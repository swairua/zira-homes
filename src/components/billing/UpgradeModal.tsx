import React, { useState, useEffect } from "react";
import { getCurrencySymbol } from "@/utils/currency";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star, Crown, Zap, X, Loader2, ArrowRight } from "lucide-react";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  billing_model: string;
  percentage_rate?: number;
  fixed_amount_per_unit?: number;
  tier_pricing?: any;
  features: string[];
  max_properties: number | null;
  max_units: number | null;
  sms_credits_included: number;
  is_active: boolean;
  is_custom?: boolean;
  contact_link?: string;
  recommended?: boolean;
  popular?: boolean;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { user } = useAuth();
  const { trialStatus, trialDaysRemaining } = useTrialManagement();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchActiveBillingPlans();
    }
  }, [isOpen]);

  const fetchActiveBillingPlans = async () => {
    try {
      setLoading(true);
      console.log('🔍 UpgradeModal: Fetching active billing plans...');
      
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*, is_custom, contact_link')
        .eq('is_active', true)
        .neq('name', 'Free Trial') // Exclude trial plans from upgrade options
        .order('price', { ascending: true });

      console.log('📊 UpgradeModal: Query result:', { data, error });

      if (error) throw error;

      // Process the plans and add display properties
      const processedPlans = (data || []).map((plan, index) => ({
        ...plan,
        features: Array.isArray(plan.features) ? (plan.features as string[]) : 
                 typeof plan.features === 'string' ? [plan.features] : [],
        popular: index === 1, // Mark second plan as popular
        recommended: plan.name.toLowerCase().includes('professional')
      }));

      console.log('✅ UpgradeModal: Processed plans:', processedPlans);
      setBillingPlans(processedPlans);
    } catch (error) {
      console.error('❌ UpgradeModal: Error fetching billing plans:', error);
      toast.error('Failed to load billing plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleUpgrade = async () => {
    if (!selectedPlan || !user) {
      toast.error("Please select a plan to continue");
      return;
    }

    const selectedPlanData = billingPlans.find(p => p.id === selectedPlan);
    if (!selectedPlanData) {
      toast.error("Selected plan not found");
      return;
    }

    // Handle custom plans by opening contact link
    if (selectedPlanData.is_custom && selectedPlanData.contact_link) {
      window.open(selectedPlanData.contact_link, '_blank');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🚀 Starting upgrade process for plan:', selectedPlanData.name);

      // For commission-based plans, activate directly without payment setup
      if (selectedPlanData.billing_model === 'percentage') {
        console.log('✅ Activating commission-based plan directly...');
        
        const { data: subscription, error: subscriptionError } = await supabase
          .from('landlord_subscriptions')
          .upsert({
            landlord_id: user.id,
            billing_plan_id: selectedPlan,
            status: 'active',
            subscription_start_date: new Date().toISOString(),
            trial_end_date: null, // End trial
            auto_renewal: true,
            sms_credits_balance: selectedPlanData.sms_credits_included || 0
          }, {
            onConflict: 'landlord_id'
          })
          .select();

        if (subscriptionError) throw subscriptionError;

        // Log the upgrade action
        await supabase.rpc('log_user_activity', {
          _user_id: user.id,
          _action: 'subscription_upgrade',
          _entity_type: 'billing_plan',
          _entity_id: selectedPlan,
          _details: {
            plan_name: selectedPlanData.name,
            billing_model: selectedPlanData.billing_model,
            percentage_rate: selectedPlanData.percentage_rate
          }
        });
        
        toast.success(`${selectedPlanData.name} plan activated! You'll be billed ${selectedPlanData.percentage_rate}% commission on rent collected monthly.`);
        onClose();
        
        // Refresh the page to update trial status
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // For other billing models, use M-Pesa STK push
        console.log('💳 Initiating M-Pesa payment for plan upgrade...');

        if (!phoneNumber || phoneNumber.trim().length < 9) {
          toast.error("Please enter a valid phone number for M-Pesa payment");
          return;
        }

        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
          'create-billing-checkout',
          {
            body: {
              planId: selectedPlan,
              phoneNumber: phoneNumber.trim()
            }
          }
        );

        if (checkoutError) {
          const errorDetail = checkoutError instanceof Error
            ? checkoutError.message
            : typeof checkoutError === 'object' && checkoutError !== null
            ? (checkoutError as any).error || JSON.stringify(checkoutError)
            : String(checkoutError);
          throw new Error(`Payment setup failed: ${errorDetail}`);
        }

        if (checkoutData?.type === 'mpesa_payment') {
          console.log('🚀 Initiating M-Pesa STK push...');

          const { data: stkData, error: stkError } = await supabase.functions.invoke(
            'mpesa-stk-push',
            {
              body: {
                phoneNumber: phoneNumber.trim(),
                amount: checkoutData.amount,
                description: `Plan Upgrade: ${selectedPlanData.name}`,
                transactionId: checkoutData.transactionId,
                paymentType: 'plan_upgrade',
                planId: selectedPlan
              }
            }
          );

          if (stkError) {
            throw stkError;
          }

          if (stkData?.CheckoutRequestID) {
            toast.success("M-Pesa prompt sent to your phone. Please complete the payment.");
            setPhoneNumber('');
            setTimeout(() => {
              onClose();
              window.location.reload();
            }, 2000);
            return;
          } else {
            throw new Error("Failed to initiate M-Pesa payment");
          }
        } else {
          throw new Error("Unexpected response from payment setup");
        }
      }
    } catch (error: any) {
      console.error('❌ Upgrade error:', error);
      const msg = error?.message || (typeof error === 'string' ? error : 'Upgrade failed. Please try again.');
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter': return <Zap className="h-5 w-5" />;
      case 'professional': return <Star className="h-5 w-5" />;
      case 'enterprise': return <Crown className="h-5 w-5" />;
      default: return <Check className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Upgrade Your Plan</DialogTitle>
              <DialogDescription className="mt-2">
                Choose the perfect plan for your property management needs
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {trialStatus && (
            <div className="flex items-center justify-center mt-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-orange-700 font-medium">
                  {trialDaysRemaining > 0 
                    ? `${trialDaysRemaining} days left in your trial`
                    : "Your trial has ended - Upgrade now to continue"
                  }
                </span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Pricing Cards */}
        <div className={`grid gap-6 my-6 ${
          loading ? 'grid-cols-1 lg:grid-cols-3' : 
          billingPlans.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          billingPlans.length === 2 ? 'grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto' :
          'grid-cols-1 lg:grid-cols-3'
        }`}>
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="relative">
                <CardHeader className="text-center pb-4">
                  <Skeleton className="h-6 w-6 mx-auto mb-2" />
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-48 mx-auto mb-3" />
                  <Skeleton className="h-8 w-24 mx-auto" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))
          ) : billingPlans.length === 0 ? (
            <div className="col-span-3 text-center py-8">
              <p className="text-muted-foreground">No billing plans available</p>
            </div>
          ) : (
            billingPlans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all duration-200 ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-primary shadow-lg' 
                  : 'hover:shadow-lg'
              } ${plan.popular ? 'border-primary' : ''}`}
              onClick={() => handlePlanSelect(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {plan.recommended && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary">Recommended</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-3">
                  {plan.is_custom ? (
                    <>
                      <span className="text-3xl font-bold text-primary">
                        Custom
                      </span>
                      <span className="text-muted-foreground text-sm block">pricing available</span>
                    </>
                  ) : plan.billing_model === 'percentage' && plan.percentage_rate ? (
                    <>
                      <span className="text-3xl font-bold text-primary">
                        {plan.percentage_rate}%
                      </span>
                      <span className="text-muted-foreground text-sm block">commission on rent collected</span>
                    </>
                  ) : plan.billing_model === 'fixed' && plan.fixed_amount_per_unit ? (
                    <>
                      <span className="text-3xl font-bold">
                        {getCurrencySymbol(plan.currency)}{plan.fixed_amount_per_unit}
                      </span>
                      <span className="text-muted-foreground text-sm">per unit/{plan.billing_cycle}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">
                        {getCurrencySymbol(plan.currency)}{plan.price}
                      </span>
                      <span className="text-muted-foreground text-sm">/{plan.billing_cycle}</span>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <ul className="space-y-2 mb-4">
                  {plan.features.slice(0, 5).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      +{plan.features.length - 5} more features
                    </li>
                  )}
                </ul>

                <Button 
                  className="w-full" 
                  variant={selectedPlan === plan.id ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (plan.is_custom && plan.contact_link) {
                      window.open(plan.contact_link, '_blank');
                    } else {
                      handlePlanSelect(plan.id);
                    }
                  }}
                >
                  {plan.is_custom ? "Contact Us" : (selectedPlan === plan.id ? "Selected" : "Select Plan")}
                </Button>
              </CardContent>
            </Card>
            ))
          )}
        </div>

        {/* Action Section */}
        {selectedPlan && !billingPlans.find(p => p.id === selectedPlan)?.is_custom && (
          <div className="bg-muted/50 border rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">
              {billingPlans.find(p => p.id === selectedPlan)?.billing_model === 'percentage' 
                ? 'Ready to activate?' 
                : 'Ready to upgrade?'
              }
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              You've selected the <strong>{billingPlans.find(p => p.id === selectedPlan)?.name}</strong> plan.
              {billingPlans.find(p => p.id === selectedPlan)?.billing_model === 'percentage' 
                ? ' This plan will be activated immediately and you\'ll be billed monthly based on rent collected.'
                : ' Click below to complete your upgrade and unlock all features.'
              }
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpgrade}
                disabled={isProcessing || loading}
                className="min-w-32"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {billingPlans.find(p => p.id === selectedPlan)?.billing_model === 'percentage' 
                      ? 'Activating...' 
                      : 'Processing...'
                    }
                  </>
                ) : (
                  billingPlans.find(p => p.id === selectedPlan)?.billing_model === 'percentage' 
                    ? 'Activate Plan' 
                    : 'Upgrade Now'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Benefits Footer */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                onClose();
                window.location.href = '/billing';
              }}
              className="text-primary hover:text-primary/80"
            >
              See all plans & features
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <h4 className="font-medium text-sm">No Commitments</h4>
              <p className="text-xs text-muted-foreground">Cancel anytime</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Star className="h-4 w-4 text-blue-600" />
              </div>
              <h4 className="font-medium text-sm">Instant Access</h4>
              <p className="text-xs text-muted-foreground">Immediate activation</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Crown className="h-4 w-4 text-purple-600" />
              </div>
              <h4 className="font-medium text-sm">Full Support</h4>
              <p className="text-xs text-muted-foreground">Priority assistance</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
