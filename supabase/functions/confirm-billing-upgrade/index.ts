import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    const { transactionId, planId } = await req.json();
    if (!transactionId || !planId) {
      throw new Error("Transaction ID and Plan ID are required");
    }
    logStep("Request parsed", { transactionId, planId });

    // Get the transaction to verify payment was successful
    const { data: transaction, error: txnError } = await supabaseService
      .from('mpesa_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txnError || !transaction) {
      throw new Error("Transaction not found");
    }
    logStep("Transaction retrieved", { status: transaction.status });

    // Verify transaction is completed
    if (transaction.status !== 'completed') {
      throw new Error(`Payment not completed. Current status: ${transaction.status}`);
    }

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
        trial_end_date: null,
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
        payment_method: 'mpesa',
        transaction_id: transactionId,
        mpesa_receipt: transaction.mpesa_receipt_number
      }
    });
    logStep("Activity logged");

    // Update the transaction metadata to link it to the subscription
    await supabaseService
      .from('mpesa_transactions')
      .update({
        metadata: {
          ...transaction.metadata,
          subscription_id: subscription?.[0]?.id,
          plan_name: plan.name,
          upgraded_at: new Date().toISOString()
        }
      })
      .eq('id', transactionId);

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
