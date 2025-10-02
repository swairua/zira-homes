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
    
    // Get auth header from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create client with service role for data fetching
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client with user token for authentication
    const supabaseClient = createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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