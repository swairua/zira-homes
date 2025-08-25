import React, { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, CreditCard, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Payment {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  property_name: string;
  unit_number: string;
  amount: number;
  payment_date: string;
  status: string;
  payment_method: string | null;
}
export function RecentPayments() {
  const [currentPage, setCurrentPage] = useState(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          status,
          payment_method,
          payment_reference,
          tenants!payments_tenant_id_fkey (
            first_name,
            last_name,
            phone
          ),
          leases!payments_lease_id_fkey (
            units!leases_unit_id_fkey (
              unit_number,
              properties!units_property_id_fkey (
                name
              )
            )
          )
        `)
        .order('payment_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transformedPayments: Payment[] = data?.map(payment => ({
        id: payment.payment_reference || payment.id,
        tenant_name: payment.tenants ? `${payment.tenants.first_name} ${payment.tenants.last_name}` : "Unknown",
        tenant_phone: payment.tenants?.phone || "N/A",
        property_name: payment.leases?.units?.properties?.name || "Unknown Property",
        unit_number: payment.leases?.units?.unit_number || "N/A",
        amount: payment.amount || 0,
        payment_date: payment.payment_date,
        status: payment.status,
        payment_method: payment.payment_method || "Bank Transfer"
      })) || [];

      setPayments(transformedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      // Fallback to empty array on error
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };
  
  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPayments = payments.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      case "failed":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "Credit Card":
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case "Bank Transfer":
        return <div className="w-4 h-4 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">B</div>;
      case "Check":
        return <div className="w-4 h-4 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold">C</div>;
      case "Mpesa":
        return <div className="w-4 h-4 bg-green-600 rounded text-white text-xs flex items-center justify-center font-bold">M</div>;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50">
        <CardHeader className="border-b bg-white/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Recent Payments</CardTitle>
                <p className="text-sm text-muted-foreground">Latest payment transactions</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50">
      <CardHeader className="border-b bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Recent Payments</CardTitle>
              <p className="text-sm text-muted-foreground">Latest payment transactions</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-shadow">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No payment data available</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b">
                    <TableHead className="font-semibold text-gray-900">Date</TableHead>
                    <TableHead className="font-semibold text-gray-900">Tenant</TableHead>
                    <TableHead className="font-semibold text-gray-900">Phone</TableHead>
                    <TableHead className="font-semibold text-gray-900">Property & Unit</TableHead>
                    <TableHead className="font-semibold text-gray-900">Amount</TableHead>
                    <TableHead className="font-semibold text-gray-900">Method</TableHead>
                    <TableHead className="font-semibold text-gray-900">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPayments.map((payment, index) => (
                    <TableRow 
                      key={payment.id} 
                      className={`hover:bg-blue-50/70 transition-colors border-b border-gray-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      }`}
                    >
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                            {payment.tenant_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium">{payment.tenant_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{payment.tenant_phone}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{payment.property_name}</div>
                          <div className="text-sm text-muted-foreground bg-gray-100 px-2 py-1 rounded-md inline-block">
                            Unit {payment.unit_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-lg text-green-600">
                          {formatAmount(payment.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
                          {getPaymentMethodIcon(payment.payment_method)}
                          <span className="text-sm font-medium">{payment.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(payment.status)} font-medium shadow-sm border-0`}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        
            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between space-x-2 p-6 bg-gray-50/50 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(startIndex + itemsPerPage, payments.length)}</span> of{" "}
                  <span className="font-semibold">{payments.length}</span> payments
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className={`w-8 h-8 p-0 shadow-sm hover:shadow-md transition-shadow ${
                            currentPage === page 
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-500' 
                              : ''
                          }`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}