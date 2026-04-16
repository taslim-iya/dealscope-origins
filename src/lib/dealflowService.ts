/**
 * DealFlow connection — syncs company data via popup window.
 * 
 * Storage: IndexedDB (dealscope-db) for company data.
 * localStorage was hitting 5MB quota with large datasets.
 */

export const DEALFLOW_URL_DEFAULT = 'https://dealflowa9.netlify.app';
const CONFIG_KEY = 'dealscope-dealflow-config';
const DB_NAME = 'dealscope-db';
const DB_VERSION = 1;
const STORE_NAME = 'companies';

export interface DealFlowCompany {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue: number | null;
  profit_before_tax: number | null;
  net_assets: number | null;
  total_assets: number | null;
  website: string | null;
  description_of_activities: string | null;
  description?: string | null;
  employees?: string | number | null;
  director_name?: string | null;
  director_title?: string | null;
  year_incorporated?: string | null;
  nace?: string | null;
  status: string;
  directors?: { name: string; title: string }[];
  tags?: string[];
}

export interface DealFlowConfig {
  apiUrl: string;
  clientApiKey: string;
  autoSync: boolean;
  lastSyncAt: string | null;
  companyCount: number;
}

// ═══════════════════════════════════════════════════════════
// IndexedDB helpers
// ═══════════════════════════════════════════════════════════

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDealFlowCompanies(): Promise<DealFlowCompany[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: try legacy localStorage
    const raw = localStorage.getItem('dealscope-companies');
    if (raw) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  }
}

export async function getDealFlowCompaniesPage(
  offset: number,
  limit: number,
  searchQuery?: string,
  industryFilter?: string,
  geographyFilter?: string,
  sortField?: string,
  sortDir?: 'asc' | 'desc'
): Promise<{ companies: DealFlowCompany[]; total: number }> {
  const all = await getDealFlowCompanies();
  
  // Filter
  let filtered = all;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.company_name?.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q) ||
      c.geography?.toLowerCase().includes(q) ||
      c.description_of_activities?.toLowerCase().includes(q) ||
      c.director_name?.toLowerCase().includes(q)
    );
  }
  if (industryFilter && industryFilter !== 'all') {
    filtered = filtered.filter(c => c.industry === industryFilter);
  }
  if (geographyFilter && geographyFilter !== 'all') {
    filtered = filtered.filter(c => c.geography === geographyFilter);
  }

  // Sort
  if (sortField) {
    const numericFields = new Set(['revenue', 'profit_before_tax', 'total_assets', 'net_assets']);
    filtered.sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      
      if (sortField === 'employees') {
        va = a.employees ? parseInt(String(a.employees).replace(/,/g, '')) : null;
        vb = b.employees ? parseInt(String(b.employees).replace(/,/g, '')) : null;
      } else if (numericFields.has(sortField)) {
        va = (a as unknown as Record<string, unknown>)[sortField] as number | null;
        vb = (b as unknown as Record<string, unknown>)[sortField] as number | null;
      } else {
        va = ((a as unknown as Record<string, unknown>)[sortField] as string)?.toLowerCase() ?? null;
        vb = ((b as unknown as Record<string, unknown>)[sortField] as string)?.toLowerCase() ?? null;
      }

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return (sortDir === 'desc') ? 1 : -1;
      if (va > vb) return (sortDir === 'desc') ? -1 : 1;
      return 0;
    });
  }

  return { companies: filtered.slice(offset, offset + limit), total: filtered.length };
}

export async function saveDealFlowCompanies(companies: DealFlowCompany[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear existing data
    store.clear();
    
    // Add all companies
    for (const company of companies) {
      store.put(company);
    }
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    console.log(`[DealScope] Saved ${companies.length} companies to IndexedDB`);
  } catch (err) {
    console.error('[DealScope] IndexedDB save failed:', err);
    // Try localStorage as last resort (will fail for large datasets)
    try {
      localStorage.setItem('dealscope-companies', JSON.stringify(companies));
      console.log(`[DealScope] Fallback: saved ${companies.length} companies to localStorage`);
    } catch (lsErr) {
      console.error('[DealScope] localStorage save also failed:', lsErr);
      throw new Error(`Failed to save companies: dataset too large. ${companies.length} companies.`);
    }
  }
}

export async function getCompanyCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function clearCompanies(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ═══════════════════════════════════════════════════════════
// Config (small, stays in localStorage)
// ═══════════════════════════════════════════════════════════

export function getDealFlowConfig(): DealFlowConfig {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) {
    return { apiUrl: DEALFLOW_URL_DEFAULT, clientApiKey: '', autoSync: false, lastSyncAt: null, companyCount: 0 };
  }
  try { return JSON.parse(raw); } catch { return { apiUrl: DEALFLOW_URL_DEFAULT, clientApiKey: '', autoSync: false, lastSyncAt: null, companyCount: 0 }; }
}

export function saveDealFlowConfig(config: DealFlowConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isDealFlowConnected(): boolean {
  const cfg = getDealFlowConfig();
  return cfg.companyCount > 0 || Boolean(cfg.clientApiKey);
}

/**
 * Import companies from a JSON file exported from DealFlow.
 */
export async function importFromJsonFile(file: File): Promise<DealFlowCompany[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        let data = JSON.parse(text);
        if (data && !Array.isArray(data) && Array.isArray(data.companies)) data = data.companies;
        if (!Array.isArray(data)) { reject(new Error('Invalid file format.')); return; }
        await saveDealFlowCompanies(data);
        const cfg = getDealFlowConfig();
        cfg.lastSyncAt = new Date().toISOString();
        cfg.companyCount = data.length;
        saveDealFlowConfig(cfg);
        resolve(data);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse JSON file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

export interface SyncProgress {
  sent: number;
  total: number;
  done: boolean;
  status: string;
}

/**
 * Sync from DealFlow via popup window with batched streaming.
 */
export function syncFromDealFlow(
  config: DealFlowConfig,
  onProgress?: (progress: SyncProgress) => void
): Promise<DealFlowCompany[]> {
  return new Promise((resolve, reject) => {
    if (!config.clientApiKey) {
      reject(new Error('No API key configured. Go to Connection Settings and add your DealFlow client API key.'));
      return;
    }

    const popup = window.open(
      `${config.apiUrl}/portal?key=${encodeURIComponent(config.clientApiKey)}&mode=sync`,
      'dealflow-sync',
      'width=520,height=400,scrollbars=yes'
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site and try again.'));
      return;
    }

    const allCompanies: DealFlowCompany[] = [];
    
    // 5 minute timeout for large datasets
    const timeout = setTimeout(() => {
      cleanup();
      if (allCompanies.length > 0) {
        saveDealFlowCompanies(allCompanies).then(() => {
          const cfg = getDealFlowConfig();
          cfg.lastSyncAt = new Date().toISOString();
          cfg.companyCount = allCompanies.length;
          saveDealFlowConfig(cfg);
          resolve(allCompanies);
        }).catch(() => resolve(allCompanies));
      } else {
        reject(new Error('Sync timed out. Make sure DealFlow has companies assigned to your client.'));
      }
    }, 300000);

    function handler(event: MessageEvent) {
      const expectedOrigin = new URL(config.apiUrl).origin;
      if (event.origin !== expectedOrigin) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;
      
      if (data.error) {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(data.error));
        return;
      }

      // Handle batched streaming
      if (data.type === 'dealflow-batch') {
        const batch = data.companies || [];
        allCompanies.push(...batch);
        
        onProgress?.({
          sent: data.sent || allCompanies.length,
          total: data.total || allCompanies.length,
          done: !!data.done,
          status: data.done 
            ? allCompanies.length > 0
              ? `Sync complete: ${allCompanies.length.toLocaleString()} companies`
              : `⚠️ Sync complete but 0 companies found. Check that companies are assigned to your client in DealFlow.`
            : `Receiving... ${allCompanies.length.toLocaleString()} companies`,
        });

        if (data.done) {
          clearTimeout(timeout);
          cleanup();
          
          if (allCompanies.length === 0) {
            // Resolve with empty but warn
            const cfg = getDealFlowConfig();
            cfg.lastSyncAt = new Date().toISOString();
            cfg.companyCount = 0;
            saveDealFlowConfig(cfg);
            resolve(allCompanies);
            return;
          }
          
          // Save to IndexedDB (async)
          saveDealFlowCompanies(allCompanies).then(() => {
            const cfg = getDealFlowConfig();
            cfg.lastSyncAt = new Date().toISOString();
            cfg.companyCount = allCompanies.length;
            saveDealFlowConfig(cfg);
            resolve(allCompanies);
          }).catch((err) => {
            console.error('[DealScope] Save after sync failed:', err);
            reject(new Error(`Sync received ${allCompanies.length} companies but failed to save: ${err.message}`));
          });
        }
        return;
      }

      // Legacy: single-shot message
      if (data.type === 'dealflow-companies') {
        clearTimeout(timeout);
        cleanup();
        const companies = data.companies || [];
        saveDealFlowCompanies(companies).then(() => {
          const cfg = getDealFlowConfig();
          cfg.lastSyncAt = new Date().toISOString();
          cfg.companyCount = companies.length;
          saveDealFlowConfig(cfg);
          resolve(companies);
        }).catch(() => resolve(companies));
      }
    }

    function cleanup() {
      window.removeEventListener('message', handler);
      try { popup?.close(); } catch {}
    }

    window.addEventListener('message', handler);
  });
}
