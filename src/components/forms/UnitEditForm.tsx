import { useForm } from "react-hook-form";
import { getGlobalCurrencySync } from "@/utils/currency";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UnitTypeSelect } from "@/components/ui/unit-type-select";
import { DynamicUnitSpecifications } from "@/components/forms/DynamicUnitSpecifications";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isCommercialUnit } from "@/utils/unitSpecifications";

const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required"),
  unit_type: z.string().min(1, "Unit type is required"),
  rent_amount: z.number().min(1, "Rent amount is required"),
  security_deposit: z.number().optional(),
  status: z.string().min(1, "Status is required"),
  description: z.string().optional(),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface UnitEditFormProps {
  unit: {
    id: string;
    unit_number: string;
    unit_type: string;
    bedrooms?: number;
    bathrooms?: number;
    square_feet?: number;
    floor_area?: number;
    office_spaces?: number;
    rent_amount: number;
    security_deposit?: number;
    status: string;
    description?: string;
    [key: string]: any; // Allow other dynamic fields
  };
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function UnitEditForm({ unit, onSave, onCancel }: UnitEditFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [unitSpecifications, setUnitSpecifications] = useState<Record<string, any>>(() => {
    // Initialize with existing unit data
    const specs: Record<string, any> = {};
    ['bedrooms', 'bathrooms', 'square_feet', 'floor_area', 'office_spaces', 'conference_rooms', 'parking_spaces', 'loading_docks'].forEach(key => {
      if (unit[key] !== undefined) {
        specs[key] = unit[key];
      }
    });
    return specs;
  });
  
  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      rent_amount: unit.rent_amount,
      security_deposit: unit.security_deposit || 0,
      status: unit.status,
      description: unit.description || "",
    },
  });

  const selectedUnitType = form.watch('unit_type');
  const isCommercial = selectedUnitType && isCommercialUnit(selectedUnitType);

  const handleSpecificationChange = (field: string, value: any) => {
    setUnitSpecifications(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onSubmit = async (data: UnitFormData) => {
    setIsLoading(true);
    try {
      // Combine form data with unit specifications
      const combinedData = {
        ...data,
        ...unitSpecifications,
      };
      await onSave(combinedData);
      toast.success("Unit updated successfully");
    } catch (error) {
      toast.error("Failed to update unit");
    } finally {
      setIsLoading(false);
    }
  };

  const currency = getGlobalCurrencySync();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit Unit</h2>
        {isCommercial && <Badge variant="secondary">Commercial Unit</Badge>}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="unit_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Type</FormLabel>
                  <FormControl>
                    <UnitTypeSelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Dynamic Unit Specifications */}
          {selectedUnitType && (
            <div>
              <Label className="text-base font-medium">
                {isCommercial ? 'Commercial' : 'Residential'} Specifications
                {isCommercial && <Badge variant="secondary" className="ml-2">Commercial</Badge>}
              </Label>
              <div className="mt-3">
                <DynamicUnitSpecifications
                  unitType={selectedUnitType}
                  values={unitSpecifications}
                  onChange={handleSpecificationChange}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rent_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Rent ({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                  <FormLabel>Security Deposit ({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional details about the unit..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}