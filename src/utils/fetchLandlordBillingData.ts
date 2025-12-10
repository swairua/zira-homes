import { supabase } from "@/integrations/supabase/client";

interface LandlordBillingData {
  billFrom: {
    name: string;
    address: string;
    phone: string;
    email: string;
    companyName?: string;
  };
}

/**
 * Fetches landlord/property owner billing data based on invoice and lease information
 * Uses multiple fallback methods to ensure data is always retrieved when possible
 */
export async function fetchLandlordBillingData(
  invoice: any
): Promise<LandlordBillingData | null> {
  try {
    // Debug: Log invoice structure to understand data format
    console.log('fetchLandlordBillingData - Invoice structure:', {
      hasId: !!invoice.id,
      hasPropertyId: !!invoice.property_id,
      hasTenantId: !!invoice.tenant_id,
      hasLeases: !!invoice.leases,
      hasUnits: !!invoice.leases?.units,
      hasProperties: !!invoice.leases?.units?.properties,
      propertiesHasId: !!invoice.leases?.units?.properties?.id
    });

    // Method 1: Try to get property ID from nested lease structure (most common)
    let propertyId = invoice.leases?.units?.properties?.id;

    if (propertyId) {
      console.log('Found property ID in nested structure:', propertyId);
    }

    // Method 2: If not in leases, try direct property_id field
    if (!propertyId && invoice.property_id) {
      propertyId = invoice.property_id;
      console.log('Found property ID in direct field:', propertyId);
    }

    // Method 3: If still no property ID, try to get from tenant's leases
    if (!propertyId && invoice.tenant_id) {
      console.log('Attempting to fetch property from tenant leases for tenant:', invoice.tenant_id);
      const { data: tenantLeases, error: leaseError } = await supabase
        .from('leases')
        .select('unit_id, units!inner(property_id)')
        .eq('tenant_id', invoice.tenant_id)
        .eq('status', 'active')
        .maybeSingle();

      if (leaseError) {
        console.error('Error fetching tenant leases:', leaseError);
      }

      if (tenantLeases?.units?.property_id) {
        propertyId = tenantLeases.units.property_id;
        console.log('Found property ID from tenant leases:', propertyId);
      } else {
        console.warn('No active lease found for tenant:', invoice.tenant_id);
      }
    }

    if (!propertyId) {
      console.warn('Unable to determine property ID from invoice data:', {
        hasLeases: !!invoice.leases,
        hasUnits: !!invoice.leases?.units,
        hasProperties: !!invoice.leases?.units?.properties,
        leasePropertiesKeys: Object.keys(invoice.leases?.units?.properties || {}),
        hasPropertyId: !!invoice.property_id,
        hasTenantId: !!invoice.tenant_id,
        invoiceKeys: Object.keys(invoice).slice(0, 10)
      });
      return null;
    }

    // Query to get property owner details with profile information
    console.log('Fetching property and owner details for property ID:', propertyId);
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

    if (error) {
      console.error('Error fetching property from database:', error);
      return null;
    }

    if (!data) {
      console.warn('No property data found for ID:', propertyId);
      return null;
    }

    // Extract owner profile (handle both direct object and array response)
    const ownerProfile = Array.isArray(data.profiles)
      ? data.profiles[0]
      : data.profiles;

    if (!ownerProfile) {
      console.warn('No owner profile found for property:', propertyId);
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

    const result: LandlordBillingData = {
      billFrom: {
        name: ownerName,
        address: propertyAddress,
        phone: ownerProfile.phone || '',
        email: ownerProfile.email || '',
        companyName: data.name || undefined
      }
    };

    console.log('Successfully fetched landlord billing data:', {
      name: result.billFrom.name,
      hasPhone: !!result.billFrom.phone,
      hasEmail: !!result.billFrom.email,
      hasAddress: !!result.billFrom.address
    });

    return result;
  } catch (error) {
    console.error('Unexpected error fetching landlord billing data:', error);
    return null;
  }
}
