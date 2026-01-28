import {
  Filter,
  Globe,
  Layers,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";

const whatItIs = [
  "Aggregated, normalised view of on-market opportunities",
  "Built for institutional buyers seeking deal flow",
  "AI-powered extraction of company details & financials",
  "Search, filter, and monitor across sources",
];

const whatItIsNot = [
  "Not a brokerage",
  "Not a marketplace",
  "No seller mandates",
  "No introductions or negotiations",
];

export default function OnMarket() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <span className="badge-coming-soon mb-6 inline-block">Coming Soon</span>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              On-Market Deal Intelligence
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              AI-powered discovery of companies currently available for sale in the United Kingdom.
            </p>
          </div>
        </div>
      </section>

      {/* What This Is / Is Not */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-5 w-5 text-foreground" />
                <h2 className="text-lg font-semibold text-foreground">What This Is</h2>
              </div>
              <ul className="space-y-3">
                {whatItIs.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">What This Is Not</h2>
              </div>
              <ul className="space-y-3">
                {whatItIsNot.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-wide">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
            <p className="mt-2 text-muted-foreground">
              AI-powered aggregation of UK business-for-sale listings.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="card-elevated p-6 text-center">
              <Globe className="h-8 w-8 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Scrape</h3>
              <p className="text-sm text-muted-foreground">
                Fetch listings from BizBuySell, BusinessesForSale, Daltons, and RightBiz.
              </p>
            </div>
            <div className="card-elevated p-6 text-center">
              <Sparkles className="h-8 w-8 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Analyze</h3>
              <p className="text-sm text-muted-foreground">
                AI extracts company details, financials, and generates investment summaries.
              </p>
            </div>
            <div className="card-elevated p-6 text-center">
              <Filter className="h-8 w-8 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Filter</h3>
              <p className="text-sm text-muted-foreground">
                Search and filter based on your acquisition criteria.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
