/**
 * Local company storage — persists to localStorage so CSV uploads survive page reloads.
 * Falls back gracefully when Supabase is unavailable.
 */

export interface LocalCompany {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue_band: string | null;
  asset_band: string | null;
  status: string;
  revenue: number | null;
  profit_before_tax: number | null;
  net_assets: number | null;
  total_assets: number | null;
  website: string | null;
  description_of_activities: string | null;
  address: string | null;
  mandate_id: string;
  created_at: string;
}

const STORAGE_KEY = "dealscope-local-companies";

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getLocalCompanies(): LocalCompany[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCompanies(companies: LocalCompany[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

export function addLocalCompanies(newCompanies: Omit<LocalCompany, "id" | "created_at" | "status">[]): LocalCompany[] {
  const existing = getLocalCompanies();
  const created = newCompanies.map((c) => ({
    ...c,
    id: generateId(),
    status: "new",
    created_at: new Date().toISOString(),
  }));
  const updated = [...created, ...existing];
  saveLocalCompanies(updated);
  return updated;
}

export function deleteLocalCompany(id: string): LocalCompany[] {
  const updated = getLocalCompanies().filter((c) => c.id !== id);
  saveLocalCompanies(updated);
  return updated;
}

export function deleteLocalCompanies(ids: string[]): LocalCompany[] {
  const idSet = new Set(ids);
  const updated = getLocalCompanies().filter((c) => !idSet.has(c.id));
  saveLocalCompanies(updated);
  return updated;
}

/**
 * Parse rows into company objects.
 * Tries to auto-map common column names from CSV, XLSX, or any tabular source.
 */
export function parseCsvToCompanies(csvRows: Record<string, string>[], mandateId: string): Omit<LocalCompany, "id" | "created_at" | "status">[] {
  // Filter out rows where company name is empty/missing or looks like a header
  return csvRows
    .map((row) => {
      // Auto-map common header variations (case-insensitive, ignore whitespace/underscores/hyphens)
      const get = (...keys: string[]): string | null => {
        for (const key of keys) {
          const normalised = key.toLowerCase().replace(/[_\s\-()\/]+/g, "");
          const found = Object.entries(row).find(
            ([k]) => k.toLowerCase().replace(/[_\s\-()\/]+/g, "") === normalised
          );
          if (found && found[1]?.toString().trim()) return found[1].toString().trim();
        }
        return null;
      };

      const parseNum = (val: string | null): number | null => {
        if (!val) return null;
        const cleaned = val.replace(/[£$€,\s]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const companyName = get(
        "companyname", "company", "name", "businessname",
        "organisation", "organization", "company name"
      );

      // Skip rows without a company name or where name is just a number
      if (!companyName || companyName === "#" || /^\d+$/.test(companyName)) return null;

      return {
        company_name: companyName,
        geography: get(
          "geography", "country", "region", "location", "city",
          "st", "state"
        ),
        industry: get(
          "industry", "sector", "category", "siccode", "sicdescription",
          "industrytype", "nace", "sicDescription"
        ),
        revenue_band: get("revenueband", "revenuerange", "turnoverband"),
        asset_band: get("assetband", "assetrange"),
        revenue: parseNum(get(
          "revenue", "turnover", "sales", "annualrevenue",
          "revenueusd", "revenue (usd)", "revenue(usd)"
        )),
        profit_before_tax: parseNum(get(
          "profitbeforetax", "pbt", "profit", "netincome", "pretaxprofit",
          "p/lbeforetax(usd)", "p/l before tax (usd)", "plbeforetaxusd",
          "p/lbeforetax", "p/l before tax"
        )),
        net_assets: parseNum(get(
          "netassets", "equity", "shareholderfunds", "networth",
          "equity(usd)", "equity (usd)", "equityusd"
        )),
        total_assets: parseNum(get(
          "totalassets", "assets",
          "totalassets(usd)", "total assets (usd)", "totalassetsusd"
        )),
        website: get("website", "url", "web", "domain", "companyurl"),
        description_of_activities: get(
          "description", "descriptionofactivities", "activities",
          "businessdescription", "about"
        ),
        address: get("address", "registeredaddress", "officelocation", "hq"),
        mandate_id: mandateId,
      };
    })
    .filter((c): c is Omit<LocalCompany, "id" | "created_at" | "status"> => c !== null);
}
