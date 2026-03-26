import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

interface Mandate {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  companies_delivered: number;
  created_at: string;
}

const statusLabels = {
  draft: { label: "Draft", className: "status-draft" },
  active: { label: "Active", className: "status-active" },
  completed: { label: "Completed", className: "status-completed" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, domain, loading: authLoading, signOut } = useAuth();
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(true);

  // Auth guard removed — allow unauthenticated access

  useEffect(() => {
    const fetchMandates = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("mandates")
        .select("id, name, status, companies_delivered, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMandates(data as Mandate[]);
      }
      setLoadingMandates(false);
    };

    if (user) {
      fetchMandates();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const freeAllowance = {
    remaining: domain?.free_companies_remaining ?? 20,
    total: 20,
  };
  const used = freeAllowance.total - freeAllowance.remaining;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader 
        email={profile?.email || user?.email || ""} 
        onSignOut={handleSignOut} 
      />

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="container-wide">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your acquisition mandates
              </p>
            </div>
            <Button asChild>
              <Link to="/mandate/create">
                <Plus className="h-4 w-4 mr-2" />
                Create mandate
              </Link>
            </Button>
          </div>

          {/* Free Allowance Tracker */}
          <div className="card-elevated p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-medium text-foreground">Domain Free Allowance</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Shared across all users at {domain?.domain_name || "your domain"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-foreground">
                  {freeAllowance.remaining}
                </span>
                <span className="text-muted-foreground"> / {freeAllowance.total} remaining</span>
              </div>
            </div>
            <div className="mt-4">
              <Progress 
                value={(used / freeAllowance.total) * 100} 
                className="h-2"
              />
            </div>
          </div>

          {/* Mandates List */}
          <div className="card-elevated">
            <div className="p-4 border-b border-border">
              <h2 className="font-medium text-foreground">Your Mandates</h2>
            </div>

            {loadingMandates ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : mandates.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-foreground mb-1">No mandates yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first mandate to start sourcing companies.
                </p>
                <Button asChild>
                  <Link to="/mandate/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create mandate
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mandates.map((mandate) => (
                  <Link
                    key={mandate.id}
                    to={`/mandate/${mandate.id}`}
                    className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-md bg-secondary">
                        <FileText className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{mandate.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {mandate.companies_delivered} companies delivered
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`status-badge ${statusLabels[mandate.status].className}`}>
                        {statusLabels[mandate.status].label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
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
