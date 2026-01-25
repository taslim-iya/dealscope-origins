import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// Mock data - will be replaced with real data from backend
const mockMandates = [
  {
    id: "1",
    name: "UK Manufacturing Targets",
    status: "active" as const,
    companiesDelivered: 12,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Software Services SME",
    status: "draft" as const,
    companiesDelivered: 0,
    createdAt: "2024-01-18",
  },
];

const freeAllowance = {
  used: 12,
  total: 20,
};

const statusLabels = {
  draft: { label: "Draft", className: "status-draft" },
  active: { label: "Active", className: "status-active" },
  completed: { label: "Completed", className: "status-completed" },
};

export default function Dashboard() {
  const [mandates] = useState(mockMandates);

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
              john@acmecapital.com
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Link>
            </Button>
          </div>
        </div>
      </header>

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
                  Shared across all users at acmecapital.com
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-foreground">
                  {freeAllowance.total - freeAllowance.used}
                </span>
                <span className="text-muted-foreground"> / {freeAllowance.total} remaining</span>
              </div>
            </div>
            <div className="mt-4">
              <Progress 
                value={(freeAllowance.used / freeAllowance.total) * 100} 
                className="h-2"
              />
            </div>
          </div>

          {/* Mandates List */}
          <div className="card-elevated">
            <div className="p-4 border-b border-border">
              <h2 className="font-medium text-foreground">Your Mandates</h2>
            </div>

            {mandates.length === 0 ? (
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
                          {mandate.companiesDelivered} companies delivered
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
