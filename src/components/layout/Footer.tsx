import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const footerLinks = {
  product: [
    { name: "Off-Market Origination", href: "/off-market" },
    { name: "On-Market Deal Intelligence", href: "/on-market" },
    { name: "Submit Deal", href: "/submit-deal" },
    { name: "List a Company", href: "/list-company" },
    { name: "Pricing", href: "/pricing" },
  ],
  account: [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Create Mandate", href: "/mandate/create" },
    { name: "Login", href: "/login" },
    { name: "Sign Up", href: "/signup" },
  ],
  company: [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
  ],
};

export function Footer() {

  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container-wide py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-lg font-semibold text-foreground">
              DealScope
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Buyer-led acquisition origination for search funds and private equity.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Account</h3>
            <ul className="space-y-2">
              {footerLinks.account.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Admin
            </h3>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { name: "Admin Dashboard", href: "/admin" },
                { name: "Companies", href: "/admin/companies" },
                { name: "Listings", href: "/admin/listings" },
                { name: "Submissions", href: "/admin/submissions" },
                { name: "Corgi AI", href: "/admin/corgi-ai" },
                { name: "Admin Signup", href: "/admin-signup" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
              DealScope provides buyer-mandated research and origination support only. 
              We do not act as a broker, agent, or intermediary and do not participate in transactions.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              © {new Date().getFullYear()} DealScope. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
