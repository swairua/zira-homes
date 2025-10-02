import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header from request and extract token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the JWT token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.error('Empty token in Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token present:', !!token);

    // Create client with anon key to verify the user's JWT
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the user is authenticated by passing the token explicitly
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for data fetching (bypasses RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching sub-users for landlord:', user.id);

    // Use service role to fetch sub_users and their profiles (bypassing RLS)
    const { data: subUsers, error: subUsersError } = await supabaseService
      .from('sub_users')
      .select(`
        *,
        profiles:user_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('landlord_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (subUsersError) {
      console.error('Error fetching sub-users:', subUsersError);
      throw subUsersError;
    }

    console.log('Fetched sub-users:', subUsers?.length || 0);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: subUsers || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in list-landlord-sub-users:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});