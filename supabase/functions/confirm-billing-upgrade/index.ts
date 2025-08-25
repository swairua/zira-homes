import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-BILLING-UPGRADE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Use service role key to bypass RLS for subscription updates
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { sessionId, planId } = await req.json();
    if (!sessionId || !planId) {
      throw new Error("Session ID and Plan ID are required");
    }
    logStep("Request parsed", { sessionId, planId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the checkout session to verify completion
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.status !== 'complete') {
      throw new Error("Checkout session is not complete");
    }
    logStep("Session verified as complete", { sessionId, status: session.status });

    // Get the billing plan
    const { data: plan, error: planError } = await supabaseService
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error("Billing plan not found");
    }
    logStep("Plan retrieved", { planName: plan.name });

    // Update or create the landlord subscription
    const { data: subscription, error: subscriptionError } = await supabaseService
      .from('landlord_subscriptions')
      .upsert({
        landlord_id: user.id,
        billing_plan_id: planId,
        status: 'active',
        subscription_start_date: new Date().toISOString(),
        trial_end_date: null, // End trial period
        auto_renewal: true,
        sms_credits_balance: plan.sms_credits_included || 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'landlord_id'
      })
      .select();

    if (subscriptionError) {
      logStep("Subscription update failed", { error: subscriptionError });
      throw subscriptionError;
    }
    logStep("Subscription updated successfully", { subscriptionId: subscription?.[0]?.id });

    // Log the upgrade action
    await supabaseService.rpc('log_user_activity', {
      _user_id: user.id,
      _action: 'subscription_upgrade',
      _entity_type: 'billing_plan',
      _entity_id: planId,
      _details: {
        plan_name: plan.name,
        billing_model: plan.billing_model,
        percentage_rate: plan.percentage_rate,
        stripe_session_id: sessionId
      }
    });
    logStep("Activity logged");

    return new Response(JSON.stringify({
      success: true,
      message: "Upgrade completed successfully",
      subscription: subscription?.[0]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});