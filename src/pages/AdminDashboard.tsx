import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Users, 
  Building2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Mandate {
  id: string;
  name: string;
  status: string;
  companies_delivered: number;
  user_id: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
    company_name: string | null;
  };
}

interface Domain {
  id: string;
  domain_name: string;
  free_companies_remaining: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedMandate, setSelectedMandate] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const checkAdminStatus = async () => {
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
        toast({
          title: "Access denied",
          description: "You don't have admin permissions.",
          variant: "destructive",
        });
        navigate("/dashboard");
      }
    };

    if (user) {
      checkAdminStatus();
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin) return;

      // Fetch all mandates with user info
      const { data: mandatesData } = await supabase
        .from("mandates")
        .select(`
          id,
          name,
          status,
          companies_delivered,
          user_id,
          created_at,
          profiles:user_id (
            email,
            full_name,
            company_name
          )
        `)
        .order("created_at", { ascending: false });

      if (mandatesData) {
        setMandates(mandatesData as unknown as Mandate[]);
      }

      // Fetch all domains
      const { data: domainsData } = await supabase
        .from("domains")
        .select("*")
        .order("domain_name");

      if (domainsData) {
        setDomains(domainsData);
      }
    };

    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedMandate) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();

      const { data, error } = await supabase.functions.invoke("process-company-upload", {
        body: {
          mandate_id: selectedMandate,
          csv_content: text,
        },
      });

      if (error) {
        throw error;
      }

      setUploadResult({
        success: true,
        message: `Successfully added ${data.companies_added} companies to "${data.mandate_name}"`,
      });

      toast({
        title: "Upload successful",
        description: `Added ${data.companies_added} companies`,
      });

      // Refresh mandates
      const { data: updatedMandates } = await supabase
        .from("mandates")
        .select(`
          id,
          name,
          status,
          companies_delivered,
          user_id,
          created_at,
          profiles:user_id (
            email,
            full_name,
            company_name
          )
        `)
        .order("created_at", { ascending: false });

      if (updatedMandates) {
        setMandates(updatedMandates as unknown as Mandate[]);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      });
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to user dashboard
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage mandate requests and upload company data
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Mandates
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
                  Active Domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">{domains.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Companies Delivered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-semibold">
                    {mandates.reduce((sum, m) => sum + m.companies_delivered, 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Company List</CardTitle>
              <CardDescription>
                Upload a CSV file with company data for a specific mandate. 
                Required column: company_name. Optional: geography, industry, revenue_band, asset_band, status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Mandate</Label>
                  <Select value={selectedMandate} onValueChange={setSelectedMandate}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Choose a mandate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {mandates.map((mandate) => (
                        <SelectItem key={mandate.id} value={mandate.id}>
                          {mandate.name} ({mandate.profiles?.company_name || "Unknown"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={!selectedMandate || uploading}
                      className="max-w-md"
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>

                {uploadResult && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg ${
                      uploadResult.success
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {uploadResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm">{uploadResult.message}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mandates Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Mandates</CardTitle>
              <CardDescription>
                View and manage all mandate requests across organisations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-container">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Mandate
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                        Organisation
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Status
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Companies
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mandates.map((mandate) => (
                      <tr key={mandate.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-foreground">{mandate.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {mandate.profiles?.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                          {mandate.profiles?.company_name || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`status-badge ${
                              mandate.status === "active"
                                ? "status-active"
                                : mandate.status === "completed"
                                ? "status-completed"
                                : "status-draft"
                            }`}
                          >
                            {mandate.status.charAt(0).toUpperCase() + mandate.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {mandate.companies_delivered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {mandates.length === 0 && (
                  <div className="p-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No mandates yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          DealScope Admin — Buyer-mandated research and origination support
        </p>
      </footer>
    </div>
  );
}
