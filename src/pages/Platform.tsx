import { Link } from "react-router-dom";
import { Database, Lock, FileText, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

const platformFeatures = [
  {
    icon: FileText,
    title: "Mandate-Based Workspaces",
    description:
      "Each mandate operates in its own dedicated workspace with defined criteria, company lists, and tracking. Multiple active mandates per client supported.",
  },
  {
    icon: Database,
    title: "Private Master Database",
    description:
      "Our continuously updated database of UK companies enables targeted sourcing based on industry, geography, and financial characteristics.",
  },
  {
    icon: Lock,
    title: "Client Access Boundaries",
    description:
      "Strict data isolation ensures your mandate activity and company lists remain private. No cross-client visibility or data sharing.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Invite colleagues from your organisation. Free allowance and mandate access shared at the corporate domain level.",
  },
];

export default function Platform() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Platform Overview
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Purpose-built infrastructure for buyer-side acquisition origination.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-8">
            {platformFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className="card-elevated p-8 animate-fade-in-up"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="p-3 rounded-lg bg-secondary inline-block mb-4">
                  <feature.icon className="h-6 w-6 text-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Normalisation */}
      <section className="section-padding bg-secondary/30 border-y border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Data Quality & Normalisation
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Every company in our database undergoes rigorous normalisation to ensure 
              consistent, comparable data across your mandate results.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background border border-border">
                <h3 className="font-medium text-foreground mb-2">Standard Fields</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Company registration details</li>
                  <li>• SIC code classification</li>
                  <li>• Geographic location</li>
                  <li>• Latest filed accounts</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <h3 className="font-medium text-foreground mb-2">Financial Data</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Revenue (where filed)</li>
                  <li>• Total assets</li>
                  <li>• Net assets</li>
                  <li>• Filing status</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container-narrow text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Ready to get started?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Create your account and start your first mandate today.
          </p>
          <div className="mt-6">
            <Button size="lg" asChild>
              <Link to="/signup">
                Sign up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
