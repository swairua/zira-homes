-- Insert M-Pesa production credentials for the default/admin landlord
-- This assumes you have an admin user; adjust the landlord_id as needed

INSERT INTO public.landlord_mpesa_configs (
  landlord_id,
  consumer_key,
  consumer_secret,
  business_shortcode,
  passkey,
  environment,
  shortcode_type,
  is_active
) 
SELECT 
  auth.uid(),
  '56ueVvt4yQATDhtR0oMKHNxvoQY5ayac4MqLmwq5zp5NWnk8',
  '0CBo0yX77vpvekKLFC0F9wSoQF60DTsWkGAqYUHomChor4R4d14l7wecm2WGwJGG',
  '4155923',
  '2c966142072a07ff83d2d28864a9ff78d180f8fafa703b7d107355b0e6cdc5d4',
  'production',
  'paybill',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.landlord_mpesa_configs 
  WHERE business_shortcode = '4155923' AND is_active = true
)
ON CONFLICT (landlord_id, is_active) DO UPDATE SET
  consumer_key = '56ueVvt4yQATDhtR0oMKHNxvoQY5ayac4MqLmwq5zp5NWnk8',
  consumer_secret = '0CBo0yX77vpvekKLFC0F9wSoQF60DTsWkGAqYUHomChor4R4d14l7wecm2WGwJGG',
  business_shortcode = '4155923',
  passkey = '2c966142072a07ff83d2d28864a9ff78d180f8fafa703b7d107355b0e6cdc5d4',
  environment = 'production',
  updated_at = NOW();
