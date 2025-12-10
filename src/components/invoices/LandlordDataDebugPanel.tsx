import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface PropertyIssue {
  propertyId: string;
  propertyName: string;
  issue: "no_owner_id" | "invalid_owner_id" | "missing_profile_data";
  ownerId?: string;
  invoiceCount: number;
  missingFields?: string[];
}

export function LandlordDataDebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [issues, setIssues] = useState<PropertyIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalChecked, setTotalChecked] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all properties with their invoices
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          owner_id,
          invoices (id)
        `);

      if (propertyError) {
        throw new Error(`Failed to fetch properties: ${propertyError.message}`);
      }

      if (!propertyData) {
        setError("No properties found");
        return;
      }

      const foundIssues: PropertyIssue[] = [];
      setTotalChecked(propertyData.length);

      for (const property of propertyData) {
        const invoiceCount = property.invoices?.length || 0;
        if (invoiceCount === 0) continue;

        // Check if owner_id is missing
        if (!property.owner_id) {
          foundIssues.push({
            propertyId: property.id,
            propertyName: property.name,
            issue: "no_owner_id",
            invoiceCount,
          });
          continue;
        }

        // Check if owner_id exists in profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone")
          .eq("id", property.owner_id)
          .single();

        if (profileError) {
          console.warn(`Profile error for ${property.name}:`, profileError);
          foundIssues.push({
            propertyId: property.id,
            propertyName: property.name,
            issue: "invalid_owner_id",
            ownerId: property.owner_id,
            invoiceCount,
          });
          continue;
        }

        if (!profileData) {
          foundIssues.push({
            propertyId: property.id,
            propertyName: property.name,
            issue: "invalid_owner_id",
            ownerId: property.owner_id,
            invoiceCount,
          });
          continue;
        }

        // Check for missing profile data
        const missingFields = [];
        if (!profileData.first_name) missingFields.push("first_name");
        if (!profileData.last_name) missingFields.push("last_name");
        if (!profileData.email) missingFields.push("email");
        if (!profileData.phone) missingFields.push("phone");

        if (missingFields.length > 0) {
          foundIssues.push({
            propertyId: property.id,
            propertyName: property.name,
            issue: "missing_profile_data",
            ownerId: property.owner_id,
            invoiceCount,
            missingFields,
          });
        }
      }

      setIssues(foundIssues);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error checking landlord data:", errorMessage);
      setError(errorMessage);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      checkData();
    }
  }, [isExpanded]);

  const issueCount = issues.length;

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full hover:opacity-75 transition"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">
              Landlord Data Debug
            </CardTitle>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-amber-800">
              Checked {totalChecked} properties
              {issueCount > 0 && ` • Found ${issueCount} issues`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={checkData}
              disabled={loading}
            >
              {loading ? "Checking..." : "Re-check"}
            </Button>
          </div>

          {issueCount === 0 && totalChecked > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
              ✓ All properties with invoices have valid landlord data
            </div>
          )}

          {issueCount > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {issues.map((issue) => (
                <div
                  key={issue.propertyId}
                  className="p-3 bg-white border border-amber-300 rounded space-y-2"
                >
                  <div className="font-semibold text-sm">
                    {issue.propertyName}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({issue.invoiceCount} invoices)
                    </span>
                  </div>

                  {issue.issue === "no_owner_id" && (
                    <Badge variant="destructive" className="text-xs">
                      No owner_id set
                    </Badge>
                  )}

                  {issue.issue === "invalid_owner_id" && (
                    <Badge variant="destructive" className="text-xs">
                      Owner ID {issue.ownerId} not found in profiles
                    </Badge>
                  )}

                  {issue.issue === "missing_profile_data" && (
                    <Badge variant="outline" className="text-xs bg-amber-100">
                      Missing: {issue.missingFields?.join(", ")}
                    </Badge>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Property ID: {issue.propertyId}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">
            These issues cause invoice PDFs to show placeholder landlord info.
            Fix the database and invoices will show correct data.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
