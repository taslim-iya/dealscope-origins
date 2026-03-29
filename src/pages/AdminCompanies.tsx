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
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  getLocalCompanies,
  getLocalCompanyCount,
  getLocalCompaniesPage,
  addLocalCompanies,
  deleteLocalCompany as deleteLocalComp,
  deleteLocalCompanies as deleteLocalComps,
  parseCsvToCompanies,
  parseXlsxRows,
  type LocalCompany,
} from "@/lib/localCompanyStore";

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
  employees?: string | null;
  director_name?: string | null;
  director_title?: string | null;
  year_incorporated?: string | null;
}

const statusBadges: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-slate-100 text-slate-600 border-slate-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: string | number | null | undefined): string => {
  if (value == null || value === "") return "—";
  const num = typeof value === "number" ? value : parseInt(String(value).replace(/,/g, ""), 10);
  if (isNaN(num)) return String(value);
  return num.toLocaleString();
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
  const [revenueMin, setRevenueMin] = useState<string>("");
  const [revenueMax, setRevenueMax] = useState<string>("");
  const [employeesMin, setEmployeesMin] = useState<string>("");
  const [employeesMax, setEmployeesMax] = useState<string>("");

  // Sort
  const [sortField, setSortField] = useState<string>("company_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Upload & Enrich
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMandateId, setUploadMandateId] = useState<string>("general");
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

  useEffect(() => {
    setIsAdmin(true);
    setCheckingAdmin(false);
  }, []);

  const fetchData = async (pageNum?: number) => {
    if (!isAdmin) return;
    setLoading(true);

    // FAST PATH: Load local IndexedDB data FIRST (instant, no network)
    try {
      const localCount = await getLocalCompanyCount();
      if (localCount > 0) {
        // Load only the current page from IndexedDB (not all 87K)
        const p = pageNum ?? page;
        const localPage = await getLocalCompaniesPage(p * PAGE_SIZE, PAGE_SIZE);
        setCompanies(localPage.map(c => ({ ...c, mandate: undefined })));
        setTotalCount(localCount);

        // Build filter options from first batch
        const allLocal = await getLocalCompaniesPage(0, 10000); // sample for filters
        const uniqueIndustries = [...new Set(allLocal.map((c) => c.industry).filter(Boolean))] as string[];
        const uniqueGeographies = [...new Set(allLocal.map((c) => c.geography).filter(Boolean))] as string[];
        setIndustries(uniqueIndustries.sort());
        setGeographies(uniqueGeographies.sort());
        setLoading(false);
      }
    } catch (err) {
      console.log("IndexedDB error:", err);
    }

    // SLOW PATH: Try Supabase in background (3s timeout)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const { data: mandatesData } = await supabase
        .from("mandates")
        .select("id, name, status, user_id, created_at, industry_description, regions, revenue_min, revenue_max")
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (mandatesData && mandatesData.length > 0) {
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

      // Fetch Supabase companies and merge
      const p = pageNum ?? page;
      const from = p * PAGE_SIZE;
      const { data: companiesData, count } = await supabase
        .from("companies")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (companiesData && companiesData.length > 0) {
        const localPage = await getLocalCompaniesPage(0, PAGE_SIZE);
        const localCount = await getLocalCompanyCount();
        const allCompanies = [
          ...companiesData.map(c => ({ ...c, mandate: undefined })),
          ...localPage.map(c => ({ ...c, mandate: undefined })),
        ];
        setCompanies(allCompanies);
        setTotalCount((count || 0) + localCount);
      }
    } catch (err) {
      // Supabase unavailable or timed out — local data already loaded above
      console.log("Supabase unavailable, using local data only");
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
    // Try Supabase first
    try {
      await supabase.from("companies").delete().eq("id", companyId);
    } catch { /* ignore */ }
    // Also delete from local
    await deleteLocalComp(companyId);
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    setTotalCount((prev) => prev - 1);
    toast({
      title: "Company deleted",
      description: `${companyName} has been removed.`,
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    const ids = Array.from(selectedIds);
    // Try Supabase
    try {
      await supabase.from("companies").delete().in("id", ids);
    } catch { /* ignore */ }
    // Also delete from local
    await deleteLocalComps(ids);
    setCompanies((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setTotalCount((prev) => prev - ids.length);
    toast({ title: `Deleted ${ids.length} companies` });
    setSelectedIds(new Set());
    setBatchDeleting(false);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({ title: "Missing file", description: "Please select a CSV or XLSX file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const isExcel = csvFile.name.endsWith(".xlsx") || csvFile.name.endsWith(".xls");
      const mandateId = uploadMandateId || "general";
      let totalAdded = 0;

      if (isExcel) {
        // Parse XLSX using array-of-arrays mode (handles merged header rows)
        const arrayBuffer = await csvFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (raw.length < 2) {
          toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
          setUploading(false);
          return;
        }

        setUploadEstimate(raw.length);

        // Parse with smart header detection
        const companyRows = parseXlsxRows(raw, mandateId);

        if (companyRows.length === 0) {
          toast({ title: "No companies found", description: "Could not find any company rows. Check your column headers.", variant: "destructive" });
          setUploading(false);
          return;
        }

        // Save to IndexedDB in chunks with progress
        const CHUNK = 5000;
        for (let i = 0; i < companyRows.length; i += CHUNK) {
          const chunk = companyRows.slice(i, i + CHUNK);
          const added = await addLocalCompanies(chunk);
          totalAdded += added;
          setUploadEstimate(Math.round(((i + CHUNK) / companyRows.length) * 100));
        }

      } else {
        // Parse CSV
        const csvContent = await csvFile.text();
        const parsed = Papa.parse<Record<string, string>>(csvContent, { header: true, skipEmptyLines: true });
        const rows = parsed.data;

        if (rows.length === 0) {
          toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
          setUploading(false);
          return;
        }

        setUploadEstimate(rows.length);
        const companyRows = parseCsvToCompanies(rows, mandateId);
        totalAdded = await addLocalCompanies(companyRows);
      }

      toast({
        title: "Upload complete ✅",
        description: `${totalAdded.toLocaleString()} companies added from ${csvFile.name}.`,
      });

      // Re-fetch to show the new companies
      await fetchData(0);

      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setUploading(false);
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
  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      const matchesSearch =
        searchQuery === "" ||
        company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.geography?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.description_of_activities?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.director_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry = industryFilter === "all" || company.industry === industryFilter;
      const matchesGeography = geographyFilter === "all" || company.geography === geographyFilter;
      const matchesStatus = statusFilter === "all" || company.status === statusFilter;
      const matchesMandate = mandateFilter === "all" || company.mandate_id === mandateFilter;

      // Revenue range
      const revMin = revenueMin ? parseFloat(revenueMin) : null;
      const revMax = revenueMax ? parseFloat(revenueMax) : null;
      const matchesRevMin = revMin === null || (company.revenue !== null && company.revenue >= revMin);
      const matchesRevMax = revMax === null || (company.revenue !== null && company.revenue <= revMax);

      // Employees range
      const empMin = employeesMin ? parseInt(employeesMin) : null;
      const empMax = employeesMax ? parseInt(employeesMax) : null;
      const empCount = company.employees ? parseInt(String(company.employees).replace(/,/g, "")) : null;
      const matchesEmpMin = empMin === null || (empCount !== null && empCount >= empMin);
      const matchesEmpMax = empMax === null || (empCount !== null && empCount <= empMax);

      return matchesSearch && matchesIndustry && matchesGeography && matchesStatus && matchesMandate && matchesRevMin && matchesRevMax && matchesEmpMin && matchesEmpMax;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortField) {
        case "company_name": valA = a.company_name?.toLowerCase(); valB = b.company_name?.toLowerCase(); break;
        case "industry": valA = a.industry?.toLowerCase(); valB = b.industry?.toLowerCase(); break;
        case "geography": valA = a.geography?.toLowerCase(); valB = b.geography?.toLowerCase(); break;
        case "revenue": valA = a.revenue; valB = b.revenue; break;
        case "profit_before_tax": valA = a.profit_before_tax; valB = b.profit_before_tax; break;
        case "total_assets": valA = a.total_assets; valB = b.total_assets; break;
        case "net_assets": valA = a.net_assets; valB = b.net_assets; break;
        case "employees": valA = a.employees ? parseInt(String(a.employees).replace(/,/g, "")) : null; valB = b.employees ? parseInt(String(b.employees).replace(/,/g, "")) : null; break;
        default: valA = a.company_name?.toLowerCase(); valB = b.company_name?.toLowerCase();
      }

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [companies, searchQuery, industryFilter, geographyFilter, statusFilter, mandateFilter, revenueMin, revenueMax, employeesMin, employeesMax, sortField, sortDir]);

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
      defaultWidth: 200,
      minWidth: 120,
      cellClassName: "font-medium",
      render: (c) => c.company_name,
      sortKey: (c) => c.company_name,
    },
    {
      id: "geography",
      label: "St / Country",
      defaultWidth: 80,
      minWidth: 60,
      cellClassName: "text-muted-foreground",
      render: (c) => c.geography || "—",
      sortKey: (c) => c.geography,
    },
    {
      id: "year_incorporated",
      label: "Year Inc.",
      defaultWidth: 75,
      minWidth: 60,
      cellClassName: "text-muted-foreground",
      render: (c) => c.year_incorporated || "—",
      sortKey: (c) => c.year_incorporated,
    },
    {
      id: "industry",
      label: "NACE / Industry",
      defaultWidth: 110,
      minWidth: 80,
      cellClassName: "text-muted-foreground",
      render: (c) => c.industry || "—",
      sortKey: (c) => c.industry,
    },
    {
      id: "employees",
      label: "Employees",
      defaultWidth: 90,
      minWidth: 70,
      render: (c) => formatNumber(c.employees),
      sortKey: (c) => c.employees ? parseInt(String(c.employees).replace(/,/g, "")) : null,
    },
    {
      id: "revenue",
      label: "Revenue (USD)",
      defaultWidth: 120,
      minWidth: 90,
      render: (c) => c.revenue ? formatCurrency(c.revenue) : c.revenue_band || "—",
      sortKey: (c) => c.revenue,
    },
    {
      id: "pbt",
      label: "P/L Before Tax",
      defaultWidth: 120,
      minWidth: 90,
      render: (c) => formatCurrency(c.profit_before_tax),
      sortKey: (c) => c.profit_before_tax,
    },
    {
      id: "total_assets",
      label: "Total Assets",
      defaultWidth: 110,
      minWidth: 80,
      render: (c) => formatCurrency(c.total_assets),
      sortKey: (c) => c.total_assets,
    },
    {
      id: "equity",
      label: "Equity (USD)",
      defaultWidth: 110,
      minWidth: 80,
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
              Visit
            </a>
          ) : "—"}
        </div>
      ),
    },
    {
      id: "description",
      label: "Description",
      defaultWidth: 200,
      minWidth: 100,
      cellClassName: "text-muted-foreground text-xs",
      render: (c) => (
        <span title={c.description_of_activities || ""}>{(c.description_of_activities || "—").slice(0, 80)}{(c.description_of_activities?.length || 0) > 80 ? "…" : ""}</span>
      ),
      sortKey: (c) => c.description_of_activities,
    },
    {
      id: "director_name",
      label: "Director",
      defaultWidth: 140,
      minWidth: 90,
      cellClassName: "text-muted-foreground",
      render: (c) => c.director_name || "—",
      sortKey: (c) => c.director_name,
    },
    {
      id: "director_title",
      label: "Title",
      defaultWidth: 120,
      minWidth: 80,
      cellClassName: "text-muted-foreground text-xs",
      render: (c) => c.director_title || "—",
      sortKey: (c) => c.director_title,
    },
    {
      id: "status",
      label: "Status",
      defaultWidth: 90,
      minWidth: 70,
      render: (c) => {
        const st = c.status || "new";
        return (
          <Badge variant="outline" className={statusBadges[st] || statusBadges.new}>
            {st.charAt(0).toUpperCase() + st.slice(1)}
          </Badge>
        );
      },
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
                        <SelectValue placeholder="Choose a mandate (or use General)…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Upload (no mandate)</SelectItem>
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
                        <label className="text-xs text-muted-foreground mb-1 block">Select a .csv or .xlsx file</label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls"
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

              {/* Revenue & Employee range filters */}
              <div className="grid gap-4 md:grid-cols-4 mt-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Revenue Min ($)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000000"
                    value={revenueMin}
                    onChange={(e) => setRevenueMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Revenue Max ($)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 50000000"
                    value={revenueMax}
                    onChange={(e) => setRevenueMax(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Employees Min</label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={employeesMin}
                    onChange={(e) => setEmployeesMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Employees Max</label>
                  <Input
                    type="number"
                    placeholder="e.g. 500"
                    value={employeesMax}
                    onChange={(e) => setEmployeesMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-3 mt-4">
                <label className="text-xs text-muted-foreground font-medium">Sort by:</label>
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_name">Company Name</SelectItem>
                    <SelectItem value="geography">State/Country</SelectItem>
                    <SelectItem value="industry">Industry/NACE</SelectItem>
                    <SelectItem value="employees">Employees</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="profit_before_tax">P/L Before Tax</SelectItem>
                    <SelectItem value="total_assets">Total Assets</SelectItem>
                    <SelectItem value="net_assets">Equity</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                  className="gap-1"
                >
                  {sortDir === "asc" ? "↑ A→Z" : "↓ Z→A"}
                </Button>

                {/* Clear filters */}
                {(searchQuery || industryFilter !== "all" || geographyFilter !== "all" || statusFilter !== "all" || revenueMin || revenueMax || employeesMin || employeesMax) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery(""); setIndustryFilter("all"); setGeographyFilter("all");
                      setStatusFilter("all"); setMandateFilter("all");
                      setRevenueMin(""); setRevenueMax(""); setEmployeesMin(""); setEmployeesMax("");
                    }}
                    className="text-destructive"
                  >
                    Clear all filters
                  </Button>
                )}
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
                  Showing <strong>{filteredCompanies.length.toLocaleString()}</strong> of {companies.length.toLocaleString()} companies
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
