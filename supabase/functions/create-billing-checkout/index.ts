import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BILLING-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client using anon key for authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body to get billing plan details
    const { planId, phoneNumber } = await req.json();
    if (!planId) throw new Error("Plan ID is required");
    logStep("Request parsed", { planId, hasPhoneNumber: !!phoneNumber });

    // Get billing plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error("Billing plan not found or inactive");
    }
    logStep("Billing plan retrieved", { planName: plan.name, price: plan.price });

    // For commission-based plans (percentage billing), activate directly
    if (plan.billing_model === 'percentage') {
      logStep("Commission-based plan detected, no payment required");
      return new Response(JSON.stringify({
        type: 'direct_activation',
        message: 'Plan activated successfully',
        requiresPayment: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For fixed pricing or other models, require M-Pesa payment via STK push
    // Phone number is required for M-Pesa STK push
    if (!phoneNumber) {
      throw new Error("Phone number is required for M-Pesa payment. Please provide a phone number registered with M-Pesa.");
    }

    logStep("M-Pesa payment required", { phoneNumber: phoneNumber.slice(-4) });

    // Format phone number for M-Pesa (ensure it starts with 254)
    let formattedPhone = phoneNumber.replace(/^0/, '254').replace(/[^\d]/g, '');
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Create a temporary transaction record for this upgrade attempt
    const { data: transaction, error: txnError } = await supabaseClient
      .from('mpesa_transactions')
      .insert({
        user_id: user.id,
        amount: plan.price,
        phone_number: formattedPhone,
        payment_type: 'plan_upgrade',
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
          billing_model: plan.billing_model
        }
      })
      .select()
      .single();

    if (txnError) {
      logStep("Failed to create transaction record", { error: txnError });
      throw new Error("Failed to initialize payment transaction");
    }

    logStep("Transaction record created", { transactionId: transaction.id });

    // Return M-Pesa payment details (STK push will be initiated on client side)
    return new Response(JSON.stringify({
      type: 'mpesa_payment',
      requiresPayment: true,
      transactionId: transaction.id,
      planId: planId,
      amount: plan.price,
      currency: plan.currency,
      phoneNumber: formattedPhone,
      message: `You will receive an M-Pesa prompt to pay ${plan.currency} ${plan.price} for the ${plan.name} plan.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    console.error("Full error object:", error);
    return new Response(JSON.stringify({
      error: errorMessage,
      details: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
