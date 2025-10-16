import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, Zap, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UpgradeConfirmationModal } from "@/components/upgrade/UpgradeConfirmationModal";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  max_properties: number | null;
  max_units: number | null;
  sms_credits_included: number;
  billing_model?: string;
  percentage_rate?: number;
  recommended?: boolean;
  popular?: boolean;
  is_custom?: boolean;
  contact_link?: string;
}

interface CurrentSubscription {
  billing_plan_id: string;
  status: string;
  plan_name: string;
}

// Feature display mapping for user-friendly names
const FEATURE_DISPLAY_MAP: Record<string, string> = {
  'reports.basic': 'Basic Financial Reports',
  'reports.advanced': 'Advanced Analytics & Reports', 
  'reports.financial': 'Comprehensive Financial Reports',
  'maintenance.tracking': 'Maintenance Request Management',
  'tenant.portal': 'Tenant Self-Service Portal',
  'notifications.email': 'Email Notifications',
  'notifications.sms': 'SMS Notifications',
  'operations.bulk': 'Bulk Operations & Imports',
  'billing.automated': 'Automated Billing & Invoicing',
  'documents.templates': 'Custom Document Templates',
  'integrations.api': 'API Access & Integrations',
  'integrations.accounting': 'Accounting Software Integration',
  'team.roles': 'Team & Role Management',
  'team.sub_users': 'Multiple User Accounts',
  'branding.white_label': 'White Label Solution',
  'branding.custom': 'Custom Branding & Logos',
  'support.priority': 'Priority Support',
  'support.dedicated': 'Dedicated Account Manager',
};

export function Upgrade() {
  const { user } = useAuth();
  const { trialStatus, trialDaysRemaining } = useTrialManagement();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    fetchActiveBillingPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchCurrentSubscription = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('landlord_subscriptions')
        .select(`
          billing_plan_id,
          status,
          billing_plans!inner(name)
        `)
        .eq('landlord_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCurrentSubscription({
          billing_plan_id: data.billing_plan_id,
          status: data.status,
          plan_name: (data.billing_plans as any).name
        });
      }
    } catch (error) {
      console.error('❌ Error fetching current subscription:', error);
    }
  };

  const fetchActiveBillingPlans = async () => {
    try {
      setLoading(true);
      console.log('🔍 Upgrade: Fetching active billing plans...');
      
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*, is_custom, contact_link')
        .eq('is_active', true)
        .neq('name', 'Free Trial') // Exclude trial plans from upgrade options
        .order('price', { ascending: true });

      console.log('📊 Upgrade: Query result:', { data, error });

      if (error) throw error;

      // Process the plans and add display properties
      const processedPlans = (data || []).map((plan, index) => ({
        ...plan,
        features: Array.isArray(plan.features) ? (plan.features as string[]) : 
                 typeof plan.features === 'string' ? [plan.features] : [],
        popular: index === 1, // Mark second plan as popular
        recommended: plan.name.toLowerCase().includes('professional')
      }));

      console.log('✅ Upgrade: Processed plans:', processedPlans);
      setBillingPlans(processedPlans);
    } catch (error) {
      console.error('❌ Upgrade: Error fetching billing plans:', error);
      toast.error('Failed to load billing plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setConfirmModalOpen(true);
  };

  const handleUpgrade = async (phoneNumberOrOtp?: string) => {
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
      setConfirmModalOpen(false);
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🚀 Starting upgrade process for plan:', selectedPlanData.name);

      // For commission-based plans, activate directly without payment setup
      if (selectedPlanData.billing_model === 'percentage') {
        console.log('✅ Activating commission-based plan directly...');

        const { error: subscriptionError } = await supabase
          .from('landlord_subscriptions')
          .upsert({
            landlord_id: user.id,
            billing_plan_id: selectedPlan,
            status: 'active',
            subscription_start_date: new Date().toISOString(),
            trial_end_date: null,
            auto_renewal: true,
            sms_credits_balance: selectedPlanData.sms_credits_included || 0
          }, {
            onConflict: 'landlord_id'
          });

        if (subscriptionError) throw subscriptionError;

        setConfirmModalOpen(false);
        toast.success(`${selectedPlanData.name} plan activated successfully!`);
        setTimeout(() => window.location.href = '/', 1000);
        return;
      }

      // For other billing models, use M-Pesa STK push for payment
      console.log('💳 Initiating M-Pesa payment for plan upgrade...');

      // Use phone number from modal or state
      const finalPhoneNumber = phoneNumberOrOtp || phoneNumber;

      // Validate phone number
      if (!finalPhoneNumber || finalPhoneNumber.trim().length < 9) {
        toast.error("Please enter a valid phone number for M-Pesa payment");
        setIsProcessing(false);
        return;
      }

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        'create-billing-checkout',
        {
          body: {
            planId: selectedPlan,
            phoneNumber: finalPhoneNumber.trim()
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

        // Initiate M-Pesa STK push
        const { data: stkData, error: stkError } = await supabase.functions.invoke(
          'mpesa-stk-push',
          {
            body: {
              phoneNumber: finalPhoneNumber.trim(),
              amount: checkoutData.amount,
              description: `Plan Upgrade: ${selectedPlanData.name}`,
              transactionId: checkoutData.transactionId,
              paymentType: 'plan_upgrade',
              planId: selectedPlan
            }
          }
        );

        if (stkError) {
          const stkErrorDetail = stkError instanceof Error
            ? stkError.message
            : typeof stkError === 'object' && stkError !== null
            ? (stkError as any).error || JSON.stringify(stkError)
            : String(stkError);
          throw new Error(`M-Pesa error: ${stkErrorDetail}`);
        }

        if (stkData?.CheckoutRequestID) {
          toast.success("M-Pesa prompt sent to your phone. Please complete the payment.");
          setConfirmModalOpen(false);
          setPhoneNumber('');

          // Store the checkout request ID for verification
          sessionStorage.setItem(`upgrade_${selectedPlan}`, stkData.CheckoutRequestID);

          // Redirect after a short delay
          setTimeout(() => window.location.href = '/', 2000);
        } else {
          throw new Error("Failed to initiate M-Pesa payment");
        }
      } else {
        throw new Error("Unexpected response from payment setup");
      }

    } catch (error: any) {
      console.error('❌ Upgrade error:', error);
      const msg = error?.message || (typeof error === 'string' ? error : 'Upgrade failed. Please try again.');
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.billing_plan_id === planId;
  };

  const getDisplayFeatures = (features: string[]) => {
    return features.map(feature => FEATURE_DISPLAY_MAP[feature] || feature);
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
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Upgrade to unlock the full power of property management
          </p>
          
          {trialStatus && trialStatus.status === 'trial' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-blue-700 font-medium">
                {trialDaysRemaining > 0 
                  ? `${trialDaysRemaining} days left in your trial`
                  : "Your trial has ended"
                }
              </span>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading plans...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {billingPlans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all duration-200 ${
                isCurrentPlan(plan.id)
                  ? 'ring-2 ring-green-500 shadow-lg border-green-200 bg-green-50/50'
                  : selectedPlan === plan.id 
                    ? 'ring-2 ring-primary shadow-lg scale-105' 
                    : 'hover:shadow-lg hover:scale-102'
              } ${plan.popular ? 'border-primary' : ''}`}
              onClick={() => !isCurrentPlan(plan.id) && handlePlanSelect(plan.id)}
            >
              {isCurrentPlan(plan.id) && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
              
              {plan.popular && !isCurrentPlan(plan.id) && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {plan.recommended && !isCurrentPlan(plan.id) && (
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary">Recommended</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  {plan.is_custom ? (
                    <div className="text-center">
                      <span className="text-2xl font-bold text-muted-foreground">Custom pricing</span>
                      <p className="text-sm text-muted-foreground mt-1">Contact us for pricing</p>
                    </div>
                  ) : plan.billing_model === 'percentage' ? (
                    <div className="text-center">
                      <span className="text-4xl font-bold">{plan.percentage_rate}%</span>
                      <p className="text-sm text-muted-foreground mt-1">of rent collected</p>
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">
                        {formatAmount(plan.price, plan.currency || getGlobalCurrencySync())}
                      </span>
                      <span className="text-muted-foreground">/{plan.billing_cycle}</span>
                      {plan.currency && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {plan.currency}
                          </Badge>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <ul className="space-y-3 mb-6">
                  {getDisplayFeatures(plan.features).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full" 
                  variant={isCurrentPlan(plan.id) ? "secondary" : selectedPlan === plan.id ? "default" : "outline"}
                  size="lg"
                  disabled={isCurrentPlan(plan.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (plan.is_custom && plan.contact_link) {
                      window.open(plan.contact_link, '_blank');
                    } else if (!isCurrentPlan(plan.id)) {
                      handlePlanSelect(plan.id);
                    }
                  }}
                >
                  {isCurrentPlan(plan.id) ? (
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Current Plan
                    </span>
                  ) : plan.is_custom ? "Contact Us" : 
                    selectedPlan === plan.id ? "Selected" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {/* Upgrade Confirmation Modal */}
        <UpgradeConfirmationModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          onConfirm={handleUpgrade}
          selectedPlan={selectedPlan ? billingPlans.find(p => p.id === selectedPlan) : undefined}
          isProcessing={isProcessing}
          requireOtp={false} // Set to true if you want OTP verification
        />

        {/* Benefits Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-8">Why upgrade from your trial?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Unlimited Access</h3>
              <p className="text-sm text-muted-foreground">
                No more feature limitations. Access all tools without restrictions.
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Priority Support</h3>
              <p className="text-sm text-muted-foreground">
                Get faster response times and priority assistance when you need help.
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Advanced Features</h3>
              <p className="text-sm text-muted-foreground">
                Unlock powerful analytics, reporting, and automation features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
