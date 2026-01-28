import { Link, useLocation } from "react-router-dom";
import { LogOut, Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  email?: string;
  onSignOut: () => void;
}

const tabs = [
  { name: "Off-Market", href: "/dashboard", icon: Target },
  { name: "On-Market", href: "/on-market", icon: Search },
];

export function DashboardHeader({ email, onSignOut }: DashboardHeaderProps) {
  const location = useLocation();

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
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
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
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
