import { Link } from "react-router-dom";
import { ArrowRight, Search, Building2, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

const features = [
  {
    icon: Search,
    title: "Mandate-Based Sourcing",
    description:
      "Define your acquisition criteria and we source matching companies from our private database.",
  },
  {
    icon: Building2,
    title: "Private Master Database",
    description:
      "Access off-market opportunities not available through traditional channels or brokers.",
  },
  {
    icon: FileText,
    title: "Client-Specific Mandates",
    description:
      "Each mandate is tailored to your specific sector, geography, and size requirements.",
  },
  {
    icon: Shield,
    title: "Buyer-Side Only",
    description:
      "We work exclusively for buyers. No conflicts, no seller representation, no intermediary role.",
  },
];

export default function OffMarket() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Live
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Off-Market Origination
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Buyer-mandated acquisition research. Define your criteria, receive qualified 
              off-market companies from our private database.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link to="/login">
                  Log in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card-elevated p-6 animate-fade-in-up"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-md bg-secondary flex-shrink-0">
                    <feature.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Outreach Coming Soon */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-narrow">
          <div className="text-center mb-8">
            <span className="badge-coming-soon mb-4 inline-block">Coming Soon</span>
            <h2 className="text-2xl font-semibold text-foreground">
              AI-Powered Outreach
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              AI-assisted tools to help buyers prepare outreach to off-market companies 
              sourced via mandates.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="card-elevated p-6 opacity-60">
              <h3 className="font-medium text-foreground mb-3">Preview Capabilities</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Draft sector-specific outreach messaging</li>
                <li>• Adjust tone for owner-managed businesses</li>
                <li>• Structure multi-touch outreach sequences</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Buyer controls all outreach. No seller representation, no negotiations, no introductions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 border-b border-border">
        <div className="container-narrow">
          <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-2xl mx-auto">
            DealScope provides buyer-mandated research and origination support only. 
            We do not act as a broker, agent, or intermediary and do not participate in transactions.
          </p>
        </div>
      </section>
    </Layout>
  );
}
