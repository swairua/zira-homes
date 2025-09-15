import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTenantAccountRequest {
  tenantData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    national_id?: string;
    employment_status?: string;
    profession?: string;
    employer_name?: string;
    monthly_income?: number;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    previous_address?: string;
  };
  unitId?: string;
  propertyId?: string;
  leaseData?: {
    monthly_rent: number;
    lease_start_date: string;
    lease_end_date: string;
    security_deposit?: number;
  };
}

const generateTemporaryPassword = (): string => {
  // Enhanced password generation for better security
  const lowercase = "abcdefghijkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNPQRSTUVWXYZ";
  const numbers = "23456789"; // Exclude 0 and 1 for clarity
  const symbols = "!@#$%&*"; // Mobile-friendly symbols
  
  let password = "";
  
  // Ensure at least one character from each category
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  // Fill remaining positions (12 total - 4 already added = 8 more)
  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = 0; i < 8; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const handler = async (req: Request): Promise<Response> => {
  console.log(`Received ${req.method} request to create-tenant-account`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log the incoming request
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create client for user authentication check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify the requesting user has permission to create tenants
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header found");
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error("Error getting user:", userError);
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const user = userData.user;

    if (!user) {
      console.error("No user found from token");
      return new Response(JSON.stringify({ error: "Unauthorized - no user found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id, user.email);

    // Check if user has permission to create tenants
    const { data: hasPermission, error: permissionError } = await supabaseAdmin.rpc('has_permission', {
      _user_id: user.id,
      _permission: 'tenant_management'
    });

    if (permissionError) {
      console.error("Error checking permissions:", permissionError);
    }

    if (!hasPermission) {
      // Also check if user has role-based access
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
        return new Response(JSON.stringify({ error: "Error checking user permissions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedRoles = ['Admin', 'Landlord', 'Manager', 'Agent'];
      const hasRoleAccess = userRoles?.some(r => allowedRoles.includes(r.role));

      if (!hasRoleAccess) {
        console.error("User lacks required permissions. User roles:", userRoles);
        return new Response(JSON.stringify({ error: "Insufficient permissions to create tenants" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request payload:", JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenantData, unitId, propertyId, leaseData }: CreateTenantAccountRequest = requestBody;

    // Validate required fields
    if (!tenantData || !tenantData.first_name || !tenantData.last_name || !tenantData.email) {
      console.error("Missing required tenant data fields:", tenantData);
      return new Response(JSON.stringify({ error: "Missing required tenant data (first_name, last_name, email)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate unit and property if provided
    if (unitId || propertyId) {
      if (!unitId || !propertyId) {
        console.error("Both unitId and propertyId must be provided if either is specified");
        return new Response(JSON.stringify({ error: "Both unitId and propertyId must be provided together" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify unit exists and belongs to property
      const { data: unitCheck, error: unitError } = await supabaseAdmin
        .from('units')
        .select('id, property_id')
        .eq('id', unitId)
        .eq('property_id', propertyId)
        .single();

      if (unitError || !unitCheck) {
        console.error("Unit validation failed:", unitError, "Unit ID:", unitId, "Property ID:", propertyId);
        return new Response(JSON.stringify({ error: "Invalid unit or property ID - unit not found or doesn't belong to specified property" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Creating tenant account for:", tenantData.email);

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Check if user already exists (use direct lookup for efficiency and reliability)
    let userId: string;
    let isNewUser = false;
    let existingAuthUser: any = null;
    try {
      const { data: userLookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(tenantData.email);
      if (lookupError) {
        console.warn("getUserByEmail failed, proceeding as new user:", lookupError);
      }
      existingAuthUser = userLookup?.user || null;
    } catch (e) {
      console.warn("getUserByEmail threw, proceeding as new user:", e);
    }

    if (existingAuthUser) {
      console.log("User already exists with email:", tenantData.email);
      userId = existingAuthUser.id;
      
      // Check if this user is already a tenant
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (existingTenant) {
        return new Response(JSON.stringify({ error: "This email is already associated with a tenant account" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: tenantData.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: tenantData.first_name,
          last_name: tenantData.last_name,
          phone: tenantData.phone,
          role: 'Tenant'
        }
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = authUser.user.id;
      isNewUser = true;
    }

    try {
      // Check if profile exists regardless of user status
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            first_name: tenantData.first_name,
            last_name: tenantData.last_name,
            email: tenantData.email,
            phone: tenantData.phone
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          throw profileError;
        }
        console.log("Profile created successfully for user:", userId);
      } else {
        // Update existing profile with any new information
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            first_name: tenantData.first_name,
            last_name: tenantData.last_name,
            phone: tenantData.phone
          })
          .eq('id', userId);

        if (profileUpdateError) {
          console.log("Profile update failed (non-critical):", profileUpdateError);
        } else {
          console.log("Profile updated successfully for user:", userId);
        }
      }

      // Assign Tenant role idempotently for both new and existing users
      const { error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'Tenant' }, { onConflict: 'user_id,role' });

      // Ignore unique constraint (already has role), but surface other errors
      if (roleInsertError && roleInsertError.code !== '23505') {
        throw roleInsertError;
      }

      // Create tenant record
      console.log("Creating tenant record for user:", userId);
      const tenantInsertData = {
        user_id: userId,
        first_name: tenantData.first_name,
        last_name: tenantData.last_name,
        email: tenantData.email,
        phone: tenantData.phone,
        national_id: tenantData.national_id,
        employment_status: tenantData.employment_status,
        profession: tenantData.profession,
        employer_name: tenantData.employer_name,
        monthly_income: tenantData.monthly_income,
        emergency_contact_name: tenantData.emergency_contact_name,
        emergency_contact_phone: tenantData.emergency_contact_phone,
        previous_address: tenantData.previous_address
      };
      
      console.log("Tenant insert data:", JSON.stringify(tenantInsertData, null, 2));
      
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .insert(tenantInsertData)
        .select()
        .single();

      if (tenantError) {
        console.error("Error creating tenant record:", tenantError);
        // Handle unique constraint (e.g., duplicate email/national_id) explicitly
        if ((tenantError as any).code === '23505') {
          return new Response(JSON.stringify({ error: "Tenant already exists", details: tenantError.message }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Failed to create tenant record: ${tenantError.message}`);
      }
      
      console.log("Tenant record created successfully:", tenant.id);

      // Create lease if unit and lease data provided
      let lease = null;
      if (unitId && leaseData) {
        console.log("Creating lease for tenant:", tenant.id, "unit:", unitId);
        
        // Validate lease data
        if (!leaseData.monthly_rent || !leaseData.lease_start_date || !leaseData.lease_end_date) {
          console.error("Missing required lease data:", leaseData);
          throw new Error("Missing required lease data (monthly_rent, lease_start_date, lease_end_date)");
        }
        
        const leaseInsertData = {
          tenant_id: tenant.id,
          unit_id: unitId,
          monthly_rent: leaseData.monthly_rent,
          lease_start_date: leaseData.lease_start_date,
          lease_end_date: leaseData.lease_end_date,
          security_deposit: leaseData.security_deposit || leaseData.monthly_rent * 2,
          status: 'active'
        };
        
        console.log("Lease insert data:", JSON.stringify(leaseInsertData, null, 2));
        
        const { data: leaseResult, error: leaseError } = await supabaseAdmin
          .from('leases')
          .insert(leaseInsertData)
          .select()
          .single();

        if (leaseError) {
          console.error("Error creating lease:", leaseError);
          throw new Error(`Failed to create lease: ${leaseError.message}`);
        }
        
        lease = leaseResult;
        console.log("Lease created successfully:", lease.id);

        // Update unit status to occupied
        const { error: unitUpdateError } = await supabaseAdmin
          .from('units')
          .update({ status: 'occupied' })
          .eq('id', unitId);
          
        if (unitUpdateError) {
          console.error("Error updating unit status:", unitUpdateError);
          // Don't throw here as the lease was created successfully
        } else {
          console.log("Unit status updated to occupied for unit:", unitId);
        }
      }

      // Get property and unit info for welcome email
      let propertyInfo = null;
      let unitInfo = null;
      
      if (unitId) {
        const { data: unitData } = await supabaseAdmin
          .from('units')
          .select(`
            unit_number,
            properties (
              name
            )
          `)
          .eq('id', unitId)
          .single();
        
        if (unitData) {
          unitInfo = unitData;
          propertyInfo = unitData.properties;
        }
      }

      // Get communication preferences
      let commPrefs = { email_enabled: true, sms_enabled: false };
      
      try {
        const { data: commPref } = await supabaseAdmin
          .from('communication_preferences')
          .select('email_enabled, sms_enabled')
          .eq('setting_name', 'user_account_creation')
          .single();
        
        if (commPref) {
          commPrefs = commPref;
        }
      } catch (prefError) {
        console.log("Using default communication preferences");
      }

      // Initialize communication status
      let emailSent = false;
      let smsSent = false;
      let communicationErrors = [];

      // Send welcome email if enabled
      if (commPrefs.email_enabled) {
        try {
          console.log("Sending welcome email...");
          const loginUrl = `${req.headers.get("origin")}/auth`;
          
          const emailBody = isNewUser ? {
            tenantEmail: tenantData.email,
            tenantName: `${tenantData.first_name} ${tenantData.last_name}`,
            propertyName: propertyInfo?.name || "Your Property",
            unitNumber: unitInfo?.unit_number || "N/A",
            temporaryPassword,
            loginUrl
          } : {
            tenantEmail: tenantData.email,
            tenantName: `${tenantData.first_name} ${tenantData.last_name}`,
            propertyName: propertyInfo?.name || "Your Property",
            unitNumber: unitInfo?.unit_number || "N/A",
            temporaryPassword: null, // Don't send temp password for existing users
            loginUrl
          };
          
          const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
            body: emailBody
          });

          if (emailError) {
            console.error("Error sending welcome email:", emailError);
            communicationErrors.push(`Email failed: ${emailError.message}`);
          } else {
            console.log("Welcome email sent successfully");
            emailSent = true;
          }
        } catch (emailErr) {
          console.error("Failed to send welcome email:", emailErr);
          communicationErrors.push(`Email failed: ${emailErr.message}`);
        }
      }

      // Get SMS provider configuration before attempting to send SMS
      let smsConfig = null;
      if (commPrefs.sms_enabled) {
        try {
          const { data: providerData } = await supabaseAdmin
            .from('sms_providers')
            .select('*')
            .eq('is_active', true)
            .eq('is_default', true)
            .single();
          
          smsConfig = providerData;
        } catch (err) {
          console.log("No SMS provider configured, using fallback config");
          // Fallback configuration for InHouse SMS
          smsConfig = {
            provider_name: "InHouse SMS",
            base_url: "http://68.183.101.252:803/bulk_api/",
            username: "ZIRA TECH",
            unique_identifier: "77",
            sender_id: "ZIRA TECH",
            sender_type: "10",
            authorization_token: "your-default-token"
          };
        }
      }

      // Send SMS with login credentials if enabled
      if (commPrefs.sms_enabled && tenantData.phone && smsConfig) {
        try {
          console.log(`Sending welcome SMS to: ${tenantData.phone}`);
          const loginUrl = `${req.headers.get("origin")}/auth`;
          
          // Enhanced SMS message template
          const smsMessage = `Welcome to Zira Homes!\n\nYour login details:\nEmail: ${tenantData.email}\nPassword: ${temporaryPassword}\nLogin: ${loginUrl}\n\nPlease change your password after first login.\n\nSupport: +254 757 878 023`;

          const { data: smsData, error: smsError } = await supabaseAdmin.functions.invoke('send-sms', {
            body: {
              provider_name: smsConfig.provider_name || 'InHouse SMS',
              phone_number: tenantData.phone,
              message: smsMessage,
              landlord_id: user.id,
              provider_config: {
                base_url: smsConfig.base_url,
                username: smsConfig.username,
                unique_identifier: smsConfig.unique_identifier,
                sender_id: smsConfig.sender_id,
                sender_type: smsConfig.sender_type,
                authorization_token: smsConfig.authorization_token,
                config_data: smsConfig.config_data
              }
            }
          });

          if (smsError) {
            console.error("Error sending welcome SMS:", smsError);
            communicationErrors.push(`SMS delivery failed: ${smsError.message}`);
            
            // Retry logic for failed SMS
            console.log("Attempting SMS retry...");
            try {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              const retryResult = await supabaseAdmin.functions.invoke('send-sms', {
                body: {
                  provider_name: smsConfig.provider_name || 'InHouse SMS',
                  phone_number: tenantData.phone,
                  message: smsMessage,
                  landlord_id: user.id,
                  provider_config: {
                    base_url: smsConfig.base_url,
                    username: smsConfig.username,
                    unique_identifier: smsConfig.unique_identifier,
                    sender_id: smsConfig.sender_id,
                    sender_type: smsConfig.sender_type,
                    authorization_token: smsConfig.authorization_token,
                    config_data: smsConfig.config_data
                  }
                }
              });
              
              if (!retryResult.error) {
                console.log("SMS retry successful");
                smsSent = true;
                communicationErrors = communicationErrors.filter(err => err.includes('SMS delivery failed'));
              }
            } catch (retryErr) {
              console.error("SMS retry also failed:", retryErr);
            }
          } else {
            console.log(`Welcome SMS sent successfully to: ${tenantData.phone}`);
            smsSent = true;
          }
        } catch (smsErr) {
          console.error("Failed to send welcome SMS:", smsErr);
          communicationErrors.push(`SMS system error: ${smsErr.message}`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        tenant,
        lease,
        temporaryPassword: isNewUser ? temporaryPassword : null, // Only return for new users
        isNewUser,
        communicationStatus: {
          emailSent,
          smsSent,
          errors: communicationErrors
        },
        // Include login details with appropriate messaging  
        loginDetails: {
          email: tenantData.email,
          temporaryPassword: isNewUser ? temporaryPassword : null,
          loginUrl: `${req.headers.get("origin")}/auth`,
          instructions: isNewUser 
            ? "Share these credentials with the tenant and ask them to change their password on first login."
            : "The tenant can use their existing credentials to log in."
        },
        message: isNewUser 
          ? "Tenant account created successfully with new login credentials."
          : "Tenant account created successfully. User already had an account."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      // If anything fails after user creation, clean up the auth user (only for new users)
      console.error("Error in tenant creation process:", error);
      if (isNewUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw error;
    }

  } catch (error: any) {
    console.error("Top-level error creating tenant account:", error);
    console.error("Error stack:", error.stack);
    
    // Return detailed error information
    const errorMessage = error.message || "Unknown error occurred";
    const errorDetails = {
      success: false,
      error: errorMessage,
      errorCode: error.code || "UNKNOWN_ERROR",
      timestamp: new Date().toISOString()
    };
    
    console.error("Returning error response:", JSON.stringify(errorDetails, null, 2));
    
    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
