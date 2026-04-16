import { useSettingsStore } from './settingsStore';

export interface EnrichedData {
  founded_year: number | null;
  logo_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  phone: string | null;
  estimated_num_employees: number | null;
  annual_revenue: number | null;
  total_funding: number | null;
  latest_funding_round_type: string | null;
  technologies: string[];
  keywords: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  short_description: string | null;
  raw: Record<string, unknown>;
  enriched_at: string;
}

export interface EnrichedContact {
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
}

function getApolloKey(): string {
  return useSettingsStore.getState().settings.apolloApiKey || 'p_k86JQdDzCm5G3aZqH6zg';
}

export async function enrichCompany(domain: string): Promise<EnrichedData | null> {
  const apiKey = getApolloKey();
  try {
    const res = await fetch(
      `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`
    );
    if (!res.ok) throw new Error(`Apollo returned ${res.status}`);
    const data = await res.json();
    const org = data.organization;
    if (!org) return null;

    return {
      founded_year: org.founded_year || null,
      logo_url: org.logo_url || null,
      linkedin_url: org.linkedin_url || null,
      twitter_url: org.twitter_url || null,
      facebook_url: org.facebook_url || null,
      phone: org.phone || null,
      estimated_num_employees: org.estimated_num_employees || null,
      annual_revenue: org.annual_revenue || null,
      total_funding: org.total_funding || null,
      latest_funding_round_type: org.latest_funding_round_type || null,
      technologies: org.technology_names || [],
      keywords: org.keywords || [],
      city: org.city || null,
      state: org.state || null,
      country: org.country || null,
      short_description: org.short_description || null,
      raw: org,
      enriched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Enrichment] Company enrichment failed:', err);
    return null;
  }
}

export async function enrichContacts(domain: string): Promise<EnrichedContact[]> {
  const apiKey = getApolloKey();
  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        q_organization_domains: domain,
        page: 1,
        per_page: 10,
      }),
    });
    if (!res.ok) throw new Error(`Apollo returned ${res.status}`);
    const data = await res.json();
    const people = data.people || [];
    return people.map((p: Record<string, unknown>) => ({
      first_name: (p.first_name as string) || null,
      last_name: (p.last_name as string) || null,
      title: (p.title as string) || null,
      email: (p.email as string) || null,
      linkedin_url: (p.linkedin_url as string) || null,
      phone: (p.phone_number as string) || null,
      city: (p.city as string) || null,
      country: (p.country as string) || null,
    }));
  } catch (err) {
    console.error('[Enrichment] Contact enrichment failed:', err);
    return [];
  }
}
