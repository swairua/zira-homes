import React, { useState, useEffect } from "react";
import { Settings, FileText, Download, Palette, Building, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SimplifiedTemplateCustomizer } from "@/components/admin/pdf-templates/SimplifiedTemplateCustomizer";
import { UnifiedPDFRenderer, BrandingData } from "@/utils/unifiedPDFRenderer";
import { toast } from "sonner";

interface DocumentTemplate {
  type: 'invoice' | 'report' | 'letter' | 'notice' | 'lease';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const documentTemplates: DocumentTemplate[] = [
  {
    type: 'invoice',
    name: 'Invoice Template',
    description: 'Generate professional invoices with your branding',
    icon: FileText
  },
  {
    type: 'report',
    name: 'Report Template', 
    description: 'Create detailed reports with charts and data',
    icon: FileText
  },
  {
    type: 'letter',
    name: 'Letter Template',
    description: 'Professional letters and correspondence',
    icon: FileText
  },
  {
    type: 'notice',
    name: 'Notice Template',
    description: 'Official notices and announcements',
    icon: FileText
  },
  {
    type: 'lease',
    name: 'Lease Template',
    description: 'Lease agreements and legal documents',
    icon: FileText
  }
];

const PDFTemplateManager = () => {
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [brandingData, setBrandingData] = useState<BrandingData | null>(null);

  useEffect(() => {
    // Load branding from database first, fallback to localStorage
    const loadBranding = async () => {
      try {
        const { BrandingFetcher } = await import('@/utils/brandingFetcher');
        const branding = await BrandingFetcher.fetchBranding();
        setBrandingData(branding);
      } catch (error) {
        console.warn('Failed to load branding from database, using localStorage:', error);
        
        // Fallback to localStorage
        const saved = localStorage.getItem('pdf-branding-data');
        if (saved) {
          setBrandingData(JSON.parse(saved));
        } else {
          // Migration: check old key and migrate data
          const oldSaved = localStorage.getItem('brandingPreferences');
          if (oldSaved) {
            const data = JSON.parse(oldSaved);
            localStorage.setItem('pdf-branding-data', oldSaved);
            localStorage.removeItem('brandingPreferences');
            setBrandingData(data);
          }
        }
      }
    };

    loadBranding();
  }, []);

  const handleSaveBranding = async (data: BrandingData) => {
    try {
      setBrandingData(data);
      
      // Save to database as platform-wide branding
      const { PDFTemplateService } = await import('@/utils/pdfTemplateService');
      await PDFTemplateService.saveBrandingProfile(data, 'platform');
      
      setIsCustomizerOpen(false);
      toast.success("Global branding preferences saved and applied across all PDF generation!");
    } catch (error) {
      console.error('Failed to save branding:', error);
      toast.error("Failed to save branding preferences. Changes saved locally only.");
      
      // Fallback to localStorage
      localStorage.setItem('pdf-branding-data', JSON.stringify(data));
      setBrandingData(data);
      setIsCustomizerOpen(false);
    }
  };

  const handleGenerateDocument = (templateType: DocumentTemplate['type']) => {
    if (!brandingData) {
      toast.error("Please customize your branding first!");
      setIsCustomizerOpen(true);
      return;
    }

    const pdfRenderer = new UnifiedPDFRenderer();
    
    // Sample content based on document type
    const sampleContent = getSampleContent(templateType);
    
    const document = {
      type: templateType,
      title: `Sample ${templateType.charAt(0).toUpperCase() + templateType.slice(1)}`,
      content: sampleContent
    };

    pdfRenderer.generateDocument(document, brandingData);
    toast.success(`${templateType.charAt(0).toUpperCase() + templateType.slice(1)} generated successfully!`);
  };

  const getSampleContent = (type: DocumentTemplate['type']) => {
    switch (type) {
      case 'invoice':
        return {
          invoiceNumber: 'INV-2024-00123',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          items: [
            { description: 'Property Management Service', amount: 1500.00 },
            { description: 'Communication Services', amount: 150.00 },
            { description: 'Maintenance Coordination', amount: 200.00 }
          ],
          total: 1850.00,
          recipient: {
            name: 'John Doe',
            address: '456 Property Lane\nCity, State 12345'
          },
          notes: 'Payment is due within 30 days. Thank you for your business.'
        };
      
      case 'report':
        return {
          reportPeriod: 'December 2024',
          summary: 'This monthly report provides an overview of property management activities, financial performance, and key metrics for the reporting period.',
          kpis: [
            { label: 'Total Revenue', value: '$45,200', trend: 'up' as const },
            { label: 'Properties Managed', value: '28', trend: 'stable' as const },
            { label: 'Collection Rate', value: '94.5%', trend: 'up' as const },
            { label: 'Maintenance Requests', value: '12', trend: 'down' as const }
          ],
          data: [
            { Property: 'Sunset Apartments', Revenue: 12500, 'Collection Rate': '98%' },
            { Property: 'Ocean View Complex', Revenue: 15600, 'Collection Rate': '92%' },
            { Property: 'Downtown Lofts', Revenue: 17100, 'Collection Rate': '96%' }
          ]
        };
      
      case 'letter':
      case 'notice':
        return {
          recipient: {
            name: 'John Doe',
            address: '456 Property Lane\nCity, State 12345'
          },
          subject: type === 'notice' ? 'Important Property Notice' : 'Property Management Update',
          body: `Dear John Doe,\n\nWe hope this ${type} finds you well. We are writing to inform you about important updates regarding your property.\n\nPlease contact us if you have any questions or concerns.\n\nThank you for your attention to this matter.`,
          sender: {
            name: brandingData?.companyName || 'Property Manager',
            title: 'Property Management Team'
          }
        };
      
      case 'lease':
        return {
          recipient: {
            name: 'John Doe',
            address: '456 Property Lane\nCity, State 12345'
          },
          subject: 'Lease Agreement Documentation',
          body: 'This document contains the lease agreement terms and conditions. Please review all sections carefully and contact us with any questions.',
          sender: {
            name: brandingData?.companyName || 'Property Manager',
            title: 'Leasing Department'
          }
        };
      
      default:
        return {};
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">PDF Document Generator</h1>
            <p className="text-muted-foreground">
              Generate professional branded documents with a unified template system
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setIsCustomizerOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Customize Branding
            </Button>
          </div>
        </div>

        {/* Branding Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Current Branding Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brandingData ? (
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{brandingData.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primary Color</p>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: brandingData.primaryColor }}
                    />
                    <span className="font-medium">{brandingData.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium text-green-600">✓ Configured</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Branding Configured</h3>
                <p className="text-muted-foreground mb-4">
                  Customize your branding to generate professional documents
                </p>
                <Button onClick={() => setIsCustomizerOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Setup Branding
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Document Generation
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Generate professional documents instantly with your branding
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentTemplates.map((template) => (
                <Card key={template.type} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <template.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {template.description}
                        </p>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleGenerateDocument(template.type)}
                          disabled={!brandingData}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Generate Sample
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">🎨 Unified Branding</h4>
                <p className="text-sm text-muted-foreground">
                  Single branding configuration applies to all document types
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">⚡ One-Click Generation</h4>
                <p className="text-sm text-muted-foreground">
                  Generate professional PDFs instantly with consistent formatting
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">📄 Multiple Document Types</h4>
                <p className="text-sm text-muted-foreground">
                  Invoices, reports, letters, notices, and lease agreements
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🔧 Easy Customization</h4>
                <p className="text-sm text-muted-foreground">
                  Simple form-based interface with live preview
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branding Customizer Dialog */}
        <Dialog open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
          <DialogContent className="max-w-full max-h-[95vh] w-[95vw] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Brand Customization</DialogTitle>
              <DialogDescription>
                Configure your global branding that will be applied to all generated documents.
              </DialogDescription>
            </DialogHeader>
            <SimplifiedTemplateCustomizer
              onSave={handleSaveBranding}
              onClose={() => setIsCustomizerOpen(false)}
              initialData={brandingData || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PDFTemplateManager;