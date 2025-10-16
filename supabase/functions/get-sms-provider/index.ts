import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // SECURITY FIX: Verify user is authenticated and has admin role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify JWT token and check admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user has admin role
    const { data: hasAdminRole, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'Admin' });

    if (roleError || !hasAdminRole) {
      console.warn(`Unauthorized SMS provider access attempt by user: ${user.id}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Administrative privileges required'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Query the actual SMS providers configuration
    const { data: providers, error } = await supabase
      .from('sms_providers')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error || !providers) {
      console.log('No active default provider found');
      return new Response(JSON.stringify({
        success: false,
        error: 'No SMS provider configured',
        message: 'Please configure an SMS provider in admin settings'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Return provider data without sensitive fields
    const safeProvider = {
      id: providers.id,
      provider_name: providers.provider_name,
      sender_id: providers.sender_id,
      sender_type: providers.sender_type,
      is_active: providers.is_active,
      is_default: providers.is_default,
      // Never expose secrets to client
      has_credentials: !!(providers.authorization_token || providers.username)
    };

    return new Response(JSON.stringify({
      success: true,
      provider: safeProvider,
      message: 'Active SMS provider retrieved successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error getting SMS provider:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);