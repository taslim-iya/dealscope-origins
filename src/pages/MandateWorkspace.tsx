import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Factory, Banknote, Filter, LogOut, Loader2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Download, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  total_assets: number | null;
  net_assets: number | null;
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

export default function MandateWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<"revenue" | "total_assets" | "net_assets" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const isPaidUser = profile?.is_paid ?? false;

  const handleExportCSV = () => {
    if (!isPaidUser) {
      toast({
        title: "Paid feature",
        description: "CSV export is available for paid subscribers only.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Company Name", "Industry", "Location", "Revenue", "Total Assets", "Net Assets", "Status"];
    const rows = filteredAndSortedCompanies.map((company) => [
      company.company_name,
      company.industry || "",
      company.geography || "",
      company.revenue?.toString() || "",
      company.total_assets?.toString() || "",
      company.net_assets?.toString() || "",
      company.status || "new",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${mandate?.name || "companies"}-export.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: "Export complete",
      description: `Exported ${filteredAndSortedCompanies.length} companies to CSV.`,
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;

      // Fetch mandate
      const { data: mandateData, error: mandateError } = await supabase
        .from("mandates")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (mandateError) {
        console.error("Error fetching mandate:", mandateError);
        navigate("/dashboard");
        return;
      }

      if (!mandateData) {
        navigate("/dashboard");
        return;
      }

      setMandate(mandateData as Mandate);

      // Fetch companies for this mandate
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .eq("mandate_id", id)
        .order("created_at", { ascending: false });

      if (!companiesError && companiesData) {
        setCompanies(companiesData as Company[]);
      }

      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [id, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSort = (column: "revenue" | "total_assets" | "net_assets" | "status") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: "revenue" | "total_assets" | "net_assets" | "status") => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filteredAndSortedCompanies = useMemo(() => {
    let result = companies.filter((company) => {
      const matchesSearch = company.company_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || company.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aVal: number | string | null;
        let bVal: number | string | null;

        if (sortColumn === "status") {
          aVal = a.status || "new";
          bVal = b.status || "new";
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === "asc" ? comparison : -comparison;
        } else {
          aVal = a[sortColumn];
          bVal = b[sortColumn];
          // Handle nulls - push them to the end
          if (aVal === null && bVal === null) return 0;
          if (aVal === null) return 1;
          if (bVal === null) return -1;
          const comparison = aVal - bVal;
          return sortDirection === "asc" ? comparison : -comparison;
        }
      });
    }

    return result;
  }, [companies, searchQuery, statusFilter, sortColumn, sortDirection]);

  // Build criteria summary
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !mandate) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-foreground">
            DealScope
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.email || user.email}
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
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">
                  {mandate.name}
                </h1>
                <span className={`status-badge ${mandateStatusLabels[mandate.status].className}`}>
                  {mandateStatusLabels[mandate.status].label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
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
          {companies.length === 0 ? (
            // Empty state
            <div className="card-elevated p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">No companies yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Companies matching your mandate criteria will appear here once sourced. 
                Your mandate is currently in <strong>{mandate.status}</strong> status.
              </p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
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
                  <Button
                    variant={isPaidUser ? "outline" : "secondary"}
                    size="sm"
                    onClick={handleExportCSV}
                    className="gap-2"
                  >
                    {isPaidUser ? (
                      <Download className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Companies Table */}
              <div className="table-container border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Company
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                        Industry
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                        Location
                      </th>
                      <th 
                        className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("revenue")}
                      >
                        <span className="inline-flex items-center justify-end">
                          Revenue {getSortIcon("revenue")}
                        </span>
                      </th>
                      <th 
                        className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("total_assets")}
                      >
                        <span className="inline-flex items-center justify-end">
                          Total Assets {getSortIcon("total_assets")}
                        </span>
                      </th>
                      <th 
                        className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("net_assets")}
                      >
                        <span className="inline-flex items-center justify-end">
                          Net Assets {getSortIcon("net_assets")}
                        </span>
                      </th>
                      <th 
                        className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-24 cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort("status")}
                      >
                        <span className="inline-flex items-center justify-center">
                          Status {getSortIcon("status")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {filteredAndSortedCompanies.map((company, index) => (
                      <tr
                        key={company.id}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                          index % 2 === 0 ? "bg-background" : "bg-muted/10"
                        }`}
                        onClick={() => navigate(`/company/${company.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground hover:text-primary">
                            {company.company_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {company.industry || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {company.geography || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {company.revenue ? formatCurrency(company.revenue) : company.revenue_band || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                          {company.total_assets ? formatCurrency(company.total_assets) : company.asset_band || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                          {company.net_assets ? formatCurrency(company.net_assets) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                              statusBadges[company.status || "new"] || statusBadges.new
                            }`}
                          >
                            {(company.status || "new").charAt(0).toUpperCase() + (company.status || "new").slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredAndSortedCompanies.length === 0 && (
                  <div className="p-12 text-center bg-background">
                    <p className="text-muted-foreground">No companies match your filters.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          DealScope provides buyer-mandated research and origination support only.
        </p>
      </footer>
    </div>
  );
}
