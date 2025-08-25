import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { email, redirectTo }: PasswordResetRequest = await req.json();

    console.log("Processing password reset for:", email);

    // Get communication preferences
    let emailEnabled = true;
    let smsEnabled = false;
    
    try {
      const { data: commPref } = await supabaseAdmin
        .from('communication_preferences')
        .select('email_enabled, sms_enabled')
        .eq('setting_name', 'password_reset')
        .single();
      
      if (commPref) {
        emailEnabled = commPref.email_enabled;
        smsEnabled = commPref.sms_enabled;
      }
    } catch (prefError) {
      console.log("Using default communication preferences");
    }

    // Get user profile and phone number
    let userProfile = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('email', email)
        .single();
      
      userProfile = profile;
    } catch (profileError) {
      console.log("Could not fetch user profile");
    }

    let results = {
      email_sent: false,
      sms_sent: false,
      error: null as string | null
    };

    // Send email reset if enabled
    if (emailEnabled) {
      try {
        const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo || `${req.headers.get("origin")}/auth?type=recovery`
        });

        if (emailError) {
          throw emailError;
        }

        results.email_sent = true;
        console.log("Password reset email sent to:", email);
      } catch (emailError: any) {
        console.error("Error sending password reset email:", emailError);
        results.error = emailError.message;
      }
    }

    // Send SMS notification if enabled and phone available
    if (smsEnabled && userProfile?.phone) {
      try {
        const resetUrl = redirectTo || `${req.headers.get("origin")}/auth?type=recovery`;
        const smsMessage = `Hi ${userProfile.first_name || 'User'}, a password reset was requested for your Zira Homes account. If this wasn't you, please contact support. Reset link sent to your email.`;
        
        await supabaseAdmin.functions.invoke('send-sms', {
          body: {
            provider_name: 'InHouse SMS',
            phone_number: userProfile.phone,
            message: smsMessage
          }
        });
        
        results.sms_sent = true;
        console.log("Password reset SMS sent to:", userProfile.phone);
      } catch (smsError: any) {
        console.error("Error sending password reset SMS:", smsError);
        // Don't override email error with SMS error
        if (!results.error) {
          results.error = `SMS failed: ${smsError.message}`;
        }
      }
    }

    // Determine response message
    let message = "Password reset processed.";
    if (results.email_sent && results.sms_sent) {
      message = "Password reset instructions sent via email and SMS.";
    } else if (results.email_sent) {
      message = "Password reset instructions sent to your email.";
    } else if (results.sms_sent) {
      message = "Password reset notification sent via SMS. Check your email for reset instructions.";
    } else if (results.error) {
      message = `Password reset failed: ${results.error}`;
    }

    return new Response(JSON.stringify({
      success: results.email_sent || results.sms_sent,
      message,
      details: results
    }), {
      status: results.email_sent || results.sms_sent ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in password reset function:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);