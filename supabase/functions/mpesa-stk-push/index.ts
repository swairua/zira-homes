
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Initialize admin client for service charge invoice validation (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phone, amount, accountReference, transactionDesc, invoiceId, paymentType, landlordId, dryRun } = await req.json()

    console.log('=== MPESA STK PUSH REQUEST START ===');
    console.log('Request payload:', {
      phone,
      amount,
      accountReference,
      transactionDesc,
      invoiceId,
      paymentType,
      landlordId,
      dryRun,
      timestamp: new Date().toISOString()
    });

    if (!phone || !amount) {
      console.error('Missing required fields:', { phone: !!phone, amount: !!amount });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, amount' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If this is a dry run, return mock success response
    if (dryRun) {
      console.log('DRY RUN: Mock STK push response');
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: 'Mock STK push - no actual payment initiated',
          data: {
            CheckoutRequestID: 'mock-checkout-' + Date.now(),
            MerchantRequestID: 'mock-merchant-' + Date.now(),
            ResponseDescription: 'Mock STK push sent successfully',
            BusinessShortCode: shortcode || '174379',
            UsingLandlordConfig: false
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Try to get landlord-specific M-Pesa config first
    let landlordConfigId = landlordId;
    
    // If no landlordId provided, try to get it from invoice
    if (!landlordConfigId && invoiceId) {
      const { data: invoiceData } = await supabaseAdmin
        .from('invoices')
        .select(`
          lease_id,
          leases!inner(
            unit_id,
            units!inner(
              property_id,
              properties!inner(owner_id)
            )
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceData?.leases?.units?.properties?.owner_id) {
        landlordConfigId = invoiceData.leases.units.properties.owner_id;
      }
    }

    let mpesaConfig = null;
    if (landlordConfigId) {
      const { data: config } = await supabaseAdmin
        .from('landlord_mpesa_configs')
        .select('*')
        .eq('landlord_id', landlordConfigId)
        .eq('is_active', true)
        .maybeSingle();
      
      mpesaConfig = config;
      console.log('Landlord M-Pesa config found:', !!mpesaConfig);
    }

    // M-Pesa credentials - use landlord config or fallback to environment
    const consumerKey = mpesaConfig?.consumer_key || Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = mpesaConfig?.consumer_secret || Deno.env.get('MPESA_CONSUMER_SECRET');
    const shortcode = mpesaConfig?.business_shortcode || Deno.env.get('MPESA_SHORTCODE') || '174379';
    const passkey = mpesaConfig?.passkey || Deno.env.get('MPESA_PASSKEY');
    const environment = mpesaConfig?.environment || Deno.env.get('MPESA_ENVIRONMENT') || 'sandbox';

    console.log('M-Pesa Environment Check:', {
      hasConsumerKey: !!consumerKey,
      hasConsumerSecret: !!consumerSecret,
      shortcode,
      hasPasskey: !!passkey,
      environment,
      usingLandlordConfig: !!mpesaConfig
    })

    if (!consumerKey || !consumerSecret || !passkey) {
      console.error('Missing M-Pesa credentials:', {
        missingConsumerKey: !consumerKey,
        missingConsumerSecret: !consumerSecret,
        missingPasskey: !passkey
      })
      return new Response(
        JSON.stringify({ 
          error: 'M-Pesa configuration incomplete. Please configure M-Pesa credentials.',
          missing: {
            consumerKey: !consumerKey,
            consumerSecret: !consumerSecret,
            passkey: !passkey
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get OAuth token
    const authUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'

    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`
      }
    })

    const authData = await authResponse.json()
    
    if (!authData.access_token) {
      console.error('Failed to get M-Pesa token:', authData)
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with M-Pesa' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)

    // Format phone number
    let phoneNumber = phone.toString().replace(/\D/g, '')
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.slice(1)
    } else if (!phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber
    }

    // STK Push request
    const stkUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'

    // Use custom callback URL if provided in config
    const callbackUrl = mpesaConfig?.callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference || (paymentType === 'service-charge' ? 'ZIRA-SERVICE' : `INV-${invoiceId}`),
      TransactionDesc: transactionDesc || (paymentType === 'service-charge' ? 'Zira Homes Service Charge' : 'Payment for ' + (accountReference || `INV-${invoiceId}`))
    }

    console.log('STK Push payload:', JSON.stringify(stkPayload, null, 2))

    const stkResponse = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    })

    const stkData = await stkResponse.json()
    console.log('STK Push response:', JSON.stringify(stkData, null, 2))

    if (stkData.ResponseCode === '0') {
      // Store the transaction in database
      const transactionData = {
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        created_at: new Date().toISOString(),
        payment_type: paymentType || 'rent'
      }

      // Only add invoice_id if it's a valid UUID (for rent payments)
      if (invoiceId && paymentType !== 'service-charge') {
        transactionData.invoice_id = invoiceId
      }

      // For service charge payments, store additional metadata
      if (paymentType === 'service-charge') {
        console.log('Processing service charge payment, validating invoice:', invoiceId);
        
        // Validate that the service charge invoice exists before processing
        if (invoiceId) {
          // Use admin client to bypass RLS for invoice validation
          const { data: serviceInvoice, error: invoiceCheckError } = await supabaseAdmin
            .from('service_charge_invoices')
            .select('id, status, invoice_number, total_amount, landlord_id')
            .eq('id', invoiceId)
            .maybeSingle()

          if (invoiceCheckError || !serviceInvoice) {
            console.error('Service charge invoice validation failed:', {
              invoiceId,
              error: invoiceCheckError,
              errorDetails: invoiceCheckError?.details,
              errorMessage: invoiceCheckError?.message
            });
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Service charge invoice not found',
                invoiceId: invoiceId,
                details: invoiceCheckError?.message
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }

          console.log('Service charge invoice validated successfully:', {
            id: serviceInvoice.id,
            invoice_number: serviceInvoice.invoice_number,
            status: serviceInvoice.status,
            total_amount: serviceInvoice.total_amount,
            landlord_id: serviceInvoice.landlord_id
          });

          if (serviceInvoice.status === 'paid') {
            console.warn('Service charge invoice already paid:', serviceInvoice.id);
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Service charge invoice already paid',
                invoiceId: invoiceId
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        }

        transactionData.metadata = {
          service_charge_invoice_id: invoiceId,
          payment_type: 'service-charge',
          landlord_id: landlordConfigId
        }
        console.log('Service charge metadata added to transaction:', transactionData.metadata);
      }

      console.log('Creating M-Pesa transaction record:', {
        checkout_request_id: transactionData.checkout_request_id,
        merchant_request_id: transactionData.merchant_request_id,
        phone_number: transactionData.phone_number,
        amount: transactionData.amount,
        payment_type: transactionData.payment_type,
        metadata: transactionData.metadata
      });

      const { error: dbError } = await supabase
        .from('mpesa_transactions')
        .insert(transactionData)

      if (dbError) {
        console.error('Database transaction insertion error:', {
          error: dbError,
          errorMessage: dbError?.message,
          errorDetails: dbError?.details,
          transactionData
        });
      } else {
        console.log('M-Pesa transaction record created successfully:', transactionData.checkout_request_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'STK push sent successfully',
          data: {
            CheckoutRequestID: stkData.CheckoutRequestID,
            MerchantRequestID: stkData.MerchantRequestID,
            ResponseDescription: stkData.ResponseDescription,
            BusinessShortCode: shortcode,
            UsingLandlordConfig: !!mpesaConfig
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.error('STK Push failed:', stkData)
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.ResponseDescription || 'STK push failed',
          data: stkData
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Error in STK push:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
