import { format } from "date-fns";

/**
 * Formats an invoice number to be more user-friendly
 * Converts various formats to: INV-YYYYMM-XXXXXX
 */
export function formatInvoiceNumber(invoiceNumber: string | null | undefined): string {
  if (!invoiceNumber) return "—";
  
  // If it's already properly formatted, return as is
  if (invoiceNumber.match(/^INV-\d{6}-[A-Z0-9]{6}$/)) {
    return invoiceNumber;
  }

  // Generate date component (current or extracted from invoice)
  const now = new Date();
  const yearMonth = format(now, "yyyyMM");
  
  // Clean and extract identifier
  let identifier = invoiceNumber;
  
  // If it's a UUID, use the first 6 characters for better readability
  if (invoiceNumber.match(/^[a-f0-9-]{8,36}$/i)) {
    identifier = invoiceNumber.replace(/-/g, "").substring(0, 6).toUpperCase();
  } else if (invoiceNumber.length > 10) {
    // For other long strings, use first 6 alphanumeric characters
    const alphanumeric = invoiceNumber.replace(/[^A-Za-z0-9]/g, "");
    identifier = alphanumeric.substring(0, 6).toUpperCase();
  } else {
    // For short strings, clean and pad
    identifier = invoiceNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  
  // Ensure identifier is exactly 6 characters
  if (identifier.length < 6) {
    identifier = identifier.padStart(6, "0");
  } else if (identifier.length > 6) {
    identifier = identifier.substring(0, 6);
  }
  
  return `INV-${yearMonth}-${identifier}`;
}

/**
 * Formats a payment reference to be more user-friendly
 */
export function formatPaymentReference(reference: string | null | undefined): string {
  if (!reference) return "—";
  
  // If it's already formatted nicely, return as is
  if (reference.match(/^PAY-/i)) {
    return reference.toUpperCase();
  }
  
  // For M-Pesa or other transaction IDs, format nicely
  if (reference.length > 8) {
    return `PAY-${reference.slice(-8).toUpperCase()}`;
  }
  
  return `PAY-${reference.toUpperCase()}`;
}

/**
 * Formats a receipt number to be more user-friendly
 * Converts long transaction IDs to: RCT-YYYYMM-XXXXXX
 */
export function formatReceiptNumber(transactionId: string | null | undefined): string {
  if (!transactionId) return "—";
  
  // If it's already properly formatted, return as is
  if (transactionId.match(/^RCT-\d{6}-[A-Z0-9]{6}$/)) {
    return transactionId;
  }

  // Generate date component (current date)
  const now = new Date();
  const yearMonth = format(now, "yyyyMM");
  
  // Clean and extract identifier from the transaction ID
  let identifier = transactionId;
  
  // For M-Pesa or other long transaction IDs, use the last 6 characters
  if (transactionId.length > 10) {
    identifier = transactionId.slice(-6).toUpperCase();
  } else {
    // For shorter IDs, clean and use as is
    identifier = transactionId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  
  // Ensure identifier is exactly 6 characters
  if (identifier.length < 6) {
    identifier = identifier.padStart(6, "0");
  } else if (identifier.length > 6) {
    identifier = identifier.substring(0, 6);
  }
  
  return `RCT-${yearMonth}-${identifier}`;
}

/**
 * Gets a display-friendly description based on invoice data
 */
export function getInvoiceDescription(invoice: any): string {
  if (invoice.description) return invoice.description;
  
  // Handle inferred invoices from payments
  if (invoice.isInferred && invoice.sourcePayment) {
    const payment = invoice.sourcePayment;
    return `Payment received via ${payment.payment_method || 'M-Pesa'}`;
  }
  
  // Generate a friendly description based on available data
  const propertyName = invoice.leases?.units?.properties?.name;
  const unitNumber = invoice.leases?.units?.unit_number;
  
  if (propertyName && unitNumber) {
    return `Rent for ${propertyName}, Unit ${unitNumber}`;
  } else if (propertyName) {
    return `Rent for ${propertyName}`;
  } else if (unitNumber) {
    return `Rent for Unit ${unitNumber}`;
  }
  
  return "Monthly Rent Payment";
}

/**
 * Links a payment to its corresponding invoice
 */
export function linkPaymentToInvoice(payment: any, invoices: any[]): {
  linkedInvoice: any | null;
  linkQuality: 'exact' | 'probable' | 'fuzzy' | 'none';
  linkReason: string;
} {
  if (!payment) {
    return { linkedInvoice: null, linkQuality: 'none', linkReason: 'No payment data' };
  }
  
  if (!invoices?.length) {
    return { linkedInvoice: null, linkQuality: 'none', linkReason: 'No invoices available to link' };
  }
  
  // 1. Exact match by invoice_id
  if (payment.invoice_id) {
    const exactMatch = invoices.find(inv => inv.id === payment.invoice_id);
    if (exactMatch) {
      return { 
        linkedInvoice: exactMatch, 
        linkQuality: 'exact', 
        linkReason: 'Matched by invoice ID' 
      };
    } else {
      return { 
        linkedInvoice: null, 
        linkQuality: 'none', 
        linkReason: 'Invoice exists but access is restricted' 
      };
    }
  }
  
  // 2. Match by invoice number
  if (payment.invoice_number) {
    const invoiceNumberMatch = invoices.find(inv => 
      inv.invoice_number === payment.invoice_number
    );
    if (invoiceNumberMatch) {
      return { 
        linkedInvoice: invoiceNumberMatch, 
        linkQuality: 'exact', 
        linkReason: 'Matched by invoice number' 
      };
    }
  }
  
  // 3. Probable match by amount and date proximity (within 30 days)
  const paymentDate = new Date(payment.payment_date);
  const probableMatches = invoices.filter(inv => {
    if (inv.amount !== payment.amount) return false;
    
    const invoiceDate = new Date(inv.invoice_date);
    const daysDiff = Math.abs((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  });
  
  if (probableMatches.length === 1) {
    return { 
      linkedInvoice: probableMatches[0], 
      linkQuality: 'probable', 
      linkReason: 'Matched by amount and date proximity' 
    };
  }
  
  // 4. Fuzzy match by amount only
  const amountMatches = invoices.filter(inv => inv.amount === payment.amount);
  if (amountMatches.length === 1) {
    return { 
      linkedInvoice: amountMatches[0], 
      linkQuality: 'fuzzy', 
      linkReason: 'Matched by amount only' 
    };
  }
  
  return { 
    linkedInvoice: null, 
    linkQuality: 'none', 
    linkReason: 'No matching invoice found in accessible data' 
  };
}