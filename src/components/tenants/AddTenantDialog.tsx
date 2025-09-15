import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { checkBackendReady } from "@/utils/backendHealth";

const tenantFormSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  national_id: z.string().min(1, "National ID or Passport is required"),
  profession: z.string().optional(),
  employment_status: z.string().optional(),
  employer_name: z.string().optional(),
  monthly_income: z.coerce.number().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  previous_address: z.string().optional(),
  property_id: z.string().min(1, "Please select a property"),
  unit_id: z.string().min(1, "Please select a unit"),
  lease_start_date: z.string().min(1, "Lease start date is required"),
  lease_end_date: z.string().min(1, "Lease end date is required"),
  monthly_rent: z.coerce.number().min(1, "Monthly rent is required"),
  security_deposit: z.coerce.number().optional(),
});

type TenantFormData = z.infer<typeof tenantFormSchema>;

interface AddTenantDialogProps {
  onTenantAdded: () => void;
}

export function AddTenantDialog({ onTenantAdded }: AddTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useUserActivity();
  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      national_id: "",
      profession: "",
      employment_status: "",
      employer_name: "",
      monthly_income: 0,
      emergency_contact_name: "",
      emergency_contact_phone: "",
      previous_address: "",
      property_id: "",
      unit_id: "",
      lease_start_date: "",
      lease_end_date: "",
      monthly_rent: 0,
      security_deposit: 0,
    }
  });
  
  const { watch, setValue, reset } = form;
  const watchPropertyId = watch("property_id");

  // Fetch properties when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchProperties();
    }
  }, [open]);

  // Fetch units when property changes
  React.useEffect(() => {
    if (watchPropertyId) {
      fetchUnits(watchPropertyId);
      setSelectedPropertyId(watchPropertyId);
    }
  }, [watchPropertyId]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address')
        .order('name');
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, rent_amount, status')
        .eq('property_id', propertyId)
        .eq('status', 'vacant')
        .order('unit_number');
      
      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      setUnits([]);
    }
  };

  const onSubmit = async (data: TenantFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add tenants",
        variant: "destructive",
      });
      return;
    }

    // Verify backend availability before proceeding
    const health = await checkBackendReady();
    if (!health.ok) {
      toast({
        title: "Backend not available",
        description: "Supabase functions are not reachable. Please configure environment or try again later.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Prepare request payload
    const requestPayload = {
      tenantData: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        national_id: data.national_id,
        employment_status: data.employment_status,
        profession: data.profession,
        employer_name: data.employer_name,
        monthly_income: data.monthly_income ? parseFloat(data.monthly_income.toString()) : undefined,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        previous_address: data.previous_address
      },
      unitId: data.unit_id,
      propertyId: data.property_id,
      leaseData: data.unit_id ? {
        lease_start_date: data.lease_start_date,
        lease_end_date: data.lease_end_date,
        monthly_rent: data.monthly_rent ? parseFloat(data.monthly_rent.toString()) : undefined,
        security_deposit: data.security_deposit ? parseFloat(data.security_deposit.toString()) : undefined
      } : undefined
    };
    
    console.log("Submitting tenant creation request:", requestPayload);
    
    try {
      // Call the edge function to create tenant account
      let invokeResponse: any = null;
      try {
        invokeResponse = await supabase.functions.invoke('create-tenant-account', { body: requestPayload });
      } catch (fnErr: any) {
        console.error("Edge function threw an error:", fnErr);
        let details = fnErr?.message || "Edge function invocation failed";
        try {
          if (fnErr?.response && typeof fnErr.response.text === 'function') {
            const txt = await fnErr.response.text();
            try {
              const parsed = JSON.parse(txt);
              details = parsed.error || parsed.message || parsed.details || JSON.stringify(parsed);
            } catch (e) {
              details = txt;
            }
          }
        } catch (e) {
          console.warn('Failed to extract error response body', e);
        }

        toast({
          title: "Tenant Creation Failed",
          description: details,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const result = invokeResponse?.data ?? invokeResponse;
      const error = invokeResponse?.error ?? null;

      console.log("Response from create-tenant-account function:", { result, error });

      if (error) {
        console.error("Edge function returned error:", error);
        let errorMessage = "Failed to create tenant account";
        let errorDetails = "";

        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
          if (error.details) errorDetails = ` Details: ${error.details}`;
        } else if (error.error) {
          errorMessage = error.error;
        } else if (error.details) {
          errorMessage = error.details;
        }

        console.error("Processed error message:", errorMessage + errorDetails);

        toast({
          title: "Tenant Creation Failed",
          description: errorMessage + errorDetails,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if we have a valid result
      if (!result) {
        console.error("No result data received from edge function");
        toast({
          title: "Tenant Creation Failed",
          description: "No response received from server",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log("Processing successful response:", result);

      if (result?.success) {
        // Log the activity
        await logActivity(
          'tenant_created',
          'tenant',
          result.tenant?.id,
          {
            tenant_name: `${data.first_name} ${data.last_name}`,
            tenant_email: data.email,
            unit_id: data.unit_id,
            property_id: data.property_id,
            has_lease: !!data.unit_id
          }
        );

        // Enhanced communication status reporting
        const commStatus = result.communicationStatus;
        let statusMessage = "✅ Tenant account created successfully!";
        let communicationDetails = [];
        
        if (commStatus?.emailSent && commStatus?.smsSent) {
          statusMessage += "\n\n📧 Email sent ✓\n📱 SMS sent ✓";
          communicationDetails.push("Email notification delivered", "SMS notification delivered");
        } else if (commStatus?.emailSent) {
          statusMessage += "\n\n📧 Email sent ✓\n📱 SMS failed ⚠️";
          communicationDetails.push("Email notification delivered", "SMS delivery failed");
        } else if (commStatus?.smsSent) {
          statusMessage += "\n\n📧 Email failed ⚠️\n📱 SMS sent ✓";
          communicationDetails.push("Email delivery failed", "SMS notification delivered");
        } else {
          statusMessage += "\n\n⚠️ Both email and SMS delivery failed";
          communicationDetails.push("Email delivery failed", "SMS delivery failed");
        }

        // Always show login details for manual sharing if needed
        if (commStatus?.errors?.length > 0 || (!commStatus?.emailSent && !commStatus?.smsSent)) {
          statusMessage += `\n\n🔑 Manual sharing required:\nEmail: ${result.loginDetails?.email}\nPassword: ${result.loginDetails?.temporaryPassword}\nLogin: ${result.loginDetails?.loginUrl}`;
        }

        // Show communication errors if any
        if (commStatus?.errors?.length > 0) {
          statusMessage += `\n\n❌ Delivery issues:\n${commStatus.errors.join('\n')}`;
        }

        toast({
          title: commStatus?.emailSent || commStatus?.smsSent ? "Tenant Created Successfully" : "Tenant Created - Manual Action Required",
          description: statusMessage,
          variant: commStatus?.emailSent || commStatus?.smsSent ? "default" : "destructive",
          duration: 8000, // Longer duration for important information
        });
        
        reset();
        setOpen(false);
        onTenantAdded();
      } else {
        throw new Error(result?.error || "Failed to create tenant account");
      }
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      
      // Extract meaningful error message
      let errorMessage = "An unexpected error occurred";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: "Tenant Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-tint-gray">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-primary">Add New Tenant</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        First Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="John"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Last Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="Doe"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Email <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="john@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Phone Number <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="+254 700 000 000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Identification & Employment */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Identification & Employment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="national_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        National ID / Passport <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="12345678"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Profession <span className="text-muted-foreground">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="Software Engineer"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Employment Status <span className="text-muted-foreground">(Optional)</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-card border-border focus:border-accent focus:ring-accent">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                          <SelectItem value="Unemployed">Unemployed</SelectItem>
                          <SelectItem value="Student">Student</SelectItem>
                          <SelectItem value="Retired">Retired</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Employer Name <span className="text-muted-foreground">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="ABC Company Ltd"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="monthly_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-primary">
                      Monthly Income (KES) <span className="text-muted-foreground">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="bg-card border-border focus:border-accent focus:ring-accent"
                        placeholder="50000"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Emergency Contact */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergency_contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Emergency Contact Name <span className="text-muted-foreground">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="Jane Doe"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergency_contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Emergency Contact Phone <span className="text-muted-foreground">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-card border-border focus:border-accent focus:ring-accent"
                          placeholder="+254 700 000 001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Property & Unit Assignment */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Property & Unit Assignment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="property_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Property <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("unit_id", ""); // Reset unit when property changes
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card border-border focus:border-accent focus:ring-accent">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.name} - {property.address}
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
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-primary">
                        Unit <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-fill rent amount when unit is selected
                          const selectedUnit = units.find(u => u.id === value);
                          if (selectedUnit) {
                            setValue("monthly_rent", selectedUnit.rent_amount);
                          }
                        }}
                        defaultValue={field.value}
                        disabled={!watchPropertyId}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card border-border focus:border-accent focus:ring-accent">
                            <SelectValue placeholder={watchPropertyId ? "Select unit" : "Select property first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              Unit {unit.unit_number} - KES {unit.rent_amount?.toLocaleString()}/month
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Lease Information (shown when unit is selected) */}
            {watch("unit_id") && (
              <div className="bg-card p-6 rounded-lg border border-border space-y-4">
                <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                  Lease Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lease_start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-primary">
                          Lease Start Date <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-card border-border focus:border-accent focus:ring-accent"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lease_end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-primary">
                          Lease End Date <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-card border-border focus:border-accent focus:ring-accent"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthly_rent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-primary">
                          Monthly Rent (KES) <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="bg-card border-border focus:border-accent focus:ring-accent"
                            placeholder="50000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="security_deposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-primary">
                          Security Deposit (KES) <span className="text-muted-foreground">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="bg-card border-border focus:border-accent focus:ring-accent"
                            placeholder="50000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Additional Information
              </h3>
              <FormField
                control={form.control}
                name="previous_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-primary">
                      Previous Address <span className="text-muted-foreground">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="bg-card border-border focus:border-accent focus:ring-accent"
                        placeholder="Previous residential address"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90">
                {loading ? "Adding..." : "Add Tenant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
