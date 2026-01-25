import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

export default function About() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              About DealScope
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Research-led acquisition origination for the UK market.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto prose prose-slate">
            <div className="space-y-8 text-muted-foreground">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Our Mission
                </h2>
                <p className="leading-relaxed">
                  DealScope exists to help institutional buyers—search funds, private equity 
                  firms, family offices, and independent acquirers—find quality acquisition 
                  opportunities in the United Kingdom.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Our Approach
                </h2>
                <p className="leading-relaxed">
                  We operate exclusively on the buyer side. Our mandate-driven model means 
                  we source companies based on your specific criteria, not based on what 
                  sellers want to list. This fundamental difference shapes everything we do.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  What Sets Us Apart
                </h2>
                <ul className="space-y-2 leading-relaxed">
                  <li>
                    <strong className="text-foreground">Buyer-side only:</strong> No seller 
                    representation, no conflicts of interest
                  </li>
                  <li>
                    <strong className="text-foreground">Research-led:</strong> Systematic 
                    sourcing from our private database
                  </li>
                  <li>
                    <strong className="text-foreground">Fixed fees:</strong> Transparent 
                    pricing independent of transaction outcomes
                  </li>
                  <li>
                    <strong className="text-foreground">No intermediary role:</strong> We 
                    source opportunities; you conduct your own process
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Our Positioning
                </h2>
                <p className="leading-relaxed">
                  DealScope is not a brokerage, not a marketplace, and not an intermediary. 
                  We provide research and origination support only. We do not introduce 
                  parties, negotiate terms, or participate in transactions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary/30 border-t border-border">
        <div className="container-narrow text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Ready to start your acquisition search?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Create your first mandate and see the quality of our research.
          </p>
          <div className="mt-6">
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
