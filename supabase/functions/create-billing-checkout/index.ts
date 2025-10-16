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

    // Get billing plan details - select only specific columns to avoid serialization issues
    const { data: plan, error: planError } = await supabaseClient
      .from('billing_plans')
      .select('id, name, price, billing_model, currency, sms_credits_included, is_active, is_custom, contact_link')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      logStep("Plan query error", { planError: planError?.message, planExists: !!plan });
      throw new Error(`Billing plan not found or inactive: ${planError?.message || 'No plan found'}`);
    }
    logStep("Billing plan retrieved", { planName: plan.name, price: plan.price, billingModel: plan.billing_model });

    // Provide defaults for missing columns to maintain backward compatibility
    const billingModel = plan.billing_model || 'fixed';
    const currency = plan.currency || 'KES';

    // For commission-based plans (percentage billing), activate directly
    if (billingModel === 'percentage') {
      logStep("Commission-based plan detected, no payment required");
      return new Response(JSON.stringify({
        type: 'direct_activation',
        message: 'Plan activated successfully',
        requiresPayment: false,
        planId: planId,
        planName: plan.name
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For fixed pricing or other models, require M-Pesa payment via STK push
    // Phone number is required for M-Pesa STK push
    if (!phoneNumber || phoneNumber.trim().length < 9) {
      throw new Error("Phone number is required for M-Pesa payment. Please provide a valid phone number.");
    }

    logStep("M-Pesa payment required", { phoneNumber: phoneNumber.slice(-4) });

    // Format phone number for M-Pesa (ensure it starts with 254)
    let formattedPhone = phoneNumber.replace(/^0/, '254').replace(/[^\d]/g, '');
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Validate formatted phone number length (Kenya numbers should be 254 + 9 digits = 12 chars)
    if (formattedPhone.length < 12 || formattedPhone.length > 15) {
      throw new Error("Invalid phone number format. Please use a valid Kenyan phone number.");
    }

    logStep("Phone number formatted", { formattedPhone: formattedPhone.slice(-4) });

    // Return M-Pesa payment details (STK push will be initiated on client side)
    // Transaction record will be created by mpesa-stk-push function when it has the checkout_request_id
    return new Response(JSON.stringify({
      type: 'mpesa_payment',
      requiresPayment: true,
      planId: planId,
      planName: plan.name,
      amount: parseFloat(plan.price as any),
      currency: currency,
      phoneNumber: formattedPhone,
      message: `You will receive an M-Pesa prompt to pay ${currency} ${plan.price} for the ${plan.name} plan.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    // Log detailed error information for debugging
    logStep("ERROR", {
      message: errorMessage,
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    });
    console.error("Full error details:", {
      message: errorMessage,
      stack: errorStack,
      error: error
    });

    return new Response(JSON.stringify({
      error: errorMessage,
      details: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
