import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Smartphone, CreditCard, Info } from "lucide-react";
import { extractErrorMessage, logErrorDetails, toErrorString } from "@/utils/errorExtraction";

interface MpesaPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: {
    id: string;
    invoice_number: string;
    amount: number;
    tenant_id: string;
  } | null;
  onPaymentInitiated?: () => void;
}

export const MpesaPaymentDialog: React.FC<MpesaPaymentDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onPaymentInitiated
}) => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [landlordShortcode, setLandlordShortcode] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  // Get landlord M-Pesa config info when dialog opens
  useEffect(() => {
    if (open && invoice?.id) {
      const checkLandlordConfig = async () => {
        try {
          // Test STK push to get the shortcode that will be used
          const { data } = await supabase.functions.invoke('mpesa-stk-push', {
            body: {
              phone: '254700000000', // dummy phone for config check
              amount: 1,
              invoiceId: invoice.id,
              dryRun: true // This would be a flag to just return config info
            }
          });
          
          if (data?.data?.BusinessShortCode) {
            setLandlordShortcode(data.data.BusinessShortCode);
          }
        } catch (error) {
          console.log('Could not determine landlord shortcode');
        }
      };
      
      checkLandlordConfig();
    }
  }, [open, invoice?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoice) {
      toast({
        title: "Error",
        description: "Invoice information is missing",
        variant: "destructive",
      });
      return;
    }
    
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Kenyan phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Use phoneFormatter for consistent formatting
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: phoneNumber,
          amount: invoice.amount,
          accountReference: invoice.invoice_number,
          transactionDesc: `Rent payment for ${invoice.invoice_number}`,
          invoiceId: invoice.id,
          paymentType: 'rent'
        }
      });

      if (error) {
        // Extract proper error message from error object
        let errorMsg = 'Failed to initiate M-Pesa payment';
        if (typeof error === 'string') {
          errorMsg = error;
        } else if (error && typeof error === 'object') {
          errorMsg = error.message || error.error || JSON.stringify(error);
        }
        throw new Error(errorMsg);
      }

      if (data && data.success) {
        toast({
          title: "Payment Request Sent",
          description: "STK push sent. Please check your phone and enter your M-Pesa PIN to complete the payment.",
        });

        onPaymentInitiated?.();
        onOpenChange(false);

        // Reset form
        setPhoneNumber("");
      } else {
        // Extract error from response data
        let errorMsg = 'Payment request failed';
        if (data && data.error) {
          errorMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
        } else if (data && data.data && data.data.ResponseDescription) {
          errorMsg = data.data.ResponseDescription;
        }
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logErrorDetails(error, 'M-Pesa Payment');
      const { message, details, fullError } = extractErrorMessage(error);
      setRawResponse(fullError || error);
      // Ensure we have valid strings and not "[object Object]"
      let msg = toErrorString(message) || 'Payment failed';
      let det = toErrorString(details) || '';

      // Double-check that we don't have [object Object]
      if (msg && msg.includes('[object Object]')) {
        msg = 'Payment initiation failed. Please try again or contact support.';
      }
      if (det && det.includes('[object Object]')) {
        det = '';
      }

      const displayMessage = det && det !== msg && det !== 'undefined' && det.length > 0
        ? `${msg}\n\n${det}`
        : msg;
      toast({
        title: "Payment Error",
        description: displayMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            M-Pesa Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment info */}
          {invoice && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Invoice:</span>
                <span className="text-sm font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                <span className="text-sm font-medium">KES {invoice.amount.toLocaleString()}</span>
              </div>
              {landlordShortcode && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Paybill/Till:</span>
                  <span className="text-sm font-medium">{landlordShortcode}</span>
                </div>
              )}
            </div>
          )}

          {/* Info alert */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p>You'll receive an STK push notification on your phone to complete the payment.</p>
              </div>
            </div>
          </div>

          {rawResponse && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="text-sm font-medium text-destructive">Function error details</div>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show raw response</summary>
                <pre className="mt-2 text-xs bg-muted/10 p-2 rounded overflow-auto max-h-40">{JSON.stringify(rawResponse, null, 2)}</pre>
              </details>
            </div>
          )}

          {/* Phone number input */}
          <div className="space-y-2">
            <Label htmlFor="phone">M-Pesa Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g., 0701234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Enter the phone number registered with M-Pesa
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
