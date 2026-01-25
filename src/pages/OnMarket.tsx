import { Link } from "react-router-dom";
import { Bell, Filter, Globe, Layers, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/layout/Layout";

const plannedFilters = [
  "Geography",
  "Industry / SIC Code",
  "Revenue Range",
  "Asset Size",
  "Deal Type",
  "Source",
];

const whatItIs = [
  "Aggregated, normalised view of on-market opportunities",
  "Built for institutional buyers seeking deal flow",
  "Deduplicated canonical company records",
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
              Buyer-side discovery of companies currently available for sale in the United Kingdom.
            </p>
          </div>
        </div>
      </section>

      {/* What This Is / Is Not */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-8">
            {/* What It Is */}
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

            {/* What It Is Not */}
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

      {/* How It Will Work */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-wide">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold text-foreground">How It Will Work</h2>
            <p className="mt-2 text-muted-foreground">
              A unified view of on-market deal flow for UK acquisitions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="card-elevated p-6 text-center opacity-70">
              <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Aggregate</h3>
              <p className="text-sm text-muted-foreground">
                Listings from brokers and public sources, continuously updated.
              </p>
            </div>
            <div className="card-elevated p-6 text-center opacity-70">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Deduplicate</h3>
              <p className="text-sm text-muted-foreground">
                Canonical company records with consistent data structure.
              </p>
            </div>
            <div className="card-elevated p-6 text-center opacity-70">
              <Filter className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Filter</h3>
              <p className="text-sm text-muted-foreground">
                Search and monitor based on your acquisition criteria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Planned Filters Preview */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-foreground">Planned Filters</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Filter on-market opportunities by your key criteria.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {plannedFilters.map((filter) => (
              <span
                key={filter}
                className="px-3 py-1.5 rounded-md bg-secondary text-sm text-muted-foreground border border-border opacity-60"
              >
                {filter}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Notify CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-narrow text-center">
          <Bell className="h-8 w-8 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-semibold">Get notified when available</h2>
          <p className="mt-2 opacity-80 max-w-md mx-auto">
            Be the first to know when On-Market Deal Intelligence launches.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your email"
              className="bg-primary-foreground text-foreground placeholder:text-muted-foreground"
            />
            <Button variant="secondary" className="whitespace-nowrap">
              Notify me
            </Button>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8">
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
