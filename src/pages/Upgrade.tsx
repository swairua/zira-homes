import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, Zap } from "lucide-react";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { toast } from "sonner";
import { navigateTo } from "@/utils/router";

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
  recommended?: boolean;
  popular?: boolean;
}

export function Upgrade() {
  const { trialStatus, trialDaysRemaining } = useTrialManagement();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock billing plans data
  const billingPlans: BillingPlan[] = [
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for individual landlords",
      price: 29,
      currency: "USD",
      billing_cycle: "monthly",
      features: [
        "Up to 5 properties",
        "Up to 50 units",
        "Basic reporting",
        "Email support",
        "100 SMS credits/month"
      ],
      max_properties: 5,
      max_units: 50,
      sms_credits_included: 100
    },
    {
      id: "professional",
      name: "Professional",
      description: "Best for growing property businesses",
      price: 79,
      currency: "USD",
      billing_cycle: "monthly",
      features: [
        "Up to 25 properties",
        "Up to 500 units",
        "Advanced analytics",
        "Priority support",
        "500 SMS credits/month",
        "Custom reports",
        "Maintenance management"
      ],
      max_properties: 25,
      max_units: 500,
      sms_credits_included: 500,
      recommended: true,
      popular: true
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "For large property management companies",
      price: 199,
      currency: "USD",
      billing_cycle: "monthly",
      features: [
        "Unlimited properties",
        "Unlimited units",
        "White-label options",
        "24/7 phone support",
        "2000 SMS credits/month",
        "API access",
        "Custom integrations",
        "Dedicated account manager"
      ],
      max_properties: null,
      max_units: null,
      sms_credits_included: 2000
    }
  ];

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) {
      toast.error("Please select a plan to continue");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Mock payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Upgrade successful! Welcome to your new plan.");
      // Redirect to dashboard
      navigateTo('/');
    } catch (error) {
      toast.error("Upgrade failed. Please try again.");
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Upgrade from your trial to unlock the full power of property management
          </p>
          
          {trialStatus && (
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {billingPlans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all duration-200 ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-primary shadow-lg scale-105' 
                  : 'hover:shadow-lg hover:scale-102'
              } ${plan.popular ? 'border-primary' : ''}`}
              onClick={() => handlePlanSelect(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {plan.recommended && (
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
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/{plan.billing_cycle}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full" 
                  variant={selectedPlan === plan.id ? "default" : "outline"}
                  size="lg"
                >
                  {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Section */}
        {selectedPlan && (
          <div className="bg-card border rounded-lg p-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to upgrade?</h3>
            <p className="text-muted-foreground mb-4">
              You've selected the {billingPlans.find(p => p.id === selectedPlan)?.name} plan.
              Click below to complete your upgrade.
            </p>
            <Button 
              size="lg" 
              onClick={handleUpgrade}
              disabled={isProcessing}
              className="min-w-48"
            >
              {isProcessing ? "Processing..." : "Upgrade Now"}
            </Button>
          </div>
        )}

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
    </div>
  );
}
