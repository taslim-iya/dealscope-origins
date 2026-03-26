import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Download,
  Eye,
  Search,
  FileText,
  User,
  Briefcase,
  MessageSquare,
  ArrowLeft,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

const statusOptions = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-800" },
  { value: "reviewing", label: "Reviewing", color: "bg-yellow-100 text-yellow-800" },
  { value: "contacted", label: "Contacted", color: "bg-purple-100 text-purple-800" },
  { value: "approved", label: "Approved", color: "bg-emerald-100 text-emerald-800" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
  { value: "archived", label: "Archived", color: "bg-gray-100 text-gray-800" },
];

interface Submission {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  contact_role: string;
  industry: string | null;
  location: string | null;
  business_summary: string | null;
  revenue: string | null;
  ebitda: string | null;
  asking_price: string | null;
  reason_for_sale: string | null;
  file_urls: string[];
  consent_given: boolean;
  status: string;
  internal_notes: string | null;
  submitted_at: string;
  updated_at: string;
}

export default function AdminSubmissions() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  useEffect(() => {
    setIsAdmin(true);
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("deal_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (!error) setSubmissions((data as any[]) || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("deal_submissions")
      .update({ status: newStatus, reviewed_by: user?.id } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev) => prev ? { ...prev, status: newStatus } : null);
      }
      toast({ title: `Status updated to ${newStatus}` });
    }
  };

  const saveNotes = async () => {
    if (!selectedSubmission) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("deal_submissions")
      .update({ internal_notes: notesText } as any)
      .eq("id", selectedSubmission.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === selectedSubmission.id ? { ...s, internal_notes: notesText } : s))
      );
      setSelectedSubmission((prev) => prev ? { ...prev, internal_notes: notesText } : null);
      toast({ title: "Notes saved" });
    }
    setSavingNotes(false);
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("deal-attachments")
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", variant: "destructive" });
    } else {
      window.open(data.signedUrl, "_blank");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  // Get filter options from data
  const industries = [...new Set(submissions.map((s) => s.industry).filter(Boolean))];
  const locations = [...new Set(submissions.map((s) => s.location).filter(Boolean))];

  // Apply filters
  const filtered = submissions.filter((s) => {
    const matchSearch =
      s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchIndustry = industryFilter === "all" || s.industry === industryFilter;
    const matchLocation = locationFilter === "all" || s.location === locationFilter;
    return matchSearch && matchStatus && matchIndustry && matchLocation;
  });

  const statusCounts = statusOptions.reduce((acc, opt) => {
    acc[opt.value] = submissions.filter((s) => s.status === opt.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader
        email={profile?.email || user?.email}
        onSignOut={async () => { await signOut(); navigate("/"); }}
      />

      <div className="border-b border-border bg-secondary/30">
        <div className="container-wide py-6">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Button>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Deal Submissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage deal submissions from owners, brokers, and advisers
          </p>
        </div>
      </div>

      <main className="flex-1 py-6">
        <div className="container-wide">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === "all"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              All ({submissions.length})
            </button>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === opt.value
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {opt.label} ({statusCounts[opt.value] || 0})
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map((i) => (
                    <SelectItem key={i} value={i!}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {locations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l} value={l!}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Submissions table */}
          {filtered.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              {submissions.length === 0 ? "No submissions yet" : "No submissions match your filters"}
            </div>
          ) : (
            <div className="card-elevated overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Industry</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((s) => {
                      const statusOpt = statusOptions.find((o) => o.value === s.status);
                      return (
                        <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                            {s.company_name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="truncate max-w-[140px]">{s.contact_name}</div>
                            <div className="text-xs truncate max-w-[140px]">{s.contact_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs capitalize">{s.contact_role}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.industry || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.location || "—"}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground text-xs">{s.revenue || "—"}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground text-xs">{s.asking_price || "—"}</td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusOpt?.color || "bg-secondary text-muted-foreground"}`}>
                                  {statusOpt?.label || s.status}
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {statusOptions.map((opt) => (
                                  <DropdownMenuItem
                                    key={opt.value}
                                    onClick={() => updateStatus(s.id, opt.value)}
                                    className="text-xs"
                                  >
                                    {opt.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(s.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSubmission(s);
                                setNotesText(s.internal_notes || "");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedSubmission.company_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <Label className="text-muted-foreground w-20">Status</Label>
                  <Select
                    value={selectedSubmission.status}
                    onValueChange={(v) => updateStatus(selectedSubmission.id, v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact */}
                <div className="card-elevated p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-accent" />
                    Contact
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {selectedSubmission.contact_name}</div>
                    <div><span className="text-muted-foreground">Role:</span> <span className="capitalize">{selectedSubmission.contact_role}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <a href={`mailto:${selectedSubmission.contact_email}`} className="text-accent underline">{selectedSubmission.contact_email}</a></div>
                    <div><span className="text-muted-foreground">Phone:</span> {selectedSubmission.contact_phone || "—"}</div>
                  </div>
                </div>

                {/* Company */}
                <div className="card-elevated p-4 space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-accent" />
                    Company Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Industry:</span> {selectedSubmission.industry || "—"}</div>
                    <div><span className="text-muted-foreground">Location:</span> {selectedSubmission.location || "—"}</div>
                    <div><span className="text-muted-foreground">Revenue:</span> {selectedSubmission.revenue || "—"}</div>
                    <div><span className="text-muted-foreground">EBITDA:</span> {selectedSubmission.ebitda || "—"}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Asking Price:</span> {selectedSubmission.asking_price || "—"}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Reason:</span> {selectedSubmission.reason_for_sale || "—"}</div>
                  </div>
                  {selectedSubmission.business_summary && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">{selectedSubmission.business_summary}</p>
                    </div>
                  )}
                </div>

                {/* Files */}
                {selectedSubmission.file_urls && selectedSubmission.file_urls.length > 0 && (
                  <div className="card-elevated p-4 space-y-2">
                    <h4 className="font-medium text-foreground flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-accent" />
                      Attachments ({selectedSubmission.file_urls.length})
                    </h4>
                    <div className="space-y-1">
                      {selectedSubmission.file_urls.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => downloadFile(url)}
                          className="flex items-center gap-2 text-sm text-accent hover:underline w-full text-left p-1.5 rounded hover:bg-secondary/50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          {url.split("/").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internal Notes */}
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Internal Notes
                  </h4>
                  <Textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Add private notes about this submission..."
                    rows={3}
                  />
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="gap-1">
                    {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Notes
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()} · 
                  Updated: {new Date(selectedSubmission.updated_at).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
