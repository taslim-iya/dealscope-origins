import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Search, Target, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardHeaderProps {
  email?: string;
  onSignOut: () => void;
}

export function DashboardHeader({ email, onSignOut }: DashboardHeaderProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    };

    checkAdminRole();
  }, [user]);

  const tabs = [
    { name: "Deal Sourcing", href: "/dashboard", icon: Target, adminOnly: false },
    { name: "Marketplace", href: "/on-market", icon: Search, adminOnly: true },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname.startsWith("/mandate");
    }
    return location.pathname === href;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container-wide h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-semibold text-foreground">
            DealScope
          </Link>

          {/* Dashboard Tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.name}
                to={tab.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive(tab.href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
                {tab.adminOnly && !isAdmin && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                    Soon
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild className="gap-1.5 border-accent/30 text-accent hover:bg-accent/5 hover:text-accent hidden sm:inline-flex">
            <Link to="/submit-deal">
              <Plus className="h-3.5 w-3.5" />
              Submit Deal
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground hidden md:block">
            {email}
          </span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="sm:hidden border-t border-border">
        <nav className="container-wide flex">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              to={tab.href}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                isActive(tab.href)
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
              {tab.adminOnly && !isAdmin && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                  Soon
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
