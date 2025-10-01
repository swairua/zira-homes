import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSubUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set', success: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user (landlord)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header provided', success: false }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: landlord }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !landlord) {
      console.error('Auth getUser failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message || null, success: false }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if the user is a landlord
    const { data: hasLandlordRole, error: roleCheckError } = await supabase
      .rpc('has_role', { _user_id: landlord.id, _role: 'Landlord' });

    if (roleCheckError || !hasLandlordRole) {
      console.error('Role check failed or user is not a landlord:', roleCheckError);
      return new Response(JSON.stringify({ error: 'Only landlords can create sub-users', details: roleCheckError?.message || null, success: false }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requestData: CreateSubUserRequest = await req.json();
    const { email, first_name, last_name, phone, title, permissions } = requestData;

    console.log('Creating sub-user:', { email, first_name, last_name });

    // Check if user already exists by email
    const { data: existingUserData } = await supabase.rpc('find_user_by_email', { _email: email });
    const existingUser = existingUserData?.[0];

    let userId: string;
    let isNewUser = false;
    let tempPassword: string | null = null;

    if (existingUser?.user_id) {
      console.log('User already exists with email:', email);
      userId = existingUser.user_id;

      // Check if this user is already an active sub-user for this landlord
      const { data: existingSubUser } = await supabase
        .from('sub_users')
        .select('id, status')
        .eq('landlord_id', landlord.id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (existingSubUser) {
        throw new Error('This email is already associated with an active sub-user for your organization');
      }

      // Update existing profile with new information if provided
      if (existingUser.has_profile) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            first_name: first_name || existingUser.first_name,
            last_name: last_name || existingUser.last_name,
            phone: phone || existingUser.phone
          })
          .eq('id', userId);

        if (profileUpdateError) {
          console.warn('Profile update failed (non-critical):', profileUpdateError);
        }
      }
    } else {
      // Create new auth user
      tempPassword = `TempPass${Math.floor(Math.random() * 10000)}!`;
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          phone,
          created_by: landlord.id,
          role: 'sub_user'
        }
      });

      if (createUserError || !newUser.user) {
        console.error('Error creating auth user:', createUserError);
        throw new Error(`Failed to create user account: ${createUserError?.message}`);
      }

      userId = newUser.user.id;
      isNewUser = true;
      console.log('New auth user created:', userId);

      // Create profile record for new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          first_name,
          last_name,
          email,
          phone: phone || null
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        await supabase.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      console.log('Profile created for user:', userId);
    }

    // Create the sub-user record
    const { error: subUserError } = await supabase
      .from('sub_users')
      .insert({
        landlord_id: landlord.id,
        user_id: userId,
        title,
        permissions,
        status: 'active'
      });

    if (subUserError) {
      console.error('Error creating sub-user:', subUserError);
      if (isNewUser) {
        // Clean up user and profile if sub-user creation fails for new user
        await supabase.auth.admin.deleteUser(userId);
        await supabase.from('profiles').delete().eq('id', userId);
      }
      throw new Error(`Failed to create sub-user record: ${subUserError.message}`);
    }

    console.log('Sub-user record created');
    
    const responseMessage = isNewUser 
      ? 'Sub-user created successfully with new account'
      : 'Sub-user created successfully with existing account';
    
    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        user_id: userId,
        temporary_password: tempPassword,
        instructions: tempPassword 
          ? 'The user should change their password on first login'
          : 'The user can log in with their existing credentials'
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in create-sub-user function:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = (error && (error as any).status) || 500;
    return new Response(
      JSON.stringify({
        error: message,
        success: false,
        details: (error as any)?.details || null
      }),
      {
        status: typeof status === 'number' ? status : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

serve(handler);
