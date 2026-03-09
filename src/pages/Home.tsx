import { Link } from "react-router-dom";
import { ArrowRight, Search, Database, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

const pillars = [
  {
    title: "Deal Sourcing",
    status: "Live",
    description:
      "Buyer-mandated sourcing of off-market companies based on your defined acquisition criteria. Access our private master database.",
    icon: Search,
    href: "/off-market",
    cta: "Start a mandate",
  },
  {
    title: "Marketplace",
    status: "Coming Soon",
    description:
      "Buyer-side discovery of companies already available for sale, aggregated and normalised from public sources across the UK.",
    icon: Database,
    href: "/on-market",
    cta: "Learn more",
  },
  {
    title: "AI-Powered Outreach",
    status: "Coming Soon",
    description:
      "Optional, assistive outreach tools to help buyers prepare and structure communications with off-market targets.",
    icon: Shield,
    href: "/off-market",
    cta: "Learn more",
  },
];

const notList = [
  "We do not represent sellers",
  "We do not act as brokers or intermediaries",
  "We do not negotiate or facilitate transactions",
  "We do not earn success fees",
];

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground animate-fade-in">
              Buyer-Led Acquisition Origination
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed animate-fade-in [animation-delay:100ms]">
              Mandate-driven sourcing for search funds, private equity firms, family offices, 
              and independent acquirers in the United Kingdom.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in [animation-delay:200ms]">
              <Button size="lg" asChild>
                <Link to="/off-market">
                  Start a mandate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/platform">How it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Product Pillars */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Research-Led Origination Support
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Purpose-built tools for institutional buyers seeking quality acquisition opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map((pillar, index) => (
              <div
                key={pillar.title}
                className="card-elevated p-6 flex flex-col animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-md bg-secondary">
                    <pillar.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      pillar.status === "Live"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {pillar.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {pillar.description}
                </p>
                <div className="mt-6">
                  <Link
                    to={pillar.href}
                    className="text-sm font-medium text-foreground hover:text-accent transition-colors inline-flex items-center"
                  >
                    {pillar.cta}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Don't Do */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-8">
              What We Don't Do
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {notList.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border"
                >
                  <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              DealScope is buyer-side only. We charge fixed fees for research and origination support.
            </p>
          </div>
        </div>
      </section>

      {/* Submit Deal CTA */}
      <section className="section-padding bg-accent/5 border-y border-accent/10">
        <div className="container-narrow text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Have a Company to Sell?
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Owners, brokers, and advisers can submit opportunities directly to our platform. 
            All submissions are confidential and reviewed within 48 hours.
          </p>
          <div className="mt-8">
            <Button size="lg" variant="outline" asChild className="gap-2 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent">
              <Link to="/submit-deal">
                Submit Deal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Buyer CTA */}
      <section className="section-padding">
        <div className="container-narrow text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Ready to start sourcing?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Create your first mandate and receive up to 20 companies free.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
