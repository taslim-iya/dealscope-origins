import { Layout } from "@/components/layout/Layout";

export default function Contact() {
  return (
    <Layout>
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Contact
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Get in touch with the DealScope team.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto space-y-8 text-muted-foreground">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">General Enquiries</h2>
              <p className="leading-relaxed">
                For general questions about DealScope, our services, or how we work, please email us at{" "}
                <a href="mailto:hello@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  hello@dealscope.co.uk
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Platform Support</h2>
              <p className="leading-relaxed">
                If you have a question about your account, mandate, or a technical issue, email{" "}
                <a href="mailto:support@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  support@dealscope.co.uk
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">List a Business</h2>
              <p className="leading-relaxed">
                If you represent a business or owner looking to be considered for acquisition opportunities,
                please use our{" "}
                <a href="/list-company" className="text-foreground underline hover:no-underline">
                  listing form
                </a>{" "}
                or email{" "}
                <a href="mailto:listings@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  listings@dealscope.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
