import jsPDF from 'jspdf';
import { Chart as ChartJS } from 'chart.js';
import { formatAmount } from './currency';

// Zira Homes Brand Colors
const BRAND_COLORS = {
  navy: '#1A1E3F',
  orange: '#FF6B35', 
  lightGrey: '#F5F5F5',
  success: '#4CAF50',
  warning: '#FBBC05',
  error: '#EA4335',
  white: '#FFFFFF',
  text: '#2C3E50',
  textMuted: '#6C757D'
};

export interface PDFReportData {
  reportTitle: string;
  reportType: string;
  landlordName?: string;
  dateGenerated: string;
  executiveSummary: string;
  kpiData: Array<{
    label: string;
    value: string;
    icon?: string;
    color?: string;
  }>;
  chartData?: any;
  tableData?: Array<Record<string, any>>;
  additionalSections?: Array<{
    title: string;
    content: string;
  }>;
}

export class ProfessionalPDFRenderer {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number;
  private pageWidth: number;
  private margins = { top: 20, bottom: 30, left: 20, right: 20 };

  constructor() {
    this.pdf = new jsPDF('portrait', 'mm', 'a4');
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.pageWidth = this.pdf.internal.pageSize.width;
  }

  private checkPageBreak(requiredHeight: number): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom) {
      this.pdf.addPage();
      this.currentY = this.margins.top;
      this.addWatermark();
    }
  }

  private addWatermark(): void {
    this.pdf.saveGraphicsState();
    this.pdf.setGState(this.pdf.GState({ opacity: 0.1 }));
    this.pdf.setTextColor(26, 30, 63); // Navy
    this.pdf.setFontSize(60);
    this.pdf.setFont('helvetica', 'bold');
    
    this.pdf.text('ZIRA HOMES', this.pageWidth / 2, this.pageHeight / 2, {
      angle: 45,
      align: 'center'
    });
    
    this.pdf.restoreGraphicsState();
  }

  private addHeader(data: PDFReportData): void {
    // Navy header background
    this.pdf.setFillColor(26, 30, 63);
    this.pdf.rect(0, 0, this.pageWidth, 35, 'F');
    
    // Zira Homes logo/text
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('ZIRA HOMES', this.margins.left, 22);
    
    // Date generated
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(`Generated: ${data.dateGenerated}`, this.pageWidth - this.margins.right - 40, 18);
    
    // Report title
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(data.reportTitle, this.margins.left, 50);
    
    // Prepared for subtitle
    if (data.landlordName) {
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(108, 117, 125);
      this.pdf.text(`Prepared for: ${data.landlordName}`, this.margins.left, 60);
      this.currentY = 75;
    } else {
      this.currentY = 65;
    }
  }

  private addExecutiveSummary(summary: string): void {
    this.checkPageBreak(25);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Executive Summary', this.margins.left, this.currentY);
    this.currentY += 8;
    
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(44, 62, 80);
    
    const summaryLines = this.pdf.splitTextToSize(summary, this.pageWidth - this.margins.left - this.margins.right);
    this.pdf.text(summaryLines, this.margins.left, this.currentY);
    this.currentY += summaryLines.length * 4 + 10;
  }

  private addKPICards(kpiData: Array<{ label: string; value: string; color?: string }>): void {
    this.checkPageBreak(30);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Key Performance Indicators', this.margins.left, this.currentY);
    this.currentY += 10;
    
    const cardWidth = (this.pageWidth - this.margins.left - this.margins.right - 15) / 4;
    const cardHeight = 20;
    
    kpiData.slice(0, 4).forEach((kpi, index) => {
      const x = this.margins.left + index * (cardWidth + 5);
      
      // Card background
      this.pdf.setFillColor(245, 245, 245); // Light grey
      this.pdf.rect(x, this.currentY, cardWidth, cardHeight, 'F');
      
      // Card border
      this.pdf.setDrawColor(26, 30, 63);
      this.pdf.rect(x, this.currentY, cardWidth, cardHeight);
      
      // KPI label
      this.pdf.setTextColor(108, 117, 125);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(kpi.label, x + 2, this.currentY + 6);
      
      // KPI value
      this.pdf.setTextColor(26, 30, 63);
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(kpi.value, x + 2, this.currentY + 15);
    });
    
    this.currentY += cardHeight + 15;
  }

  private addDataTable(
    title: string, 
    headers: string[], 
    data: Array<Record<string, any>>,
    maxRows: number = 10
  ): void {
    this.checkPageBreak(50);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margins.left, this.currentY);
    this.currentY += 10;
    
    const tableWidth = this.pageWidth - this.margins.left - this.margins.right;
    const colWidth = tableWidth / headers.length;
    const rowHeight = 8;
    
    // Table headers
    this.pdf.setFillColor(26, 30, 63);
    this.pdf.rect(this.margins.left, this.currentY, tableWidth, rowHeight, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    
    headers.forEach((header, index) => {
      this.pdf.text(header, this.margins.left + index * colWidth + 2, this.currentY + 6);
    });
    
    this.currentY += rowHeight;
    
    // Table data
    const limitedData = data.slice(0, maxRows);
    limitedData.forEach((row, rowIndex) => {
      // Alternating row colors
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(249, 249, 249);
        this.pdf.rect(this.margins.left, this.currentY, tableWidth, rowHeight, 'F');
      }
      
      this.pdf.setTextColor(44, 62, 80);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      
      headers.forEach((header, colIndex) => {
        const cellValue = row[header] || '';
        const text = typeof cellValue === 'number' && header.toLowerCase().includes('amount') 
          ? formatAmount(cellValue)
          : String(cellValue);
        
        this.pdf.text(
          this.pdf.splitTextToSize(text, colWidth - 4)[0] || '',
          this.margins.left + colIndex * colWidth + 2,
          this.currentY + 6
        );
      });
      
      this.currentY += rowHeight;
    });
    
    this.currentY += 10;
  }

  private addFooter(pageNumber: number, totalPages: number): void {
    const footerY = this.pageHeight - 20;
    
    // Footer line
    this.pdf.setDrawColor(233, 236, 239);
    this.pdf.line(this.margins.left, footerY, this.pageWidth - this.margins.right, footerY);
    
    // Footer content
    this.pdf.setTextColor(108, 117, 125);
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    
    this.pdf.text('Zira Homes © 2025 – www.zira-tech.com', this.margins.left, footerY + 5);
    this.pdf.text(`Page ${pageNumber} of ${totalPages}`, this.pageWidth - this.margins.right - 30, footerY + 5);
    this.pdf.text('Phone: +254-757-878-023', this.margins.left, footerY + 9);
    this.pdf.text('Email: info@ziratech.com', this.margins.left, footerY + 13);
    this.pdf.text('Website: zira-tech.com', this.margins.left, footerY + 17);
  }

  public async generatePDF(data: PDFReportData): Promise<void> {
    // Add watermark
    this.addWatermark();
    
    // Add header
    this.addHeader(data);
    
    // Add executive summary
    this.addExecutiveSummary(data.executiveSummary);
    
    // Add KPI cards
    if (data.kpiData && data.kpiData.length > 0) {
      this.addKPICards(data.kpiData);
    }
    
    // Add data table if available
    if (data.tableData && data.tableData.length > 0) {
      const headers = Object.keys(data.tableData[0]);
      this.addDataTable('Detailed Data', headers, data.tableData);
    }
    
    // Add additional sections
    if (data.additionalSections) {
      data.additionalSections.forEach(section => {
        this.checkPageBreak(20);
        
        this.pdf.setTextColor(26, 30, 63);
        this.pdf.setFontSize(14);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(section.title, this.margins.left, this.currentY);
        this.currentY += 8;
        
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setTextColor(44, 62, 80);
        
        const contentLines = this.pdf.splitTextToSize(section.content, this.pageWidth - this.margins.left - this.margins.right);
        this.pdf.text(contentLines, this.margins.left, this.currentY);
        this.currentY += contentLines.length * 4 + 10;
      });
    }
    
    // Add footers to all pages
    const totalPages = this.pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);
      this.addFooter(i, totalPages);
    }
    
    // Download the PDF
    const fileName = `${data.reportTitle.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.pdf.save(fileName);
  }
}