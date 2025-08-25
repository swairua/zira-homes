import jsPDF from 'jspdf';
import { EnhancedChartRenderer } from './enhancedChartRenderer';
import { ReportChartDataService } from './reportChartDataService';
import { PDFLayoutOptimizer } from './pdfLayoutOptimizer';
import { formatAmount, compactCurrency } from './currency';
import { CachedAssets } from './cachedAssets';

export interface BrandingData {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  websiteUrl?: string;
  // Report layout preferences
  reportLayout?: {
    chartDimensions: 'ultra-compact' | 'compact' | 'standard' | 'large';
    kpiStyle: 'cards' | 'minimal' | 'detailed';
    sectionSpacing: 'tight' | 'normal' | 'spacious';
    showGridlines: boolean;
    accentColor?: string;
    layoutDensity?: 'compact' | 'standard' | 'spacious';
    contentFlow?: 'traditional' | 'optimized' | 'dense';
    maxKpisPerRow?: number;
    chartSpacing?: 'minimal' | 'normal' | 'generous';
  };
}

export interface DocumentContent {
  type: 'invoice' | 'report' | 'letter' | 'notice' | 'lease';
  title: string;
  content: any;
}

interface InvoiceContent {
  invoiceNumber: string;
  dueDate: Date;
  items: Array<{ description: string; amount: number; quantity?: number }>;
  total: number;
  recipient: {
    name: string;
    address: string;
  };
  notes?: string;
}

interface ReportContent {
  type?: string;
  reportPeriod: string;
  summary: string;
  kpis: Array<{ id?: string; label: string; value: string; trend?: 'up' | 'down' | 'stable'; change?: string; description?: string }>;
  tableData?: Array<Record<string, any>>;
  charts?: Array<any>; // Chart configurations for enhanced report rendering
  includeCharts?: boolean; // Flag to enable/disable chart generation
}

interface LetterContent {
  recipient: {
    name: string;
    address: string;
  };
  subject: string;
  body: string;
  sender?: {
    name: string;
    title: string;
  };
}

export class UnifiedPDFRenderer {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number;
  private pageWidth: number;
  private margins = { top: 10, bottom: 20, left: 12, right: 12 }; // Ultra-compact margins for maximum content space
  private layoutOptimizer: PDFLayoutOptimizer;

  constructor() {
    // Enable compression for smaller, faster PDF files
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.layoutOptimizer = new PDFLayoutOptimizer(this.pdf, {
      pageHeight: this.pageHeight,
      pageWidth: this.pageWidth,
      margins: this.margins,
      headerHeight: 25,
      footerHeight: 15
    });
  }

  private formatTableHeader(header: string): string {
    return header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  private formatTableValue(value: any, header: string): string {
    if (value === null || value === undefined) return '-';
    const h = header.toLowerCase();
    
    // Format currency-like values using global currency
    const currencyKeywords = ['amount','rent','balance','revenue','expense','expenses','income','cost','fee','fees','payment','paid'];
    if (currencyKeywords.some(k => h.includes(k))) {
      const match = String(value).match(/-?[\d,]+\.?\d*/);
      if (match) {
        const num = parseFloat(match[0].replace(/,/g, ''));
        if (!isNaN(num)) return formatAmount(num);
      }
      if (typeof value === 'number') return formatAmount(value);
    }
    
    // Format dates (Date objects and parseable strings)
    if (h.includes('date')) {
      if (value instanceof Date) return value.toLocaleDateString();
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }
    
    // Truncate long strings
    const str = String(value);
    return str.length > 25 ? str.substring(0, 22) + '...' : str;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 37, g: 99, b: 235 }; // Default blue
  }

  private fitTextToWidth(text: string, maxWidth: number, fontSize: number): { text: string; fontSize: number } {
    this.pdf.setFontSize(fontSize);
    const textWidth = this.pdf.getTextWidth(text);
    
    if (textWidth <= maxWidth) {
      return { text, fontSize };
    }
    
    // Try compact formatting for large numbers
    const compactText = this.getCompactValue(text);
    if (compactText !== text) {
      const compactWidth = this.pdf.getTextWidth(compactText);
      if (compactWidth <= maxWidth) {
        return { text: compactText, fontSize };
      }
    }
    
    // Scale down font size if needed
    const scaleFactor = maxWidth / textWidth;
    const newFontSize = Math.max(8, fontSize * scaleFactor);
    return { text, fontSize: newFontSize };
  }

  private getCompactValue(text: string): string {
    const numberMatch = text.match(/[\d,]+\.?\d*/);
    if (!numberMatch) return text;
    
    const numStr = numberMatch[0].replace(/,/g, '');
    const num = parseFloat(numStr);
    
    if (isNaN(num)) return text;
    
    // Use the new compactCurrency helper for consistent formatting
    const compactFormatted = compactCurrency(num);
    return text.replace(numberMatch[0], compactFormatted.replace(/^[A-Z]+ /, ''));
  }

  private checkPageBreak(requiredHeight: number, sectionType: 'header' | 'kpi' | 'chart' | 'table' | 'content' = 'content'): void {
    const footerSpace = 25; // Reserved space for footer
    const availableHeight = this.pageHeight - this.margins.bottom - footerSpace;
    
    if (this.currentY + requiredHeight > availableHeight) {
      this.pdf.addPage();
      this.currentY = this.margins.top;
      
      // Add header to new page if needed
      if (sectionType !== 'header') {
        this.currentY += 8; // Space for potential header on continuation
      }
    }
  }

  private async addHeaderWithLogo(platformBranding: BrandingData, template?: any): Promise<void> {
    // Use template header styling if available
    const headerConfig = template?.content?.header || {};
    const headerStyle = headerConfig.style || {};
    const headerHeight = headerConfig.height || 35;
    
    // Professional header background
    const primaryColor = this.hexToRgb(headerStyle.backgroundColor || '#1B365D');
    this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.rect(0, 0, this.pageWidth, headerHeight, 'F');
    
    // Enhanced logo placement with cached base64 for performance
    let logoWidth = 0;
    if (platformBranding.logoUrl && headerConfig.showLogo !== false) {
      try {
        const cachedLogoData = await CachedAssets.getLogoAsBase64(platformBranding.logoUrl);
        if (cachedLogoData) {
          const maxHeight = headerStyle.logoMaxHeight || 18;
          const maxWidth = 30;
          
          // Use fixed aspect ratio for cached logos to avoid additional requests
          const aspectRatio = 2.0; // Default 2:1 aspect ratio for logos
          let logoHeight = maxHeight;
          let calculatedWidth = logoHeight * aspectRatio;
          
          if (calculatedWidth > maxWidth) {
            calculatedWidth = maxWidth;
            logoHeight = calculatedWidth / aspectRatio;
          }
          
          logoWidth = calculatedWidth;
          const logoY = (headerHeight - logoHeight) / 2;
          this.pdf.addImage(cachedLogoData, 'PNG', 10, logoY, calculatedWidth, logoHeight);
        }
      } catch (error) {
        console.warn('Failed to add logo to PDF:', error);
        logoWidth = 0;
      }
    }
    
    // Company information with template styling
    if (headerConfig.showCompanyInfo !== false) {
      const textColor = this.hexToRgb(headerStyle.textColor || '#FFFFFF');
      this.pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      
      // Company name
      this.pdf.setFontSize(headerStyle.companyNameSize || 18);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(platformBranding.companyName, logoWidth + 15, headerHeight * 0.45);
      
      // Company tagline  
      this.pdf.setFontSize(headerStyle.taglineSize || 10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(textColor.r - 20, textColor.g - 20, textColor.b - 20);
      this.pdf.text(platformBranding.companyTagline, logoWidth + 15, headerHeight * 0.75);
    }
    
    this.currentY = headerHeight + 10;
  }

  private getImageDimensions(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        // Return default dimensions if image fails to load
        resolve({ width: 200, height: 100 }); // 2:1 aspect ratio default
      };
      img.src = src;
    });
  }

  private addDocumentTitle(title: string, platformBranding: BrandingData, template?: any): void {
    // Use template title styling if available
    const titleConfig = template?.content?.sections?.title || {};
    const titleStyle = titleConfig.style || {};
    
    // Professional document title with template styling
    const titleColor = this.hexToRgb(titleStyle.color || '#1B365D');
    this.pdf.setTextColor(titleColor.r, titleColor.g, titleColor.b);
    this.pdf.setFontSize(titleStyle.fontSize || 20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margins.left, this.currentY + 8);
    
    // Add professional underline using template styling
    const underlineColor = this.hexToRgb(titleStyle.underlineColor || '#F36F21');
    this.pdf.setDrawColor(underlineColor.r, underlineColor.g, underlineColor.b);
    this.pdf.setLineWidth(titleStyle.underlineWidth || 2);
    this.pdf.line(this.margins.left, this.currentY + 12, this.pageWidth - this.margins.right, this.currentY + 12);
    
    this.currentY += titleStyle.marginBottom || 20;
  }

  private addFooter(platformBranding: BrandingData, template?: any): void {
    // Use template footer styling if available
    const footerConfig = template?.content?.footer || {};
    const footerStyle = footerConfig.style || {};
    const footerHeight = footerConfig.height || 20;
    const footerY = this.pageHeight - footerHeight;
    
    // Professional footer background
    const bgColor = this.hexToRgb(footerStyle.backgroundColor || '#F8F9FB');
    this.pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
    this.pdf.rect(0, footerY, this.pageWidth, footerHeight, 'F');
    
    // Footer border line
    const borderColor = this.hexToRgb(footerStyle.borderColor || '#E2E8F0');
    this.pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(0, footerY, this.pageWidth, footerY);
    
    // Footer text styling
    const textColor = this.hexToRgb(footerStyle.textColor || '#64748B');
    this.pdf.setTextColor(textColor.r, textColor.g, textColor.b);
    this.pdf.setFontSize(footerStyle.fontSize || 8);
    this.pdf.setFont('helvetica', 'normal');
    
    // Company information with template format
    if (footerConfig.showCompanyInfo !== false) {
      const companyFormat = footerStyle.companyInfoFormat || '{companyName} • {phone} • {email}';
      const footerText = companyFormat
        .replace('{companyName}', platformBranding.companyName)
        .replace('{phone}', platformBranding.companyPhone) 
        .replace('{email}', platformBranding.companyEmail);
      this.pdf.text(footerText, this.margins.left, footerY + 8);
    }
    
    // Generation date and page numbers
    if (footerConfig.showGenerationDate !== false) {
      const dateFormat = footerStyle.dateFormat || 'MMM dd, yyyy';
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      this.pdf.text(`Generated: ${currentDate}`, this.margins.left, footerY + 14);
    }
    
    if (footerConfig.showPageNumbers !== false) {
      const pageNumber = this.pdf.getCurrentPageInfo().pageNumber;
      this.pdf.text(`Page ${pageNumber}`, this.pageWidth - this.margins.right, footerY + 11, { align: 'right' });
    }
  }

  // Enhanced methods for report content with better spacing
  private async addLandlordSection(landlordData: any, platformBranding: BrandingData): Promise<void> {
    this.checkPageBreak(25, 'content');
    
    const navyBlue = { r: 27, g: 54, b: 93 };
    this.pdf.setTextColor(navyBlue.r, navyBlue.g, navyBlue.b);
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Property Manager:', this.margins.left, this.currentY);
    
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(landlordData.name || 'Property Manager', this.margins.left, this.currentY + 8);
    this.pdf.text(landlordData.email || 'manager@property.com', this.margins.left, this.currentY + 16);
    this.currentY += 24; // Reduced spacing
  }

  private async addKPISection(kpis: any[], platformBranding: BrandingData, template?: any): Promise<void> {
    if (kpis.length === 0) return;
    
    // Use template styling if available
    const kpiConfig = template?.content?.sections?.kpi || {};
    const cardStyle = kpiConfig.cardStyle || {};
    const typography = kpiConfig.typography || {};
    
    const requiredHeight = this.calculateKPIHeight(kpis, platformBranding);
    this.checkPageBreak(requiredHeight);
    
    // Professional KPI header with template styling
    const navyBlue = { r: 27, g: 54, b: 93 };
    this.pdf.setFillColor(navyBlue.r, navyBlue.g, navyBlue.b);
    this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 10, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('KEY PERFORMANCE INDICATORS', this.margins.left + 6, this.currentY + 7);
    this.currentY += 15;

    // Enhanced KPI card layout
    const availableWidth = this.pageWidth - (this.margins.left + this.margins.right);
    const kpisPerRow = Math.min(kpiConfig.columns || 4, kpis.length);
    const cardSpacing = cardStyle.spacing || 8;
    const cardWidth = (availableWidth - ((kpisPerRow - 1) * cardSpacing)) / kpisPerRow;
    const cardHeight = cardStyle.height || 28;
    
    kpis.forEach((kpi, index) => {
      const col = index % kpisPerRow;
      const row = Math.floor(index / kpisPerRow);
      
      const x = this.margins.left + col * (cardWidth + cardSpacing);
      const y = this.currentY + row * (cardHeight + cardSpacing);
      
      // Enhanced card with clean white background
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(x, y, cardWidth, cardHeight, 'F');
      
      // Professional card border using template styling
      const borderColor = this.hexToRgb(cardStyle.borderColor || '#E2E8F0');
      this.pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
      this.pdf.setLineWidth(cardStyle.borderWidth || 1);
      this.pdf.rect(x, y, cardWidth, cardHeight);
      
      // Add subtle shadow effect (simulated with additional lines)
      this.pdf.setDrawColor(220, 220, 220);
      this.pdf.setLineWidth(0.2);
      this.pdf.line(x + 1, y + cardHeight + 0.5, x + cardWidth + 0.5, y + cardHeight + 0.5);
      this.pdf.line(x + cardWidth + 0.5, y + 1, x + cardWidth + 0.5, y + cardHeight + 0.5);
      
      // KPI Value with template typography and text fitting
      const valueColor = this.hexToRgb(typography.valueColor || '#1B365D');
      this.pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      this.pdf.setFontSize(typography.valueSize || 13);
      this.pdf.setFont('helvetica', 'bold');
      const valueText = kpi.value || String(kpi.amount || kpi.count || '0');
      const fittedValue = this.fitTextToWidth(valueText, cardWidth - (cardStyle.padding || 8) * 2, typography.valueSize || 13);
      this.pdf.text(fittedValue.text, x + (cardStyle.padding || 8), y + 14);
      
      // KPI Label with template typography  
      const labelColor = this.hexToRgb(typography.labelColor || '#64748B');
      this.pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      this.pdf.setFontSize(typography.labelSize || 7);
      this.pdf.setFont('helvetica', 'normal');
      const labelText = kpi.label || kpi.title || 'Metric';
      this.pdf.text(labelText, x + (cardStyle.padding || 8), y + cardHeight - 6);
    });
    
    // Calculate total height used
    const rows = Math.ceil(kpis.length / kpisPerRow);
    const totalHeight = rows * (cardHeight + cardSpacing) - cardSpacing;
    this.currentY += totalHeight + 15; // Professional spacing
  }

  private async addDynamicCharts(charts: any[], platformBranding: BrandingData): Promise<void> {
    if (!charts || charts.length === 0) return; // Skip if no charts
    
    for (const chart of charts) {
      this.currentY = this.layoutOptimizer.addPageBreakIfNeeded(this.currentY, 120, 'chart');
      
      // Professional chart header with enhanced styling
      const navyBlue = { r: 27, g: 54, b: 93 };
      this.pdf.setFillColor(navyBlue.r, navyBlue.g, navyBlue.b);
      this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 12, 'F');
      
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(chart.title || 'VISUAL ANALYSIS', this.margins.left + 6, this.currentY + 8);
      this.currentY += 18;

      if (chart.data && chart.type) {
        try {
          console.log('Processing chart:', {
            title: chart.title,
            type: chart.type,
            hasData: !!chart.data,
            dataKeys: chart.data ? Object.keys(chart.data) : [],
            datasetsLength: chart.data?.datasets?.length || 0
          });

          // Use enhanced chart renderer with branding
          const chartConfig = {
            ...chart,
            branding: platformBranding,
            dimensions: platformBranding.reportLayout?.chartDimensions || 'standard'
          };
          
          console.log('Calling EnhancedChartRenderer with config:', chartConfig.title);
          const chartImageData = await EnhancedChartRenderer.renderChartForPDF(chartConfig);
          
          if (chartImageData && chartImageData.startsWith('data:image')) {
            console.log('Chart rendered successfully, adding to PDF');
            const availableWidth = this.pageWidth - (this.margins.left + this.margins.right);
            const chartHeight = this.getOptimalChartHeight(chartConfig.dimensions);
            
            // Add chart with proper boundaries and spacing
            this.pdf.addImage(chartImageData, 'PNG', this.margins.left, this.currentY, availableWidth, chartHeight);
            this.currentY += chartHeight + this.layoutOptimizer.getOptimalSpacing('chart', 'medium');
            
            // Add chart description if available
            if (chart.description) {
              this.pdf.setTextColor(100, 100, 100);
              this.pdf.setFontSize(9);
              this.pdf.setFont('helvetica', 'italic');
              const descLines = this.pdf.splitTextToSize(chart.description, availableWidth);
              this.pdf.text(descLines, this.margins.left, this.currentY);
              this.currentY += descLines.length * 4 + 8;
            }
          } else {
            console.error('Chart rendering failed - invalid image data:', chartImageData?.substring(0, 50));
            throw new Error('Invalid chart image data returned');
          }
        } catch (error) {
          console.error('Dynamic chart rendering failed:', error);
          
          // Professional fallback display
          this.pdf.setFillColor(248, 250, 252);
          this.pdf.setDrawColor(220, 220, 220);
          this.pdf.setLineWidth(0.5);
          this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 35, 'FD');
          
          this.pdf.setTextColor(120, 120, 120);
          this.pdf.setFontSize(10);
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.text('📊 Chart visualization unavailable - rendering error', this.margins.left + 10, this.currentY + 18);
          this.currentY += 40;
        }
      } else {
        console.warn('Chart missing required data or type:', {
          title: chart.title,
          hasData: !!chart.data,
          hasType: !!chart.type
        });
        
        // Show placeholder for invalid chart configuration
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.setDrawColor(220, 220, 220);
        this.pdf.setLineWidth(0.5);
        this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 35, 'FD');
        
        this.pdf.setTextColor(120, 120, 120);
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text('📊 Chart configuration incomplete - missing data or type', this.margins.left + 10, this.currentY + 18);
        this.currentY += 40;
      }
    }
  }

  private async addReportCharts(charts: any[], platformBranding: BrandingData): Promise<void> {
    // Fallback for legacy chart format
    await this.addDynamicCharts(charts, platformBranding);
  }

  private getOptimalChartHeight(dimensions?: 'ultra-compact' | 'compact' | 'standard' | 'large'): number {
    switch (dimensions) {
      case 'ultra-compact': return 65; // Increased from 50 for better visibility
      case 'compact': return 80; // Increased from 65
      case 'large': return 140; // Increased from 120
      case 'standard':
      default: return 110; // Increased from 100
    }
  }

  private calculateKPIHeight(kpis: any[], branding: BrandingData): number {
    const layoutDensity = branding.reportLayout?.layoutDensity || 'standard';
    const maxKpisPerRow = branding.reportLayout?.maxKpisPerRow || 4;
    const cardHeight = layoutDensity === 'compact' ? 22 : layoutDensity === 'spacious' ? 32 : 26;
    const cardSpacing = layoutDensity === 'compact' ? 3 : layoutDensity === 'spacious' ? 8 : 5;
    const headerHeight = layoutDensity === 'compact' ? 0 : 12;
    const rows = Math.ceil(kpis.length / maxKpisPerRow);
    return headerHeight + (rows * cardHeight) + ((rows - 1) * cardSpacing) + 10;
  }

  private async addDataTables(tableData: any[], platformBranding: BrandingData, reportType: string): Promise<void> {
    if (!tableData || tableData.length === 0) {
      // Clean "no data" section
      this.checkPageBreak(25);
      
      const navyBlue = { r: 27, g: 54, b: 93 };
      this.pdf.setFillColor(248, 248, 248);
      this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 20, 'F');
      
      this.pdf.setTextColor(navyBlue.r, navyBlue.g, navyBlue.b);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text('No detailed data available for this reporting period', this.margins.left + 10, this.currentY + 12);
      this.currentY += 25;
      return;
    }

    this.checkPageBreak(60);
    
    // Clean table header
    const navyBlue = { r: 27, g: 54, b: 93 };
    this.pdf.setFillColor(navyBlue.r, navyBlue.g, navyBlue.b);
    this.pdf.rect(this.margins.left, this.currentY, this.pageWidth - (this.margins.left + this.margins.right), 10, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('DETAILED BREAKDOWN', this.margins.left + 5, this.currentY + 7);
    this.currentY += 16;

    // Get table headers and calculate optimal column widths
    const headers = Object.keys(tableData[0]);
    const availableWidth = this.pageWidth - (this.margins.left + this.margins.right);
    const columnWidth = availableWidth / headers.length;
    
    // Professional table headers
    this.pdf.setFillColor(245, 245, 245);
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(this.margins.left, this.currentY, availableWidth, 10, 'FD');
    
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    
    headers.forEach((header, index) => {
      const xPos = this.margins.left + (index * columnWidth);
      this.pdf.text(this.formatTableHeader(header), xPos + 3, this.currentY + 7);
    });
    
    this.currentY += 10;

    // Data rows with smart pagination and alternating colors
    const maxRows = Math.min(20, tableData.length); // Increased limit but still manageable
    
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      this.checkPageBreak(8);
      
      const row = tableData[rowIndex];
      
      // Alternating row colors for better readability
      if (rowIndex % 2 === 1) {
        this.pdf.setFillColor(252, 252, 252);
        this.pdf.rect(this.margins.left, this.currentY, availableWidth, 8, 'F');
      }
      
      // Add subtle row borders
      this.pdf.setDrawColor(230, 230, 230);
      this.pdf.setLineWidth(0.1);
      this.pdf.line(this.margins.left, this.currentY + 8, this.margins.left + availableWidth, this.currentY + 8);
      
      this.pdf.setTextColor(40, 40, 40);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      
      headers.forEach((header, index) => {
        const xPos = this.margins.left + (index * columnWidth);
        const cellValue = this.formatTableValue(row[header], header);
        this.pdf.text(cellValue, xPos + 3, this.currentY + 6);
      });
      
      this.currentY += 8;
    }

    // Professional pagination indicator
    if (tableData.length > maxRows) {
      this.pdf.setTextColor(120, 120, 120);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.text(`Showing first ${maxRows} of ${tableData.length} records`, this.margins.left, this.currentY + 8);
      this.currentY += 12;
    }

    this.currentY += 8;
  }

  private async renderChartToPDF(chartConfig: any, platformBranding: BrandingData): Promise<string | null> {
    try {
      // Use consistent chart rendering with EnhancedChartRenderer
      const enhancedConfig = {
        ...chartConfig,
        branding: platformBranding,
        dimensions: platformBranding.reportLayout?.chartDimensions || 'standard'
      };
      
      console.log('Rendering chart with EnhancedChartRenderer:', enhancedConfig.title);
      const chartImageData = await EnhancedChartRenderer.renderChartForPDF(enhancedConfig);
      
      if (chartImageData) {
        console.log('Chart rendered successfully');
        return chartImageData;
      } else {
        console.warn('Chart rendering returned empty data');
        return null;
      }
    } catch (error) {
      console.error('Enhanced chart rendering failed:', error);
      return null;
    }
  }

  private addInvoiceContent(content: InvoiceContent, platformBranding: BrandingData, template?: any, billingData?: any): void {
    // Bill From section with real landlord data
    const brandColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setTextColor(brandColor.r, brandColor.g, brandColor.b);
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Bill From:', 20, this.currentY);
    
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    
    // Use real billing data instead of generic landlord info
    const billFrom = billingData?.billFrom || {
      name: 'Property Owner',
      address: 'Property Management Office',
      phone: '+254 700 000 000',
      email: 'landlord@property.com'
    };
    
    this.pdf.text(billFrom.name, 20, this.currentY + 8);
    if (billFrom.companyName && billFrom.companyName !== billFrom.name) {
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(80, 80, 80);
      this.pdf.text(`Property: ${billFrom.companyName}`, 20, this.currentY + 16);
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(billFrom.address, 20, this.currentY + 24);
      this.pdf.text(billFrom.phone, 20, this.currentY + 32);
      this.pdf.text(billFrom.email, 20, this.currentY + 40);
    } else {
      this.pdf.text(billFrom.address, 20, this.currentY + 16);
      this.pdf.text(billFrom.phone, 20, this.currentY + 24);
      this.pdf.text(billFrom.email, 20, this.currentY + 32);
    }

    // Bill To section with real tenant data
    const billColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setTextColor(billColor.r, billColor.g, billColor.b);
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Bill To:', this.pageWidth - 100, this.currentY);
    
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    
    // Use real tenant data from billing relationships
    const billTo = billingData?.billTo;
    const tenantName = billTo?.name || content.recipient.name;
    this.pdf.text(tenantName, this.pageWidth - 100, this.currentY + 8);
    
    // Add tenant email if available
    if (billTo?.email) {
      this.pdf.text(billTo.email, this.pageWidth - 100, this.currentY + 16);
    }
    
    // Property and unit information
    const address = billTo?.address || content.recipient.address;
    const addressLines = address.split('\n');
    const startLine = billTo?.email ? 24 : 16;
    addressLines.forEach((line, index) => {
      this.pdf.text(line, this.pageWidth - 100, this.currentY + startLine + (index * 4));
    });
    
    this.currentY += 55;
    
    // Invoice details
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.text(`Invoice: ${content.invoiceNumber}`, 20, this.currentY);
    this.pdf.text(`Due Date: ${content.dueDate.toLocaleDateString()}`, this.pageWidth - 100, this.currentY);
    this.currentY += 15;

    // Items table
    // Header with primary color
    const tableColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setFillColor(tableColor.r, tableColor.g, tableColor.b);
    this.pdf.rect(20, this.currentY, this.pageWidth - 40, 8, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('DESCRIPTION', 25, this.currentY + 5);
    this.pdf.text('AMOUNT', this.pageWidth - 60, this.currentY + 5, { align: 'right' });

    this.currentY += 8;

    // Items
    content.items.forEach((item) => {
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(item.description, 25, this.currentY + 5);
      this.pdf.text(formatAmount(item.amount), this.pageWidth - 60, this.currentY + 5, { align: 'right' });
      this.currentY += 8;
    });

    // Total with primary color background
    const totalColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setFillColor(totalColor.r, totalColor.g, totalColor.b);
    this.pdf.rect(this.pageWidth - 80, this.currentY, 60, 8, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('TOTAL', this.pageWidth - 75, this.currentY + 5);
    this.pdf.text(formatAmount(content.total), this.pageWidth - 25, this.currentY + 5, { align: 'right' });

    this.currentY += 20;
  }

  private async addReportContent(content: ReportContent, platformBranding: BrandingData, chartData?: any, template?: any): Promise<void> {
    // Report title and period with template styling
    const reportColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setTextColor(reportColor.r, reportColor.g, reportColor.b);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(content.reportPeriod, this.margins.left, this.currentY);
    this.currentY += 15;

    // Executive Summary with template content styling
    const contentStyle = template?.content?.sections?.content?.style || {};
    const textColor = this.hexToRgb(contentStyle.color || '#374151');
    this.pdf.setTextColor(textColor.r, textColor.g, textColor.b);
    this.pdf.setFontSize(contentStyle.fontSize || 11);
    this.pdf.setFont('helvetica', 'normal');
    const summaryLines = this.pdf.splitTextToSize(content.summary, this.pageWidth - (this.margins.left + this.margins.right));
    this.pdf.text(summaryLines, this.margins.left, this.currentY);
    this.currentY += summaryLines.length * (contentStyle.lineHeight || 1.4) * 4 + 15;

    // Add KPIs section with template
    if (content.kpis && content.kpis.length > 0) {
      await this.addKPISection(content.kpis, platformBranding, template);
    }

    // Add charts section only if includeCharts is true
    if (content.includeCharts === true) {
      if (content.charts && content.charts.length > 0) {
        console.log(`Rendering ${content.charts.length} charts in PDF:`, content.charts.map(c => c.title));
        await this.addDynamicCharts(content.charts, platformBranding);
      } else {
        // Fallback: Generate charts dynamically if none provided
        let dynamicCharts = [];
        if (content.tableData && content.tableData.length > 0) {
          // Transform KPIs to match ReportKPI interface
          const transformedKpis = content.kpis.map((kpi: any, index: number) => ({
            id: kpi.id || `kpi-${index}`,
            label: kpi.label,
            value: kpi.value,
            trend: typeof kpi.trend === 'string' ? { 
              direction: (kpi.trend === 'stable' ? 'neutral' : 
                         kpi.trend === 'up' ? 'up' : 
                         kpi.trend === 'down' ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
            } : kpi.trend,
          }));
          
          dynamicCharts = ReportChartDataService.generateChartsForReport(
            content.type || 'general',
            content.tableData,
            transformedKpis
          );
          
          console.log(`Generated ${dynamicCharts.length} fallback charts for ${content.type}`);
        }

        if (dynamicCharts.length > 0) {
          await this.addDynamicCharts(dynamicCharts, platformBranding);
        } else if (chartData) {
          // Legacy chart data support
          await this.addLegacyChartData(chartData, platformBranding);
        }
      }
    }

    // Add detailed data tables
    if (content.tableData && content.tableData.length > 0) {
      await this.addDataTables(content.tableData, platformBranding, content.type);
    }
  }

  private async addLegacyChartData(chartData: any, platformBranding: BrandingData): Promise<void> {
    this.checkPageBreak(70);
    
    // Chart header
    const chartColor = this.hexToRgb(platformBranding.primaryColor);
    this.pdf.setFillColor(chartColor.r, chartColor.g, chartColor.b);
    this.pdf.rect(20, this.currentY, this.pageWidth - 40, 8, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('VISUAL ANALYTICS', 25, this.currentY + 5);
    this.currentY += 15;

    try {
      // Handle different chart data formats
      if (typeof chartData === 'string') {
        // Base64 image string
        const chartWidth = this.pageWidth - 40;
        const chartHeight = 60;
        this.pdf.addImage(chartData, 'PNG', 20, this.currentY, chartWidth, chartHeight);
        this.currentY += chartHeight + 10;
      } else if (chartData.type && chartData.data) {
        // Chart configuration object - render chart info
        this.pdf.setTextColor(0, 0, 0);
        this.pdf.setFontSize(12);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(chartData.title || 'Chart Analysis', 20, this.currentY);
        this.currentY += 10;
        
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(`Chart Type: ${chartData.type.toUpperCase()}`, 20, this.currentY);
        this.currentY += 8;
      }
    } catch (error) {
      console.warn('Failed to add chart to PDF:', error);
      // Add professional fallback with styled background
      this.pdf.setFillColor(248, 250, 252);
      this.pdf.rect(20, this.currentY, this.pageWidth - 40, 30, 'F');
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.text('Chart visualization will be available in enhanced report versions', 25, this.currentY + 15);
      this.currentY += 35;
    }
  }

  private addLetterContent(content: LetterContent, platformBranding: BrandingData, landlordData?: any): void {
    // Date
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(new Date().toLocaleDateString(), this.pageWidth - 40, this.currentY);
    this.currentY += 20;

    // Recipient
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('To:', 20, this.currentY);
    this.currentY += 8;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(content.recipient.name, 20, this.currentY);
    this.currentY += 5;
    
    const addressLines = content.recipient.address.split('\n');
    addressLines.forEach(line => {
      this.pdf.text(line, 20, this.currentY);
      this.currentY += 5;
    });

    this.currentY += 10;

    // Subject
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`Subject: ${content.subject}`, 20, this.currentY);
    this.currentY += 15;

    // Body
    this.pdf.setFont('helvetica', 'normal');
    const bodyLines = this.pdf.splitTextToSize(content.body, this.pageWidth - 40);
    this.pdf.text(bodyLines, 20, this.currentY);
    this.currentY += bodyLines.length * 5 + 20;

    // Signature
    if (content.sender) {
      this.pdf.text('Sincerely,', 20, this.currentY);
      this.currentY += 15;
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(content.sender.name, 20, this.currentY);
      this.currentY += 5;
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(content.sender.title, 20, this.currentY);
    }
  }

  async generateDocument(
    document: DocumentContent, 
    platformBranding?: BrandingData, 
    billingData?: any, 
    chartData?: string,
    template?: any
  ): Promise<void> {
    const branding = platformBranding || this.getDefaultBranding();
    
    try {
      // Add professional header using template
      await this.addHeaderWithLogo(branding, template);
      
      // Add document title with template styling
      this.addDocumentTitle(document.title, branding, template);
      
      // Add landlord section if provided (from billing data)
      if (billingData?.billFrom) {
        await this.addLandlordSection(billingData.billFrom, branding);
      }
      
      // Handle different document types with template-aware rendering
      switch (document.type) {
        case 'invoice':
          this.addInvoiceContent(document.content as InvoiceContent, branding, template, billingData);
          break;
        case 'report':
          await this.addReportContent(document.content as ReportContent, branding, chartData, template);
          break;
        case 'letter':
        case 'notice':
        case 'lease':
          this.addLetterContent(document.content as LetterContent, branding);
          break;
        default:
          throw new Error(`Unsupported document type: ${document.type}`);
          throw new Error(`Unsupported document type: ${document.type}`);
      }
      
      // Add professional footer using template on all pages
      const totalPages = this.pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        this.pdf.setPage(i);
        this.addFooter(branding, template);
      }
      
      // Generate filename and save
      const filename = this.generateFilename(document, billingData?.billFrom);
      this.pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private generateFilename(document: DocumentContent, billFromData?: any): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    
    // Clean document title for filename (remove special characters)
    const cleanTitle = document.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    
    // Get landlord name if available
    const landlordName = billFromData?.name 
      ? billFromData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase()
      : 'property-manager';
    
    // Create descriptive filename: Report-Title_Landlord-Name_Date.pdf
    return `${cleanTitle}_${landlordName}_${currentDate}.pdf`;
  }

  getDefaultBranding(): BrandingData {
    return {
      companyName: 'Zira Technologies',
      companyTagline: 'Professional Property Management Solutions',
      companyAddress: 'P.O. Box 1234, Nairobi, Kenya',
      companyPhone: '+254 700 000 000',
      companyEmail: 'info@ziratechnologies.com',
      logoUrl: '/src/assets/zira-logo.png',
      primaryColor: '#1B365D', // Navy
      secondaryColor: '#64748B', // Grey
      footerText: 'Powered by Zira Technologies • www.ziratechnologies.com',
      websiteUrl: 'www.ziratechnologies.com'
    };
  }
}