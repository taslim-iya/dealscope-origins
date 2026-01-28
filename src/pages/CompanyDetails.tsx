import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Factory,
  Globe,
  Hash,
  FileText,
  Banknote,
  TrendingUp,
  Wallet,
  BarChart3,
  LogOut,
  Loader2,
  ExternalLink,
  Check,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OutreachPanel } from "@/components/outreach/OutreachPanel";

interface Company {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue_band: string | null;
  asset_band: string | null;
  status: string | null;
  description_of_activities: string | null;
  companies_house_number: string | null;
  website: string | null;
  address: string | null;
  revenue: number | null;
  profit_before_tax: number | null;
  net_assets: number | null;
  total_assets: number | null;
  mandate_id: string;
  created_at: string;
}

interface Mandate {
  id: string;
  name: string;
}

const statusOptions = [
  { value: "new", label: "New", className: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "reviewed", label: "Reviewed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "shortlisted", label: "Shortlisted", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function CompanyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (companyError || !companyData) {
        console.error("Error fetching company:", companyError);
        navigate("/dashboard");
        return;
      }

      setCompany(companyData as Company);

      // Fetch mandate name
      const { data: mandateData } = await supabase
        .from("mandates")
        .select("id, name")
        .eq("id", companyData.mandate_id)
        .maybeSingle();

      if (mandateData) {
        setMandate(mandateData);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!company) return;
    
    setUpdatingStatus(true);
    const { error } = await supabase
      .from("companies")
      .update({ status: newStatus })
      .eq("id", company.id);

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCompany({ ...company, status: newStatus });
      toast({
        title: "Status updated",
        description: `Company status changed to ${newStatus}`,
      });
    }
    setUpdatingStatus(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !company) {
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
            to={mandate ? `/mandate/${mandate.id}` : "/dashboard"}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {mandate?.name || "mandate"}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {company.company_name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {company.industry || "Industry not specified"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={company.status || "new"}
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className={`w-[140px] ${statusOptions.find(s => s.value === (company.status || "new"))?.className || ""}`}>
                  {updatingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent className="bg-background border border-border">
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {company.status === option.value && (
                          <Check className="h-3 w-3" />
                        )}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="container-wide">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList>
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="outreach" className="gap-2">
                <Mail className="h-4 w-4" />
                Outreach
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Company Info Card */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Description */}
                    {company.description_of_activities && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Description of Activities
                        </h4>
                        <p className="text-foreground">
                          {company.description_of_activities}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Companies House Number */}
                      <div className="flex items-start gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Companies House Number
                          </p>
                          <p className="font-medium text-foreground">
                            {company.companies_house_number || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Website */}
                      <div className="flex items-start gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Website</p>
                          {company.website ? (
                            <a
                              href={
                                company.website.startsWith("http")
                                  ? company.website
                                  : `https://${company.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {company.website}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p className="font-medium text-foreground">—</p>
                          )}
                        </div>
                      </div>

                      {/* Industry */}
                      <div className="flex items-start gap-3">
                        <Factory className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Industry</p>
                          <p className="font-medium text-foreground">
                            {company.industry || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Location / Geography */}
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="font-medium text-foreground">
                            {company.geography || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    {company.address && (
                      <div className="flex items-start gap-3 pt-2 border-t border-border">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Registered Address
                          </p>
                          <p className="font-medium text-foreground">
                            {company.address}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Financials Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Financials
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Banknote className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(company.revenue)}
                        </p>
                        {company.revenue_band && (
                          <p className="text-xs text-muted-foreground">
                            Band: {company.revenue_band}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Profit Before Tax
                        </p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(company.profit_before_tax)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Wallet className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Net Assets</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(company.net_assets)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Assets</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(company.total_assets)}
                        </p>
                        {company.asset_band && (
                          <p className="text-xs text-muted-foreground">
                            Band: {company.asset_band}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="outreach">
              <OutreachPanel
                companyId={company.id}
                mandateId={company.mandate_id}
                companyName={company.company_name}
              />
            </TabsContent>
          </Tabs>
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
