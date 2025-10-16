import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Mail, MessageCircle, Settings, Save } from "lucide-react";

interface CommunicationPreference {
  id: string;
  setting_name: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  description: string;
}

const CommunicationSettings = () => {
  const [preferences, setPreferences] = useState<CommunicationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("communication_preferences")
        .select("*")
        .order("setting_name");

      if (error) throw error;
      setPreferences(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load communication preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (id: string, field: 'email_enabled' | 'sms_enabled', value: boolean) => {
    setPreferences(prev => 
      prev.map(pref => 
        pref.id === id ? { ...pref, [field]: value } : pref
      )
    );
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const updates = preferences.map(pref => ({
        id: pref.id,
        email_enabled: pref.email_enabled,
        sms_enabled: pref.sms_enabled,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("communication_preferences")
          .update({
            email_enabled: update.email_enabled,
            sms_enabled: update.sms_enabled,
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Communication preferences have been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getSettingDisplayName = (settingName: string) => {
    const names: Record<string, string> = {
      user_account_creation: "User Account Creation",
      tenant_account_creation: "Tenant Account Creation", // Legacy support
      password_reset: "Password Reset",
      payment_notifications: "Payment Notifications", 
      maintenance_notifications: "Maintenance Notifications",
      general_announcements: "General Announcements",
    };
    return names[settingName] || settingName.replace(/_/g, " ");
  };

  const getChannelStatus = (emailEnabled: boolean, smsEnabled: boolean) => {
    if (emailEnabled && smsEnabled) return "Both Channels";
    if (emailEnabled) return "Email Only";
    if (smsEnabled) return "SMS Only";
    return "Disabled";
  };

  const getStatusVariant = (emailEnabled: boolean, smsEnabled: boolean) => {
    if (emailEnabled && smsEnabled) return "default";
    if (emailEnabled || smsEnabled) return "secondary";
    return "destructive";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Communication Settings</h1>
            <p className="text-muted-foreground">
              Configure how the system communicates with users across different scenarios
            </p>
          </div>
          <Button onClick={savePreferences} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="grid gap-6">
          {preferences.map((preference) => (
            <Card key={preference.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      {getSettingDisplayName(preference.setting_name)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {preference.description}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(preference.email_enabled, preference.sms_enabled)}>
                    {getChannelStatus(preference.email_enabled, preference.sms_enabled)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor={`email-${preference.id}`} className="text-sm font-medium">
                        Email Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Send notifications via email
                      </p>
                    </div>
                    <Switch
                      id={`email-${preference.id}`}
                      checked={preference.email_enabled}
                      onCheckedChange={(checked) => 
                        updatePreference(preference.id, 'email_enabled', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor={`sms-${preference.id}`} className="text-sm font-medium">
                        SMS Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Send notifications via SMS
                      </p>
                    </div>
                    <Switch
                      id={`sms-${preference.id}`}
                      checked={preference.sms_enabled}
                      onCheckedChange={(checked) => 
                        updatePreference(preference.id, 'sms_enabled', checked)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • <strong>User Account Creation:</strong> When creating any user accounts (Landlords, Tenants, Agents, etc.), login credentials will be sent via the selected communication method(s)
            </p>
            <p className="text-sm text-muted-foreground">
              • <strong>Password Reset:</strong> Users will receive password reset instructions through the selected channel(s)
            </p>
            <p className="text-sm text-muted-foreground">
              • <strong>SMS Requirements:</strong> SMS functionality requires proper SMS provider configuration
            </p>
            <p className="text-sm text-muted-foreground">
              • <strong>Email Requirements:</strong> Email functionality requires Resend API configuration
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationSettings;