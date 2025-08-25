import React, { useState } from 'react';
import { formatAmount } from '@/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrialCountdown } from './TrialCountdown';
import { Search, Filter, Eye, Settings, Crown } from 'lucide-react';

interface PropertyStakeholderSubscription {
  id: string;
  landlord_id: string;
  status: string;
  trial_start_date?: string;
  trial_end_date?: string;
  next_billing_date?: string;
  sms_credits_balance: number;
  daysRemaining: number;
  role: string;
  billing_plan?: {
    id: string;
    name: string;
    price: number;
    billing_cycle: string;
    currency: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface PropertyStakeholderSubscriptionsProps {
  subscriptions: PropertyStakeholderSubscription[];
  billingPlans: any[];
  onAssignPlan: (landlordId: string, planId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export const PropertyStakeholderSubscriptions: React.FC<PropertyStakeholderSubscriptionsProps> = ({
  subscriptions,
  billingPlans,
  onAssignPlan,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const formatCurrency = (amount: number, currency?: string) => {
    return formatAmount(amount, currency);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Landlord':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Agent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = !searchTerm || 
      sub.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-primary flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Property Stakeholder Subscriptions
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              Manage subscriptions for all property owners, landlords, managers, and agents
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 border-border bg-card"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[180px] border-border bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-primary">Stakeholder</TableHead>
                <TableHead className="text-primary">Role</TableHead>
                <TableHead className="text-primary">Plan</TableHead>
                <TableHead className="text-primary">Status</TableHead>
                <TableHead className="text-primary">Trial Progress</TableHead>
                <TableHead className="text-primary">SMS Credits</TableHead>
                <TableHead className="text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((subscription) => (
                <TableRow key={subscription.id} className="border-border">
                  <TableCell>
                    <div>
                      <div className="font-medium text-primary">
                        {subscription.profiles?.first_name} {subscription.profiles?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {subscription.profiles?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(subscription.role)}>
                      {subscription.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-primary">
                        {subscription.billing_plan?.name || "No Plan"}
                      </div>
                      {subscription.billing_plan && (
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(subscription.billing_plan.price, subscription.billing_plan.currency)} / {subscription.billing_plan.billing_cycle}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TrialCountdown 
                      daysRemaining={subscription.daysRemaining}
                      status={subscription.status}
                    />
                  </TableCell>
                   <TableCell>
                     {subscription.status === 'trial' && subscription.trial_start_date && subscription.trial_end_date && (
                       <div className="space-y-1">
                         {(() => {
                           const totalTrialDays = Math.ceil(
                             (new Date(subscription.trial_end_date).getTime() - new Date(subscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)
                           );
                           const progressPercentage = Math.max(5, Math.min(100, ((totalTrialDays - subscription.daysRemaining) / totalTrialDays) * 100));
                           
                           return (
                             <>
                               <div className="w-full bg-muted rounded-full h-2">
                                 <div 
                                   className={`h-2 rounded-full transition-all ${
                                     subscription.daysRemaining <= 3 
                                       ? 'bg-destructive' 
                                       : subscription.daysRemaining <= 7 
                                       ? 'bg-orange-500' 
                                       : 'bg-primary'
                                   }`}
                                   style={{ 
                                     width: `${progressPercentage}%` 
                                   }}
                                 />
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {subscription.daysRemaining} of {totalTrialDays} days
                               </div>
                             </>
                           );
                         })()}
                       </div>
                     )}
                   </TableCell>
                  <TableCell>
                    <span className="font-medium text-primary">
                      {subscription.sms_credits_balance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Select onValueChange={(planId) => onAssignPlan(subscription.landlord_id, planId)}>
                        <SelectTrigger className="w-32 h-8 border-border bg-card">
                          <SelectValue placeholder="Change Plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredSubscriptions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No stakeholder subscriptions found matching your criteria.
          </div>
        )}
      </CardContent>
    </Card>
  );
};