import { useState, useEffect, useMemo } from 'react';
import {
  Search, ExternalLink, Star, StarOff, Filter, ArrowUpDown,
  Building2, MapPin, TrendingUp, ChevronDown, X, Bookmark, BookmarkCheck,
  Globe, Lock, SlidersHorizontal, BarChart3,
} from 'lucide-react';

/* ─── Types ─── */
interface Listing {
  id: string;
  title: string;
  price: string | null;
  askingPrice: number;
  revenue: string | null;
  revenueNum: number;
  profit: string | null;
  profitNum: number;
  location: string;
  region: string;
  industry: string;
  source: string;
  sourceId: string;
  url: string;
  employees: string | null;
  established: string | null;
  description: string | null;
  type: string; // freehold, leasehold, relocatable
}

interface SavedDeal {
  id: string;
  savedAt: string;
  notes: string;
}

/* ─── Helpers ─── */
function parseNum(s: string | null): number {
  if (!s) return 0;
  const clean = s.replace(/[^0-9.kmb]/gi, '').toLowerCase();
  let n = parseFloat(clean) || 0;
  if (clean.includes('m')) n *= 1_000_000;
  else if (clean.includes('k')) n *= 1_000;
  else if (clean.includes('b')) n *= 1_000_000_000;
  // Handle raw numbers like £1,250,000
  const raw = s.replace(/[^0-9.]/g, '');
  const rawN = parseFloat(raw) || 0;
  return Math.max(n, rawN);
}

function fmtGBP(n: number): string {
  if (n === 0) return '—';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toLocaleString()}`;
}

function extractRegion(loc: string): string {
  if (!loc) return 'Unknown';
  const l = loc.toLowerCase();
  if (l.includes('london')) return 'London';
  if (l.includes('south east') || l.includes('kent') || l.includes('surrey') || l.includes('sussex')) return 'South East';
  if (l.includes('south west') || l.includes('devon') || l.includes('bristol') || l.includes('cornwall')) return 'South West';
  if (l.includes('north west') || l.includes('manchester') || l.includes('liverpool') || l.includes('lancashire')) return 'North West';
  if (l.includes('north east') || l.includes('newcastle') || l.includes('sunderland')) return 'North East';
  if (l.includes('west midlands') || l.includes('birmingham') || l.includes('coventry')) return 'West Midlands';
  if (l.includes('east midlands') || l.includes('nottingham') || l.includes('leicester')) return 'East Midlands';
  if (l.includes('yorkshire') || l.includes('leeds') || l.includes('sheffield')) return 'Yorkshire';
  if (l.includes('east anglia') || l.includes('norfolk') || l.includes('suffolk') || l.includes('cambridge')) return 'East Anglia';
  if (l.includes('scotland') || l.includes('glasgow') || l.includes('edinburgh')) return 'Scotland';
  if (l.includes('wales') || l.includes('cardiff') || l.includes('swansea')) return 'Wales';
  if (l.includes('northern ireland') || l.includes('belfast')) return 'Northern Ireland';
  if (l.includes('online') || l.includes('remote') || l.includes('uk')) return 'UK-Wide / Online';
  return loc.split(',')[0].trim() || 'Unknown';
}

const SOURCE_LABELS: Record<string, string> = {
  hiltonsmythe: 'Hilton Smythe', businessesforsale: 'BusinessesForSale', flippa: 'Flippa',
  smergers: 'SMERGERS', rightbiz: 'Rightbiz', daltons: 'Daltons', bizdaq: 'Bizdaq',
  bizbuysell: 'BizBuySell', acquire: 'Acquire.com',
};

type SortKey = 'title' | 'askingPrice' | 'revenueNum' | 'location' | 'industry' | 'source';
type SortDir = 'asc' | 'desc';
type Tab = 'on-market' | 'off-market' | 'saved';

/* ─── Main Component ─── */
export default function DealFinder() {
  const [tab, setTab] = useState<Tab>('on-market');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('askingPrice');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [saved, setSaved] = useState<Record<string, SavedDeal>>(() => {
    try { return JSON.parse(localStorage.getItem('dealscope-saved') || '{}'); } catch { return {}; }
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, sources: 0, scrapedAt: '' });

  // Persist saved
  useEffect(() => { localStorage.setItem('dealscope-saved', JSON.stringify(saved)); }, [saved]);

  // Load listings
  useEffect(() => {
    fetch('/data/listings.json')
      .then(r => r.json())
      .then(data => {
        const parsed: Listing[] = (data.listings || [])
          .filter((l: any) => l.title && l.title !== 'Choose your country' && l.title.length > 5)
          .map((l: any) => ({
            ...l,
            askingPrice: parseNum(l.price),
            revenueNum: parseNum(l.revenue),
            profitNum: parseNum(l.profit),
            region: extractRegion(l.location),
            employees: l.employees || null,
            established: l.established || null,
            description: l.description || null,
            type: l.type || '',
            profit: l.profit || null,
          }));
        setListings(parsed);
        const activeSources = Object.values(data.sources || {}).filter((v: any) => v > 0).length;
        setStats({ total: parsed.length, sources: activeSources, scrapedAt: data.scrapedAt || '' });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Derived filter options
  const industries = useMemo(() => {
    const set = new Set(listings.map(l => l.industry).filter(Boolean));
    return [...set].sort();
  }, [listings]);

  const regions = useMemo(() => {
    const set = new Set(listings.map(l => l.region).filter(Boolean));
    return [...set].sort();
  }, [listings]);

  const sources = useMemo(() => {
    const set = new Set(listings.map(l => l.sourceId).filter(Boolean));
    return [...set].sort();
  }, [listings]);

  // Filter + sort
  const filtered = useMemo(() => {
    let f = listings;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(l => l.title.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q));
    }
    if (industryFilter) f = f.filter(l => l.industry === industryFilter);
    if (regionFilter) f = f.filter(l => l.region === regionFilter);
    if (sourceFilter) f = f.filter(l => l.sourceId === sourceFilter);
    if (priceMin) f = f.filter(l => l.askingPrice >= parseFloat(priceMin) * 1000);
    if (priceMax) f = f.filter(l => l.askingPrice <= parseFloat(priceMax) * 1000);
    if (tab === 'saved') f = f.filter(l => saved[l.id]);

    f.sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return f;
  }, [listings, search, industryFilter, regionFilter, sourceFilter, priceMin, priceMax, sortKey, sortDir, tab, saved]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { id, savedAt: new Date().toISOString(), notes: '' };
      return next;
    });
  };

  const clearFilters = () => {
    setSearch(''); setIndustryFilter(''); setRegionFilter(''); setSourceFilter('');
    setPriceMin(''); setPriceMax('');
  };

  const hasFilters = search || industryFilter || regionFilter || sourceFilter || priceMin || priceMax;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc'
      ? <ArrowUpDown size={12} style={{ color: 'var(--accent)' }} />
      : <ArrowUpDown size={12} style={{ color: 'var(--accent)', transform: 'scaleY(-1)' }} />;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* CSS vars */}
      <style>{`
        :root { --accent: #0F172A; --accent-light: #334155; --blue: #2563EB; --border: #E2E8F0; --surface: #fff; --muted: #64748B; --bg: #F8FAFC; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .th-sort { cursor: pointer; user-select: none; display: flex; align-items: center; gap: 4px; }
        .th-sort:hover { color: var(--accent); }
        .row-hover:hover { background: #F1F5F9 !important; }
        .tab-btn { padding: 10px 20px; font-size: 14px; font-weight: 500; border: none; background: none; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; transition: all 0.15s; }
        .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
        .tab-btn:hover { color: var(--accent-light); }
        .filter-select { padding: 7px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--accent); min-width: 120px; }
        .filter-input { padding: 7px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--accent); width: 100px; }
        .badge { display: inline-flex; align-items: center; padding: 2px 8px; font-size: 11px; font-weight: 500; border-radius: 4px; }
        .save-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; }
        .save-btn:hover { background: #F1F5F9; }
        .expanded-row { background: #FAFBFC; border-left: 3px solid var(--blue); }
        @media (max-width: 768px) { .hide-mobile { display: none; } }
      `}</style>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={14} color="#fff" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>DealScope</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {stats.total.toLocaleString()} listings · {stats.sources} sources
            </span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20, paddingTop: 8 }}>
          {([
            { id: 'on-market' as Tab, label: 'On-Market', icon: Globe, count: listings.length },
            { id: 'off-market' as Tab, label: 'Off-Market', icon: Lock, count: 0 },
            { id: 'saved' as Tab, label: 'Saved', icon: Bookmark, count: Object.keys(saved).length },
          ]).map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <t.icon size={14} />
                {t.label}
                {t.count > 0 && <span style={{ fontSize: 11, background: tab === t.id ? '#0F172A' : '#E2E8F0', color: tab === t.id ? '#fff' : '#64748B', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t.count}</span>}
              </span>
            </button>
          ))}
        </div>

        {/* Off-Market tab */}
        {tab === 'off-market' && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <Lock size={40} style={{ color: '#CBD5E1', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Off-Market Deal Sourcing</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
              Private company sourcing from our database of 2.4M+ UK companies. Define your acquisition criteria — sector, size, geography, financials — and receive matched opportunities not listed publicly.
            </p>
            <div style={{ display: 'inline-flex', padding: '10px 24px', borderRadius: 8, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 600 }}>
              Coming Soon
            </div>
          </div>
        )}

        {/* On-Market + Saved tabs */}
        {(tab === 'on-market' || tab === 'saved') && (
          <>
            {/* Search + filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search businesses, locations, sectors..."
                  style={{ width: '100%', padding: '9px 10px 9px 32px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: '#0F172A' }} />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 14px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: showFilters ? '#F1F5F9' : '#fff', color: 'var(--accent)', cursor: 'pointer' }}>
                <SlidersHorizontal size={13} /> Filters {hasFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }} />}
              </button>
              {hasFilters && (
                <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', fontSize: 12, border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 500 }}>
                  <X size={12} /> Clear all
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
                {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '12px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="filter-select" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
                  <option value="">All Sectors</option>
                  {industries.map(i => <option key={i}>{i}</option>)}
                </select>
                <select className="filter-select" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r}>{r}</option>)}
                </select>
                <select className="filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                  <option value="">All Sources</option>
                  {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Price (£k):</span>
                  <input className="filter-input" type="number" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)} style={{ width: 70 }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                  <input className="filter-input" type="number" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ width: 70 }} />
                </div>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading listings...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                {tab === 'saved' ? 'No saved deals yet. Click the bookmark icon to save listings.' : 'No listings match your filters.'}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ width: 36, padding: '10px 8px' }}></th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                        <div className="th-sort" onClick={() => toggleSort('title')}><span>Business</span><SortIcon col="title" /></div>
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                        <div className="th-sort" onClick={() => toggleSort('industry')}><span>Sector</span><SortIcon col="industry" /></div>
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                        <div className="th-sort" onClick={() => toggleSort('location')}><span>Location</span><SortIcon col="location" /></div>
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div className="th-sort" onClick={() => toggleSort('askingPrice')} style={{ justifyContent: 'flex-end' }}><span>Asking Price</span><SortIcon col="askingPrice" /></div>
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }} className="hide-mobile">
                        <div className="th-sort" onClick={() => toggleSort('revenueNum')} style={{ justifyContent: 'flex-end' }}><span>Revenue</span><SortIcon col="revenueNum" /></div>
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                        <div className="th-sort" onClick={() => toggleSort('source')}><span>Source</span><SortIcon col="source" /></div>
                      </th>
                      <th style={{ width: 40, padding: '10px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((l, i) => (
                      <>
                        <tr key={l.id} className="row-hover" onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                          style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', cursor: 'pointer' }}>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button className="save-btn" onClick={e => { e.stopPropagation(); toggleSave(l.id); }}>
                              {saved[l.id] ? <BookmarkCheck size={14} style={{ color: 'var(--blue)' }} /> : <Bookmark size={14} style={{ color: '#CBD5E1' }} />}
                            </button>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0F172A', maxWidth: 300 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {l.industry ? (
                              <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{l.industry}</span>
                            ) : (
                              <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={11} /> {l.region || l.location || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                            {l.askingPrice > 0 ? fmtGBP(l.askingPrice) : <span style={{ color: '#CBD5E1' }}>POA</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="hide-mobile">
                            {l.revenueNum > 0 ? fmtGBP(l.revenueNum) : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{SOURCE_LABELS[l.sourceId] || l.source}</span>
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {l.url && l.url !== 'https://flippa.com' && l.url !== 'https://uk.businessesforsale.com/uk/search/businesses-for-sale' ? (
                              <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ color: 'var(--blue)', padding: 4, display: 'flex' }}>
                                <ExternalLink size={13} />
                              </a>
                            ) : null}
                          </td>
                        </tr>
                        {expandedId === l.id && (
                          <tr key={`${l.id}-detail`}>
                            <td colSpan={8} className="expanded-row" style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: l.description ? 12 : 0 }}>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Asking Price</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.askingPrice > 0 ? fmtGBP(l.askingPrice) : 'POA'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Revenue</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.revenueNum > 0 ? fmtGBP(l.revenueNum) : '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Profit (Pre-Tax)</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.profitNum > 0 ? fmtGBP(l.profitNum) : '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Sector</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.industry || '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Location</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.location || '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Employees</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.employees || '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Established</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.established || '—'}</span></div>
                                <div><span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Type</span><span style={{ fontSize: 14, fontWeight: 600 }}>{l.type || '—'}</span></div>
                              </div>
                              {l.description && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{l.description}</p>}
                              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                {l.url && l.url.length > 30 && (
                                  <a href={l.url} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, background: '#0F172A', color: '#fff', textDecoration: 'none' }}>
                                    View Full Listing <ExternalLink size={11} />
                                  </a>
                                )}
                                <button onClick={() => toggleSave(l.id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border)', background: saved[l.id] ? '#EFF6FF' : '#fff', color: saved[l.id] ? 'var(--blue)' : '#475569', cursor: 'pointer' }}>
                                  {saved[l.id] ? <><BookmarkCheck size={11} /> Saved</> : <><Bookmark size={11} /> Save Deal</>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 200 && (
                  <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                    Showing 200 of {filtered.length.toLocaleString()} results. Use filters to narrow down.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ marginTop: 40, padding: '20px 24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          DealScope aggregates publicly listed businesses for sale across the UK. Data refreshed daily.
          Listings sourced from {stats.sources} platforms. Not financial advice.
        </p>
      </footer>
    </div>
  );
}
