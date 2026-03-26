import { Layout } from "@/components/layout/Layout";

export default function Terms() {
  return (
    <Layout>
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto space-y-8 text-muted-foreground">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Service Description</h2>
              <p className="leading-relaxed">
                DealScope provides a buyer-side acquisition origination platform. We source and present
                company information based on mandates created by our users. We are not a broker, agent,
                or intermediary and do not participate in any transactions.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Eligibility</h2>
              <p className="leading-relaxed">
                DealScope is intended for institutional buyers including search funds, private equity firms,
                family offices, and professional acquirers. By creating an account, you confirm that you
                are using the platform for legitimate acquisition research purposes.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Your Account</h2>
              <p className="leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials.
                Each account is tied to a company domain. Multiple users from the same organisation
                share a domain allowance.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Acceptable Use</h2>
              <ul className="space-y-2 leading-relaxed list-disc list-inside">
                <li>Use the platform only for lawful acquisition research</li>
                <li>Do not share or resell company data obtained through DealScope</li>
                <li>Do not attempt to reverse-engineer or scrape the platform</li>
                <li>Do not submit false or misleading information in listings or mandates</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data and Accuracy</h2>
              <p className="leading-relaxed">
                Company data on DealScope is sourced from publicly available records and third-party
                databases. We do not guarantee the accuracy, completeness, or timeliness of any data.
                Users should conduct their own due diligence before making any acquisition decisions.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. No Intermediary Role</h2>
              <p className="leading-relaxed">
                DealScope does not introduce buyers to sellers, negotiate on behalf of any party, or
                participate in transactions in any capacity. Any contact between buyers and companies
                is made independently by the user.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
              <p className="leading-relaxed">
                DealScope is provided "as is". To the maximum extent permitted by law, we exclude all
                warranties and liability for any losses arising from use of the platform or reliance on
                data presented therein.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to Terms</h2>
              <p className="leading-relaxed">
                We may update these terms from time to time. Continued use of DealScope after changes
                constitutes acceptance of the updated terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact</h2>
              <p className="leading-relaxed">
                For any questions about these terms, contact us at{" "}
                <a href="mailto:hello@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  hello@dealscope.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
