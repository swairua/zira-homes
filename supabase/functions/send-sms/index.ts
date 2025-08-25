import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  provider_name: string;
  phone_number: string;
  message: string;
  landlord_id?: string;
  provider_config: {
    api_key?: string;
    authorization_token?: string;
    username?: string;
    sender_id?: string;
    base_url?: string;
    unique_identifier?: string;
    sender_type?: string;
    config_data?: Record<string, any>;
  };
}

// Sanitize text for GSM-7 compatible SMS (remove/replace unsupported characters)
function sanitizeForSMS(input: string): string {
  if (!input) return '';
  let s = input;
  // Normalize quotes and dashes
  s = s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // double quotes
    .replace(/[\u2013\u2014\u2015]/g, '-') // dashes
    .replace(/\u00A0/g, ' '); // non-breaking space
  // Remove emojis and any non-ASCII except newline
  s = s.replace(/[^\x20-\x7E\n]/g, '');
  // Collapse excessive spaces and trim lines
  s = s
    .split('\n')
    .map(line => line.replace(/\s{2,}/g, ' ').trimEnd())
    .join('\n');
  return s.trim();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_name, phone_number, message, landlord_id, provider_config }: SMSRequest = await req.json();

    const sanitizedMessage = sanitizeForSMS(message || "");

    console.log('SMS Request:', { provider_name, phone_number, preview: sanitizedMessage.substring(0, 50) + '...' });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let smsResponse;
    let smsStatus = 'pending';
    let smsCost = 2.50; // Default cost per SMS in KES

    try {
      switch (provider_name.toLowerCase()) {
        case 'inhouse sms':
          smsResponse = await sendInHouseSMS(phone_number, sanitizedMessage, provider_config);
          smsStatus = 'sent';
          break;
        case 'twilio':
          smsResponse = await sendTwilioSMS(phone_number, sanitizedMessage, provider_config);
          smsStatus = 'sent';
          break;
        case "africa's talking":
          smsResponse = await sendAfricasTalkingSMS(phone_number, sanitizedMessage, provider_config);
          smsStatus = 'sent';
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${provider_name}`);
      }
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
      smsStatus = 'failed';
      throw smsError;
    }

    // Record SMS usage in database if landlord_id is provided
    if (landlord_id) {
      try {
        const { error: usageError } = await supabase
          .from('sms_usage_logs')
          .insert({
            landlord_id,
            recipient_phone: phone_number,
            message_content: sanitizedMessage,
            provider_name: provider_name,
            cost: smsCost,
            status: smsStatus,
            sent_at: new Date().toISOString(),
            delivery_status: smsStatus === 'sent' ? 'delivered' : 'failed',
            error_message: smsStatus === 'failed' ? 'SMS delivery failed' : null,
            metadata: { provider_config: provider_config }
          });

        if (usageError) {
          console.error('Error recording SMS usage:', usageError);
        } else {
          console.log('SMS usage recorded successfully');
        }
      } catch (dbError) {
        console.error('Database error while recording SMS usage:', dbError);
      }
    }

    console.log('SMS sent successfully:', smsResponse);

    return new Response(JSON.stringify({
      success: true,
      provider: provider_name,
      message: 'SMS sent successfully',
      cost: smsCost,
      response: smsResponse
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    
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

async function sendInHouseSMS(phone: string, message: string, config: any) {
  const url = config.base_url || 'http://68.183.101.252:803/bulk_api/';
  
  // Enhanced phone number validation and formatting
  let formattedPhone = phone.replace(/\D/g, '');
  
  // Validate phone number format
  if (formattedPhone.length < 9) {
    throw new Error(`Invalid phone number format: ${phone}. Must be at least 9 digits.`);
  }
  
  // Convert different Kenyan formats to international format
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1); // Convert 07XX to 2547XX
  } else if (formattedPhone.startsWith('7') && formattedPhone.length === 9) {
    formattedPhone = '254' + formattedPhone; // Convert 7XX to 2547XX
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }
  
  // Validate final format
  if (!formattedPhone.startsWith('254') || formattedPhone.length !== 12) {
    throw new Error(`Invalid Kenyan phone number: ${phone}. Expected format: +254XXXXXXXXX`);
  }

  // Validate message length (SMS limit is typically 160 characters for single SMS)
  if (message.length > 320) { // Allow up to 2 SMS segments
    console.warn(`SMS message is ${message.length} characters, may be split into multiple segments`);
  }

  const dataSet = [
    {
      username: config.username || config.config_data?.username || 'ZIRA TECH',
      phone_number: formattedPhone,
      unique_identifier: config.unique_identifier || config.config_data?.unique_identifier || '77',
      sender_name: config.sender_id || 'ZIRA TECH',
      message: message,
      sender_type: parseInt(config.sender_type || config.config_data?.sender_type || '10')
    }
  ];

  const requestBody = {
    dataSet: dataSet,
    timeStamp: Math.floor(Date.now() / 1000)
  };

  // Enhanced authentication token handling
  const authToken = config.authorization_token || config.api_key || config.config_data?.authorization_token;
  if (!authToken || authToken === 'your-default-token') {
    throw new Error('Valid SMS provider authentication token is required. Please configure your SMS provider properly.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Token ${authToken}`,
    'User-Agent': 'Zira-Homes-SMS-Service/1.0'
  };

  console.log('InHouse SMS Request:', {
    url,
    phone: formattedPhone,
    messageLength: message.length,
    headers: { ...headers, Authorization: 'Token ***' },
    bodySize: JSON.stringify(requestBody).length
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('InHouse SMS Response:', {
      status: response.status,
      statusText: response.statusText,
      bodySize: responseText.length,
      body: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
    });

    if (!response.ok) {
      // Enhanced error messages based on common HTTP status codes
      let errorMessage = `InHouse SMS API error: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorMessage += ' - Unauthorized: Check your authentication token';
          break;
        case 403:
          errorMessage += ' - Forbidden: Insufficient permissions';
          break;
        case 404:
          errorMessage += ' - Not Found: Check API endpoint URL';
          break;
        case 429:
          errorMessage += ' - Rate Limited: Too many requests';
          break;
        case 500:
          errorMessage += ' - Server Error: Provider system issue';
          break;
        default:
          errorMessage += ` - ${response.statusText}`;
      }
      
      errorMessage += `. Response: ${responseText}`;
      throw new Error(errorMessage);
    }

    try {
      const parsedResponse = JSON.parse(responseText);
      console.log('SMS sent successfully:', { 
        phone: formattedPhone, 
        messageId: parsedResponse.id || 'N/A',
        status: parsedResponse.status || 'sent'
      });
      return parsedResponse;
    } catch (parseError) {
      console.log('Response not JSON, treating as success:', responseText);
      return { 
        success: true, 
        raw_response: responseText,
        phone: formattedPhone,
        timestamp: new Date().toISOString()
      };
    }
  } catch (fetchError) {
    console.error('Network error sending SMS:', fetchError);
    throw new Error(`SMS delivery failed: ${fetchError.message}. Please check network connectivity and provider settings.`);
  }
}

async function sendTwilioSMS(phone: string, message: string, config: any) {
  // Twilio implementation placeholder
  throw new Error('Twilio SMS not implemented yet');
}

async function sendAfricasTalkingSMS(phone: string, message: string, config: any) {
  // Africa's Talking implementation placeholder
  throw new Error("Africa's Talking SMS not implemented yet");
}

serve(handler);