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
import { supabase } from "@/integrations/supabase/client";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { Plus, Search, Filter, DollarSign, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";

interface Payment {
  id: string;
  tenant_id: string;
  lease_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  status: string;
  notes?: string;
  tenants: {
    first_name: string;
    last_name: string;
  };
  leases: {
    units: {
      unit_number: string;
      properties: {
        name: string;
      };
    };
  };
}

interface PaymentFormData {
  tenant_id: string;
  lease_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  payment_reference: string;
  invoice_number?: string;
  notes?: string;
}

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("last_12_months");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PaymentFormData>();

  const selectedTenantId = watch("tenant_id");


  const fetchPayments = async () => {
    try {
      console.log("🔍 Starting payments fetch");
      
      // Get payments data
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false });

      if (paymentsError) {
        console.error("❌ Payments query error:", paymentsError);
        throw paymentsError;
      }

      // Get related data separately
      const [tenantsResult, leasesResult, unitsResult, propertiesResult] = await Promise.all([
        supabase.from("tenants").select("id, first_name, last_name"),
        supabase.from("leases").select("id, unit_id"),
        supabase.from("units").select("id, unit_number, property_id"),
        supabase.from("properties").select("id, name")
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (leasesResult.error) throw leasesResult.error;
      if (unitsResult.error) throw unitsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      // Create lookup maps
      const tenantMap = new Map(tenantsResult.data?.map(t => [t.id, t]) || []);
      const leaseMap = new Map(leasesResult.data?.map(l => [l.id, l]) || []);
      const unitMap = new Map(unitsResult.data?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);

      // Join data manually
      const joinedPayments = paymentsData?.map(payment => {
        const tenant = tenantMap.get(payment.tenant_id);
        const lease = leaseMap.get(payment.lease_id);
        const unit = lease ? unitMap.get(lease.unit_id) : null;
        const property = unit ? propertyMap.get(unit.property_id) : null;
        
        return {
          ...payment,
          tenants: tenant || { first_name: '', last_name: '' },
          leases: {
            units: {
              unit_number: unit?.unit_number || '',
              properties: {
                name: property?.name || ''
              }
            }
          }
        };
      }) || [];

      console.log("🔗 Joined payments:", joinedPayments.length);
      setPayments(joinedPayments);
    } catch (error) {
      console.error("💥 Error in fetchPayments:", error);
      toast({
        title: "Error", 
        description: "Failed to load payments. Please check your permissions.",
        variant: "destructive",
      });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantsAndLeases = async () => {
    try {
      // Get tenants and leases separately
      const [tenantsResult, leasesResult, unitsResult, propertiesResult] = await Promise.all([
        supabase.from("tenants").select("id, first_name, last_name"),
        supabase.from("leases").select("id, tenant_id, monthly_rent, unit_id"),
        supabase.from("units").select("id, unit_number, property_id"),
        supabase.from("properties").select("id, name")
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (leasesResult.error) throw leasesResult.error;
      if (unitsResult.error) throw unitsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      // Create lookup maps
      const unitMap = new Map(unitsResult.data?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);

      // Join leases with units and properties
      const joinedLeases = leasesResult.data?.map(lease => {
        const unit = unitMap.get(lease.unit_id);
        const property = unit ? propertyMap.get(unit.property_id) : null;
        
        return {
          ...lease,
          units: {
            unit_number: unit?.unit_number || '',
            properties: {
              name: property?.name || ''
            }
          }
        };
      }) || [];

      setTenants(tenantsResult.data || []);
      setLeases(joinedLeases);
    } catch (error) {
      console.error("Error fetching tenants and leases:", error);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTenantsAndLeases();
  }, []);

  const onSubmit = async (data: PaymentFormData) => {
    try {
      const { error } = await supabase
        .from("payments")
        .insert([{
          ...data,
          amount: Number(data.amount),
          status: 'completed'
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });

      reset();
      setDialogOpen(false);
      fetchPayments();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPeriodDates = (period: string) => {
    const now = new Date();
    const today = new Date();
    
    switch (period) {
      case 'current_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: today
        };
      case 'last_12_months':
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
      case 'ytd':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: today
        };
      default:
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
    }
  };

  const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.tenants.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.tenants.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.leases.units.properties.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredLeases = leases.filter(lease => lease.tenant_id === selectedTenantId);

  const getFilteredPaymentsByPeriod = (filterPeriod?: string) => {
    const period = filterPeriod || periodFilter;
    const { start, end } = getPeriodDates(period);
    
    return payments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return p.status === 'completed' && 
             paymentDate >= start && 
             paymentDate <= end;
    });
  };

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const periodRevenue = getFilteredPaymentsByPeriod().reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonthRevenue = getFilteredPaymentsByPeriod('current_month').reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Payments</h1>
            <p className="text-muted-foreground">
              Track rent payments and financial transactions
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Record New Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="tenant_id">Tenant</Label>
                  <Select onValueChange={(value) => setValue("tenant_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label htmlFor="lease_id">Lease</Label>
                  <Select onValueChange={(value) => setValue("lease_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lease" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredLeases.map(lease => (
                        <SelectItem key={lease.id} value={lease.id}>
                          {lease.units.properties.name} - Unit {lease.units.unit_number} ({formatAmount(lease.monthly_rent)}/month)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.lease_id && <p className="text-sm text-destructive">Lease is required</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount ({getGlobalCurrencySync()})</Label>
                    <Input
                      id="amount"
                      type="number"
                      {...register("amount", { required: "Amount is required" })}
                      placeholder="25000"
                    />
                    {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      {...register("payment_date", { required: "Payment date is required" })}
                    />
                    {errors.payment_date && <p className="text-sm text-destructive">{errors.payment_date.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select onValueChange={(value) => setValue("payment_method", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="payment_type">Payment Type</Label>
                    <Select onValueChange={(value) => setValue("payment_type", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Security Deposit">Security Deposit</SelectItem>
                        <SelectItem value="Utility">Utility</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_reference">Payment Reference</Label>
                    <Input
                      id="payment_reference"
                      {...register("payment_reference", { required: "Payment reference is required" })}
                      placeholder="REF-2024-001"
                    />
                    {errors.payment_reference && (
                      <p className="text-sm text-red-500">{errors.payment_reference.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="invoice_number">Invoice Number</Label>
                    <Input
                      id="invoice_number"
                      {...register("invoice_number")}
                      placeholder="INV-2024-001 (optional)"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    {...register("notes")}
                    placeholder="Payment notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Record Payment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Period Filter & KPI Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="period-filter" className="text-sm font-medium">Period:</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger id="period-filter" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Current Month</SelectItem>
                <SelectItem value="last_12_months">Last 12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <KpiGrid className="lg:grid-cols-4">
          <KpiStatCard
            title="Total Revenue (All Time)"
            value={formatAmount(totalRevenue)}
            subtitle="All completed payments"
            icon={DollarSign}
            gradient="card-gradient-green"
            isLoading={loading}
          />
          <KpiStatCard
            title={periodFilter === 'current_month' ? 'This Month' : 
                   periodFilter === 'ytd' ? 'Year to Date' : 'Last 12 Months'}
            value={formatAmount(periodRevenue)}
            subtitle="Period revenue"
            icon={Calendar}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="This Month"
            value={formatAmount(currentMonthRevenue)}
            subtitle="Current month revenue"
            icon={Calendar}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="Total Payments"
            value={payments.length}
            subtitle="Payment records"
            icon={DollarSign}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payments found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-medium">
                          {payment.tenants.first_name} {payment.tenants.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {payment.leases.units.properties.name} - Unit {payment.leases.units.unit_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_type} • {payment.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatAmount(payment.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      {getStatusBadge(payment.status)}
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

export default Payments;