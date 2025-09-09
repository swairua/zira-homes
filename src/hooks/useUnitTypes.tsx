import { useState, useEffect } from 'react';
import { restSelect, restPost, restUpdate, restDelete, restUpsert } from '@/integrations/supabase/restProxy';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface UnitType {
  id: string;
  name: string;
  category: 'Residential' | 'Commercial' | 'Mixed';
  features: string[];
  is_system: boolean;
  landlord_id?: string;
  isEnabled?: boolean; // For preferences
}

// Type for the database response
type DatabaseUnitType = {
  id: string;
  name: string;
  category: string;
  features: string[];
  is_system: boolean;
  landlord_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Helper function to convert database response to our interface
const mapDatabaseToUnitType = (dbUnitType: DatabaseUnitType): UnitType => ({
  id: dbUnitType.id,
  name: dbUnitType.name,
  category: dbUnitType.category as 'Residential' | 'Commercial' | 'Mixed',
  features: dbUnitType.features,
  is_system: dbUnitType.is_system,
  landlord_id: dbUnitType.landlord_id || undefined,
});

export const useUnitTypes = () => {
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUnitTypes = async (enabledOnly: boolean = false) => {
    try {
      setLoading(true);

      const unitTypesRes = await restSelect('unit_types', '*', { is_active: 'eq.true', order: 'is_system.desc,name.asc' });
      if (unitTypesRes.error) throw unitTypesRes.error;
      let unitTypesData: any = unitTypesRes.data;
      if (!Array.isArray(unitTypesData)) {
        if (unitTypesData && typeof unitTypesData === 'object' && Array.isArray((unitTypesData as any).data)) unitTypesData = (unitTypesData as any).data;
        else if (unitTypesData == null || unitTypesData === '') unitTypesData = [];
        else unitTypesData = [unitTypesData];
      }

      // Preferences
      const landlordId = user?.id || '';
      const prefsRes = await restSelect('unit_type_preferences', 'unit_type_id,is_enabled', { landlord_id: `eq.${landlordId}` });
      if (prefsRes.error) console.warn('Error fetching preferences (using defaults):', prefsRes.error);
      let preferencesData: any = prefsRes.data || [];
      if (!Array.isArray(preferencesData)) {
        if (preferencesData && typeof preferencesData === 'object' && Array.isArray((preferencesData as any).data)) preferencesData = (preferencesData as any).data;
        else if (preferencesData == null || preferencesData === '') preferencesData = [];
        else preferencesData = [preferencesData];
      }

      const preferencesMap = new Map();
      (preferencesData || []).forEach((pref: any) => preferencesMap.set(pref.unit_type_id, pref.is_enabled));

      let mappedData = (unitTypesData || []).map((item: any) => {
        const unitType = mapDatabaseToUnitType(item);
        return { ...unitType, isEnabled: preferencesMap.get(item.id) ?? true };
      });

      if (enabledOnly) mappedData = mappedData.filter((ut: any) => ut.isEnabled);

      setUnitTypes(mappedData);
    } catch (error) {
      console.error('Error fetching unit types:', error);
      toast({ title: 'Error', description: 'Failed to fetch unit types', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createUnitType = async (unitType: Omit<UnitType, 'id' | 'is_system' | 'landlord_id'>) => {
    try {
      const postRes = await restPost('unit_types', { ...unitType, is_system: false });
      if (postRes.error) throw postRes.error;
      let data: any = postRes.data;
      if (Array.isArray(data)) data = data[0];
      const mappedData = mapDatabaseToUnitType(data);
      setUnitTypes(prev => [...prev, mappedData]);
      toast({ title: 'Success', description: 'Unit type created successfully' });
      return mappedData;
    } catch (error) {
      console.error('Error creating unit type:', error);
      toast({ title: 'Error', description: 'Failed to create unit type', variant: 'destructive' });
      throw error;
    }
  };

  const updateUnitType = async (id: string, updates: Partial<UnitType>) => {
    try {
      const updRes = await restUpdate('unit_types', updates, { id: `eq.${id}` });
      if (updRes.error) throw updRes.error;
      let data: any = updRes.data;
      if (Array.isArray(data)) data = data[0];
      const mappedData = mapDatabaseToUnitType(data);
      setUnitTypes(prev => prev.map(ut => ut.id === id ? mappedData : ut));
      toast({ title: 'Success', description: 'Unit type updated successfully' });
      return mappedData;
    } catch (error) {
      console.error('Error updating unit type:', error);
      toast({ title: 'Error', description: 'Failed to update unit type', variant: 'destructive' });
      throw error;
    }
  };

  const deleteUnitType = async (id: string) => {
    try {
      const delRes = await restDelete('unit_types', { id: `eq.${id}` });
      if (delRes.error) throw delRes.error;
      setUnitTypes(prev => prev.filter(ut => ut.id !== id));
      toast({ title: 'Success', description: 'Unit type deleted successfully' });
    } catch (error) {
      console.error('Error deleting unit type:', error);
      toast({ title: 'Error', description: 'Failed to delete unit type', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => { fetchUnitTypes(); }, []);

  const toggleUnitTypePreference = async (unitTypeId: string, isEnabled: boolean) => {
    try {
      const landlordId = user?.id || '';
      const upsertRes = await restUpsert('unit_type_preferences', { landlord_id: landlordId, unit_type_id: unitTypeId, is_enabled: isEnabled });
      if (upsertRes.error) throw upsertRes.error;
      setUnitTypes(prev => prev.map(ut => ut.id === unitTypeId ? { ...ut, isEnabled } : ut));
      toast({ title: 'Success', description: `Unit type ${isEnabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
      console.error('Error toggling unit type preference:', error);
      toast({ title: 'Error', description: 'Failed to update unit type preference', variant: 'destructive' });
    }
  };

  return { unitTypes, loading, createUnitType, updateUnitType, deleteUnitType, toggleUnitTypePreference, refetch: fetchUnitTypes };
};
