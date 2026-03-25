import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Building2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
  Shield,
  ShieldOff,
  UserCog
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
import { fileToCSV } from "@/lib/fileToCSV";

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
  companies_delivered: number;
  user_id: string;
  created_at: string;
  profile?: Profile;
}

interface Domain {
  id: string;
  domain_name: string;
  free_companies_remaining: number;
}

interface UserWithRole extends Profile {
  isAdmin: boolean;
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
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [loadingRoleChange, setLoadingRoleChange] = useState<string | null>(null);

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

      // Fetch all mandates
      const { data: mandatesData } = await supabase
        .from("mandates")
        .select("id, name, status, companies_delivered, user_id, created_at")
        .order("created_at", { ascending: false });

      if (mandatesData) {
        // Get unique user IDs
        const userIds = [...new Set(mandatesData.map((m) => m.user_id))];

        // Fetch profiles for those users
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, full_name, company_name")
          .in("id", userIds);

        // Create a map of profiles by ID
        const profilesMap = new Map<string, Profile>();
        profilesData?.forEach((p) => profilesMap.set(p.id, p));

        // Merge profiles into mandates
        const mandatesWithProfiles = mandatesData.map((m) => ({
          ...m,
          profile: profilesMap.get(m.user_id),
        }));

        setMandates(mandatesWithProfiles);
      }

      // Fetch all domains
      const { data: domainsData } = await supabase
        .from("domains")
        .select("*")
        .order("domain_name");

      if (domainsData) {
        setDomains(domainsData);
      }

      // Fetch all users with their admin status
      const { data: allProfilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name")
        .order("email");

      if (allProfilesData) {
        // Fetch all admin roles
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        const adminUserIds = new Set(adminRoles?.map((r) => r.user_id) || []);

        setAllUsers(
          allProfilesData.map((p) => ({
            ...p,
            isAdmin: adminUserIds.has(p.id),
          }))
        );
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
        .select("id, name, status, companies_delivered, user_id, created_at")
        .order("created_at", { ascending: false });

      if (updatedMandates) {
        const userIds = [...new Set(updatedMandates.map((m) => m.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, full_name, company_name")
          .in("id", userIds);

        const profilesMap = new Map<string, Profile>();
        profilesData?.forEach((p) => profilesMap.set(p.id, p));

        setMandates(
          updatedMandates.map((m) => ({
            ...m,
            profile: profilesMap.get(m.user_id),
          }))
        );
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

  const handleToggleAdmin = async (targetUserId: string, currentlyAdmin: boolean) => {
    if (targetUserId === user?.id) {
      toast({
        title: "Action not allowed",
        description: "You cannot change your own admin status.",
        variant: "destructive",
      });
      return;
    }

    setLoadingRoleChange(targetUserId);

    try {
      if (currentlyAdmin) {
        // Revoke admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", "admin");

        if (error) throw error;

        setAllUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, isAdmin: false } : u))
        );

        toast({
          title: "Admin role revoked",
          description: "User no longer has admin privileges.",
        });
      } else {
        // Grant admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUserId, role: "admin" });

        if (error) throw error;

        setAllUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, isAdmin: true } : u))
        );

        toast({
          title: "Admin role granted",
          description: "User now has admin privileges.",
        });
      }
    } catch (error) {
      console.error("Role change error:", error);
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingRoleChange(null);
    }
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

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage mandate requests and upload company data
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/corgi-ai">
                <Button variant="outline" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Corgi AI
                </Button>
              </Link>
              <Link to="/admin/companies">
                <Button variant="outline" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Database
                </Button>
              </Link>
            </div>
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
                          {mandate.name} ({mandate.profile?.company_name || "Unknown"})
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

          {/* User Management Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Grant or revoke admin privileges for users
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-container">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        User
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                        Company
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Role
                      </th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {u.full_name || "No name"}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                          {u.company_name || "—"}
                        </td>
                        <td className="px-4 py-4">
                          {u.isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                              <Shield className="h-3 w-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-secondary text-muted-foreground">
                              User
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {u.id === user?.id ? (
                            <span className="text-xs text-muted-foreground">You</span>
                          ) : (
                            <Button
                              variant={u.isAdmin ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                              disabled={loadingRoleChange === u.id}
                            >
                              {loadingRoleChange === u.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : u.isAdmin ? (
                                <>
                                  <ShieldOff className="h-3 w-3 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <Shield className="h-3 w-3 mr-1" />
                                  Make Admin
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {allUsers.length === 0 && (
                  <div className="p-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No users found</p>
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
                      <tr
                        key={mandate.id}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/admin/mandate/${mandate.id}`)}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-foreground hover:text-primary">
                              {mandate.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {mandate.profile?.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                          {mandate.profile?.company_name || "—"}
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
