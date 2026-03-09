import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  User,
  Briefcase,
  Upload,
  CheckCircle,
  Loader2,
  ArrowRight,
  Shield,
  FileText,
  X,
  UserCheck,
  HandshakeIcon,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface DealForm {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_role: string;
  industry: string;
  location: string;
  business_summary: string;
  revenue: string;
  ebitda: string;
  asking_price: string;
  reason_for_sale: string;
}

const emptyForm: DealForm = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  contact_role: "",
  industry: "",
  location: "",
  business_summary: "",
  revenue: "",
  ebitda: "",
  asking_price: "",
  reason_for_sale: "",
};

const roles = [
  { value: "owner", label: "Business Owner" },
  { value: "broker", label: "Broker" },
  { value: "adviser", label: "Adviser" },
  { value: "other", label: "Other" },
];

const trustPoints = [
  { icon: Shield, text: "All submissions are treated as strictly confidential" },
  { icon: UserCheck, text: "Reviewed by our deal team within 48 hours" },
  { icon: HandshakeIcon, text: "No obligation — submit and we'll be in touch" },
];

export default function SubmitDeal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<DealForm>(emptyForm);
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DealForm | "consent", string>>>({});

  const updateField = (field: keyof DealForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const maxSize = 20 * 1024 * 1024; // 20MB
    const valid = newFiles.filter((f) => {
      if (f.size > maxSize) {
        toast({ title: `${f.name} is too large`, description: "Max 20MB per file", variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.company_name.trim()) newErrors.company_name = "Required";
    if (!form.contact_name.trim()) newErrors.contact_name = "Required";
    if (!form.contact_email.trim()) newErrors.contact_email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) newErrors.contact_email = "Invalid email";
    if (!form.contact_role) newErrors.contact_role = "Please select your role";
    if (!consent) newErrors.consent = "You must agree to continue";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Upload files first
      const fileUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `submissions/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("deal-attachments")
          .upload(path, file);
        if (!uploadError) {
          fileUrls.push(path);
        } else {
          console.error("Upload error:", uploadError);
        }
      }

      // Check for duplicate (same company name + email in last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      if (user) {
        const { data: existing } = await supabase
          .from("deal_submissions")
          .select("id")
          .eq("contact_email", form.contact_email.trim().toLowerCase())
          .ilike("company_name", form.company_name.trim())
          .gte("submitted_at", oneDayAgo)
          .limit(1);

        if (existing && existing.length > 0) {
          toast({
            title: "Duplicate submission",
            description: "A submission for this company was already received recently.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from("deal_submissions").insert({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: form.contact_phone || null,
        contact_role: form.contact_role,
        industry: form.industry || null,
        location: form.location || null,
        business_summary: form.business_summary || null,
        revenue: form.revenue || null,
        ebitda: form.ebitda || null,
        asking_price: form.asking_price || null,
        reason_for_sale: form.reason_for_sale || null,
        file_urls: fileUrls,
        consent_given: true,
        submitted_by: user?.id || null,
        status: "new",
      } as any);

      if (error) throw error;

      // Trigger admin notification
      try {
        await supabase.functions.invoke("notify-deal-submission", {
          body: {
            company_name: form.company_name,
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            contact_role: form.contact_role,
          },
        });
      } catch (notifyErr) {
        console.warn("Notification failed (non-critical):", notifyErr);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <section className="section-padding">
          <div className="container-narrow max-w-lg mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
              Submission Received
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Thank you for submitting <strong>{form.company_name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Our team will review your submission and be in touch within 48 hours.
              All information is treated as strictly confidential.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setForm(emptyForm);
                  setFiles([]);
                  setConsent(false);
                }}
              >
                Submit Another
              </Button>
              <Button asChild>
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full mb-4">
              For Owners, Brokers & Advisers
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              List a Company or Deal
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Submit a business opportunity for review. Our team connects serious sellers 
              with qualified institutional buyers across the UK.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Points */}
      <section className="border-b border-border bg-secondary/30">
        <div className="container-wide py-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            {trustPoints.map((point) => (
              <div key={point.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <point.icon className="h-4 w-4 text-accent shrink-0" />
                {point.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="section-padding">
        <div className="container-narrow max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Contact Details */}
            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-accent" />
                Your Details
              </h3>
              <p className="text-sm text-muted-foreground -mt-2">
                Tell us who you are so we can follow up.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_name">Full Name *</Label>
                  <Input
                    id="contact_name"
                    value={form.contact_name}
                    onChange={(e) => updateField("contact_name", e.target.value)}
                    placeholder="John Smith"
                    className={errors.contact_name ? "border-destructive" : ""}
                  />
                  {errors.contact_name && <p className="text-xs text-destructive mt-1">{errors.contact_name}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_role">Your Role *</Label>
                  <Select value={form.contact_role} onValueChange={(v) => updateField("contact_role", v)}>
                    <SelectTrigger className={errors.contact_role ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.contact_role && <p className="text-xs text-destructive mt-1">{errors.contact_role}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_email">Email *</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    placeholder="john@company.com"
                    className={errors.contact_email ? "border-destructive" : ""}
                  />
                  {errors.contact_email && <p className="text-xs text-destructive mt-1">{errors.contact_email}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_phone">Phone / WhatsApp</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    placeholder="+44 7700 900000"
                  />
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-accent" />
                Company Information
              </h3>
              <p className="text-sm text-muted-foreground -mt-2">
                Share what you can — more detail helps us match faster.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="company_name">Company or Deal Name *</Label>
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={(e) => updateField("company_name", e.target.value)}
                    placeholder="e.g. Smith Engineering Ltd"
                    className={errors.company_name ? "border-destructive" : ""}
                  />
                  {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name}</p>}
                </div>

                <div>
                  <Label htmlFor="industry">Industry / Sector</Label>
                  <Input
                    id="industry"
                    value={form.industry}
                    onChange={(e) => updateField("industry", e.target.value)}
                    placeholder="e.g. Manufacturing, Services"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location / Region</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="e.g. Manchester, North West"
                  />
                </div>

                <div>
                  <Label htmlFor="revenue">Revenue / Turnover</Label>
                  <Input
                    id="revenue"
                    value={form.revenue}
                    onChange={(e) => updateField("revenue", e.target.value)}
                    placeholder="e.g. £2.5m"
                  />
                </div>

                <div>
                  <Label htmlFor="ebitda">EBITDA / Profit</Label>
                  <Input
                    id="ebitda"
                    value={form.ebitda}
                    onChange={(e) => updateField("ebitda", e.target.value)}
                    placeholder="e.g. £400k"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="asking_price">Asking Price / Valuation Expectation</Label>
                  <Input
                    id="asking_price"
                    value={form.asking_price}
                    onChange={(e) => updateField("asking_price", e.target.value)}
                    placeholder="e.g. £1.5m or 'Open to offers'"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="business_summary">Business Summary</Label>
                  <Textarea
                    id="business_summary"
                    value={form.business_summary}
                    onChange={(e) => updateField("business_summary", e.target.value)}
                    placeholder="Briefly describe the business, its strengths, and key selling points..."
                    rows={3}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="reason_for_sale">Reason for Sale</Label>
                  <Input
                    id="reason_for_sale"
                    value={form.reason_for_sale}
                    onChange={(e) => updateField("reason_for_sale", e.target.value)}
                    placeholder="e.g. Retirement, new venture, strategic exit"
                  />
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-accent" />
                Attachments
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </h3>
              <p className="text-sm text-muted-foreground -mt-2">
                Upload a teaser, CIM, accounts, or any supporting documents. Max 5 files, 20MB each.
              </p>

              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/40 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, XLS, PPT — up to 20MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
                  className="hidden"
                  onChange={handleFileAdd}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-secondary/50 rounded-lg">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consent & Submit */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(c) => {
                    setConsent(c === true);
                    if (errors.consent) setErrors((prev) => ({ ...prev, consent: undefined }));
                  }}
                  className={errors.consent ? "border-destructive" : ""}
                />
                <Label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I confirm that I have the authority to share this information and consent to DealScope
                  contacting me regarding this submission. All information will be treated as confidential.
                </Label>
              </div>
              {errors.consent && <p className="text-xs text-destructive ml-7">{errors.consent}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full gap-2"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Deal"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Your submission is confidential and will only be shared with our internal review team.
              </p>
            </div>
          </form>
        </div>
      </section>
    </Layout>
  );
}
