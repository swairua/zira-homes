import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Settings, Shield, Calendar, Smartphone, Building2, Globe, Check, X, TestTube, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SimpleBankService } from "@/services/simpleBankService";

const PaymentConfiguration = () => {
  const { toast } = useToast();
  
  // Admin-only access check (you could add useAuth + role check here if needed)
  
  // Payment gateway settings
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('');
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState('');
  const [cellulantMerchantCode, setCellulantMerchantCode] = useState('');
  const [cellulantSecretKey, setCellulantSecretKey] = useState('');
  
  // Mobile Money settings
  const [mpesaConsumerKey, setMpesaConsumerKey] = useState('');
  const [mpesaConsumerSecret, setMpesaConsumerSecret] = useState('');
  const [mpesaShortcode, setMpesaShortcode] = useState('');
  const [mpesaPasskey, setMpesaPasskey] = useState('');
  const [mpesaEnvironment, setMpesaEnvironment] = useState('sandbox');
  
  // Bank configurations from SimpleBankService
  const [bankConfigs, setBankConfigs] = useState(SimpleBankService.loadConfigurations());
  
  // Payment rules
  const [lateFeeEnabled, setLateFeeEnabled] = useState(true);
  const [lateFeeAmount, setLateFeeAmount] = useState('50');
  const [lateFeeType, setLateFeeType] = useState('fixed'); // fixed or percentage
  const [gracePeriod, setGracePeriod] = useState('5');
  const [autoPaymentEnabled, setAutoPaymentEnabled] = useState(false);
  const [partialPaymentAllowed, setPartialPaymentAllowed] = useState(true);
  
  // Payment reminders
  const [reminderDays, setReminderDays] = useState('3,7,14');
  const [overdueReminderDays, setOverdueReminderDays] = useState('1,5,10');
  
  // UI state
  const [showSecrets, setShowSecrets] = useState({});
  const [testingStatus, setTestingStatus] = useState({});
  
  // Approved payment methods state
  const [approvedMethods, setApprovedMethods] = useState([]);
  const [newMethod, setNewMethod] = useState({
    payment_method_type: '',
    provider_name: '',
    country_code: 'KE',
    configuration: {}
  });

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
    loadApprovedMethods();
  }, []);

  const loadConfiguration = () => {
    try {
      const savedConfig = localStorage.getItem('payment_configuration');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        // Load payment gateway settings
        if (config.paymentGateways) {
          if (config.paymentGateways.stripe) {
            setStripePublishableKey(config.paymentGateways.stripe.publishableKey || '');
            setStripeSecretKey(config.paymentGateways.stripe.secretKey || '');
          }
          if (config.paymentGateways.paypal) {
            setPaypalClientId(config.paymentGateways.paypal.clientId || '');
            setPaypalClientSecret(config.paymentGateways.paypal.clientSecret || '');
          }
          if (config.paymentGateways.flutterwave) {
            setFlutterwavePublicKey(config.paymentGateways.flutterwave.publicKey || '');
            setFlutterwaveSecretKey(config.paymentGateways.flutterwave.secretKey || '');
          }
          if (config.paymentGateways.cellulant) {
            setCellulantMerchantCode(config.paymentGateways.cellulant.merchantCode || '');
            setCellulantSecretKey(config.paymentGateways.cellulant.secretKey || '');
          }
        }
        
        // Load mobile money settings
        if (config.mobileMoney?.mpesa) {
          setMpesaConsumerKey(config.mobileMoney.mpesa.consumerKey || '');
          setMpesaConsumerSecret(config.mobileMoney.mpesa.consumerSecret || '');
          setMpesaShortcode(config.mobileMoney.mpesa.shortcode || '');
          setMpesaPasskey(config.mobileMoney.mpesa.passkey || '');
        }
        
        // Load bank configurations
        if (config.bankConfigurations) {
          setBankConfigs(prevConfigs => ({ ...prevConfigs, ...config.bankConfigurations }));
        }
        
        // Load payment rules
        if (config.paymentRules) {
          setLateFeeEnabled(config.paymentRules.lateFee?.enabled ?? true);
          setLateFeeAmount(config.paymentRules.lateFee?.amount || '50');
          setLateFeeType(config.paymentRules.lateFee?.type || 'fixed');
          setGracePeriod(config.paymentRules.gracePeriod || '5');
          setAutoPaymentEnabled(config.paymentRules.autoPayment ?? false);
          setPartialPaymentAllowed(config.paymentRules.partialPayment ?? true);
        }
        
        // Load reminder settings
        if (config.reminders) {
          setReminderDays(config.reminders.beforeDue || '3,7,14');
          setOverdueReminderDays(config.reminders.afterDue || '1,5,10');
        }
      }
    } catch (error) {
      console.error('Error loading payment configuration:', error);
    }
  };

  const saveConfiguration = () => {
    const config = {
      paymentGateways: {
        stripe: { publishableKey: stripePublishableKey, secretKey: stripeSecretKey },
        paypal: { clientId: paypalClientId, clientSecret: paypalClientSecret },
        flutterwave: { publicKey: flutterwavePublicKey, secretKey: flutterwaveSecretKey },
        cellulant: { merchantCode: cellulantMerchantCode, secretKey: cellulantSecretKey }
      },
      mobileMoney: {
        mpesa: { 
          consumerKey: mpesaConsumerKey, 
          consumerSecret: mpesaConsumerSecret,
          shortcode: mpesaShortcode,
          passkey: mpesaPasskey,
          environment: mpesaEnvironment
        }
      },
      paymentRules: {
        lateFee: { enabled: lateFeeEnabled, amount: lateFeeAmount, type: lateFeeType },
        gracePeriod: gracePeriod,
        autoPayment: autoPaymentEnabled,
        partialPayment: partialPaymentAllowed
      },
      reminders: {
        beforeDue: reminderDays,
        afterDue: overdueReminderDays
      },
      bankConfigurations: bankConfigs
    };
    
    localStorage.setItem('payment_configuration', JSON.stringify(config));
    SimpleBankService.saveConfigurations(bankConfigs);
    
    toast({
      title: "Configuration Saved",
      description: "Payment settings have been updated successfully.",
    });
  };

  const updateBankConfig = (bankCode, field, value) => {
    setBankConfigs(prevConfigs => {
      const newConfigs = { ...prevConfigs };
      if (!newConfigs[bankCode].config) {
        newConfigs[bankCode].config = {};
      }
      newConfigs[bankCode].config[field] = value;
      return newConfigs;
    });
  };

  const toggleBankEnabled = (bankCode) => {
    setBankConfigs(prevConfigs => ({
      ...prevConfigs,
      [bankCode]: {
        ...prevConfigs[bankCode],
        enabled: !prevConfigs[bankCode].enabled
      }
    }));
  };

  const toggleEnvironment = (bankCode) => {
    setBankConfigs(prevConfigs => ({
      ...prevConfigs,
      [bankCode]: {
        ...prevConfigs[bankCode],
        environment: prevConfigs[bankCode].environment === 'sandbox' ? 'production' : 'sandbox'
      }
    }));
  };

  const testBankConnection = async (bankCode) => {
    setTestingStatus(prev => ({ ...prev, [bankCode]: 'testing' }));
    
    try {
      // Simulate API test - replace with actual bank API test calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const config = bankConfigs[bankCode];
      const hasRequiredFields = config.enabled && Object.keys(config.config || {}).length > 0;
      
      if (hasRequiredFields) {
        setTestingStatus(prev => ({ ...prev, [bankCode]: 'success' }));
        toast({
          title: "Bank Connection Test",
          description: `${bankCode.toUpperCase()} connection test successful.`,
        });
      } else {
        setTestingStatus(prev => ({ ...prev, [bankCode]: 'error' }));
        toast({
          title: "Bank Connection Test",
          description: `${bankCode.toUpperCase()} configuration incomplete.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      setTestingStatus(prev => ({ ...prev, [bankCode]: 'error' }));
      toast({
        title: "Bank Connection Test",
        description: `${bankCode.toUpperCase()} connection test failed.`,
        variant: "destructive"
      });
    }
    
    setTimeout(() => {
      setTestingStatus(prev => ({ ...prev, [bankCode]: undefined }));
    }, 5000);
  };

  const loadApprovedMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApprovedMethods(data || []);
    } catch (error) {
      console.error('Error loading approved methods:', error);
    }
  };

  const addApprovedMethod = async () => {
    try {
      if (!newMethod.payment_method_type || !newMethod.provider_name) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('approved_payment_methods')
        .insert([newMethod]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment method approved successfully",
      });

      setNewMethod({
        payment_method_type: '',
        provider_name: '',
        country_code: 'KE',
        configuration: {}
      });

      loadApprovedMethods();
    } catch (error) {
      console.error('Error adding approved method:', error);
      toast({
        title: "Error",
        description: "Failed to add payment method",
        variant: "destructive"
      });
    }
  };

  const toggleMethodStatus = async (methodId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('approved_payment_methods')
        .update({ is_active: !isActive })
        .eq('id', methodId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Payment method ${!isActive ? 'activated' : 'deactivated'} successfully`,
      });

      loadApprovedMethods();
    } catch (error) {
      console.error('Error updating method status:', error);
      toast({
        title: "Error",
        description: "Failed to update payment method",
        variant: "destructive"
      });
    }
  };

  const deleteApprovedMethod = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from('approved_payment_methods')
        .delete()
        .eq('id', methodId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });

      loadApprovedMethods();
    } catch (error) {
      console.error('Error deleting method:', error);
      toast({
        title: "Error",
        description: "Failed to delete payment method",
        variant: "destructive"
      });
    }
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getBankDisplayName = (bankCode) => {
    const names = {
      kcb: 'KCB Bank (Buni)',
      equity: 'Equity Bank (Jenga)',
      cooperative: 'Cooperative Bank',
      im: 'I&M Bank',
      ncba: 'NCBA Bank',
      dtb: 'Diamond Trust Bank'
    };
    return names[bankCode] || bankCode.toUpperCase();
  };

  const getStatusIcon = (bankCode) => {
    const config = bankConfigs[bankCode];
    if (!config.enabled) return <X className="h-4 w-4 text-muted-foreground" />;
    
    const hasConfig = Object.keys(config.config || {}).length > 0;
    if (!hasConfig) return <X className="h-4 w-4 text-destructive" />;
    
    return <Check className="h-4 w-4 text-success" />;
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Payment Configuration</h1>
            <p className="text-muted-foreground">
              Configure payment gateways, approved methods, and global payment rules (Admin Only)
            </p>
          </div>
          <Button onClick={saveConfiguration} className="w-full sm:w-auto">
            <Settings className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>

        <Tabs defaultValue="gateways" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-auto relative z-10">
            <TabsTrigger value="gateways" className="flex items-center justify-start gap-2 w-full">
              <Globe className="h-4 w-4" />
              Payment Gateways
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center justify-start gap-2 w-full">
              <Smartphone className="h-4 w-4" />
              Mobile Money
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center justify-start gap-2 w-full">
              <Building2 className="h-4 w-4" />
              Bank Transfer
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center justify-start gap-2 w-full">
              <Check className="h-4 w-4" />
              Approved Methods
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center justify-start gap-2 w-full">
              <Shield className="h-4 w-4" />
              Rules & Settings
            </TabsTrigger>
          </TabsList>

          {/* Payment Gateways Tab */}
          <TabsContent value="gateways" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Stripe */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Stripe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripe-publishable">Publishable Key</Label>
                    <Input
                      id="stripe-publishable"
                      placeholder="pk_test_..."
                      value={stripePublishableKey}
                      onChange={(e) => setStripePublishableKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe-secret">Secret Key</Label>
                    <Input
                      id="stripe-secret"
                      type="password"
                      placeholder="sk_test_..."
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PayPal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    PayPal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paypal-client-id">Client ID</Label>
                    <Input
                      id="paypal-client-id"
                      placeholder="AYjnxxxxxxxxxxxxxxxxxxxxxxxn2uA"
                      value={paypalClientId}
                      onChange={(e) => setPaypalClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypal-client-secret">Client Secret</Label>
                    <Input
                      id="paypal-client-secret"
                      type="password"
                      placeholder="ELxxxxxxxxxxxxxxxxxxxxxxx2k_"
                      value={paypalClientSecret}
                      onChange={(e) => setPaypalClientSecret(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Flutterwave */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Flutterwave
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="flutterwave-public">Public Key</Label>
                    <Input
                      id="flutterwave-public"
                      placeholder="FLWPUBK_TEST-xxxxxxxx"
                      value={flutterwavePublicKey}
                      onChange={(e) => setFlutterwavePublicKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flutterwave-secret">Secret Key</Label>
                    <Input
                      id="flutterwave-secret"
                      type="password"
                      placeholder="FLWSECK_TEST-xxxxxxxx"
                      value={flutterwaveSecretKey}
                      onChange={(e) => setFlutterwaveSecretKey(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cellulant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Cellulant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cellulant-merchant">Merchant Code</Label>
                    <Input
                      id="cellulant-merchant"
                      placeholder="Your merchant code"
                      value={cellulantMerchantCode}
                      onChange={(e) => setCellulantMerchantCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cellulant-secret">Secret Key</Label>
                    <Input
                      id="cellulant-secret"
                      type="password"
                      placeholder="Your secret key"
                      value={cellulantSecretKey}
                      onChange={(e) => setCellulantSecretKey(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Mobile Money Tab */}
          <TabsContent value="mobile" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* M-Pesa */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    M-Pesa (Kenya)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-consumer-key">Consumer Key</Label>
                    <Input
                      id="mpesa-consumer-key"
                      placeholder="Your consumer key"
                      value={mpesaConsumerKey}
                      onChange={(e) => setMpesaConsumerKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-consumer-secret">Consumer Secret</Label>
                    <Input
                      id="mpesa-consumer-secret"
                      type="password"
                      placeholder="Your consumer secret"
                      value={mpesaConsumerSecret}
                      onChange={(e) => setMpesaConsumerSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-shortcode">Shortcode</Label>
                    <Input
                      id="mpesa-shortcode"
                      placeholder="174379"
                      value={mpesaShortcode}
                      onChange={(e) => setMpesaShortcode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-passkey">Passkey</Label>
                    <Input
                      id="mpesa-passkey"
                      type="password"
                      placeholder="Your passkey"
                      value={mpesaPasskey}
                      onChange={(e) => setMpesaPasskey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-environment">Environment</Label>
                    <Select value={mpesaEnvironment} onValueChange={setMpesaEnvironment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Mobile Money providers can be added here */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Other Mobile Money
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Support for additional mobile money providers like MTN Mobile Money, 
                    Airtel Money, and others can be configured here.
                  </p>
                  <Button variant="outline" className="w-full">
                    Configure Additional Providers
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bank Transfer Tab */}
          <TabsContent value="bank" className="space-y-6">
            <div className="space-y-6">
              {/* Bank Gateway Configurations */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Kenyan Bank Payment Gateways</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable multiple banks to receive payments
                  </p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(bankConfigs).map(([bankCode, config]) => (
                    <Card key={bankCode} className={`transition-all ${config.enabled ? 'ring-2 ring-primary/20' : ''}`}>
                      <CardHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-4 w-4" />
                            {getBankDisplayName(bankCode)}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(bankCode)}
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={() => toggleBankEnabled(bankCode)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.environment === 'sandbox' ? 'secondary' : 'default'}>
                            {config.environment}
                          </Badge>
                          {config.enabled && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleEnvironment(bankCode)}
                            >
                              Switch to {config.environment === 'sandbox' ? 'Production' : 'Sandbox'}
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      
                      {config.enabled && (
                        <CardContent className="space-y-4">
                          {bankCode === 'kcb' && (
                            <>
                              <div className="space-y-2">
                                <Label>Consumer Key</Label>
                                <div className="relative">
                                  <Input
                                    type={showSecrets[`${bankCode}_key`] ? 'text' : 'password'}
                                    placeholder="KCB Buni API Consumer Key"
                                    value={config.config?.consumerKey || ''}
                                    onChange={(e) => updateBankConfig(bankCode, 'consumerKey', e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => toggleSecretVisibility(`${bankCode}_key`)}
                                  >
                                    {showSecrets[`${bankCode}_key`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Consumer Secret</Label>
                                <div className="relative">
                                  <Input
                                    type={showSecrets[`${bankCode}_secret`] ? 'text' : 'password'}
                                    placeholder="KCB Buni API Consumer Secret"
                                    value={config.config?.consumerSecret || ''}
                                    onChange={(e) => updateBankConfig(bankCode, 'consumerSecret', e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => toggleSecretVisibility(`${bankCode}_secret`)}
                                  >
                                    {showSecrets[`${bankCode}_secret`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                          
                          {bankCode === 'equity' && (
                            <>
                              <div className="space-y-2">
                                <Label>API Key</Label>
                                <div className="relative">
                                  <Input
                                    type={showSecrets[`${bankCode}_key`] ? 'text' : 'password'}
                                    placeholder="Equity Jenga API Key"
                                    value={config.config?.apiKey || ''}
                                    onChange={(e) => updateBankConfig(bankCode, 'apiKey', e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => toggleSecretVisibility(`${bankCode}_key`)}
                                  >
                                    {showSecrets[`${bankCode}_key`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Partner ID</Label>
                                <Input
                                  placeholder="Equity Jenga Partner ID"
                                  value={config.config?.partnerId || ''}
                                  onChange={(e) => updateBankConfig(bankCode, 'partnerId', e.target.value)}
                                />
                              </div>
                            </>
                          )}
                          
                          {['cooperative', 'im', 'ncba', 'dtb'].includes(bankCode) && (
                            <>
                              <div className="space-y-2">
                                <Label>API Key</Label>
                                <div className="relative">
                                  <Input
                                    type={showSecrets[`${bankCode}_key`] ? 'text' : 'password'}
                                    placeholder={`${getBankDisplayName(bankCode)} API Key`}
                                    value={config.config?.apiKey || ''}
                                    onChange={(e) => updateBankConfig(bankCode, 'apiKey', e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => toggleSecretVisibility(`${bankCode}_key`)}
                                  >
                                    {showSecrets[`${bankCode}_key`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Merchant ID</Label>
                                <Input
                                  placeholder={`${getBankDisplayName(bankCode)} Merchant ID`}
                                  value={config.config?.merchantId || ''}
                                  onChange={(e) => updateBankConfig(bankCode, 'merchantId', e.target.value)}
                                />
                              </div>
                            </>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => testBankConnection(bankCode)}
                            disabled={testingStatus[bankCode] === 'testing'}
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            {testingStatus[bankCode] === 'testing' ? 'Testing...' : 'Test Connection'}
                          </Button>
                          
                          {testingStatus[bankCode] && testingStatus[bankCode] !== 'testing' && (
                            <div className={`text-sm flex items-center gap-2 ${testingStatus[bankCode] === 'success' ? 'text-success' : 'text-destructive'}`}>
                              {testingStatus[bankCode] === 'success' ? (
                                <><Check className="h-4 w-4" /> Connection successful</>
                              ) : (
                                <><X className="h-4 w-4" /> Connection failed</>
                              )}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Approved Payment Methods Tab */}
          <TabsContent value="approved" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Pre-Approved Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Method Form */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Payment Type</Label>
                    <Select 
                      value={newMethod.payment_method_type} 
                      onValueChange={(value) => setNewMethod({...newMethod, payment_method_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input
                      placeholder="e.g., Safaricom, Visa"
                      value={newMethod.provider_name}
                      onChange={(e) => setNewMethod({...newMethod, provider_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select 
                      value={newMethod.country_code} 
                      onValueChange={(value) => setNewMethod({...newMethod, country_code: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KE">Kenya (KE)</SelectItem>
                        <SelectItem value="US">United States (US)</SelectItem>
                        <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                        <SelectItem value="EU">European Union (EU)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addApprovedMethod} className="w-full">
                      Add Method
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Approved Methods List */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Approved Payment Methods</h4>
                  {approvedMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No approved payment methods yet.</p>
                  ) : (
                    <div className="grid gap-3">
                      {approvedMethods.map((method) => (
                        <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                           <div className="flex items-center gap-3">
                             {method.payment_method_type === 'mpesa' ? (
                               <Smartphone className="h-5 w-5 text-green-600" />
                             ) : method.payment_method_type === 'card' || method.payment_method_type === 'stripe' ? (
                               <CreditCard className="h-5 w-5 text-blue-600" />
                             ) : method.payment_method_type === 'bank_transfer' ? (
                               <Building2 className="h-5 w-5 text-purple-600" />
                             ) : (
                               <CreditCard className="h-5 w-5" />
                             )}
                            <div>
                              <div className="font-medium">{method.provider_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {method.payment_method_type.toUpperCase()} • {method.country_code}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={method.is_active ? "default" : "secondary"}>
                              {method.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Switch
                              checked={method.is_active}
                              onCheckedChange={() => toggleMethodStatus(method.id, method.is_active)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this payment method?')) {
                                  deleteApprovedMethod(method.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules & Settings Tab */}
          <TabsContent value="rules" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Payment Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Payment Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Late Fee Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="late-fee">Late Fee</Label>
                      <Switch
                        id="late-fee"
                        checked={lateFeeEnabled}
                        onCheckedChange={setLateFeeEnabled}
                      />
                    </div>
                    
                    {lateFeeEnabled && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="late-fee-amount">Amount</Label>
                          <Input
                            id="late-fee-amount"
                            value={lateFeeAmount}
                            onChange={(e) => setLateFeeAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="late-fee-type">Type</Label>
                          <Select value={lateFeeType} onValueChange={setLateFeeType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Grace Period */}
                  <div className="space-y-2">
                    <Label htmlFor="grace-period">Grace Period (days)</Label>
                    <Input
                      id="grace-period"
                      value={gracePeriod}
                      onChange={(e) => setGracePeriod(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of days after due date before late fees apply
                    </p>
                  </div>

                  <Separator />

                  {/* Auto Payment */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-payment">Auto Payment</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow tenants to set up recurring payments
                      </p>
                    </div>
                    <Switch
                      id="auto-payment"
                      checked={autoPaymentEnabled}
                      onCheckedChange={setAutoPaymentEnabled}
                    />
                  </div>

                  {/* Partial Payment */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="partial-payment">Partial Payments</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow tenants to make partial payments
                      </p>
                    </div>
                    <Switch
                      id="partial-payment"
                      checked={partialPaymentAllowed}
                      onCheckedChange={setPartialPaymentAllowed}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Reminders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Payment Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reminder-days">Before Due Date (days)</Label>
                    <Input
                      id="reminder-days"
                      placeholder="3,7,14"
                      value={reminderDays}
                      onChange={(e) => setReminderDays(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of days before due date to send reminders
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="overdue-reminder-days">After Due Date (days)</Label>
                    <Input
                      id="overdue-reminder-days"
                      placeholder="1,5,10"
                      value={overdueReminderDays}
                      onChange={(e) => setOverdueReminderDays(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of days after due date to send overdue notices
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PaymentConfiguration;