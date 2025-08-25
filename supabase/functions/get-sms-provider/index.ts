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

    // Query the actual SMS providers configuration
    const { data: providers, error } = await supabase
      .from('sms_providers')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error || !providers) {
      console.log('No active default provider found, using fallback');
      // Fallback to mock provider
      const mockProvider = {
        provider_name: 'InHouse SMS',
        is_active: true,
        is_default: true,
        config_data: {
          username: 'ZIRA TECH',
          authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
          unique_identifier: '77',
          sender_id: 'ZIRA TECH',
          sender_type: '10',
          base_url: 'http://68.183.101.252:803/bulk_api/'
        }
      };

      return new Response(JSON.stringify({
        success: true,
        provider: mockProvider,
        message: 'Fallback SMS provider retrieved successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      provider: providers,
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