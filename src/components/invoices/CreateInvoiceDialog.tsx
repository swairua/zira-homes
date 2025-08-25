import { useState } from "react";
import { getGlobalCurrencySync } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formSchema = z.object({
  lease_id: z.string().min(1, "Please select a lease"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be a positive number"
  ),
  due_date: z.date({
    required_error: "Due date is required",
  }),
  description: z.string().optional(),
});

interface CreateInvoiceDialogProps {
  onInvoiceCreated?: () => void;
}

export const CreateInvoiceDialog = ({ onInvoiceCreated }: CreateInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lease_id: "",
      amount: "",
      description: "",
    },
  });

  const fetchLeases = async () => {
    try {
      const { data, error } = await supabase
        .from("leases")
        .select(`
          id,
          monthly_rent,
          tenant_id,
          unit_id,
          tenants (
            first_name,
            last_name
          ),
          units (
            unit_number,
            properties (
              name
            )
          )
        `)
        .eq("status", "active");

      if (error) throw error;
      setLeases(data || []);
    } catch (error) {
      console.error("Error fetching leases:", error);
      toast.error("Failed to load leases");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchLeases();
    } else {
      form.reset();
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const selectedLease = leases.find(lease => lease.id === values.lease_id);
      if (!selectedLease) {
        toast.error("Selected lease not found");
        return;
      }

      // Generate invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const { error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          lease_id: values.lease_id,
          tenant_id: selectedLease.tenant_id,
          amount: Number(values.amount),
          due_date: format(values.due_date, "yyyy-MM-dd"),
          invoice_date: format(new Date(), "yyyy-MM-dd"),
          description: values.description || `Monthly rent - ${format(new Date(), "MMMM yyyy")}`,
          status: "pending"
        });

      if (error) throw error;

      toast.success("Invoice created successfully!");
      setOpen(false);
      form.reset();
      onInvoiceCreated?.();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lease_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lease</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lease" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leases.map((lease) => (
                        <SelectItem key={lease.id} value={lease.id}>
                          {lease.tenants?.first_name} {lease.tenants?.last_name} - {lease.units?.properties?.name} ({lease.units?.unit_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({getGlobalCurrencySync()})</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter amount"
                      type="number"
                      step="0.01"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date()
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter invoice description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};