import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_id?: string;
  related_type?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, message, type, related_id, related_type }: NotificationEmailRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's notification preferences
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("email_enabled, sms_enabled")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefError && prefError.code !== 'PGRST116') {
      console.error("Error fetching preferences:", prefError);
    }

    // Get user's profile for email/phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, phone, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    const responses = [];

    // Send email notification if enabled
    if (preferences?.email_enabled !== false && profile.email) {
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-notification-email', {
          body: {
            to: profile.email,
            to_name: `${profile.first_name} ${profile.last_name}`,
            subject: title,
            title,
            message,
            type,
            related_id,
            related_type
          }
        });

        if (emailError) {
          console.error("Email notification error:", emailError);
        } else {
          responses.push({ channel: "email", success: true, data: emailData });
        }
      } catch (error) {
        console.error("Email notification failed:", error);
        responses.push({ channel: "email", success: false, error: error.message });
      }
    }

    // Send SMS notification if enabled
    if (preferences?.sms_enabled && profile.phone) {
      try {
        const smsMessage = `${title}: ${message}`;
        const { data: smsData, error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            to: profile.phone,
            message: smsMessage,
            user_id: user_id
          }
        });

        if (smsError) {
          console.error("SMS notification error:", smsError);
        } else {
          responses.push({ channel: "sms", success: true, data: smsData });
        }
      } catch (error) {
        console.error("SMS notification failed:", error);
        responses.push({ channel: "sms", success: false, error: error.message });
      }
    }

    // Log the notification delivery
    await supabase
      .from("notification_logs")
      .insert({
        user_id,
        notification_type: type,
        message: title,
        status: responses.some(r => r.success) ? "sent" : "failed",
        sent_at: responses.some(r => r.success) ? new Date().toISOString() : null,
        error_message: responses.filter(r => !r.success).map(r => r.error).join("; ") || null
      });

    return new Response(JSON.stringify({
      success: true,
      notifications_sent: responses.length,
      responses
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);