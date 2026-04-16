import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnMarketDeal {
  id: string;
  companyName: string;
  description: string;
  industry: string;
  location: string;
  askingPrice: number | null;
  revenue: number | null;
  sourceUrl: string;
  sourceName: string;
  listingUrl?: string;
  status: 'new' | 'reviewed' | 'contacted' | 'passed' | 'sold';
  aiSummary: string | null;
  created_at: string;
  updated_at: string;
  scrapedAt?: string;
}

export interface ScrapeSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  isBuiltIn: boolean;
  lastScrapedAt: string | null;
  listingsCount?: number;
}

const BUILT_IN_SOURCES: ScrapeSource[] = [
  { id: 'rightbiz', name: 'Rightbiz', url: 'https://www.rightbiz.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'daltons', name: 'Daltons Business', url: 'https://www.daltonsbusiness.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'businessesforsale', name: 'BusinessesForSale.com', url: 'https://uk.businessesforsale.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'businesssale', name: 'Business Sale Report', url: 'https://www.business-sale.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'dealopportunities', name: 'Deal Opportunities', url: 'https://www.dealopportunities.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'bizdaq', name: 'Bizdaq', url: 'https://www.bizdaq.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'nationwidebusinesses', name: 'Nationwide Businesses', url: 'https://www.nationwidebusinesses.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'intelligent', name: 'Intelligent', url: 'https://www.intelligent.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'smergers', name: 'SMERGERS', url: 'https://www.smergers.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'flippa', name: 'Flippa', url: 'https://flippa.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'hiltonsmythe', name: 'Hilton Smythe', url: 'https://www.hiltonsmythe.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'businessbuyers', name: 'Business Buyers', url: 'https://www.businessbuyers.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'transworld', name: 'Transworld', url: 'https://www.tworld.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'buymybiz', name: 'BuyMyBiz', url: 'https://www.buymybiz.co.uk', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
  { id: 'bizquest', name: 'BizQuest', url: 'https://www.bizquest.com', enabled: true, isBuiltIn: true, lastScrapedAt: null, listingsCount: 0 },
];

interface OnMarketState {
  deals: OnMarketDeal[];
  sources: ScrapeSource[];
  lastFullScrape: string | null;
  scraping: boolean;
  addDeal: (deal: OnMarketDeal) => void;
  addDeals: (deals: OnMarketDeal[]) => void;
  updateDeal: (id: string, updates: Partial<OnMarketDeal>) => void;
  deleteDeal: (id: string) => void;
  clearDeals: () => void;
  markSold: (ids: string[]) => void;
  addSource: (source: ScrapeSource) => void;
  updateSource: (id: string, updates: Partial<ScrapeSource>) => void;
  deleteSource: (id: string) => void;
  setScraping: (v: boolean) => void;
  setLastFullScrape: (d: string) => void;
}

export const useOnMarketStore = create<OnMarketState>()(
  persist(
    (set) => ({
      deals: [],
      sources: BUILT_IN_SOURCES,
      lastFullScrape: null,
      scraping: false,
      addDeal: (deal) => set((s) => ({ deals: [...s.deals, deal] })),
      addDeals: (deals) => set((s) => {
        // Deduplicate by title+source
        const existing = new Set(s.deals.map(d => `${d.companyName}::${d.sourceName}`));
        const newDeals = deals.filter(d => !existing.has(`${d.companyName}::${d.sourceName}`));
        return { deals: [...s.deals, ...newDeals] };
      }),
      updateDeal: (id, updates) =>
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d)),
        })),
      deleteDeal: (id) => set((s) => ({ deals: s.deals.filter((d) => d.id !== id) })),
      clearDeals: () => set({ deals: [] }),
      markSold: (ids) => set((s) => ({
        deals: s.deals.map((d) => ids.includes(d.id) ? { ...d, status: 'sold' as const } : d),
      })),
      addSource: (source) => set((s) => ({ sources: [...s.sources, source] })),
      updateSource: (id, updates) =>
        set((s) => ({ sources: s.sources.map((src) => (src.id === id ? { ...src, ...updates } : src)) })),
      deleteSource: (id) => set((s) => ({ sources: s.sources.filter((src) => src.id !== id || src.isBuiltIn) })),
      setScraping: (scraping) => set({ scraping }),
      setLastFullScrape: (d) => set({ lastFullScrape: d }),
    }),
    { name: 'dealscope-onmarket-v2' }
  )
);
