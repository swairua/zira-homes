import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { email, password, firstName, lastName, role } = await req.json();

    console.log(`Creating admin user: ${email}`);

    // Create the user with admin privileges
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        email: email,
        email_verified: true
      },
      email_confirm: true // Auto-confirm email
    });

    if (authError) {
      console.error("Error creating user:", authError);
      throw authError;
    }

    console.log("User created successfully:", authData.user?.id);

    // The user profile will be created automatically by the trigger
    // The role will be assigned by the trigger based on user_metadata

    // Log the admin user creation activity
    if (authData.user) {
      await supabaseAdmin.rpc('log_user_activity', {
        _user_id: authData.user.id,
        _action: 'admin_user_created',
        _entity_type: 'user',
        _entity_id: authData.user.id,
        _details: JSON.stringify({
          created_by: 'system',
          email: email,
          role: role,
          auto_confirmed: true
        })
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          role: role
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in create-admin-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});