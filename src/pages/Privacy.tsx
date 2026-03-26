import { Layout } from "@/components/layout/Layout";

export default function Privacy() {
  return (
    <Layout>
      <section className="section-padding border-b border-border">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow">
          <div className="max-w-2xl mx-auto space-y-8 text-muted-foreground">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Who We Are</h2>
              <p className="leading-relaxed">
                DealScope is a buyer-side acquisition origination platform operated in the United Kingdom.
                We help institutional buyers source and evaluate acquisition targets based on their mandates.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Data We Collect</h2>
              <p className="leading-relaxed mb-3">We collect the following information:</p>
              <ul className="space-y-2 leading-relaxed list-disc list-inside">
                <li>Account information: name, email address, company name</li>
                <li>Mandate data: search criteria, notes, and preferences you provide</li>
                <li>Usage data: pages visited, features used, and session information</li>
                <li>Company data submitted via listings or deal submission forms</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Data</h2>
              <ul className="space-y-2 leading-relaxed list-disc list-inside">
                <li>To operate and improve the DealScope platform</li>
                <li>To match acquisition mandates with relevant companies</li>
                <li>To send transactional emails related to your account or mandates</li>
                <li>To comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Sharing</h2>
              <p className="leading-relaxed">
                We do not sell your personal data. We may share data with trusted service providers
                (such as our hosting and database providers) strictly for the purpose of operating the platform.
                We use Supabase for database and authentication services.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Retention</h2>
              <p className="leading-relaxed">
                We retain your data for as long as your account is active. You may request deletion of
                your account and associated data at any time by contacting us at{" "}
                <a href="mailto:hello@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  hello@dealscope.co.uk
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Your Rights</h2>
              <p className="leading-relaxed">
                Under UK GDPR, you have the right to access, correct, or delete your personal data.
                To exercise these rights, please contact us at{" "}
                <a href="mailto:hello@dealscope.co.uk" className="text-foreground underline hover:no-underline">
                  hello@dealscope.co.uk
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Contact</h2>
              <p className="leading-relaxed">
                For any privacy-related questions, contact us at{" "}
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
