import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { Plus, Search, Calendar, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { LeaseExpiryManager } from "@/components/lease/LeaseExpiryManager";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";

interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent: number;
  security_deposit: number;
  status: string;
  tenants: {
    first_name: string;
    last_name: string;
  };
  units: {
    unit_number: string;
    properties: {
      name: string;
    };
  };
}

interface LeaseFormData {
  tenant_id: string;
  unit_id: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent: number;
  security_deposit: number;
}

const Leases = () => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<LeaseFormData>();
  
  const { page, pageSize, setPage, setPageSize } = useUrlPageParam({
    pageSize: 10,
    defaultPage: 1
  });

  const [expiringWithinDays, setExpiringWithinDays] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get('expiringWithinDays') || params.get('expiring');
    if (d) {
      const n = Number(d);
      if (Number.isFinite(n) && n > 0) setExpiringWithinDays(n);
    }
  }, []);


  const fetchLeases = async () => {
    try {
      console.log("🔍 Starting leases fetch for user:", user?.id);

      if (!user?.id) {
        console.log("❌ No authenticated user");
        setLoading(false);
        return;
      }

      // If an expiry window is requested, use the same RPC as the dashboard for parity
      if (expiringWithinDays != null) {
        const days = Number(expiringWithinDays);
        const today = new Date();
        const startDate = today.toISOString().slice(0, 10);
        const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const rpcArgs = days === 90 ? { p_start_date: null, p_end_date: null } : { p_start_date: startDate, p_end_date: endDate };

        const { data, error } = await (supabase as any)
          .rpc('get_lease_expiry_report', rpcArgs)
          .maybeSingle();
        if (error) throw error;

        const raw = Array.isArray(data) ? data[0] : data;
        const rows = Array.isArray(raw?.table) ? raw.table : [];
        const mapped = rows.map((l: any) => {
          const tn = (l.tenant_name || '').trim();
          const parts = tn.split(' ');
          const last = parts.length > 1 ? parts.pop() : '';
          const first = parts.join(' ');
          return {
            id: l.id || `${l.property_name || ''}-${l.unit_number || ''}-${l.lease_end_date || ''}`,
            tenant_id: l.tenant_id || '',
            unit_id: l.unit_id || '',
            lease_start_date: l.lease_start_date || null,
            lease_end_date: l.lease_end_date || null,
            monthly_rent: Number(l.monthly_rent || 0),
            security_deposit: Number(l.security_deposit || 0),
            status: l.status || 'active',
            tenants: { first_name: first || tn, last_name: last || '' },
            units: { unit_number: l.unit_number || '', properties: { name: l.property_name || '' } }
          } as any;
        });
        setLeases(mapped);
        console.log("✅ Loaded leases via RPC:", mapped.length);
        return;
      }

      // Otherwise: original fetch for full list
      const isAdmin = await hasRole('Admin');

      if (isAdmin) {
        const { data, error } = await (supabase as any)
          .from("leases")
          .select(`*, tenants:tenants(id, first_name, last_name), units:units(id, unit_number, property_id, properties:properties(id, name))`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setLeases(data || []);
        console.log("✅ Loaded leases for admin:", data?.length || 0);
        return;
      }

      // For non-admins, load entities and filter to user's properties
      const { data: leasesData, error: leasesError } = await supabase
        .from("leases")
        .select("*")
        .order("created_at", { ascending: false });
      if (leasesError) throw leasesError;

      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name");
      if (tenantsError) throw tenantsError;

      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id");
      if (unitsError) throw unitsError;

      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`);
      if (propertiesError) throw propertiesError;

      const tenantMap = new Map(tenantsData?.map(t => [t.id, t]) || []);
      const unitMap = new Map(unitsData?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesData?.map(p => [p.id, p]) || []);

      const joinedLeases = (leasesData || [])
        .filter(lease => {
          const unit = unitMap.get(lease.unit_id);
          return unit && propertyMap.has(unit.property_id);
        })
        .map(lease => {
          const tenant = tenantMap.get(lease.tenant_id);
          const unit = unitMap.get(lease.unit_id);
          const property = unit ? propertyMap.get(unit.property_id) : null;
          return {
            ...lease,
            tenants: tenant || { first_name: '', last_name: '' },
            units: {
              unit_number: unit?.unit_number || '',
              properties: { name: property?.name || '' }
            }
          };
        });

      console.log("🔗 Joined leases:", joinedLeases.length);
      setLeases(joinedLeases);
    } catch (error: any) {
      const msg = String(error?.message || error);
      console.error("💥 Error in fetchLeases:", error);
      if (msg.toLowerCase().includes('failed to fetch')) {
        toast({
          title: "Network error",
          description: "Could not reach database. Check your internet or Supabase CORS settings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load leases. Please check your permissions.",
          variant: "destructive",
        });
      }
      setLeases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantsAndUnits = async () => {
    try {
      if (!user?.id) return;

      // Get tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name");
      if (tenantsError) throw tenantsError;

      const isAdmin = await hasRole('Admin');

      if (isAdmin) {
        // Admin: all vacant units with property names
        const { data: allUnits, error: unitsErr } = await (supabase as any)
          .from("units")
          .select("id, unit_number, status, properties:properties(id, name)")
          .eq('status', 'vacant');
        if (unitsErr) throw unitsErr;
        setTenants(tenantsData || []);
        setUnits(allUnits || []);
        return;
      }

      // Non-admin: only user's properties
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id, status")
        .eq('status', 'vacant');
      if (unitsError) throw unitsError;

      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`);
      if (propertiesError) throw propertiesError;

      const propertyMap = new Map(propertiesData?.map(p => [p.id, p]) || []);
      const userVacantUnits = (unitsData || [])
        .filter(unit => propertyMap.has(unit.property_id))
        .map(unit => ({ ...unit, properties: propertyMap.get(unit.property_id) }));

      setTenants(tenantsData || []);
      setUnits(userVacantUnits);
    } catch (error) {
      console.error("Error fetching tenants and units:", error);
    }
  };

  useEffect(() => {
    fetchLeases();
    fetchTenantsAndUnits();
  }, []);

  const onSubmit = async (data: LeaseFormData) => {
    const formatError = (e: any) => {
      try {
        if (!e) return 'Unknown error';
        if (typeof e === 'string') return e;
        const parts: string[] = [];
        if (e.message) parts.push(e.message);
        if (e.details) parts.push(e.details);
        if (e.hint) parts.push(`hint: ${e.hint}`);
        if (e.code) parts.push(`code: ${e.code}`);
        if (e.status) parts.push(`status: ${e.status}`);
        if (parts.length === 0) return JSON.stringify(e);
        return parts.join(' | ');
      } catch {
        return String(e);
      }
    };

    try {
      // Basic client-side validation for clearer errors
      if (!data.tenant_id || !data.unit_id) {
        toast({ title: 'Missing fields', description: 'Please select both a tenant and a unit.', variant: 'destructive' });
        return;
      }
      if (!data.lease_start_date || !data.lease_end_date) {
        toast({ title: 'Missing dates', description: 'Start and end dates are required.', variant: 'destructive' });
        return;
      }
      const start = new Date(data.lease_start_date);
      const end = new Date(data.lease_end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        toast({ title: 'Invalid dates', description: 'Please provide valid start and end dates.', variant: 'destructive' });
        return;
      }
      if (end < start) {
        toast({ title: 'Date range error', description: 'End date must be after start date.', variant: 'destructive' });
        return;
      }
      const monthly = Number(data.monthly_rent);
      const deposit = Number(data.security_deposit);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        toast({ title: 'Invalid amount', description: 'Monthly rent must be greater than 0.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(deposit) || deposit < 0) {
        toast({ title: 'Invalid amount', description: 'Security deposit cannot be negative.', variant: 'destructive' });
        return;
      }

      const payload = {
        tenant_id: data.tenant_id,
        unit_id: data.unit_id,
        lease_start_date: start.toISOString().slice(0, 10),
        lease_end_date: end.toISOString().slice(0, 10),
        monthly_rent: monthly,
        security_deposit: deposit,
        status: 'active'
      } as const;

      const { error } = await supabase
        .from("leases")
        .insert([payload]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lease created successfully",
      });

      reset();
      setDialogOpen(false);
      fetchLeases();
    } catch (error: any) {
      const formatted = formatError(error);
      console.error("Error creating lease:", formatted, error);
      toast({
        title: "Error",
        description: formatted,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    
    if (status === 'expired' || end < today) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'active') {
      return <Badge className="bg-green-600">Active</Badge>;
    }
    return <Badge variant="secondary">Upcoming</Badge>;
  };

  const filteredLeases = leases.filter(lease => {
    const matchesSearch =
      lease.tenants.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lease.tenants.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lease.units.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lease.units.properties.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (expiringWithinDays != null) {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = lease.lease_end_date ? new Date(lease.lease_end_date) : null;
      if (!end) return false;
      const ms = end.getTime() - startOfToday.getTime();
      const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= expiringWithinDays;
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredLeases.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedLeases = filteredLeases.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, setPage]);

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Leases</h1>
            <p className="text-muted-foreground">
              Manage lease agreements and terms
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Lease
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-tint-gray">
              <DialogHeader>
                <DialogTitle className="text-primary">Add New Lease</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="tenant_id" className="text-primary">Tenant</Label>
                  <Select onValueChange={(value) => setValue("tenant_id", value)}>
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {tenants.map(tenant => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.first_name} {tenant.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tenant_id && <p className="text-sm text-destructive">Tenant is required</p>}
                </div>

                <div>
                  <Label htmlFor="unit_id" className="text-primary">Unit</Label>
                  <Select onValueChange={(value) => setValue("unit_id", value)}>
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.properties.name} - Unit {unit.unit_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unit_id && <p className="text-sm text-destructive">Unit is required</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lease_start_date" className="text-primary">Start Date</Label>
                    <Input
                      id="lease_start_date"
                      type="date"
                      className="border-border bg-card"
                      {...register("lease_start_date", { required: "Start date is required" })}
                    />
                    {errors.lease_start_date && <p className="text-sm text-destructive">{errors.lease_start_date.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lease_end_date" className="text-primary">End Date</Label>
                    <Input
                      id="lease_end_date"
                      type="date"
                      className="border-border bg-card"
                      {...register("lease_end_date", { required: "End date is required" })}
                    />
                    {errors.lease_end_date && <p className="text-sm text-destructive">{errors.lease_end_date.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthly_rent" className="text-primary">Monthly Rent ({getGlobalCurrencySync()})</Label>
                    <Input
                      id="monthly_rent"
                      type="number"
                      className="border-border bg-card"
                      {...register("monthly_rent", { required: "Monthly rent is required" })}
                      placeholder="25000"
                    />
                    {errors.monthly_rent && <p className="text-sm text-destructive">{errors.monthly_rent.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="security_deposit" className="text-primary">Security Deposit ({getGlobalCurrencySync()})</Label>
                    <Input
                      id="security_deposit"
                      type="number"
                      className="border-border bg-card"
                      {...register("security_deposit", { required: "Security deposit is required" })}
                      placeholder="50000"
                    />
                    {errors.security_deposit && <p className="text-sm text-destructive">{errors.security_deposit.message}</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90">
                    Create Lease
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Summary */}
        <KpiGrid>
          <KpiStatCard
            title="Total Leases"
            value={leases.length}
            subtitle="Active & expired"
            icon={Calendar}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="Active Leases"
            value={leases.filter(l => l.status === 'active').length}
            subtitle="Currently active"
            icon={DollarSign}
            gradient="card-gradient-green"
            isLoading={loading}
          />
          <KpiStatCard
            title="Expiring Soon"
            value={leases.filter(l => {
              const endDate = new Date(l.lease_end_date);
              const thirtyDaysFromNow = new Date();
              thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
              return endDate <= thirtyDaysFromNow && endDate >= new Date();
            }).length}
            subtitle="Next 30 days"
            icon={Calendar}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="Avg Rent"
            value={leases.length > 0 ? formatAmount(Math.round(leases.reduce((sum, l) => sum + l.monthly_rent, 0) / leases.length)) : formatAmount(0)}
            subtitle="Average monthly"
            icon={DollarSign}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        {/* Search Bar */}
        <Card className="bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leases by tenant, unit, or property..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Expiring</span>
              <Select
                value={expiringWithinDays != null ? String(expiringWithinDays) : 'all'}
                onValueChange={(val) => {
                  const v = val === 'all' ? null : Number(val);
                  setExpiringWithinDays(v);
                  setPage(1);
                  const params = new URLSearchParams(window.location.search);
                  if (v == null) {
                    params.delete('expiringWithinDays');
                    params.delete('expiring');
                  } else {
                    params.set('expiringWithinDays', String(v));
                  }
                  const qs = params.toString();
                  window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
                }}
              >
                <SelectTrigger className="w-48 border-border bg-card">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Any time</SelectItem>
                  <SelectItem value="30">Next 30 days</SelectItem>
                  <SelectItem value="60">Next 60 days</SelectItem>
                  <SelectItem value="90">Next 90 days</SelectItem>
                  <SelectItem value="180">Next 6 months</SelectItem>
                  <SelectItem value="365">Next 1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Enhanced Lease Expiry Management */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lease Expiry Management</span>
                <DisabledActionWrapper feature={FEATURES.ADVANCED_REPORTING}>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Advanced Manager
                  </Button>
                </DisabledActionWrapper>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaseExpiryManager />
            </CardContent>
          </Card>
        </div>

        {/* Leases Content */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">All Leases{expiringWithinDays != null ? ` — Expiring in ${expiringWithinDays} days` : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredLeases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leases found
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedLeases.map((lease) => (
                  <div key={lease.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <Calendar className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-medium text-primary">
                          {lease.tenants.first_name} {lease.tenants.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {lease.units.properties.name} - Unit {lease.units.unit_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {format(new Date(lease.lease_start_date), 'MMM dd, yyyy')} - {format(new Date(lease.lease_end_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm">{formatAmount(lease.monthly_rent)}/month</span>
                        </div>
                      </div>
                      {getStatusBadge(lease.status, lease.lease_end_date)}
                    </div>
                  </div>
                ))}
                
                <TablePaginator
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredLeases.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  showPageSizeSelector={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Leases;
