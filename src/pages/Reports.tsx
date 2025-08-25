
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign,
  Download,
  BarChart3,
  Eye,
  PieChart,
  Wrench,
  UserX,
  AlertTriangle,
  LineChart,
  Calculator
} from "lucide-react";
import { reportConfigs } from "@/lib/reporting/config";
import { PreviewReportDialog } from "@/components/reporting/PreviewReportDialog";
import { PDFGenerationProgress } from "@/components/ui/pdf-generation-progress";
import { ReportPreloadManager } from "@/components/reporting/ReportPreloadManager";
import { QuickExpiryCheck } from "@/components/reports/QuickExpiryCheck";
import { ReportKpiCards } from "@/components/reports/ReportKpiCards";
import { useAuth } from "@/hooks/useAuth";
import { useExecutiveSummary } from "@/hooks/useExecutiveSummary";
import { useOptimizedReportGeneration } from "@/hooks/useOptimizedReportGeneration";
import { useReportPrefetch } from "@/hooks/useReportPrefetch";
import { testPDFHealth } from "@/utils/testPDFGeneration";
import { fmtCurrency } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentGeneratingReport, setCurrentGeneratingReport] = useState<string>("");
  const [userRole, setUserRole] = useState<string>('landlord');
  const { user } = useAuth();
  const { 
    generateOptimizedReport, 
    isActive: isGenerating, 
    progress, 
    currentStep 
  } = useOptimizedReportGeneration();
  const { prefetchReportData } = useReportPrefetch();

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      try {
        // Check if user is a tenant first
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (tenant) {
          setUserRole("tenant");
          return;
        }

        // Check user roles table
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (userRoles && userRoles.length > 0) {
          const roles = userRoles.map(r => r.role);
          if (roles.includes("Admin")) {
            setUserRole("admin");
          } else if (roles.includes("Landlord")) {
            setUserRole("landlord");
          } else if (roles.includes("Manager")) {
            setUserRole("manager");
          } else if (roles.includes("Agent")) {
            setUserRole("agent");
          } else {
            setUserRole("landlord"); // Default fallback
          }
        } else {
          setUserRole("landlord"); // Default fallback
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("landlord"); // Default fallback
      }
    };

    fetchUserRole();
  }, [user]);

  // Basic SEO for the page
  useEffect(() => {
    document.title = 'Reports | Zira Homes';
    const metaDesc = 'Generate executive, financial, and operational property management reports.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaDesc);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, []);

  // Filter reports based on user role
  const availableReports = reportConfigs.filter(config => 
    config.roles.includes(userRole as any)
  );

  const handlePreviewReport = (config: any) => {
    // Compute filters from default period for instant prefetch
    const getPeriodDates = (preset: string) => {
      const now = new Date();
      switch (preset) {
        case 'current_period':
          return { startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], 
                   endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
        case 'last_12_months':
          return { startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0], 
                   endDate: now.toISOString().split('T')[0] };
        case 'ytd':
          return { startDate: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0], 
                   endDate: now.toISOString().split('T')[0] };
        default:
          return { startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], 
                   endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
      }
    };

    const dates = getPeriodDates(config.defaultPeriod);
    const filters = {
      periodPreset: config.defaultPeriod,
      ...dates
    };

    // Instant prefetch before opening preview
    prefetchReportData(config.queryId, filters, config.title);
    
    setSelectedReport(config);
    setPreviewOpen(true);
  };

  const handleGenerateReport = async (reportConfig: any, filters: any) => {
    try {
      setCurrentGeneratingReport(reportConfig.title);
      setProgressOpen(true);
      
      // Add date range to filters if using preset
      const updatedFilters = {
        ...filters,
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      
      await generateOptimizedReport(
        reportConfig.queryId, // Use queryId for data fetching
        reportConfig.title,
        updatedFilters
      );
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const getReportIcon = (reportId: string) => {
    const iconMap: Record<string, any> = {
      'rent-collection': DollarSign,
      'financial-summary': BarChart3,
      'occupancy-report': Building2,
      'maintenance-report': Wrench,
      'lease-expiry': Calendar,
      'tenant-turnover': UserX,
      'outstanding-balances': AlertTriangle,
      'property-performance': TrendingUp,
      'profit-loss': Calculator,
      'revenue-vs-expenses': LineChart,
      'expense-summary': PieChart,
      'cash-flow': TrendingUp,
      'market-rent': Building2,
      'executive-summary': BarChart3,
    };
    return iconMap[reportId] || FileText;
  };

  // Find the executive summary report
  const executiveSummaryReport = availableReports.find(config => config.id === 'executive-summary');
  const leaseExpiryReport = availableReports.find(config => config.id === 'lease-expiry');

  // Get executive summary data
  const { totalRevenue, netOperatingIncome, outstandingAmount, isLoading: summaryLoading } = useExecutiveSummary();

  const handleViewLeaseExpiryDetails = () => {
    if (leaseExpiryReport) {
      handlePreviewReport(leaseExpiryReport);
    }
  };

  const handleKpiClick = (reportType: string) => {
    switch (reportType) {
      case 'rent-collection':
        const rentReport = availableReports.find(r => r.id === 'rent-collection');
        if (rentReport) {
          handlePreviewReport(rentReport);
        }
        break;
      case 'scheduled':
        // Scroll to reports grid
        document.getElementById('reports-grid')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'all':
      case 'coverage':
      default:
        // Show a toast with info
        toast.success("Browse available reports below to generate detailed insights.");
    }
  };

  return (
    <DashboardLayout>
      <ReportPreloadManager 
        filters={{ periodPreset: 'current_period' }}
      />
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Reports</h1>
          <p className="text-muted-foreground">
            Generate financial and operational reports
          </p>
        </div>

        {/* Executive Summary Section */}
        {executiveSummaryReport && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Executive Summary Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Portfolio Overview</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Our property management portfolio spans multiple premium properties, 
                    maintaining strong collection rates and occupancy levels.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Revenue (YTD)</span>
                      {summaryLoading ? (
                        <div className="h-4 w-16 bg-muted animate-pulse rounded"></div>
                      ) : (
                        <span className="font-medium text-success">{fmtCurrency(totalRevenue)}</span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net Operating Income</span>
                      {summaryLoading ? (
                        <div className="h-4 w-16 bg-muted animate-pulse rounded"></div>
                      ) : (
                        <span className="font-medium text-success">{fmtCurrency(netOperatingIncome)}</span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Outstanding Balances</span>
                      {summaryLoading ? (
                        <div className="h-4 w-16 bg-muted animate-pulse rounded"></div>
                      ) : (
                        <span className="font-medium text-warning">{fmtCurrency(outstandingAmount)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Key Insights</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 bg-success rounded-full mt-1.5 flex-shrink-0"></div>
                      <p className="text-sm text-muted-foreground">Real-time collection tracking</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 bg-warning rounded-full mt-1.5 flex-shrink-0"></div>
                      <p className="text-sm text-muted-foreground">Lease renewal monitoring</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 bg-accent rounded-full mt-1.5 flex-shrink-0"></div>
                      <p className="text-sm text-muted-foreground">Maintenance cost optimization</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleGenerateReport(executiveSummaryReport, { periodPreset: 'current_period' })}
                      disabled={isGenerating}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isGenerating ? `${Math.round(progress)}%` : 'Download Summary'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                      onClick={testPDFHealth}
                    >
                      Test PDF
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Expiry Check */}
        <QuickExpiryCheck onViewDetails={handleViewLeaseExpiryDetails} hideWhenEmpty />

        {/* KPI Summary Cards */}
        <ReportKpiCards onReportClick={handleKpiClick} />

        {/* Reports Grid */}
        <div id="reports-grid" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableReports.map((config) => {
            const IconComponent = getReportIcon(config.id);
            
            return (
              <Card key={config.id} className="hover:shadow-elevated transition-all duration-300 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-foreground">
                          {config.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-success text-white">
                      Ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Period:</span>
                      <span className="font-medium text-foreground">{config.defaultPeriod.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handlePreviewReport(config)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-primary hover:bg-primary/90"
                        onClick={() => handleGenerateReport(config, { periodPreset: config.defaultPeriod })}
                        disabled={isGenerating}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Generate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Preview Dialog */}
        {selectedReport && (
          <PreviewReportDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            reportConfig={selectedReport}
            onGeneratePDF={(filters) => handleGenerateReport(selectedReport, filters)}
            isGenerating={isGenerating}
          />
        )}

        {/* PDF Generation Progress Dialog */}
        <PDFGenerationProgress
          open={progressOpen}
          onOpenChange={setProgressOpen}
          isGenerating={isGenerating}
          progress={progress}
          currentStep={currentStep}
          isComplete={false}
          reportTitle={currentGeneratingReport}
        />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
