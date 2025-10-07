import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";

export function TestSMSButton() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendTestSMS = async () => {
    setIsSending(true);
    
    try {
      console.log("🧪 Triggering test SMS to 254722241745...");
      
      const { data, error } = await supabase.functions.invoke('test-sms');
      
      if (error) {
        console.error("❌ Test SMS failed:", error);
        throw error;
      }

      console.log("✅ Test SMS response:", data);
      
      toast({
        title: "Test SMS Sent! 🎉",
        description: `SMS sent to 254722241745. Check your phone and the SMS logs.`,
      });
      
    } catch (error: any) {
      console.error("💥 Error sending test SMS:", error);
      toast({
        title: "Failed to send test SMS",
        description: error.message || "An error occurred while sending the test SMS",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button 
      onClick={sendTestSMS} 
      disabled={isSending}
      size="lg"
      className="w-full md:w-auto"
    >
      {isSending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending Test SMS...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Send Test SMS to 254722241745
        </>
      )}
    </Button>
  );
}
