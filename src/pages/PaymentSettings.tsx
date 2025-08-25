import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Shield, Settings, Info, ArrowLeft } from "lucide-react";
import { PaymentSettingsForm } from "@/components/landlord/PaymentSettingsForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserCountry } from "@/hooks/useUserCountry";
import { getCountryInfo } from "@/utils/countryService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { filterPaymentMethodsByCountry } from "@/utils/countryService";

interface ApprovedMethod {
  id: string;
  payment_method_type: string;
  provider_name: string;
  is_active: boolean;
  country_code: string;
}

interface PaymentPreferences {
  preferred_payment_method: string;
  mpesa_phone_number?: string;
  bank_account_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    branch?: string;
    swift_code?: string;
  };
  payment_instructions?: string;
  auto_payment_enabled: boolean;
  payment_reminders_enabled: boolean;
}

interface BillingData {
  approved_payment_methods: ApprovedMethod[];
  payment_preferences: PaymentPreferences;
}

const PaymentSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { primaryCountry, loading: countryLoading } = useUserCountry();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Fetch approved payment methods
      const { data: paymentMethods, error: pmError } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .eq('is_active', true);

      if (pmError) throw pmError;

      // Filter by country
      const filteredMethods = filterPaymentMethodsByCountry(paymentMethods || [], primaryCountry);

      // Fetch payment preferences
      const { data: preferences } = await supabase
        .from('landlord_payment_preferences')
        .select('*')
        .eq('landlord_id', user?.id)
        .single();

      setBillingData({
        approved_payment_methods: filteredMethods,
        payment_preferences: {
          preferred_payment_method: preferences?.preferred_payment_method || 'mpesa',
          mpesa_phone_number: preferences?.mpesa_phone_number,
          bank_account_details: typeof preferences?.bank_account_details === 'object' && preferences?.bank_account_details 
            ? preferences.bank_account_details as any
            : {},
          payment_instructions: preferences?.payment_instructions,
          auto_payment_enabled: preferences?.auto_payment_enabled || false,
          payment_reminders_enabled: preferences?.payment_reminders_enabled || true,
        }
      });

    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast({
        title: "Error",
        description: "Failed to load payment settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = (preferences: PaymentPreferences) => {
    setBillingData(prev => prev ? { ...prev, payment_preferences: preferences } : null);
    setEditMode(false);
    toast({
      title: "Success",
      description: "Payment preferences updated successfully!",
    });
  };

  if (loading || countryLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Payment Settings</h1>
            <p className="text-muted-foreground">
              Configure payment methods and preferences for tenant payments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span>{getCountryInfo(primaryCountry).flag}</span>
              {getCountryInfo(primaryCountry).name}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              Secure
            </Badge>
          </div>
        </div>

        {/* Payment Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Configuration
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure M-Pesa, bank transfer, and other payment methods for your tenants
                </p>
              </div>
              {!editMode && billingData && (
                <Button onClick={() => setEditMode(true)} variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Settings
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <PaymentSettingsForm
                billingData={billingData}
                onSave={handleSavePreferences}
                onCancel={() => setEditMode(false)}
              />
            ) : billingData ? (
              <div className="space-y-6">
                {/* Current Payment Method */}
                <div>
                  <h4 className="font-medium mb-3">Preferred Payment Method</h4>
                  <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium capitalize">
                        {billingData.payment_preferences.preferred_payment_method === 'mpesa' ? 'M-Pesa' :
                         billingData.payment_preferences.preferred_payment_method === 'bank_transfer' ? 'Bank Transfer' :
                         billingData.payment_preferences.preferred_payment_method}
                      </p>
                      {billingData.payment_preferences.preferred_payment_method === 'mpesa' && (
                        <p className="text-sm text-muted-foreground">
                          {billingData.payment_preferences.mpesa_phone_number || 'Phone number not set'}
                        </p>
                      )}
                    </div>
                    <Badge>Primary</Badge>
                  </div>
                </div>

                {/* Payment Preferences */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Auto Payment</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={billingData.payment_preferences.auto_payment_enabled ? "default" : "secondary"}>
                        {billingData.payment_preferences.auto_payment_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Payment Reminders</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={billingData.payment_preferences.payment_reminders_enabled ? "default" : "secondary"}>
                        {billingData.payment_preferences.payment_reminders_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                {billingData.payment_preferences.payment_instructions && (
                  <div>
                    <h4 className="font-medium mb-2">Payment Instructions</h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      {billingData.payment_preferences.payment_instructions}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Click "Edit Settings" to configure your payment preferences</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Available Payment Methods for {getCountryInfo(primaryCountry).name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {billingData?.approved_payment_methods.map(method => (
                <div key={method.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium">{method.provider_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{method.payment_method_type.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Bank Transfer</p>
                  <p className="text-xs text-muted-foreground">Direct bank transfers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PaymentSettings;