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
  const { user } = useAuth();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<LeaseFormData>();


  const fetchLeases = async () => {
    try {
      console.log("🔍 Starting leases fetch for user:", user?.id);
      
      if (!user?.id) {
        console.log("❌ No authenticated user");
        setLoading(false);
        return;
      }

      // First get leases data
      const { data: leasesData, error: leasesError } = await supabase
        .from("leases")
        .select("*")
        .order("created_at", { ascending: false });

      if (leasesError) {
        console.error("❌ Leases query error:", leasesError);
        throw leasesError;
      }

      // Get tenants separately
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name");

      if (tenantsError) {
        console.error("❌ Tenants query error:", tenantsError);
        throw tenantsError;
      }

      // Get units with properties for user's properties only
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id");

      if (unitsError) {
        console.error("❌ Units query error:", unitsError);
        throw unitsError;
      }

      // Get properties that belong to the user
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`);

      if (propertiesError) {
        console.error("❌ Properties query error:", propertiesError);
        throw propertiesError;
      }

      // Create lookup maps
      const tenantMap = new Map(tenantsData?.map(t => [t.id, t]) || []);
      const unitMap = new Map(unitsData?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesData?.map(p => [p.id, p]) || []);

      // Join data manually and filter to user's properties only
      const joinedLeases = leasesData?.filter(lease => {
        const unit = unitMap.get(lease.unit_id);
        return unit && propertyMap.has(unit.property_id);
      }).map(lease => {
        const tenant = tenantMap.get(lease.tenant_id);
        const unit = unitMap.get(lease.unit_id);
        const property = unit ? propertyMap.get(unit.property_id) : null;
        
        return {
          ...lease,
          tenants: tenant || { first_name: '', last_name: '' },
          units: {
            unit_number: unit?.unit_number || '',
            properties: {
              name: property?.name || ''
            }
          }
        };
      }) || [];

      console.log("🔗 Joined leases:", joinedLeases.length);
      setLeases(joinedLeases);
    } catch (error) {
      console.error("💥 Error in fetchLeases:", error);
      toast({
        title: "Error",
        description: "Failed to load leases. Please check your permissions.",
        variant: "destructive",
      });
      setLeases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantsAndUnits = async () => {
    try {
      if (!user?.id) return;
      
      // Get tenants separately
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name");

      if (tenantsError) throw tenantsError;

      // Get units for user's properties only
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id");

      if (unitsError) throw unitsError;

      // Get user's properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`);

      if (propertiesError) throw propertiesError;

      // Create property map and filter units
      const propertyMap = new Map(propertiesData?.map(p => [p.id, p]) || []);
      const userUnits = unitsData?.filter(unit => propertyMap.has(unit.property_id))
        .map(unit => ({
          ...unit,
          properties: propertyMap.get(unit.property_id)
        })) || [];

      setTenants(tenantsData || []);
      setUnits(userUnits);
    } catch (error) {
      console.error("Error fetching tenants and units:", error);
    }
  };

  useEffect(() => {
    fetchLeases();
    fetchTenantsAndUnits();
  }, []);

  const onSubmit = async (data: LeaseFormData) => {
    try {
      const { error } = await supabase
        .from("leases")
        .insert([{
          ...data,
          monthly_rent: Number(data.monthly_rent),
          security_deposit: Number(data.security_deposit)
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lease created successfully",
      });

      reset();
      setDialogOpen(false);
      fetchLeases();
    } catch (error) {
      console.error("Error creating lease:", error);
      toast({
        title: "Error",
        description: "Failed to create lease",
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

  const filteredLeases = leases.filter(lease =>
    lease.tenants.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lease.tenants.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lease.units.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lease.units.properties.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leases by tenant, unit, or property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-border"
            />
          </div>
        </Card>

        {/* Leases Content */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">All Leases</CardTitle>
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
                {filteredLeases.map((lease) => (
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Leases;