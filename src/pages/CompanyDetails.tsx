import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
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
  Pencil,
  Save,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const location = useLocation();
  const cameFromAdmin = document.referrer.includes('/admin') || location.state?.from === 'admin';
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth guard removed — allow unauthenticated access

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
    };
    if (user) checkAdmin();
  }, [user]);

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
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    } else {
      setCompany({ ...company, status: newStatus });
      toast({ title: "Status updated", description: `Company status changed to ${newStatus}` });
    }
    setUpdatingStatus(false);
  };

  const startEditing = () => {
    if (!company) return;
    setEditForm({
      company_name: company.company_name,
      industry: company.industry,
      geography: company.geography,
      website: company.website,
      address: company.address,
      description_of_activities: company.description_of_activities,
      companies_house_number: company.companies_house_number,
      revenue: company.revenue,
      profit_before_tax: company.profit_before_tax,
      net_assets: company.net_assets,
      total_assets: company.total_assets,
      revenue_band: company.revenue_band,
      asset_band: company.asset_band,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        company_name: editForm.company_name,
        industry: editForm.industry || null,
        geography: editForm.geography || null,
        website: editForm.website || null,
        address: editForm.address || null,
        description_of_activities: editForm.description_of_activities || null,
        companies_house_number: editForm.companies_house_number || null,
        revenue: editForm.revenue ?? null,
        profit_before_tax: editForm.profit_before_tax ?? null,
        net_assets: editForm.net_assets ?? null,
        total_assets: editForm.total_assets ?? null,
        revenue_band: editForm.revenue_band || null,
        asset_band: editForm.asset_band || null,
      })
      .eq("id", company.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      setCompany({ ...company, ...editForm } as Company);
      setIsEditing(false);
      toast({ title: "Company updated", description: "Changes saved successfully." });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!company) return;
    const { error } = await supabase.from("companies").delete().eq("id", company.id);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Company deleted", description: `${company.company_name} has been removed.` });
      navigate(-1);
    }
  };

  const updateField = (field: keyof Company, value: string | number | null) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
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
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

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
            <div className="flex items-center gap-2">
              {isAdmin && !isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {company.company_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this company and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleDelete}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                </>
              )}
              {!isEditing && (
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
              )}
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
                    {isEditing ? (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Description of Activities</label>
                        <Textarea
                          value={editForm.description_of_activities || ""}
                          onChange={(e) => updateField("description_of_activities", e.target.value)}
                          rows={3}
                        />
                      </div>
                    ) : company.description_of_activities ? (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Description of Activities</h4>
                        <p className="text-foreground">{company.description_of_activities}</p>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {isEditing ? (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Company Name</label>
                            <Input value={editForm.company_name || ""} onChange={(e) => updateField("company_name", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Companies House Number</label>
                            <Input value={editForm.companies_house_number || ""} onChange={(e) => updateField("companies_house_number", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Website</label>
                            <Input value={editForm.website || ""} onChange={(e) => updateField("website", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Industry</label>
                            <Input value={editForm.industry || ""} onChange={(e) => updateField("industry", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Location / Geography</label>
                            <Input value={editForm.geography || ""} onChange={(e) => updateField("geography", e.target.value)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Registered Address</label>
                            <Input value={editForm.address || ""} onChange={(e) => updateField("address", e.target.value)} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <Hash className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Companies House Number</p>
                              <p className="font-medium text-foreground">{company.companies_house_number || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Website</p>
                              {company.website ? (
                                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                                  {company.website}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <p className="font-medium text-foreground">—</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Factory className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Industry</p>
                              <p className="font-medium text-foreground">{company.industry || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Location</p>
                              <p className="font-medium text-foreground">{company.geography || "—"}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {!isEditing && company.address && (
                      <div className="flex items-start gap-3 pt-2 border-t border-border">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Registered Address</p>
                          <p className="font-medium text-foreground">{company.address}</p>
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
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Revenue (£)</label>
                          <Input type="number" value={editForm.revenue ?? ""} onChange={(e) => updateField("revenue", e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Revenue Band</label>
                          <Input value={editForm.revenue_band || ""} onChange={(e) => updateField("revenue_band", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Profit Before Tax (£)</label>
                          <Input type="number" value={editForm.profit_before_tax ?? ""} onChange={(e) => updateField("profit_before_tax", e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Net Assets (£)</label>
                          <Input type="number" value={editForm.net_assets ?? ""} onChange={(e) => updateField("net_assets", e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Total Assets (£)</label>
                          <Input type="number" value={editForm.total_assets ?? ""} onChange={(e) => updateField("total_assets", e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1 block">Asset Band</label>
                          <Input value={editForm.asset_band || ""} onChange={(e) => updateField("asset_band", e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <Banknote className="h-4 w-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Revenue</p>
                            <p className="font-semibold text-foreground">{formatCurrency(company.revenue)}</p>
                            {company.revenue_band && <p className="text-xs text-muted-foreground">Band: {company.revenue_band}</p>}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Profit Before Tax</p>
                            <p className="font-semibold text-foreground">{formatCurrency(company.profit_before_tax)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Wallet className="h-4 w-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Net Assets</p>
                            <p className="font-semibold text-foreground">{formatCurrency(company.net_assets)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <BarChart3 className="h-4 w-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm text-muted-foreground">Total Assets</p>
                            <p className="font-semibold text-foreground">{formatCurrency(company.total_assets)}</p>
                            {company.asset_band && <p className="text-xs text-muted-foreground">Band: {company.asset_band}</p>}
                          </div>
                        </div>
                      </>
                    )}
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