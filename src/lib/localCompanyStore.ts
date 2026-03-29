/**
 * Local company storage — uses IndexedDB for large datasets (87K+ rows).
 * Falls back gracefully when Supabase is unavailable.
 */

import { openDB, type IDBPDatabase } from "idb";

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
  employees?: string | null;
  director_name?: string | null;
  director_title?: string | null;
  year_incorporated?: string | null;
}

const DB_NAME = "dealscope-companies";
const STORE_NAME = "companies";
const DB_VERSION = 1;

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("mandate_id", "mandate_id");
        store.createIndex("company_name", "company_name");
      }
    },
  });
}

export async function getLocalCompanies(): Promise<LocalCompany[]> {
  try {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  } catch {
    return [];
  }
}

export async function getLocalCompanyCount(): Promise<number> {
  try {
    const db = await getDB();
    return db.count(STORE_NAME);
  } catch {
    return 0;
  }
}

export async function getLocalCompaniesPage(offset: number, limit: number): Promise<LocalCompany[]> {
  try {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

export async function addLocalCompanies(
  newCompanies: Omit<LocalCompany, "id" | "created_at" | "status">[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  let added = 0;

  for (let i = 0; i < newCompanies.length; i++) {
    const c = newCompanies[i];
    await store.put({
      ...c,
      id: generateId(),
      status: "new",
      created_at: new Date().toISOString(),
    });
    added++;
    if (onProgress && (i % 1000 === 0 || i === newCompanies.length - 1)) {
      onProgress(i + 1, newCompanies.length);
    }
  }

  await tx.done;
  return added;
}

export async function deleteLocalCompany(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function deleteLocalCompanies(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const id of ids) {
    await tx.objectStore(STORE_NAME).delete(id);
  }
  await tx.done;
}

export async function clearLocalCompanies(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Parse XLSX rows (array of arrays) into company objects.
 * Handles the template format: row 0 = category header, row 1 = actual headers, row 2+ = data.
 */
export function parseXlsxRows(
  raw: any[][],
  mandateId: string
): Omit<LocalCompany, "id" | "created_at" | "status">[] {
  // Find the header row — look for a row containing "Company Name"
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i];
    if (row && row.some((cell: any) =>
      String(cell).toLowerCase().replace(/\s+/g, "").includes("companyname")
    )) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: assume row 0 is headers
    headerRowIdx = 0;
  }

  const headers = raw[headerRowIdx].map((h: any) => String(h || "").trim());
  const dataRows = raw.slice(headerRowIdx + 1);

  // Build column index map
  const colIdx = (targetHeaders: string[]): number => {
    for (const target of targetHeaders) {
      const normalised = target.toLowerCase().replace(/[_\s\-()\/]+/g, "");
      const idx = headers.findIndex(
        (h) => h.toLowerCase().replace(/[_\s\-()\/]+/g, "").includes(normalised)
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = colIdx(["companyname"]);
  const stateIdx = colIdx(["st", "state", "geography", "country"]);
  const yearIdx = colIdx(["yearincorp", "yearincorporated", "incorporated"]);
  const naceIdx = colIdx(["nace", "sic", "industrycode"]);
  const employeesIdx = colIdx(["employees", "staff", "headcount"]);
  const revenueIdx = colIdx(["revenueusd", "revenue", "turnover", "sales"]);
  const pbtIdx = colIdx(["plbeforetax", "profitbeforetax", "pbt"]);
  const totalAssetsIdx = colIdx(["totalassets", "assets"]);
  const equityIdx = colIdx(["equityusd", "equity", "netassets"]);
  const websiteIdx = colIdx(["website", "url", "web"]);
  const descIdx = colIdx(["description", "activities"]);
  const directorNameIdx = colIdx(["directorname", "director"]);
  const directorTitleIdx = colIdx(["directortitle", "title"]);

  if (nameIdx === -1) {
    throw new Error("Could not find 'Company Name' column in the file. Please check your headers.");
  }

  const parseNum = (val: any): number | null => {
    if (val == null || val === "") return null;
    if (typeof val === "number") return val;
    const cleaned = String(val).replace(/[£$€,\s]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const getCell = (row: any[], idx: number): string | null => {
    if (idx === -1 || !row[idx]) return null;
    const val = String(row[idx]).trim();
    return val || null;
  };

  const results: Omit<LocalCompany, "id" | "created_at" | "status">[] = [];

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    const name = getCell(row, nameIdx);
    // Skip empty rows, numbered-only rows, or header-like rows
    if (!name || /^\d+$/.test(name) || name === "#" || name === "Company Name") continue;

    results.push({
      company_name: name,
      geography: getCell(row, stateIdx),
      industry: getCell(row, naceIdx),
      revenue_band: null,
      asset_band: null,
      revenue: parseNum(row[revenueIdx]),
      profit_before_tax: parseNum(row[pbtIdx]),
      net_assets: parseNum(row[equityIdx]),
      total_assets: parseNum(row[totalAssetsIdx]),
      website: getCell(row, websiteIdx),
      description_of_activities: getCell(row, descIdx),
      address: null,
      mandate_id: mandateId,
      employees: getCell(row, employeesIdx),
      director_name: getCell(row, directorNameIdx),
      director_title: getCell(row, directorTitleIdx),
      year_incorporated: getCell(row, yearIdx),
    });
  }

  return results;
}

/**
 * Parse CSV rows (objects with header keys) into company objects.
 */
export function parseCsvToCompanies(
  csvRows: Record<string, string>[],
  mandateId: string
): Omit<LocalCompany, "id" | "created_at" | "status">[] {
  return csvRows
    .map((row) => {
      const get = (...keys: string[]): string | null => {
        for (const key of keys) {
          const normalised = key.toLowerCase().replace(/[_\s\-()\/]+/g, "");
          const found = Object.entries(row).find(
            ([k]) => k.toLowerCase().replace(/[_\s\-()\/]+/g, "").includes(normalised)
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
        "organisation", "organization"
      );

      if (!companyName || companyName === "#" || /^\d+$/.test(companyName)) return null;

      return {
        company_name: companyName,
        geography: get("geography", "country", "region", "location", "city", "st", "state"),
        industry: get("industry", "sector", "category", "nace", "siccode", "sicdescription"),
        revenue_band: get("revenueband", "revenuerange", "turnoverband"),
        asset_band: get("assetband", "assetrange"),
        revenue: parseNum(get("revenueusd", "revenue", "turnover", "sales", "annualrevenue")),
        profit_before_tax: parseNum(get("plbeforetax", "profitbeforetax", "pbt", "profit", "netincome")),
        net_assets: parseNum(get("equityusd", "equity", "netassets", "shareholderfunds", "networth")),
        total_assets: parseNum(get("totalassetsusd", "totalassets", "assets")),
        website: get("website", "url", "web", "domain"),
        description_of_activities: get("description", "descriptionofactivities", "activities", "about"),
        address: get("address", "registeredaddress", "officelocation", "hq"),
        mandate_id: mandateId,
        employees: get("employees", "staff", "headcount"),
        director_name: get("directorname", "director"),
        director_title: get("directortitle"),
        year_incorporated: get("yearincorp", "yearincorporated", "incorporated"),
      };
    })
    .filter((c): c is Omit<LocalCompany, "id" | "created_at" | "status"> => c !== null);
}
