import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Factory,
  Banknote,
  Filter,
  LogOut,
  Loader2,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UploadProgressIndicator } from "@/components/admin/UploadProgressIndicator";
import { fileToCSV } from "@/lib/fileToCSV";
import SuggestedMatches from "@/components/SuggestedMatches";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
}

interface Mandate {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  companies_delivered: number;
  country: string;
  regions: string[] | null;
  sic_codes: string | null;
  industry_description: string | null;
  revenue_min: number | null;
  revenue_max: number | null;
  total_assets_min: number | null;
  total_assets_max: number | null;
  net_assets_min: number | null;
  net_assets_max: number | null;
  user_id: string;
  profile?: Profile;
}

interface Company {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue_band: string | null;
  asset_band: string | null;
  status: string | null;
  revenue: number | null;
}

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "shortlisted", label: "Shortlisted" },
];

const statusBadges: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-slate-100 text-slate-600 border-slate-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const mandateStatusLabels = {
  draft: { label: "Draft", className: "status-draft" },
  active: { label: "Active", className: "status-active" },
  completed: { label: "Completed", className: "status-completed" },
};

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

export default function AdminMandateView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [estimatedCompanies, setEstimatedCompanies] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any> | null>(null);
  const [analyzingCsv, setAnalyzingCsv] = useState(false);
  const [lastCsvContent, setLastCsvContent] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
      setCheckingAdmin(false);

      if (!data) {
        toast({
          title: "Access denied",
          description: "You don't have admin permissions.",
          variant: "destructive",
        });
        navigate("/dashboard");
      }
    };

    if (user) {
      checkAdminStatus();
    }
  }, [user, navigate, toast]);

  const fetchData = async () => {
    if (!id || !isAdmin) return;

    // Fetch mandate (admin can see all)
    const { data: mandateData, error: mandateError } = await supabase
      .from("mandates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (mandateError || !mandateData) {
      console.error("Error fetching mandate:", mandateError);
      navigate("/admin");
      return;
    }

    // Fetch client profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_name")
      .eq("id", mandateData.user_id)
      .maybeSingle();

    setMandate({
      ...mandateData,
      profile: profileData || undefined,
    } as Mandate);

    // Fetch companies using paginated ranges
    const pageSize = 1000;
    let from = 0;
    let allCompanies: any[] = [];
    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from("companies")
        .select("*")
        .eq("mandate_id", id)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (batchError) break;
      allCompanies = allCompanies.concat(batch || []);
      if (!batch || batch.length < pageSize) break;
      from += pageSize;
    }
    setCompanies(allCompanies as Company[]);

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [id, isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    setUploadResult(null);
    setAiSuggestions(null);

    try {
      const text = await fileToCSV(file);
      setLastCsvContent(text);

      const { data, error } = await supabase.functions.invoke("process-company-upload", {
        body: {
          mandate_id: id,
          csv_content: text,
        },
      });

      if (error) {
        throw error;
      }

      setUploadResult({
        success: true,
        message: data.message || `Processing ~${data.estimated_companies} companies in background`,
      });
      setEstimatedCompanies(data.estimated_companies || 0);
      setBgProcessing(true);

      toast({
        title: "Upload started",
        description: data.message,
      });

      // Trigger AI analysis in background
      analyzeWithAI(text);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      });
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const analyzeWithAI = async (csvContent: string) => {
    setAnalyzingCsv(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-csv", {
        body: { csv_content: csvContent },
      });

      if (error) throw error;
      if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("AI analysis error:", error);
    } finally {
      setAnalyzingCsv(false);
    }
  };

  const applyAiSuggestions = async () => {
    if (!aiSuggestions || !id) return;

    const updates: Record<string, any> = {};
    if (aiSuggestions.industries) updates.industry_description = aiSuggestions.industries;
    if (aiSuggestions.sic_codes) updates.sic_codes = aiSuggestions.sic_codes;
    if (aiSuggestions.regions) updates.regions = aiSuggestions.regions.split(",").map((r: string) => r.trim());
    if (aiSuggestions.revenue_min) updates.revenue_min = aiSuggestions.revenue_min;
    if (aiSuggestions.revenue_max) updates.revenue_max = aiSuggestions.revenue_max;
    if (aiSuggestions.total_assets_min) updates.total_assets_min = aiSuggestions.total_assets_min;
    if (aiSuggestions.total_assets_max) updates.total_assets_max = aiSuggestions.total_assets_max;
    if (aiSuggestions.net_assets_min) updates.net_assets_min = aiSuggestions.net_assets_min;
    if (aiSuggestions.net_assets_max) updates.net_assets_max = aiSuggestions.net_assets_max;

    if (Object.keys(updates).length === 0) {
      toast({ title: "No suggestions to apply" });
      return;
    }

    const { error } = await supabase
      .from("mandates")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({ title: "Failed to update mandate", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Mandate updated", description: "AI suggestions applied successfully." });
    setAiSuggestions(null);
    fetchData();
  };

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch = company.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || company.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const buildGeographySummary = () => {
    if (!mandate) return "—";
    let geo = mandate.country;
    if (mandate.regions && mandate.regions.length > 0) {
      geo += ` (${mandate.regions.join(", ")})`;
    }
    return geo;
  };

  const buildIndustrySummary = () => {
    if (!mandate) return "—";
    const parts = [];
    if (mandate.sic_codes) parts.push(`SIC ${mandate.sic_codes}`);
    if (mandate.industry_description) parts.push(mandate.industry_description);
    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  const buildRevenueSummary = () => {
    if (!mandate) return "—";
    if (mandate.revenue_min === null && mandate.revenue_max === null) return "—";
    const min = formatCurrency(mandate.revenue_min);
    const max = mandate.revenue_max ? formatCurrency(mandate.revenue_max) : "∞";
    return `${min} - ${max}`;
  };

  if (authLoading || checkingAdmin || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin || !mandate) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container-wide h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold text-foreground">
              DealScope
            </Link>
            <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.email || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Sub-header */}
      <div className="border-b border-border bg-secondary/30">
        <div className="container-wide py-4">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">{mandate.name}</h1>
                <span className={`status-badge ${mandateStatusLabels[mandate.status].className}`}>
                  {mandateStatusLabels[mandate.status].label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Client: {mandate.profile?.company_name || mandate.profile?.email || "Unknown"} •{" "}
                {mandate.companies_delivered} companies delivered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mandate Criteria Summary */}
      <div className="border-b border-border">
        <div className="container-wide py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{buildGeographySummary()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Factory className="h-4 w-4" />
              <span>{buildIndustrySummary()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Banknote className="h-4 w-4" />
              <span>Revenue: {buildRevenueSummary()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="container-wide">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Companies & Upload */}
            <div className="lg:col-span-2 space-y-6">
              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Companies
                  </CardTitle>
                  <CardDescription>
                    Upload a CSV file with company data for this mandate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="max-w-md"
                      />
                      {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>

                    {uploadResult && !bgProcessing && (
                      <div
                        className={`flex items-center gap-2 p-3 rounded-lg ${
                          uploadResult.success
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {uploadResult.success ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span className="text-sm">{uploadResult.message}</span>
                      </div>
                    )}
                    {bgProcessing && id && (
                      <UploadProgressIndicator
                        mandateId={id}
                        isProcessing={bgProcessing}
                        estimatedCompanies={estimatedCompanies}
                        onComplete={() => {
                          setBgProcessing(false);
                          fetchData();
                        }}
                      />
                    )}

                    {analyzingCsv && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">AI is analyzing the uploaded data...</span>
                      </div>
                    )}

                    {aiSuggestions && (
                      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            AI-Suggested Mandate Criteria
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{aiSuggestions.summary}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {aiSuggestions.industries && (
                            <div>
                              <span className="text-muted-foreground">Industries:</span>{" "}
                              <span className="text-foreground">{aiSuggestions.industries}</span>
                            </div>
                          )}
                          {aiSuggestions.sic_codes && (
                            <div>
                              <span className="text-muted-foreground">SIC Codes:</span>{" "}
                              <span className="text-foreground">{aiSuggestions.sic_codes}</span>
                            </div>
                          )}
                          {aiSuggestions.regions && (
                            <div>
                              <span className="text-muted-foreground">Regions:</span>{" "}
                              <span className="text-foreground">{aiSuggestions.regions}</span>
                            </div>
                          )}
                          {(aiSuggestions.revenue_min || aiSuggestions.revenue_max) && (
                            <div>
                              <span className="text-muted-foreground">Revenue:</span>{" "}
                              <span className="text-foreground">
                                £{aiSuggestions.revenue_min?.toLocaleString() || "0"} – £{aiSuggestions.revenue_max?.toLocaleString() || "∞"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={applyAiSuggestions}>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Apply to Mandate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setAiSuggestions(null)}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Companies List */}
              <Card>
                <CardHeader>
                  <CardTitle>Companies ({companies.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {companies.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No companies added yet. Upload a CSV or add from suggestions.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <Input
                          placeholder="Search companies..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="max-w-xs"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        {filteredCompanies.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/company/${company.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <span className="font-medium text-foreground">
                                  {company.company_name}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {company.industry || "—"} • {company.geography || "—"}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`status-badge ${
                                statusBadges[company.status || "new"] || statusBadges.new
                              }`}
                            >
                              {(company.status || "new").charAt(0).toUpperCase() +
                                (company.status || "new").slice(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Suggested Matches */}
            <div>
              <SuggestedMatches mandate={mandate} onCompanyAdded={fetchData} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          DealScope Admin • Managing mandate for {mandate.profile?.company_name || "client"}
        </p>
      </footer>
    </div>
  );
}
