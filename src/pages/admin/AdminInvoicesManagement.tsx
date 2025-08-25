import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount } from "@/utils/currency";
import { toast } from "sonner";
import { FileText, Search, Filter, Plus, Eye, Edit, Download, Send, Calendar, DollarSign, Users, Building } from "lucide-react";
import { InvoiceDetailsDialog } from "@/components/invoices/InvoiceDetailsDialog";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";

interface AdminInvoice {
  id: string;
  invoice_number: string;
  lease_id: string;
  tenant_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  leases?: {
    units?: {
      unit_number: string;
      properties?: {
        name: string;
        owner_id: string;
      };
    };
  };
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

const AdminInvoicesManagement = () => {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [properties, setProperties] = useState<{id: string, name: string}[]>([]);
  const { downloadInvoice, sendInvoice } = useInvoiceActions();

  // Fetch all invoices with landlord and property information
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          leases!lease_id (
            units!unit_id (
              unit_number,
              properties!property_id (
                id,
                name,
                owner_id
              )
            )
          ),
          tenants!tenant_id (first_name, last_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);

      // Extract unique properties for filtering
      const uniqueProperties = data?.reduce((acc: {id: string, name: string}[], invoice) => {
        const property = invoice.leases?.units?.properties;
        if (property && property.name && !acc.find(p => p.name === property.name)) {
          // Use property name as ID since the query doesn't include property ID
          acc.push({ id: property.name, name: property.name });
        }
        return acc;
      }, []) || [];
      
      setProperties(uniqueProperties);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${invoice.tenants?.first_name} ${invoice.tenants?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.leases?.units?.properties?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || invoice.status === filterStatus;
    const matchesProperty = filterProperty === "all" || invoice.leases?.units?.properties?.name === filterProperty;
    
    return matchesSearch && matchesStatus && matchesProperty;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success text-success-foreground";
      case "pending":
        return "bg-warning text-warning-foreground";
      case "overdue":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">All Invoices Management</h1>
            <p className="text-muted-foreground">
              Manage all tenant invoices across all properties
            </p>
          </div>
          <CreateInvoiceDialog onInvoiceCreated={fetchInvoices} />
        </div>

        {/* Admin KPI Summary Cards */}
        <div className="grid gap-6 md:grid-cols-5">
          <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Invoices</CardTitle>
              <div className="icon-bg-white">
                <FileText className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalInvoices}</div>
              <p className="text-xs text-white/80">All properties</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Amount</CardTitle>
              <div className="icon-bg-white">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatAmount(totalAmount)}</div>
              <p className="text-xs text-white/80">All invoices</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Paid</CardTitle>
              <div className="icon-bg-white">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatAmount(totalPaid)}</div>
              <p className="text-xs text-white/80">Collected</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Pending</CardTitle>
              <div className="icon-bg-white">
                <Calendar className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatAmount(totalPending)}</div>
              <p className="text-xs text-white/80">Awaiting payment</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-red hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Overdue</CardTitle>
              <div className="icon-bg-white">
                <Calendar className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatAmount(totalOverdue)}</div>
              <p className="text-xs text-white/80">Past due</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="bg-card p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by invoice number, tenant, or property..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-[200px] border-border">
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map(property => (
                    <SelectItem key={property.name} value={property.name}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Invoices Table */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-8 w-[100px]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredInvoices.length > 0 ? (
          <Card className="bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <div className="font-semibold">{invoice.invoice_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(invoice.invoice_date).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invoice.tenants?.first_name} {invoice.tenants?.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.tenants?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {invoice.leases?.units?.properties?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.leases?.units?.unit_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-primary">
                          {formatAmount(invoice.amount)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <InvoiceDetailsDialog 
                            invoice={invoice} 
                            mode="view"
                            trigger={
                              <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                <Eye className="h-3 w-3" />
                              </Button>
                            }
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                            onClick={() => downloadInvoice(invoice)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-accent hover:bg-accent/90"
                            onClick={() => sendInvoice(invoice)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
              <p className="text-muted-foreground text-center mb-6">
                {searchTerm || filterStatus !== "all" || filterProperty !== "all"
                  ? "Try adjusting your search or filters"
                  : "No invoices have been created yet"
                }
              </p>
              {!searchTerm && filterStatus === "all" && filterProperty === "all" && (
                <CreateInvoiceDialog onInvoiceCreated={fetchInvoices} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminInvoicesManagement;