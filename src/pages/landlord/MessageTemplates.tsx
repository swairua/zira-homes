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
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Edit, Save, X, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  type: string;
  enabled: boolean;
  variables: string[];
  subject?: string;
  landlord_id?: string;
}

const LandlordMessageTemplates = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [defaultTemplates, setDefaultTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const categories = [
    { value: 'tenant_communication', label: 'Tenant Communication' },
    { value: 'payment_reminders', label: 'Payment Reminders' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'lease_management', label: 'Lease Management' },
    { value: 'notifications', label: 'Notifications' }
  ];

  const messageTypes = [
    { value: 'sms', label: 'SMS', icon: '📱' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { value: 'push', label: 'Push Notification', icon: '🔔' }
  ];

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // Load landlord's custom templates
      const { data: customTemplates, error: customError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('landlord_id', user?.id)
        .order('name');

      if (customError) throw customError;

      // Load default/global templates for reference
      const { data: globalTemplates, error: globalError } = await supabase
        .from('message_templates')
        .select('*')
        .is('landlord_id', null)
        .eq('enabled', true)
        .order('name');

      if (globalError) throw globalError;

      setTemplates(customTemplates || []);
      setDefaultTemplates(globalTemplates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Failed to load message templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      content: '',
      category: 'tenant_communication',
      type: 'sms',
      enabled: true,
      variables: [],
      landlord_id: user?.id
    });
    setIsCreating(true);
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      if (isCreating) {
        const { error } = await supabase
          .from('message_templates')
          .insert([{
            ...editingTemplate,
            landlord_id: user?.id
          }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Message template created successfully.",
        });
      } else {
        const { error } = await supabase
          .from('message_templates')
          .update(editingTemplate)
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Message template updated successfully.",
        });
      }

      setEditingTemplate(null);
      setIsCreating(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save message template.",
        variant: "destructive",
      });
    }
  };

  const handleCustomizeDefault = (defaultTemplate: MessageTemplate) => {
    setEditingTemplate({
      ...defaultTemplate,
      id: '',
      landlord_id: user?.id,
      name: `${defaultTemplate.name} (Custom)`
    });
    setIsCreating(true);
  };

  const getCharacterCount = (content: string, type: string) => {
    if (type === 'sms') {
      return `${content.length}/160`;
    }
    return `${content.length} characters`;
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Message Templates</h1>
            <p className="text-muted-foreground">
              Customize SMS, WhatsApp, and notification templates
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
                    <span>{isCreating ? 'Create' : 'Edit'} Message Template</span>
                    <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        placeholder="e.g., Payment Reminder SMS"
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
                    <div className="space-y-2">
                      <Label htmlFor="type">Message Type</Label>
                      <Select
                        value={editingTemplate.type}
                        onValueChange={(value) => setEditingTemplate({ ...editingTemplate, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {messageTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                {type.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {editingTemplate.type === 'whatsapp' && (
                    <div className="space-y-2">
                      <Label htmlFor="subject">WhatsApp Subject (Optional)</Label>
                      <Input
                        id="subject"
                        value={editingTemplate.subject || ''}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                        placeholder="e.g., Payment Reminder"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="content">Message Content</Label>
                      <span className="text-xs text-muted-foreground">
                        {getCharacterCount(editingTemplate.content, editingTemplate.type)}
                      </span>
                    </div>
                    <Textarea
                      id="content"
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                      placeholder="Write your message template here..."
                      rows={6}
                      maxLength={editingTemplate.type === 'sms' ? 160 : undefined}
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
                        Create custom message templates or customize default ones.
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
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {messageTypes.find(t => t.value === template.type)?.icon}
                              </span>
                              <Badge variant={template.enabled ? "default" : "secondary"}>
                                {template.enabled ? "Active" : "Disabled"}
                              </Badge>
                            </div>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {categories.find(c => c.value === template.category)?.label} • {messageTypes.find(t => t.value === template.type)?.label}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4 line-clamp-3">{template.content}</p>
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
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {messageTypes.find(t => t.value === template.type)?.icon}
                        </span>
                        <Badge variant="outline">
                          Default
                        </Badge>
                      </div>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {categories.find(c => c.value === template.category)?.label} • {messageTypes.find(t => t.value === template.type)?.label}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4 line-clamp-3">{template.content}</p>
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
      </div>
    </DashboardLayout>
  );
};

export default LandlordMessageTemplates;