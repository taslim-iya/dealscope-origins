import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

const pricingTiers = [
  {
    name: "Initial Coverage Sample",
    price: "Free",
    period: "",
    description: "Start with 20 companies to evaluate our research quality.",
    features: [
      "20 companies per domain",
      "Full company profiles",
      "Define acquisition criteria",
      "Shared across team members",
    ],
    cta: "Get started",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Focused Sourcing Sprint",
    price: "£1,000",
    period: "one-time",
    description: "Intensive 30-day sourcing sprint for active acquisition search.",
    features: [
      "150–250 companies delivered",
      "30-day active sourcing",
      "Priority support",
      "No auto-renewal",
      "Custom mandate criteria",
    ],
    cta: "Start a sprint",
    href: "/signup",
    highlight: true,
  },
];

export default function Pricing() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Simple, Fixed Pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Transparent fees independent of outcomes. No success fees, no hidden costs.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`card-elevated p-8 flex flex-col ${
                  tier.highlight ? "ring-2 ring-accent" : ""
                }`}
              >
                {tier.highlight && (
                  <span className="text-xs font-medium text-accent mb-2">
                    Recommended
                  </span>
                )}
                <h2 className="text-xl font-semibold text-foreground">{tier.name}</h2>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-muted-foreground">
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>

                <ul className="mt-6 space-y-3 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Button
                    variant={tier.highlight ? "default" : "outline"}
                    className="w-full"
                    asChild
                  >
                    <Link to={tier.href}>
                      {tier.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-narrow">
          <div className="max-w-xl mx-auto">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Pricing Notes
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                Fees are independent of transaction outcomes
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                No success fees or commissions
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                Scope is defined and agreed upfront
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
                Free allowance is one-time per corporate domain
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container-narrow text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Questions about pricing?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Contact us to discuss your specific requirements.
          </p>
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
