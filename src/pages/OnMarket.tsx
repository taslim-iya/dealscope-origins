import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Filter,
  Globe,
  Layers,
  XCircle,
  Sparkles,
  Search,
  ExternalLink,
  Loader2,
  Database,
  RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
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
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

interface OnMarketDeal {
  id: string;
  company_name: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  asking_price: string | null;
  revenue: string | null;
  profit: string | null;
  net_assets: string | null;
  source: string;
  source_url: string;
  ai_summary: string | null;
  scraped_at: string;
}

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
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [deals, setDeals] = useState<OnMarketDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [scraping, setScraping] = useState(false);

  // If not logged in, show the public "Coming Soon" view
  const isAuthenticated = !authLoading && user;

  useEffect(() => {
    if (isAuthenticated) {
      fetchDeals();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchDeals = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("on_market_deals")
      .select("*")
      .eq("user_id", user.id)
      .order("scraped_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
    } else {
      setDeals(data || []);
    }
    setLoading(false);
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-deals", {
        body: { sources: ["bizbuysell", "daltons"] },
      });

      if (error) throw error;

      toast({
        title: "Scraping complete",
        description: `Found ${data?.deals_found || 0} new deals.`,
      });
      
      await fetchDeals();
    } catch (error) {
      console.error("Scrape error:", error);
      toast({
        title: "Scraping failed",
        description: "Could not fetch new deals. Try again later.",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Get unique industries for filter
  const industries = [...new Set(deals.map(d => d.industry).filter(Boolean))];

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = 
      deal.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesIndustry = industryFilter === "all" || deal.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  // Public view for non-authenticated users
  if (!isAuthenticated) {
    return (
      <Layout>
        {/* Hero */}
        <section className="section-padding border-b border-border">
          <div className="container-narrow">
            <div className="max-w-2xl mx-auto text-center">
              <span className="badge-coming-soon mb-6 inline-block">Coming Soon</span>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                On-Market Deal Intelligence
              </h1>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                AI-powered discovery of companies currently available for sale in the United Kingdom.
              </p>
              <div className="mt-8">
                <Button asChild>
                  <Link to="/signup">Get Early Access</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* What This Is / Is Not */}
        <section className="section-padding">
          <div className="container-wide">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="card-elevated p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-5 w-5 text-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">What This Is</h2>
                </div>
                <ul className="space-y-3">
                  {whatItIs.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2"></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-elevated p-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">What This Is Not</h2>
                </div>
                <ul className="space-y-3">
                  {whatItIsNot.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section-padding bg-secondary/30 border-y border-border">
          <div className="container-wide">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
              <p className="mt-2 text-muted-foreground">
                AI-powered aggregation of UK business-for-sale listings.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-elevated p-6 text-center">
                <Globe className="h-8 w-8 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Scrape</h3>
                <p className="text-sm text-muted-foreground">
                  Fetch listings from BizBuySell, BusinessesForSale, Daltons, and RightBiz.
                </p>
              </div>
              <div className="card-elevated p-6 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Analyze</h3>
                <p className="text-sm text-muted-foreground">
                  AI extracts company details, financials, and generates investment summaries.
                </p>
              </div>
              <div className="card-elevated p-6 text-center">
                <Filter className="h-8 w-8 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Filter</h3>
                <p className="text-sm text-muted-foreground">
                  Search and filter based on your acquisition criteria.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  // Authenticated dashboard view
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader 
        email={profile?.email || user?.email} 
        onSignOut={handleSignOut} 
      />

      {/* Sub-header */}
      <div className="border-b border-border bg-secondary/30">
        <div className="container-wide py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                On-Market Deal Intelligence
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Discover companies currently available for sale across the UK
              </p>
            </div>
            <Button onClick={handleScrape} disabled={scraping} className="gap-2">
              {scraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {scraping ? "Scraping..." : "Scrape New Deals"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="container-wide">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deals.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">No deals scraped yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Click "Scrape New Deals" to fetch the latest on-market opportunities from UK business-for-sale listings.
              </p>
              <Button onClick={handleScrape} disabled={scraping} className="gap-2">
                {scraping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {scraping ? "Scraping..." : "Scrape New Deals"}
              </Button>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All industries</SelectItem>
                    {industries.map((ind) => (
                      <SelectItem key={ind} value={ind!}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card-elevated p-4">
                  <p className="text-2xl font-semibold text-foreground">{deals.length}</p>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                </div>
                <div className="card-elevated p-4">
                  <p className="text-2xl font-semibold text-foreground">{industries.length}</p>
                  <p className="text-sm text-muted-foreground">Industries</p>
                </div>
                <div className="card-elevated p-4">
                  <p className="text-2xl font-semibold text-foreground">
                    {[...new Set(deals.map(d => d.source))].length}
                  </p>
                  <p className="text-sm text-muted-foreground">Sources</p>
                </div>
                <div className="card-elevated p-4">
                  <p className="text-2xl font-semibold text-foreground">{filteredDeals.length}</p>
                  <p className="text-sm text-muted-foreground">Matching Filters</p>
                </div>
              </div>

              {/* Deals Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDeals.map((deal) => (
                  <div key={deal.id} className="card-elevated p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {deal.company_name}
                      </h3>
                      <a
                        href={deal.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    
                    {deal.industry && (
                      <span className="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded mb-3 w-fit">
                        {deal.industry}
                      </span>
                    )}
                    
                    {deal.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {deal.description}
                      </p>
                    )}
                    
                    <div className="mt-auto space-y-2 text-sm">
                      {deal.location && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span className="text-foreground">{deal.location}</span>
                        </div>
                      )}
                      {deal.asking_price && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Asking Price</span>
                          <span className="text-foreground font-medium">{deal.asking_price}</span>
                        </div>
                      )}
                      {deal.revenue && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="text-foreground">{deal.revenue}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>{deal.source}</span>
                      <span>{new Date(deal.scraped_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
