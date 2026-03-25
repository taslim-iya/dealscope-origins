import { useState, useEffect, useRef } from "react";
import { fileToCSV } from "@/lib/fileToCSV";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
  Building2,
  Trash2,
  Search,
  Download,
  ExternalLink,
  Sparkles,
  Globe,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UploadProgressIndicator } from "@/components/admin/UploadProgressIndicator";

const CORGI_AI_MANDATE_NAME = "Corgi AI";

interface Company {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue: number | null;
  profit_before_tax: number | null;
  net_assets: number | null;
  total_assets: number | null;
  status: string | null;
  website: string | null;
  description_of_activities: string | null;
  companies_house_number: string | null;
  address: string | null;
  created_at: string;
}

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

export default function AdminCorgiAI() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [mandateId, setMandateId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [estimatedCompanies, setEstimatedCompanies] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [webEnriching, setWebEnriching] = useState(false);
  const [sortField, setSortField] = useState<keyof Company | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const checkAdmin = async () => {
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
        toast({ title: "Access denied", description: "Admin permissions required.", variant: "destructive" });
        navigate("/dashboard");
      }
    };
    if (user) checkAdmin();
  }, [user, navigate, toast]);

  const getOrCreateMandate = async (): Promise<string | null> => {
    if (!user) return null;

    // Look for existing Corgi AI mandate
    const { data: existing } = await supabase
      .from("mandates")
      .select("id")
      .eq("name", CORGI_AI_MANDATE_NAME)
      .maybeSingle();

    if (existing) return existing.id;

    // Create one
    const { data: created, error } = await supabase
      .from("mandates")
      .insert({
        name: CORGI_AI_MANDATE_NAME,
        user_id: user.id,
        status: "active",
        country: "United Kingdom",
        industry_description: "Corgi AI client companies",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create Corgi AI mandate:", error);
      return null;
    }
    return created.id;
  };

  const fetchCount = async (mId: string) => {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("mandate_id", mId);
    setTotalCount(count || 0);
  };

  const fetchCompanies = async (mId: string, pageNum?: number) => {
    const p = pageNum ?? page;
    const from = p * PAGE_SIZE;
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("mandate_id", mId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch companies:", error);
    } else {
      setCompanies((data || []) as Company[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      if (!isAdmin) return;
      const mId = await getOrCreateMandate();
      if (mId) {
        setMandateId(mId);
        await Promise.all([fetchCount(mId), fetchCompanies(mId, 0)]);
      } else {
        setLoading(false);
      }
    };
    if (isAdmin) init();
  }, [isAdmin]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
    if (mandateId) {
      setLoading(true);
      fetchCompanies(mandateId, newPage);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !mandateId) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const text = await fileToCSV(file);
      const { data, error } = await supabase.functions.invoke("process-company-upload", {
        body: { mandate_id: mandateId, csv_content: text },
      });

      if (error) throw error;

      setUploadResult({ success: true, message: data.message || `Processing ~${data.estimated_companies} companies in background` });
      setEstimatedCompanies(data.estimated_companies || 0);
      setBgProcessing(true);
      toast({ title: "Upload started", description: data.message });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      setUploadResult({ success: false, message: msg });
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    toast({ title: "Company deleted" });
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

  const handleReanalyze = async () => {
    if (!mandateId) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-enrich-companies", {
        body: { mandate_id: mandateId },
      });

      if (error) {
        // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
        const errorBody = typeof error === "object" && "context" in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        const msg = errorBody?.error || error.message || "Re-analysis failed";
        toast({ title: "Re-analysis failed", description: msg, variant: "destructive" });
        return;
      }

      if (data?.error) {
        toast({ title: "Re-analysis failed", description: data.error, variant: "destructive" });
        return;
      }

      toast({ title: "Re-analysis started", description: data?.message || "AI is enriching company data from the stored file." });
      // Poll for updates
      setTimeout(() => { if (mandateId) { fetchCount(mandateId); fetchCompanies(mandateId); } }, 10000);
      setTimeout(() => { if (mandateId) { fetchCount(mandateId); fetchCompanies(mandateId); } }, 30000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Re-analysis failed";
      toast({ title: "Re-analysis failed", description: msg, variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  const handleWebEnrich = async () => {
    if (!mandateId) return;
    setWebEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-enrich-companies", {
        body: { mandate_id: mandateId },
      });

      if (error) {
        const errorBody = typeof error === "object" && "context" in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        const msg = errorBody?.error || error.message || "Web enrichment failed";
        toast({ title: "Web enrichment failed", description: msg, variant: "destructive" });
        return;
      }

      if (data?.error) {
        toast({ title: "Web enrichment failed", description: data.error, variant: "destructive" });
        return;
      }

      toast({ title: "Web enrichment started", description: data?.message || "Searching the web to fill missing company data." });
      // Poll for updates
      setTimeout(() => { if (mandateId) { fetchCount(mandateId); fetchCompanies(mandateId); } }, 15000);
      setTimeout(() => { if (mandateId) { fetchCount(mandateId); fetchCompanies(mandateId); } }, 30000);
      setTimeout(() => { if (mandateId) { fetchCount(mandateId); fetchCompanies(mandateId); } }, 60000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Web enrichment failed";
      toast({ title: "Web enrichment failed", description: msg, variant: "destructive" });
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

  const handleExportCSV = () => {
    if (companies.length === 0) return;
    const headers = ["Company Name", "Industry", "Geography", "Revenue", "Profit Before Tax", "Net Assets", "Website", "Status"];
    const rows = companies.map((c) => [
      c.company_name,
      c.industry || "",
      c.geography || "",
      c.revenue?.toString() || "",
      c.profit_before_tax?.toString() || "",
      c.net_assets?.toString() || "",
      c.website || "",
      c.status || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corgi-ai-companies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: keyof Company) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: keyof Company }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filteredCompanies = companies
    .filter((c) =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.industry || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.geography || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (authLoading || checkingAdmin || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container-wide h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold text-foreground">DealScope</Link>
            <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{profile?.email || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" />Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="container-wide">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />Back to Admin Dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                Corgi AI
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload and manage companies for Corgi AI — {totalCount.toLocaleString()} companies in database
              </p>
            </div>
            {companies.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWebEnrich}
                  disabled={webEnriching}
                  className="gap-2"
                >
                  {webEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  Enrich with Web Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReanalyze}
                  disabled={enriching}
                  className="gap-2"
                >
                  {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Re-analyze with AI
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />Export CSV
                </Button>
              </div>
            )}
          </div>

          {/* Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />Upload Companies
              </CardTitle>
              <CardDescription>
                Upload a CSV file with company data for Corgi AI. Required column: company_name.
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
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${uploadResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {uploadResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span className="text-sm">{uploadResult.message}</span>
                  </div>
                )}
                {bgProcessing && mandateId && (
                  <UploadProgressIndicator
                    mandateId={mandateId}
                    isProcessing={bgProcessing}
                    estimatedCompanies={estimatedCompanies}
                    onComplete={() => {
                      setBgProcessing(false);
                      fetchCount(mandateId);
                      fetchCompanies(mandateId);
                      // Auto-trigger web enrichment after upload completes
                      setTimeout(() => handleWebEnrich(), 2000);
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Companies Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CardTitle>Companies ({filteredCompanies.length})</CardTitle>
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
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredCompanies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {companies.length === 0 ? "No companies uploaded yet. Upload a CSV or Excel file to get started." : "No companies match your search."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[1400px]">
                    <TableHeader>
                      <TableRow>
                         <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("company_name")}>
                          <span className="inline-flex items-center">Company Name<SortIcon field="company_name" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("industry")}>
                          <span className="inline-flex items-center">Industry<SortIcon field="industry" /></span>
                        </TableHead>
                        <TableHead className="max-w-[200px] cursor-pointer select-none" onClick={() => toggleSort("description_of_activities")}>
                          <span className="inline-flex items-center">Description<SortIcon field="description_of_activities" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("geography")}>
                          <span className="inline-flex items-center">Country<SortIcon field="geography" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("revenue")}>
                          <span className="inline-flex items-center">Revenue<SortIcon field="revenue" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("profit_before_tax")}>
                          <span className="inline-flex items-center">PBT<SortIcon field="profit_before_tax" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total_assets")}>
                          <span className="inline-flex items-center">Total Assets<SortIcon field="total_assets" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("net_assets")}>
                          <span className="inline-flex items-center">Equity<SortIcon field="net_assets" /></span>
                        </TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompanies.map((company) => (
                        <TableRow key={company.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/company/${company.id}`)}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(company.id)}
                              onCheckedChange={() => toggleSelect(company.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{company.company_name}</TableCell>
                          <TableCell className="text-muted-foreground">{company.industry || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs" title={company.description_of_activities || ""}>
                            {company.description_of_activities || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{company.geography || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(company.revenue)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(company.profit_before_tax)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(company.total_assets)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(company.net_assets)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {company.website ? (
                              <a
                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Link
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete company?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove "{company.company_name}" from the database.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCompany(company.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
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
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
