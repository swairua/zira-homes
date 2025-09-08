import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageSquare, Plus, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  enabled: boolean;
  variables: string[];
  landlord_id?: string;
  is_default?: boolean;
}

const MessageTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [defaultTemplates, setDefaultTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const categories = [
    { value: 'payment_reminders', label: 'Payment Reminders' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'lease_management', label: 'Lease Management' },
    { value: 'general', label: 'General' }
  ];

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // Load landlord's custom templates  
      const { data: customTemplates, error: customError } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('landlord_id', user?.id)
        .order('name');

      if (customError) throw customError;

      // Load default/global templates for reference
      const { data: globalTemplates, error: globalError } = await supabase
        .from('sms_templates')
        .select('*')
        .is('landlord_id', null)
        .eq('enabled', true)
        .order('name');

      if (globalError) throw globalError;

      setTemplates(customTemplates || []);
      setDefaultTemplates(globalTemplates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error("Failed to load SMS templates.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      content: '',
      category: 'payment_reminders',
      enabled: true,
      variables: [],
      landlord_id: user?.id
    });
    setIsCreating(true);
  };

  const handleEditTemplate = (template: SMSTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      if (isCreating) {
        const { error } = await supabase
          .from('sms_templates')
          .insert([{
            ...editingTemplate,
            landlord_id: user?.id
          }]);

        if (error) throw error;

        toast.success("SMS template created successfully.");
      } else {
        const { error } = await supabase
          .from('sms_templates')
          .update(editingTemplate)
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast.success("SMS template updated successfully.");
      }

      setEditingTemplate(null);
      setIsCreating(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error("Failed to save SMS template.");
    }
  };

  const handleCustomizeDefault = (defaultTemplate: SMSTemplate) => {
    setEditingTemplate({
      ...defaultTemplate,
      id: '',
      landlord_id: user?.id,
      name: `${defaultTemplate.name} (Custom)`
    });
    setIsCreating(true);
  };

  if (loading) {
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
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        <FeatureGate
          feature={FEATURES.CUSTOM_SMS_TEMPLATES}
          fallbackTitle="Custom SMS Templates"
          fallbackDescription="Create and manage custom SMS templates for your property communications. Personalize messages with variables and organize by category."
          allowReadOnly={true}
          readOnlyMessage="View-only mode - upgrade to Pro to create and edit custom templates"
        >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">SMS Templates</h1>
            <p className="text-muted-foreground">
              Customize SMS templates for your property communications
            </p>
          </div>
          <Button onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        <Tabs defaultValue="custom" className="space-y-6">
          <TabsList>
            <TabsTrigger value="custom">My Templates</TabsTrigger>
            <TabsTrigger value="defaults">Default Templates</TabsTrigger>
          </TabsList>

          {/* Custom Templates */}
          <TabsContent value="custom" className="space-y-4">
            {editingTemplate ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{isCreating ? 'Create' : 'Edit'} SMS Template</span>
                    <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        placeholder="e.g., Payment Reminder"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={editingTemplate.category}
                        onValueChange={(value) => setEditingTemplate({ ...editingTemplate, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="content">SMS Content</Label>
                    <Textarea
                      id="content"
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                      placeholder="Write your SMS template content here..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use variables like {'{tenant_name}'}, {'{property_name}'}, {'{amount}'} to personalize messages.
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveTemplate}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Custom Templates</h3>
                      <p className="text-muted-foreground mb-4">
                        Create custom SMS templates or customize default ones.
                      </p>
                      <Button onClick={handleCreateTemplate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Template
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <Card key={template.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between text-base">
                            <span>{template.name}</span>
                            <Badge variant={template.enabled ? "default" : "secondary"}>
                              {template.enabled ? "Active" : "Disabled"}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {categories.find(c => c.value === template.category)?.label}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4 line-clamp-2">{template.content}</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Default Templates */}
          <TabsContent value="defaults" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {defaultTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{template.name}</span>
                      <Badge variant="outline">
                        Default
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {categories.find(c => c.value === template.category)?.label}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4 line-clamp-2">{template.content}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCustomizeDefault(template)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Customize
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        </FeatureGate>
      </div>
    </DashboardLayout>
  );
};

export default MessageTemplates;