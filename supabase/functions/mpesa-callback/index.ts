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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const callbackData = await req.json()
    console.log('=== MPESA CALLBACK RECEIVED ===');
    console.log('M-Pesa callback received:', JSON.stringify(callbackData, null, 2))

    const { Body } = callbackData
    if (!Body?.stkCallback) {
      console.log('Invalid callback format - missing Body.stkCallback')
      return new Response('OK', { status: 200 })
    }

    const { stkCallback } = Body
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback
    
    console.log('Callback details extracted:', {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      hasCallbackMetadata: !!CallbackMetadata
    });

    // Update transaction status
    const status = ResultCode === 0 ? 'completed' : 'failed'
    console.log('Processing transaction update:', { status, ResultCode });
    
    let transactionId = null
    let phoneNumber = null
    let amount = null

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      console.log('Extracting payment details from successful transaction');
      // Extract payment details from successful transaction
      const items = CallbackMetadata.Item
      
      for (const item of items) {
        if (item.Name === 'MpesaReceiptNumber') {
          transactionId = item.Value
        } else if (item.Name === 'PhoneNumber') {
          phoneNumber = item.Value
        } else if (item.Name === 'Amount') {
          amount = item.Value
        }
      }
      
      console.log('Extracted payment details:', {
        transactionId,
        phoneNumber,
        amount
      });
    }

    console.log('Updating M-Pesa transaction record for CheckoutRequestID:', CheckoutRequestID);
    
    // Update the transaction record
    const { data: transaction, error: updateError } = await supabase
      .from('mpesa_transactions')
      .update({
        status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: transactionId,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating transaction:', {
        error: updateError,
        CheckoutRequestID,
        errorMessage: updateError?.message,
        errorDetails: updateError?.details
      });
      return new Response('OK', { status: 200 })
    }

    console.log('Transaction updated successfully:', {
      id: transaction?.id,
      checkout_request_id: transaction?.checkout_request_id,
      status: transaction?.status,
      payment_type: transaction?.payment_type,
      metadata: transaction?.metadata
    });

    // If payment was successful, handle different payment types
    if (ResultCode === 0 && transaction) {
      console.log('Processing successful payment for transaction:', transaction.id);
      
      try {
        // Check if this is a service charge payment
        const isServiceCharge = transaction.payment_type === 'service-charge' || 
                               (transaction.metadata && transaction.metadata.payment_type === 'service-charge')

        console.log('Payment type determination:', {
          isServiceCharge,
          payment_type: transaction.payment_type,
          metadata: transaction.metadata
        });

        if (isServiceCharge) {
          console.log('Processing service charge payment');
          // Handle service charge payment
          const serviceChargeInvoiceId = transaction.metadata?.service_charge_invoice_id
          
          console.log('Service charge invoice ID from metadata:', serviceChargeInvoiceId);
          
          if (serviceChargeInvoiceId) {
            console.log('Fetching service charge invoice details:', serviceChargeInvoiceId);
            
            // First check if the invoice exists and get its current status
            const { data: existingInvoice, error: fetchError } = await supabase
              .from('service_charge_invoices')
              .select('id, status, landlord_id, invoice_number, total_amount')
              .eq('id', serviceChargeInvoiceId)
              .single()

            if (fetchError || !existingInvoice) {
              console.error('Service charge invoice not found during callback processing:', {
                serviceChargeInvoiceId,
                fetchError,
                errorMessage: fetchError?.message
              });
              return new Response('OK', { status: 200 })
            }

            console.log('Service charge invoice found for payment processing:', {
              id: existingInvoice.id,
              invoice_number: existingInvoice.invoice_number,
              current_status: existingInvoice.status,
              total_amount: existingInvoice.total_amount,
              landlord_id: existingInvoice.landlord_id
            });

            // Update service charge invoice status
            const { error: serviceInvoiceError } = await supabase
              .from('service_charge_invoices')
              .update({
                status: 'paid',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'M-Pesa',
                mpesa_receipt_number: transactionId,
                payment_phone_number: phoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('id', serviceChargeInvoiceId)

            if (serviceInvoiceError) {
              console.error('Error updating service charge invoice:', serviceInvoiceError)
            } else {
              console.log(`Service charge invoice ${serviceChargeInvoiceId} marked as paid`)
              
              // Send SMS confirmation for service charge payment
              try {
                const { data: serviceInvoice } = await supabase
                  .from('service_charge_invoices')
                  .select(`
                    landlord_id,
                    profiles!service_charge_invoices_landlord_id_fkey(phone, first_name, last_name)
                  `)
                  .eq('id', serviceChargeInvoiceId)
                  .single()

                if (serviceInvoice?.profiles?.phone) {
                  const smsResponse = await supabase.functions.invoke('send-sms', {
                    body: {
                      provider_name: 'InHouse SMS',
                      phone_number: serviceInvoice.profiles.phone,
                      message: `Service charge payment of KES ${amount || transaction.amount} received. Thank you! - Zira Homes. Receipt: ${transactionId}`,
                      provider_config: {
                        api_key: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
                        authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
                        username: 'ZIRA TECH',
                        sender_id: 'ZIRA TECH',
                        base_url: 'http://68.183.101.252:803/bulk_api/',
                        unique_identifier: '77',
                        sender_type: '10',
                        config_data: {
                          username: 'ZIRA TECH',
                          unique_identifier: '77',
                          sender_type: '10',
                          authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38'
                        }
                      }
                    }
                  })

                  if (smsResponse.error) {
                    console.error('Error sending service charge SMS confirmation:', smsResponse.error)
                  } else {
                    console.log('Service charge SMS confirmation sent to:', serviceInvoice.profiles.phone)
                  }
                } else {
                  console.log('No phone number found for landlord, skipping SMS')
                }
              } catch (smsError) {
                console.error('Error in service charge SMS confirmation process:', smsError)
              }
            }
          }
        } else if (transaction.invoice_id) {
          // Handle regular rent invoice payment
          const { data: invoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', transaction.invoice_id)
            .single()

          if (invoice) {
            // Check if payment already exists to prevent duplicates
            const { data: existingPayment } = await supabase
              .from('payments')
              .select('id')
              .eq('transaction_id', transactionId)
              .eq('payment_reference', CheckoutRequestID)
              .single()

            if (existingPayment) {
              console.log('Payment already exists for this transaction, skipping duplicate creation:', {
                transactionId,
                CheckoutRequestID,
                existingPaymentId: existingPayment.id
              })
              return new Response('OK', { status: 200 })
            }

            // Create payment record
            const { error: paymentError } = await supabase
              .from('payments')
              .insert({
                tenant_id: invoice.tenant_id,
                lease_id: invoice.lease_id,
                invoice_id: invoice.id,
                amount: amount || transaction.amount,
                payment_method: 'M-Pesa',
                payment_date: new Date().toISOString().split('T')[0],
                transaction_id: transactionId,
                payment_reference: CheckoutRequestID,
                payment_type: 'rent',
                status: 'completed',
                notes: `M-Pesa payment via STK Push. Receipt: ${transactionId}`
              })

            if (paymentError) {
              console.error('Error creating payment record:', paymentError)
            } else {
              // Update invoice status to paid
              const { error: invoiceError } = await supabase
                .from('invoices')
                .update({
                  status: 'paid',
                  updated_at: new Date().toISOString()
                })
                .eq('id', invoice.id)

              if (invoiceError) {
                console.error('Error updating invoice status:', invoiceError)
              } else {
                console.log(`Invoice ${invoice.id} marked as paid`)
                
                // ✅ AUTO-GENERATE SERVICE CHARGE INVOICE FOR LANDLORD
                try {
                  console.log('Starting automatic service charge invoice generation for rent payment...');
                  
                  // Get landlord ID from the property ownership
                  const { data: leaseData } = await supabase
                    .from('leases')
                    .select(`
                      unit:units!inner(
                        property:properties!inner(
                          owner_id,
                          manager_id
                        )
                      )
                    `)
                    .eq('id', invoice.lease_id)
                    .single();

                  const landlordId = leaseData?.unit?.property?.owner_id || leaseData?.unit?.property?.manager_id;
                  
                  if (landlordId) {
                    console.log('Found landlord ID:', landlordId);
                    
                    // Get current month's billing period
                    const now = new Date();
                    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    
                    // Check if service charge invoice already exists for this period
                    const { data: existingServiceInvoice } = await supabase
                      .from('service_charge_invoices')
                      .select('id, total_amount, rent_collected')
                      .eq('landlord_id', landlordId)
                      .eq('billing_period_start', billingPeriodStart)
                      .eq('billing_period_end', billingPeriodEnd)
                      .single();

                    if (existingServiceInvoice) {
                      console.log('Service charge invoice already exists, updating with new rent collection...');
                      
                      // Update existing invoice with the new rent collection
                      const updatedRentCollected = existingServiceInvoice.rent_collected + (Number(amount) || Number(transaction.amount));
                      
                      // Get landlord's billing plan to recalculate service charge
                      const { data: subscription } = await supabase
                        .from('landlord_subscriptions')
                        .select('*, billing_plan:billing_plans(*)')
                        .eq('landlord_id', landlordId)
                        .single();

                      if (subscription?.billing_plan) {
                        const plan = subscription.billing_plan;
                        let newServiceChargeAmount = 0;
                        
                        if (plan.billing_model === 'percentage' && plan.percentage_rate) {
                          newServiceChargeAmount = (updatedRentCollected * plan.percentage_rate) / 100;
                        }

                        // Update the existing invoice
                        await supabase
                          .from('service_charge_invoices')
                          .update({
                            rent_collected: updatedRentCollected,
                            service_charge_amount: newServiceChargeAmount,
                            total_amount: newServiceChargeAmount, // Simplified - add SMS/other charges if needed
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', existingServiceInvoice.id);

                        console.log('Updated existing service charge invoice with new rent collection');
                      }
                    } else {
                      console.log('No existing service charge invoice found, generating new one...');
                      
                      // Generate new service charge invoice via edge function
                      const serviceInvoiceResponse = await supabase.functions.invoke('generate-service-invoice', {
                        body: {
                          landlord_id: landlordId,
                          billing_period_start: billingPeriodStart,
                          billing_period_end: billingPeriodEnd
                        }
                      });

                      if (serviceInvoiceResponse.error) {
                        console.error('Failed to generate service charge invoice:', serviceInvoiceResponse.error);
                      } else {
                        console.log('Successfully generated service charge invoice for landlord:', landlordId);
                      }
                    }
                  } else {
                    console.log('Could not find landlord ID for automatic service charge invoice generation');
                  }
                } catch (serviceInvoiceError) {
                  console.error('Error in automatic service charge invoice generation:', serviceInvoiceError);
                  // Don't fail the main payment process if service invoice generation fails
                }
                
                // Send SMS receipt confirmation
                try {
                  // Get tenant details for SMS
                  const { data: tenant } = await supabase
                    .from('tenants')
                    .select('phone, first_name, last_name')
                    .eq('id', invoice.tenant_id)
                    .single()

                  if (tenant?.phone) {
                    // Send SMS confirmation using the send-sms function
                    const smsResponse = await supabase.functions.invoke('send-sms', {
                      body: {
                        provider_name: 'InHouse SMS',
                        phone_number: tenant.phone,
                        message: `Payment of KES ${amount || transaction.amount} received. Thank you! - Zira Homes. Receipt: ${transactionId}`,
                        provider_config: {
                          api_key: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
                          authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
                          username: 'ZIRA TECH',
                          sender_id: 'ZIRA TECH',
                          base_url: 'http://68.183.101.252:803/bulk_api/',
                          unique_identifier: '77',
                          sender_type: '10',
                          config_data: {
                            username: 'ZIRA TECH',
                            unique_identifier: '77',
                            sender_type: '10',
                            authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38'
                          }
                        }
                      }
                    })

                    if (smsResponse.error) {
                      console.error('Error sending SMS receipt confirmation:', smsResponse.error)
                    } else {
                      console.log('SMS receipt confirmation sent to:', tenant.phone)
                    }
                  } else {
                    console.log('No phone number found for tenant, skipping SMS')
                  }
                } catch (smsError) {
                  console.error('Error in SMS receipt confirmation process:', smsError)
                  // Don't fail the payment process if SMS fails
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing successful payment:', error)
      }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Error in M-Pesa callback:', error)
    return new Response('OK', { status: 200 })
  }
})