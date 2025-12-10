import { supabase } from "@/integrations/supabase/client";

interface LandlordBillingData {
  billFrom: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

/**
 * Fetches landlord/property owner billing data based on invoice and lease information
 */
export async function fetchLandlordBillingData(
  invoice: any
): Promise<LandlordBillingData | null> {
  try {
    // Get property ID from invoice
    const propertyId = invoice.leases?.units?.properties?.id;
    
    if (!propertyId) {
      console.warn('No property ID found in invoice');
      return null;
    }

    // Query to get property owner details with profile information
    const { data, error } = await supabase
      .from('properties')
      .select(`
        id,
        name,
        address,
        city,
        state,
        owner_id,
        profiles:owner_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('id', propertyId)
      .single();

    if (error || !data) {
      console.warn('Failed to fetch property owner data:', error);
      return null;
    }

    // Extract owner profile (handle both direct object and array response)
    const ownerProfile = Array.isArray(data.profiles) 
      ? data.profiles[0] 
      : data.profiles;

    if (!ownerProfile) {
      console.warn('No owner profile found for property');
      return null;
    }

    // Build full name
    const ownerName = [ownerProfile.first_name, ownerProfile.last_name]
      .filter(Boolean)
      .join(' ') || 'Property Owner';

    // Build address from property details
    const propertyAddress = [
      data.address,
      data.city,
      data.state
    ]
      .filter(Boolean)
      .join(', ') || 'Property';

    return {
      billFrom: {
        name: ownerName,
        address: propertyAddress,
        phone: ownerProfile.phone || '',
        email: ownerProfile.email || ''
      }
    };
  } catch (error) {
    console.error('Error fetching landlord billing data:', error);
    return null;
  }
}
