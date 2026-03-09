import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Upload,
  User,
  Briefcase,
  Loader2,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ListingType = "owner" | "broker";

interface ListingForm {
  company_name: string;
  asking_price: string;
  location: string;
  industry: string;
  revenue: string;
  profit: string;
  net_assets: string;
  description: string;
  source_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

const emptyForm: ListingForm = {
  company_name: "",
  asking_price: "",
  location: "",
  industry: "",
  revenue: "",
  profit: "",
  net_assets: "",
  description: "",
  source_url: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
};

export default function ListCompany() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [listingType, setListingType] = useState<ListingType>("owner");
  const [form, setForm] = useState<ListingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResults, setCsvResults] = useState<{ success: number; failed: number } | null>(null);

  const updateField = (field: keyof ListingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Please sign in", description: "You need an account to list a company.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!form.company_name.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("on_market_deals").insert({
        company_name: form.company_name.trim(),
        asking_price: form.asking_price || null,
        location: form.location || null,
        industry: form.industry || null,
        revenue: form.revenue || null,
        profit: form.profit || null,
        net_assets: form.net_assets || null,
        description: form.description || null,
        source_url: form.source_url || `listing://${listingType}/${Date.now()}`,
        source: listingType === "owner" ? "Owner Listed" : "Broker Listed",
        user_id: user.id,
        listing_type: listingType,
        approval_status: "pending",
        submitted_by: user.id,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || user.email || null,
        contact_phone: form.contact_phone || null,
      } as any);

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Listing submitted", description: "Your listing is pending admin review." });
    } catch (err: any) {
      console.error("Submit error:", err);
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile || !user) return;

    setCsvUploading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "File must have a header row and at least one data row.", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      
      // Map common header names
      const headerMap: Record<string, string> = {
        "company name": "company_name",
        "business name": "company_name",
        name: "company_name",
        "asking price": "asking_price",
        price: "asking_price",
        location: "location",
        city: "location",
        region: "location",
        industry: "industry",
        sector: "industry",
        revenue: "revenue",
        turnover: "revenue",
        profit: "profit",
        "net assets": "net_assets",
        description: "description",
        url: "source_url",
        website: "source_url",
        "contact name": "contact_name",
        "contact email": "contact_email",
        email: "contact_email",
        phone: "contact_phone",
      };

      const colMap = headers.map((h) => headerMap[h] || h);

      let success = 0;
      let failed = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        colMap.forEach((col, idx) => {
          if (values[idx]) row[col] = values[idx];
        });

        if (!row.company_name) {
          failed++;
          continue;
        }

        const { error } = await supabase.from("on_market_deals").insert({
          company_name: row.company_name,
          asking_price: row.asking_price || null,
          location: row.location || null,
          industry: row.industry || null,
          revenue: row.revenue || null,
          profit: row.profit || null,
          net_assets: row.net_assets || null,
          description: row.description || null,
          source_url: row.source_url || `listing://broker-csv/${Date.now()}-${i}`,
          source: "Broker Listed",
          user_id: user.id,
          listing_type: "broker",
          approval_status: "pending",
          submitted_by: user.id,
          contact_name: row.contact_name || null,
          contact_email: row.contact_email || user.email || null,
          contact_phone: row.contact_phone || null,
        } as any);

        if (error) {
          console.error("Row insert error:", error);
          failed++;
        } else {
          success++;
        }
      }

      setCsvResults({ success, failed });
      toast({
        title: "CSV Upload Complete",
        description: `${success} listings submitted, ${failed} failed. All pending admin review.`,
      });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <section className="section-padding">
          <div className="container-narrow max-w-lg mx-auto text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-accent mb-6" />
            <h1 className="text-2xl font-semibold text-foreground mb-2">Listing Submitted</h1>
            <p className="text-muted-foreground mb-8">
              Your listing is now pending admin review. You'll be notified once it's approved and live on the marketplace.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setSubmitted(false); setForm(emptyForm); }}>
                Submit Another
              </Button>
              <Button onClick={() => navigate("/on-market")}>
                View Marketplace
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              List a Company for Sale
            </h1>
            <p className="mt-3 text-muted-foreground">
              Submit your business or client's business to our marketplace. All listings are reviewed before going live.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow max-w-2xl mx-auto">
          {/* Listing Type Selector */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setListingType("owner")}
              className={`card-elevated p-5 text-left transition-all border-2 ${
                listingType === "owner"
                  ? "border-accent bg-accent/5"
                  : "border-transparent hover:border-border"
              }`}
            >
              <User className="h-6 w-6 mb-2 text-accent" />
              <h3 className="font-semibold text-foreground text-sm">Business Owner</h3>
              <p className="text-xs text-muted-foreground mt-1">
                I own this business and want to list it for sale
              </p>
            </button>
            <button
              onClick={() => setListingType("broker")}
              className={`card-elevated p-5 text-left transition-all border-2 ${
                listingType === "broker"
                  ? "border-accent bg-accent/5"
                  : "border-transparent hover:border-border"
              }`}
            >
              <Briefcase className="h-6 w-6 mb-2 text-accent" />
              <h3 className="font-semibold text-foreground text-sm">Broker / Advisor</h3>
              <p className="text-xs text-muted-foreground mt-1">
                I represent sellers and want to list client businesses
              </p>
            </button>
          </div>

          {listingType === "broker" ? (
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="form" className="flex-1 gap-2">
                  <Building2 className="h-4 w-4" />
                  Single Listing
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex-1 gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Bulk CSV Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form">
                <ListingFormComponent
                  form={form}
                  updateField={updateField}
                  onSubmit={handleSubmitForm}
                  submitting={submitting}
                  listingType={listingType}
                  authLoading={authLoading}
                  user={user}
                />
              </TabsContent>

              <TabsContent value="csv">
                <div className="card-elevated p-6 space-y-6">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Bulk Upload via CSV</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a CSV file with your listings. Required column: <strong>Company Name</strong>.
                      Optional: Asking Price, Location, Industry, Revenue, Profit, Net Assets, Description, URL, Contact Name, Contact Email, Phone.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <Input
                      type="file"
                      accept=".csv"
                      className="max-w-xs mx-auto"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    {csvFile && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {csvFile.name}
                      </p>
                    )}
                  </div>

                  {csvResults && (
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                      <p className="text-sm text-foreground">
                        <strong>{csvResults.success}</strong> listings submitted successfully
                        {csvResults.failed > 0 && (
                          <>, <strong>{csvResults.failed}</strong> failed</>
                        )}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleCsvUpload}
                    disabled={!csvFile || csvUploading || !user}
                    className="w-full gap-2"
                  >
                    {csvUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {csvUploading ? "Uploading..." : "Upload & Submit for Review"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <ListingFormComponent
              form={form}
              updateField={updateField}
              onSubmit={handleSubmitForm}
              submitting={submitting}
              listingType={listingType}
              authLoading={authLoading}
              user={user}
            />
          )}

          {!user && !authLoading && (
            <div className="mt-6 p-4 bg-secondary/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                You need an account to list a company.{" "}
                <a href="/signup" className="text-accent underline">Sign up</a> or{" "}
                <a href="/login" className="text-accent underline">log in</a> to continue.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function ListingFormComponent({
  form,
  updateField,
  onSubmit,
  submitting,
  listingType,
  authLoading,
  user,
}: {
  form: ListingForm;
  updateField: (field: keyof ListingForm, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  listingType: ListingType;
  authLoading: boolean;
  user: any;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Company Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="e.g. Smith Engineering Ltd"
              required
            />
          </div>

          <div>
            <Label htmlFor="asking_price">Asking Price</Label>
            <Input
              id="asking_price"
              value={form.asking_price}
              onChange={(e) => updateField("asking_price", e.target.value)}
              placeholder="e.g. £500,000"
            />
          </div>

          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={form.industry}
              onChange={(e) => updateField("industry", e.target.value)}
              placeholder="e.g. Manufacturing"
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="e.g. Manchester"
            />
          </div>

          <div>
            <Label htmlFor="revenue">Revenue / Turnover</Label>
            <Input
              id="revenue"
              value={form.revenue}
              onChange={(e) => updateField("revenue", e.target.value)}
              placeholder="e.g. £1,200,000"
            />
          </div>

          <div>
            <Label htmlFor="profit">Profit</Label>
            <Input
              id="profit"
              value={form.profit}
              onChange={(e) => updateField("profit", e.target.value)}
              placeholder="e.g. £200,000"
            />
          </div>

          <div>
            <Label htmlFor="net_assets">Net Assets</Label>
            <Input
              id="net_assets"
              value={form.net_assets}
              onChange={(e) => updateField("net_assets", e.target.value)}
              placeholder="e.g. £350,000"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Business Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of the business, its operations, and reason for sale..."
              rows={3}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="source_url">Website / Listing URL</Label>
            <Input
              id="source_url"
              value={form.source_url}
              onChange={(e) => updateField("source_url", e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          Contact Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contact_name">
              {listingType === "broker" ? "Broker Name" : "Your Name"}
            </Label>
            <Input
              id="contact_name"
              value={form.contact_name}
              onChange={(e) => updateField("contact_name", e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={form.contact_email}
              onChange={(e) => updateField("contact_email", e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={form.contact_phone}
              onChange={(e) => updateField("contact_phone", e.target.value)}
              placeholder="+44 ..."
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={submitting || authLoading || !user}
        className="w-full gap-2"
        size="lg"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        {submitting ? "Submitting..." : "Submit for Review"}
      </Button>
    </form>
  );
}
