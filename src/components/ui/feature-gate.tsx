import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, Zap, ArrowRight, AlertCircle } from "lucide-react";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  feature: Feature;
  currentCount?: number;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  showUpgradePrompt?: boolean;
  allowReadOnly?: boolean;
  readOnlyMessage?: string;
}

export function FeatureGate({ 
  feature, 
  currentCount = 1,
  children, 
  fallbackTitle, 
  fallbackDescription,
  showUpgradePrompt = true,
  allowReadOnly = false,
  readOnlyMessage = "This feature is read-only in your current plan"
}: FeatureGateProps) {
  const navigate = useNavigate();
  const { allowed, is_limited, limit, remaining, plan_name, loading } = usePlanFeatureAccess(feature, currentCount);

  const handleUpgrade = () => {
    navigate("/upgrade");
  };

  // Show loading state
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    );
  }

  // Feature is allowed - show content
  if (allowed) {
    return (
      <>
        {children}
        {is_limited && limit && remaining !== undefined && remaining <= 2 && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {remaining === 0 
                  ? `You've reached your ${limit} ${feature.includes('units') ? 'units' : 'items'} limit`
                  : `You have ${remaining} of ${limit} ${feature.includes('units') ? 'units' : 'items'} remaining`
                }
              </span>
            </div>
            {remaining <= 1 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 text-orange-700 border-orange-300 hover:bg-orange-100"
                onClick={handleUpgrade}
              >
                Upgrade Plan
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </>
    );
  }

  // Feature not allowed - show upgrade prompt or read-only access
  if (allowReadOnly) {
    return (
      <div className="relative">
        <div className="opacity-60 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">{readOnlyMessage}</span>
            </div>
            {showUpgradePrompt && (
              <Button size="sm" onClick={handleUpgrade}>
                Upgrade Plan
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Feature completely blocked - show upgrade card
  return (
    <Card className="border-2 border-dashed border-muted-foreground/25">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="relative">
            {getPlanIcon(plan_name)}
            <Lock className="absolute -bottom-1 -right-1 h-3 w-3 text-muted-foreground bg-background rounded-full" />
          </div>
        </div>
        <CardTitle className="text-lg">
          {fallbackTitle || getFeatureTitle(feature)}
        </CardTitle>
        <CardDescription>
          {fallbackDescription || getFeatureDescription(feature)}
        </CardDescription>
        {plan_name && (
          <Badge variant="outline" className="self-center mt-2">
            Current plan: {plan_name}
          </Badge>
        )}
      </CardHeader>
      
      {showUpgradePrompt && (
        <CardContent className="pt-0 text-center">
          <div className="space-y-3">
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground mb-3">
              {getFeatureBenefits(feature).map((benefit, index) => (
                <span key={index} className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-primary rounded-full"></div>
                  {benefit}
                </span>
              ))}
            </div>
            
            <Button onClick={handleUpgrade} className="w-full">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Access
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function getPlanIcon(planName?: string) {
  const iconClass = "h-8 w-8 text-muted-foreground";
  
  switch (planName?.toLowerCase()) {
    case 'starter':
      return <Zap className={iconClass} />;
    case 'professional':
      return <Crown className={iconClass} />;
    case 'enterprise':
      return <Crown className={`${iconClass} text-purple-600`} />;
    default:
      return <Lock className={iconClass} />;
  }
}

function getFeatureTitle(feature: Feature): string {
  const titles: Record<string, string> = {
    'units.max': 'Unit Limit Reached',
    'sms.quota': 'SMS Quota Exceeded',
    'reports.advanced': 'Advanced Reporting',
    'reports.financial': 'Financial Reports',
    'integrations.api': 'API Access',
    'integrations.accounting': 'Accounting Integration',
    'team.roles': 'Team Roles & Permissions',
    'branding.white_label': 'White Label Branding',
    'support.priority': 'Priority Support',
    'operations.bulk': 'Bulk Operations',
  };
  
  return titles[feature] || 'Premium Feature';
}

function getFeatureDescription(feature: Feature): string {
  const descriptions: Record<string, string> = {
    'units.max': 'Upgrade your plan to manage more properties and units',
    'sms.quota': 'Get more SMS credits to stay connected with your tenants',
    'reports.advanced': 'Access detailed analytics and custom reporting tools',
    'reports.financial': 'Generate comprehensive financial statements and insights',
    'integrations.api': 'Connect with third-party applications and services',
    'integrations.accounting': 'Seamlessly sync with accounting software like QuickBooks',
    'team.roles': 'Add team members with custom permissions and access control',
    'branding.white_label': 'Customize the platform with your company branding',
    'support.priority': 'Get faster response times and dedicated support',
    'operations.bulk': 'Efficiently manage multiple properties with bulk operations',
  };
  
  return descriptions[feature] || 'This feature requires a higher plan to access';
}

function getFeatureBenefits(feature: Feature): string[] {
  const benefits: Record<string, string[]> = {
    'units.max': ['Manage more properties', 'Scale your business', 'No limits'],
    'sms.quota': ['Stay connected', 'Instant notifications', 'Better communication'],
    'reports.advanced': ['Detailed insights', 'Custom reports', 'Better decisions'],
    'integrations.api': ['Automate workflows', 'Connect apps', 'Save time'],
    'team.roles': ['Team collaboration', 'Role-based access', 'Better security'],
    'branding.white_label': ['Professional look', 'Brand consistency', 'Client trust'],
  };
  
  return benefits[feature] || ['Enhanced functionality', 'Professional features', 'Better experience'];
}