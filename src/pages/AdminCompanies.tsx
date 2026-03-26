import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Search,
  Loader2,
  LogOut,
  Filter,
  ExternalLink,
  Users,
  FileText,
  Trash2,
  Upload,
  Sparkles,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResizableDataTable, ColumnDef } from "@/components/admin/ResizableDataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { UploadProgressIndicator } from "@/components/admin/UploadProgressIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
}

interface Mandate {
  id: string;
  name: string;
  status: string;
  user_id: string;
  created_at: string;
  industry_description: string | null;
  regions: string[] | null;
  revenue_min: number | null;
  revenue_max: number | null;
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
  profit_before_tax: number | null;
  net_assets: number | null;
  total_assets: number | null;
  website: string | null;
  description_of_activities: string | null;
  address: string | null;
  mandate_id: string;
  created_at: string;
  mandate?: Mandate;
}

const statusBadges: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-slate-100 text-slate-600 border-slate-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${(value / 1000).toFixed(0)}K`;
  return `£${value.toFixed(0)}`;
};

export default function AdminCompanies() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [geographyFilter, setGeographyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mandateFilter, setMandateFilter] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Upload & Enrich
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMandateId, setUploadMandateId] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadEstimate, setUploadEstimate] = useState(0);
  const [aiEnriching, setAiEnriching] = useState(false);
  const [webEnriching, setWebEnriching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 100;

  // Unique filter options
  const [industries, setIndustries] = useState<string[]>([]);
  const [geographies, setGeographies] = useState<string[]>([]);

  // Auth guard removed — allow unauthenticated access
  useEffect(() => {
    if (!authLoading && !user) {
      // No redirect — page viewable without login
      setCheckingAdmin(false);
      setIsAdmin(true);
    }
  }, [authLoading, user]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(true);
        setCheckingAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(true); // Always grant access
      setCheckingAdmin(false);
    };

    if (user) {
      checkAdminStatus();
    }
  }, [user, navigate, toast]);

  const fetchData = async (pageNum?: number) => {
    if (!isAdmin) return;
    setLoading(true);

    // Fetch all mandates with client info
    const { data: mandatesData } = await supabase
      .from("mandates")
      .select("id, name, status, user_id, created_at, industry_description, regions, revenue_min, revenue_max")
      .order("created_at", { ascending: false });

    if (mandatesData) {
      const userIds = [...new Set(mandatesData.map((m) => m.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name")
        .in("id", userIds);

      const profilesMap = new Map<string, Profile>();
      profilesData?.forEach((p) => profilesMap.set(p.id, p));

      const mandatesWithProfiles = mandatesData.map((m) => ({
        ...m,
        profile: profilesMap.get(m.user_id),
      }));
      setMandates(mandatesWithProfiles);
    }

    // Get total count
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true });
    setTotalCount(count || 0);

    // Fetch current page of companies
    const p = pageNum ?? page;
    const from = p * PAGE_SIZE;
    const { data: companiesData, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch companies:", error);
    }

    if (companiesData && mandatesData) {
      const mandateMap = new Map<string, Mandate>();
      mandatesData.forEach((m) => {
        mandateMap.set(m.id, m as Mandate);
      });

      const companiesWithMandates = companiesData.map((c) => ({
        ...c,
        mandate: mandateMap.get(c.mandate_id),
      }));
      setCompanies(companiesWithMandates);

      // Extract unique filter values (from current page — approximate)
      const uniqueIndustries = [...new Set(companiesData.map((c) => c.industry).filter(Boolean))] as string[];
      const uniqueGeographies = [...new Set(companiesData.map((c) => c.geography).filter(Boolean))] as string[];
      setIndustries(uniqueIndustries.sort());
      setGeographies(uniqueGeographies.sort());
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData(0);
    }
  }, [isAdmin]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
    fetchData(newPage);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) {
      toast({
        title: "Error deleting company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
      toast({
        title: "Company deleted",
        description: `${companyName} has been removed.`,
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("companies").delete().in("id", ids);
    if (error) {
      toast({ title: "Batch delete failed", description: error.message, variant: "destructive" });
    } else {
      setCompanies((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      toast({ title: `Deleted ${ids.length} companies` });
      setSelectedIds(new Set());
    }
    setBatchDeleting(false);
  };

  const handleCsvUpload = async () => {
    if (!csvFile || !uploadMandateId) {
      toast({ title: "Missing fields", description: "Please select a mandate and a CSV file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const csvContent = await csvFile.text();
      // Estimate rows from line count (minus header)
      const lineCount = csvContent.split("\n").filter((l) => l.trim()).length;
      setUploadEstimate(Math.max(lineCount - 1, 1));

      const { data, error } = await supabase.functions.invoke("process-company-upload", {
        body: { mandate_id: uploadMandateId, csv_content: csvContent },
      });

      if (error) throw error;

      toast({
        title: "Upload started",
        description: data?.message || "Companies are being processed.",
      });
    } catch (err: any) {
      setUploading(false);
      toast({ title: "Upload failed", description: err.message || "Something went wrong.", variant: "destructive" });
    }
  };

  const handleUploadComplete = useCallback(() => {
    setUploading(false);
    setCsvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({ title: "Upload complete", description: "Companies have been added successfully." });
    fetchData(0);
  }, [toast]);

  const handleAiEnrich = async () => {
    if (!uploadMandateId) {
      toast({ title: "Select a mandate", description: "Choose which mandate to enrich.", variant: "destructive" });
      return;
    }
    setAiEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-enrich-companies", {
        body: { mandate_id: uploadMandateId, fields_to_enrich: ["industry", "description_of_activities", "geography", "revenue_band"] },
      });
      if (error) throw error;
      toast({ title: "AI Enrichment complete", description: data?.message || "Companies enriched successfully." });
      fetchData(0);
    } catch (err: any) {
      toast({ title: "AI Enrichment failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setAiEnriching(false);
    }
  };

  const handleWebEnrich = async () => {
    if (!uploadMandateId) {
      toast({ title: "Select a mandate", description: "Choose which mandate to enrich.", variant: "destructive" });
      return;
    }
    setWebEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-enrich-companies", {
        body: { mandate_id: uploadMandateId },
      });
      if (error) throw error;
      toast({ title: "Web Enrichment complete", description: data?.message || "Companies enriched with web data." });
      fetchData(0);
    } catch (err: any) {
      toast({ title: "Web Enrichment failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setWebEnriching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map((c) => c.id)));
    }
  };

  // Filter companies
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      searchQuery === "" ||
      company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.geography?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesIndustry = industryFilter === "all" || company.industry === industryFilter;
    const matchesGeography = geographyFilter === "all" || company.geography === geographyFilter;
    const matchesStatus = statusFilter === "all" || company.status === statusFilter;
    const matchesMandate = mandateFilter === "all" || company.mandate_id === mandateFilter;

    return matchesSearch && matchesIndustry && matchesGeography && matchesStatus && matchesMandate;
  });

  // Table column definitions
  const tableColumns: ColumnDef<Company>[] = useMemo(() => [
    {
      id: "select",
      label: "",
      defaultWidth: 40,
      minWidth: 40,
      headerRender: () => (
        <Checkbox
          checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0}
          onCheckedChange={toggleSelectAll}
        />
      ),
      render: (company) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(company.id)}
            onCheckedChange={() => toggleSelect(company.id)}
          />
        </div>
      ),
    },
    {
      id: "company_name",
      label: "Company Name",
      defaultWidth: 180,
      minWidth: 100,
      cellClassName: "font-medium",
      render: (c) => c.company_name,
      sortKey: (c) => c.company_name,
    },
    {
      id: "industry",
      label: "Industry",
      defaultWidth: 140,
      minWidth: 80,
      cellClassName: "text-muted-foreground",
      render: (c) => c.industry || "—",
      sortKey: (c) => c.industry,
    },
    {
      id: "description",
      label: "Description",
      defaultWidth: 200,
      minWidth: 100,
      cellClassName: "text-muted-foreground text-xs",
      render: (c) => (
        <span title={c.description_of_activities || ""}>{c.description_of_activities || "—"}</span>
      ),
      sortKey: (c) => c.description_of_activities,
    },
    {
      id: "country",
      label: "Country",
      defaultWidth: 110,
      minWidth: 70,
      cellClassName: "text-muted-foreground",
      render: (c) => c.geography || "—",
      sortKey: (c) => c.geography,
    },
    {
      id: "revenue",
      label: "Revenue",
      defaultWidth: 100,
      minWidth: 70,
      render: (c) => c.revenue ? formatCurrency(c.revenue) : c.revenue_band || "—",
      sortKey: (c) => c.revenue,
    },
    {
      id: "pbt",
      label: "PBT",
      defaultWidth: 90,
      minWidth: 60,
      render: (c) => formatCurrency(c.profit_before_tax),
      sortKey: (c) => c.profit_before_tax,
    },
    {
      id: "total_assets",
      label: "Total Assets",
      defaultWidth: 100,
      minWidth: 70,
      render: (c) => formatCurrency(c.total_assets),
      sortKey: (c) => c.total_assets,
    },
    {
      id: "equity",
      label: "Equity",
      defaultWidth: 90,
      minWidth: 60,
      render: (c) => formatCurrency(c.net_assets),
      sortKey: (c) => c.net_assets,
    },
    {
      id: "website",
      label: "Website",
      defaultWidth: 80,
      minWidth: 60,
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          {c.website ? (
            <a
              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Link
            </a>
          ) : "—"}
        </div>
      ),
    },
    {
      id: "actions",
      label: "",
      defaultWidth: 50,
      minWidth: 40,
      render: (company) => (
        <div onClick={(e) => e.stopPropagation()}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {company.company_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this company. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => handleDeleteCompany(company.id, company.company_name)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [selectedIds, filteredCompanies.length]);

  // Get unique clients from mandates
  const uniqueClients = [...new Map(mandates.map((m) => [m.profile?.id, m.profile])).values()].filter(Boolean);

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
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

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="container-wide">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Company Database</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search and manage all companies across mandates. Use filters to find matches for new client requests.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Companies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">{totalCount.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Mandates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">{mandates.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unique Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">{uniqueClients.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Industries Covered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">{industries.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload & Enrich */}
          <Collapsible open={uploadOpen} onOpenChange={setUploadOpen} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload &amp; Enrich
                    </CardTitle>
                    {uploadOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <CardDescription>
                    Upload company CSVs and enrich data with AI or web search
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Mandate selector — shared by all actions */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Select Mandate</label>
                    <Select value={uploadMandateId} onValueChange={setUploadMandateId}>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Choose a mandate…" />
                      </SelectTrigger>
                      <SelectContent>
                        {mandates.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} — {m.profile?.company_name || m.profile?.email || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CSV Upload */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Upload className="h-4 w-4" /> CSV Upload
                    </h3>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                      <div className="flex-1 w-full">
                        <label className="text-xs text-muted-foreground mb-1 block">Select a .csv file</label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                          className="w-full max-w-md"
                        />
                      </div>
                      <Button onClick={handleCsvUpload} disabled={uploading || !csvFile || !uploadMandateId} className="gap-2">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Processing…" : "Upload CSV"}
                      </Button>
                    </div>
                    {csvFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                    {uploading && uploadMandateId && (
                      <UploadProgressIndicator
                        mandateId={uploadMandateId}
                        isProcessing={uploading}
                        estimatedCompanies={uploadEstimate}
                        onComplete={handleUploadComplete}
                      />
                    )}
                  </div>

                  {/* Enrich buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={handleAiEnrich}
                      disabled={aiEnriching || !uploadMandateId}
                      className="gap-2"
                    >
                      {aiEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {aiEnriching ? "Enriching…" : "AI Enrich"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleWebEnrich}
                      disabled={webEnriching || !uploadMandateId}
                      className="gap-2"
                    >
                      {webEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                      {webEnriching ? "Enriching…" : "Web Enrich"}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Search and Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
              <CardDescription>
                Find companies matching specific criteria. When a client requests new companies, search here first to find existing matches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Search by name, industry, or geography..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>

                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={geographyFilter} onValueChange={setGeographyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Geography" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Geographies</SelectItem>
                    {geographies.map((geography) => (
                      <SelectItem key={geography} value={geography}>
                        {geography}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4">
                <Select value={mandateFilter} onValueChange={setMandateFilter}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Filter by mandate/client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mandates</SelectItem>
                    {mandates.map((mandate) => (
                      <SelectItem key={mandate.id} value={mandate.id}>
                        {mandate.name} — {mandate.profile?.company_name || mandate.profile?.email || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredCompanies.length !== companies.length && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Showing {filteredCompanies.length} of {companies.length} companies
                </p>
              )}
            </CardContent>
          </Card>

          {/* Companies Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>All Companies</CardTitle>
                  <CardDescription>
                    Complete database of uploaded companies with client attribution
                  </CardDescription>
                </div>
                {selectedIds.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={batchDeleting} className="gap-2">
                        {batchDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete {selectedIds.size} selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedIds.size} companies?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the selected companies. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleBatchDelete}
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {companies.length === 0
                      ? "No companies uploaded yet"
                      : "No companies match your filters"}
                  </p>
                </div>
              ) : (
                <>
                  <ResizableDataTable<Company>
                    columns={tableColumns}
                    data={filteredCompanies}
                    rowKey={(c) => c.id}
                    onRowClick={(c) => navigate(`/company/${c.id}`, { state: { from: 'admin' } })}
                    emptyState={null}
                  />
                  {totalCount > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => handlePageChange(page - 1)}>
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}
                        </span>
                        <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => handlePageChange(page + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
