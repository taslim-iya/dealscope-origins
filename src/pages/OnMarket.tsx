import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Filter,
  Globe,
  Layers,
  XCircle,
  Play,
  Loader2,
  Building2,
  MapPin,
  Banknote,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OnMarketDeal {
  id: string;
  source: string;
  source_url: string;
  company_name: string;
  asking_price: string | null;
  location: string | null;
  industry: string | null;
  revenue: string | null;
  profit: string | null;
  net_assets: string | null;
  description: string | null;
  ai_summary: string | null;
  scraped_at: string;
}

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "BusinessesForSale.com", label: "BusinessesForSale.com" },
  { value: "Daltons Business", label: "Daltons Business" },
  { value: "RightBiz", label: "RightBiz" },
  { value: "BizBuySell UK", label: "BizBuySell UK" },
];

const whatItIs = [
  "Aggregated, normalised view of on-market opportunities",
  "Built for institutional buyers seeking deal flow",
  "AI-powered extraction of company details & financials",
  "Search, filter, and monitor across sources",
];

const whatItIsNot = [
  "Not a brokerage",
  "Not a marketplace",
  "No seller mandates",
  "No introductions or negotiations",
];

export default function OnMarket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [deals, setDeals] = useState<OnMarketDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");

  // Fetch deals on mount - no auth required
  useEffect(() => {
    const fetchDeals = async () => {
      const { data, error } = await supabase
        .from("on_market_deals")
        .select("*")
        .order("scraped_at", { ascending: false });

      if (!error && data) {
        setDeals(data as OnMarketDeal[]);
      }
      setLoading(false);
    };

    fetchDeals();
  }, []);

  const handleScrape = async (source?: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to run a scrape.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setScraping(true);
    toast({
      title: "Scraping started",
      description: "This may take a minute. We're fetching listings and analyzing with AI...",
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-deals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ source: source || null }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Scrape failed");
      }

      // Refresh deals
      const { data: newDeals } = await supabase
        .from("on_market_deals")
        .select("*")
        .order("scraped_at", { ascending: false });

      if (newDeals) {
        setDeals(newDeals as OnMarketDeal[]);
      }

      const totalFound = result.results?.reduce(
        (sum: number, r: any) => sum + (r.deals_found || 0),
        0
      );

      toast({
        title: "Scrape complete",
        description: `Found ${totalFound || 0} deals across ${result.results?.length || 0} sources.`,
      });
    } catch (error) {
      console.error("Scrape error:", error);
      toast({
        title: "Scrape failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  // Get unique industries for filter
  const industries = Array.from(
    new Set(deals.map((d) => d.industry).filter(Boolean))
  ) as string[];

  // Filter deals
  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      deal.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === "all" || deal.source === sourceFilter;
    const matchesIndustry = industryFilter === "all" || deal.industry === industryFilter;
    return matchesSearch && matchesSource && matchesIndustry;
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-wide">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  On-Market Deal Intelligence
                </h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                  Beta
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {deals.length} listings from UK business-for-sale sources
              </p>
            </div>
            {user ? (
              <Button onClick={() => handleScrape()} disabled={scraping} className="gap-2">
                {scraping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Scan All Sources
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={() => navigate("/login")} variant="outline" className="gap-2">
                Log in to scan sources
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-4 border-b border-border">
        <div className="container-wide">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search companies, industries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by industry" />
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
          </div>
        </div>
      </section>

      {/* Deals List */}
      <section className="section-padding">
        <div className="container-wide">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {deals.length === 0 ? "No deals scraped yet" : "No matching deals"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {deals.length === 0
                  ? "Click 'Scan All Sources' to fetch business listings from UK marketplaces."
                  : "Try adjusting your search or filters."}
              </p>
              {deals.length === 0 && (
                user ? (
                  <Button onClick={() => handleScrape()} disabled={scraping}>
                    {scraping ? "Scraping..." : "Start First Scan"}
                  </Button>
                ) : (
                  <Button onClick={() => navigate("/login")} variant="outline">
                    Log in to scan sources
                  </Button>
                )
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="card-elevated p-5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {deal.company_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {deal.industry && (
                              <span className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                {deal.industry}
                              </span>
                            )}
                            {deal.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {deal.location}
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded bg-secondary">
                              {deal.source}
                            </span>
                          </div>
                        </div>
                      </div>

                      {deal.description && (
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-2 ml-8">
                          {deal.description}
                        </p>
                      )}

                      {deal.ai_summary && (
                        <div className="mt-3 ml-8 p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
                            <Sparkles className="h-3 w-3" />
                            AI Analysis
                          </div>
                          <p className="text-sm text-foreground">{deal.ai_summary}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-8 lg:ml-0">
                      {deal.asking_price && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Asking Price</div>
                          <div className="font-semibold text-foreground flex items-center gap-1">
                            <Banknote className="h-4 w-4" />
                            {deal.asking_price}
                          </div>
                        </div>
                      )}
                      {deal.revenue && (
                        <div className="text-right text-sm">
                          <span className="text-muted-foreground">Revenue: </span>
                          <span className="text-foreground">{deal.revenue}</span>
                        </div>
                      )}
                      {deal.profit && (
                        <div className="text-right text-sm">
                          <span className="text-muted-foreground">Profit: </span>
                          <span className="text-foreground">{deal.profit}</span>
                        </div>
                      )}
                      <a
                        href={deal.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        View listing
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 border-t border-border">
        <div className="container-narrow">
          <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-2xl mx-auto">
            DealScope aggregates publicly available business listings for research purposes only.
            We do not verify listing accuracy, act as a broker, or participate in transactions.
          </p>
        </div>
      </section>
    </Layout>
  );
}
