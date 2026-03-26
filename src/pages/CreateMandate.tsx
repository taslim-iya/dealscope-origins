import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const steps = [
  { id: 1, name: "Mandate Details" },
  { id: 2, name: "Geography" },
  { id: 3, name: "Industry" },
  { id: 4, name: "Size Filters" },
  { id: 5, name: "Review" },
];

export default function CreateMandate() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    notes: "",
    country: "United Kingdom",
    regions: "",
    sicCodes: "",
    industryDescription: "",
    revenueMin: "",
    revenueMax: "",
    totalAssetsMin: "",
    totalAssetsMax: "",
    netAssetsMin: "",
    netAssetsMax: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const parseNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const num = parseFloat(value.replace(/,/g, ""));
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a mandate.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const regionsArray = formData.regions
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const { data, error } = await supabase
      .from("mandates")
      .insert({
        user_id: user.id,
        domain_id: profile.domain_id,
        name: formData.name,
        notes: formData.notes || null,
        country: formData.country,
        regions: regionsArray.length > 0 ? regionsArray : null,
        sic_codes: formData.sicCodes || null,
        industry_description: formData.industryDescription || null,
        revenue_min: parseNumber(formData.revenueMin),
        revenue_max: parseNumber(formData.revenueMax),
        total_assets_min: parseNumber(formData.totalAssetsMin),
        total_assets_max: parseNumber(formData.totalAssetsMax),
        net_assets_min: parseNumber(formData.netAssetsMin),
        net_assets_max: parseNumber(formData.netAssetsMax),
        status: "draft",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating mandate:", error);
      toast({
        title: "Failed to create mandate",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Mandate created",
      description: "Your mandate has been saved successfully.",
    });
    navigate(`/mandate/${data.id}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to dashboard</span>
          </Link>
          <Link to="/" className="text-lg font-semibold text-foreground">
            DealScope
          </Link>
          <div className="w-32"></div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-border bg-secondary/30">
        <div className="container-narrow py-4">
          <nav className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step.id < currentStep
                      ? "bg-accent text-accent-foreground"
                      : step.id === currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={`hidden sm:block ml-2 text-sm ${
                    step.id === currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step.name}
                </span>
                {index < steps.length - 1 && (
                  <div className="w-8 sm:w-16 h-px bg-border mx-2 sm:mx-4" />
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Form Content */}
      <main className="flex-1 py-8">
        <div className="container-narrow max-w-xl">
          {/* Step 1: Mandate Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Mandate Details</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Give your mandate a name and optional notes.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Mandate name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., UK Manufacturing Targets"
                    value={formData.name}
                    onChange={(e) => updateFormData("name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional context for this mandate..."
                    value={formData.notes}
                    onChange={(e) => updateFormData("notes", e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Geography */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Geography</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Define the geographic scope for your mandate.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => updateFormData("country", e.target.value)}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Currently limited to United Kingdom
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regions">Regions (optional)</Label>
                  <Input
                    id="regions"
                    placeholder="e.g., South East, Midlands, North West"
                    value={formData.regions}
                    onChange={(e) => updateFormData("regions", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of target regions
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Industry */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Industry</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Specify target industries using SIC codes or descriptions.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sicCodes">SIC codes</Label>
                  <Input
                    id="sicCodes"
                    placeholder="e.g., 25110, 25120, 28110"
                    value={formData.sicCodes}
                    onChange={(e) => updateFormData("sicCodes", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated SIC codes for target industries
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industryDescription">Industry description (optional)</Label>
                  <Textarea
                    id="industryDescription"
                    placeholder="Additional context about your target industries..."
                    value={formData.industryDescription}
                    onChange={(e) => updateFormData("industryDescription", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Size Filters */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Size Filters</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Define financial criteria for target companies.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>Revenue (£)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        placeholder="Min"
                        value={formData.revenueMin}
                        onChange={(e) => updateFormData("revenueMin", e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Max"
                        value={formData.revenueMax}
                        onChange={(e) => updateFormData("revenueMax", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Total Assets (£)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        placeholder="Min"
                        value={formData.totalAssetsMin}
                        onChange={(e) => updateFormData("totalAssetsMin", e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Max"
                        value={formData.totalAssetsMax}
                        onChange={(e) => updateFormData("totalAssetsMax", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Net Assets (£)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        placeholder="Min"
                        value={formData.netAssetsMin}
                        onChange={(e) => updateFormData("netAssetsMin", e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Max"
                        value={formData.netAssetsMax}
                        onChange={(e) => updateFormData("netAssetsMax", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Review & Submit</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review your mandate details before submitting.
                </p>
              </div>

              <div className="card-elevated divide-y divide-border">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Mandate Name</h3>
                  <p className="text-foreground">{formData.name || "—"}</p>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Geography</h3>
                  <p className="text-foreground">
                    {formData.country}
                    {formData.regions && ` (${formData.regions})`}
                  </p>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Industry</h3>
                  <p className="text-foreground">
                    {formData.sicCodes || formData.industryDescription || "—"}
                  </p>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Size Filters</h3>
                  <div className="text-sm text-foreground space-y-1">
                    {formData.revenueMin || formData.revenueMax ? (
                      <p>Revenue: £{formData.revenueMin || "0"} – £{formData.revenueMax || "∞"}</p>
                    ) : null}
                    {formData.totalAssetsMin || formData.totalAssetsMax ? (
                      <p>Total Assets: £{formData.totalAssetsMin || "0"} – £{formData.totalAssetsMax || "∞"}</p>
                    ) : null}
                    {formData.netAssetsMin || formData.netAssetsMax ? (
                      <p>Net Assets: £{formData.netAssetsMin || "0"} – £{formData.netAssetsMax || "∞"}</p>
                    ) : null}
                    {!formData.revenueMin && !formData.revenueMax && !formData.totalAssetsMin && 
                     !formData.totalAssetsMax && !formData.netAssetsMin && !formData.netAssetsMax && (
                      <p>No size filters applied</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Companies delivered will count toward your domain's free allowance 
                  (20 companies shared across all users at your organisation).
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < 5 ? (
              <Button onClick={nextStep} disabled={currentStep === 1 && !formData.name}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name}>
                {isSubmitting ? "Submitting..." : "Submit mandate"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
