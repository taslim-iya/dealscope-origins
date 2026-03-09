import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/", comingSoon: false },
  { name: "Deal Sourcing", href: "/off-market", comingSoon: false },
  { name: "Marketplace", href: "/on-market", comingSoon: true },
  { name: "Pricing", href: "/pricing", comingSoon: false },
  { name: "About", href: "/about", comingSoon: false },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container-wide flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground">
              DealScope
            </span>
          </Link>

          <div className="hidden lg:flex lg:gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors rounded-md",
                  location.pathname === item.href
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.name}
                  {item.comingSoon && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                      Soon
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5 border-accent/30 text-accent hover:bg-accent/5 hover:text-accent">
            <Link to="/submit-deal">
              <Plus className="h-3.5 w-3.5" />
              Submit Deal
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>

        <button
          type="button"
          className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="container-wide py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "block px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location.pathname === item.href
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="flex items-center gap-2">
                  {item.name}
                  {item.comingSoon && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                      Soon
                    </span>
                  )}
                </span>
              </Link>
            ))}
            <div className="pt-4 flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild className="w-full gap-1.5 border-accent/30 text-accent">
                <Link to="/submit-deal">
                  <Plus className="h-3.5 w-3.5" />
                  Submit Deal
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="w-full">
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
