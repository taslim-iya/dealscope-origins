import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe, RefreshCw, ExternalLink, Search, ArrowUpDown, Filter, X,
  Building2, MapPin, PoundSterling, ChevronDown, ChevronRight, ChevronUp,
  Star, Eye, MessageSquare, Send, Loader2, Download, Columns,
  ArrowDown, ArrowUp, SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';

// ─── Types ───
interface Listing {
  id: string;
  title: string;
  price: string | null;
  revenue?: string | null;
  location: string;
  industry: string;
  source: string;
  sourceId: string;
  url: string;
  sourceUrl: string;
}

interface ListingsData {
  total: number;
  sources: Record<string, number>;
  scrapedAt: string;
  listings: Listing[];
}

// ─── Column config (Excel-like) ───
type ColKey = 'title' | 'price' | 'location' | 'industry' | 'source';
interface ColDef { key: ColKey; label: string; width: number; sortable: boolean; }

const DEFAULT_COLS: ColDef[] = [
  { key: 'title', label: 'Business Name', width: 320, sortable: true },
  { key: 'price', label: 'Asking Price', width: 140, sortable: true },
  { key: 'location', label: 'Location', width: 160, sortable: true },
  { key: 'industry', label: 'Sector', width: 160, sortable: true },
  { key: 'source', label: 'Source', width: 150, sortable: true },
];

const SOURCE_COLOR: Record<string, string> = {
  hiltonsmythe: '#1E3A5F', smergers: '#6366F1', flippa: '#059669',
  intelligent: '#D97706', daltons: '#2563EB', rightbiz: '#10B981',
  businessesforsale: '#F97316', sovereign: '#7C3AED', hornblower: '#0E7490',
  sellingmybusiness: '#DC2626', cogogo: '#EA580C', mybizdaq: '#0EA5E9',
  christie: '#B45309', nationwidebusinesses: '#374151',
};

function parsePrice(p: string | null): number {
  if (!p) return 0;
  const clean = p.replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
}

// ─── Endole-style Detail Panel ───
function DetailPanel({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
      background: '#fff', borderLeft: '1px solid #E3E8EE',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', zIndex: 50,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #E3E8EE',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1A1F36' }}>Company Details</h3>
        <button onClick={onClose} style={{ color: '#697386', cursor: 'pointer', background: 'none', border: 'none' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1F36', marginBottom: 4, lineHeight: 1.3 }}>
            {listing.title}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <Badge variant="outline" style={{
              borderColor: SOURCE_COLOR[listing.sourceId] || '#697386',
              color: SOURCE_COLOR[listing.sourceId] || '#697386',
              fontSize: 11,
            }}>
              {listing.source}
            </Badge>
            {listing.location && (
              <span style={{ fontSize: 12, color: '#697386', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} />{listing.location}
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics - Endole style */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24,
        }}>
          {[
            { label: 'Asking Price', value: listing.price || 'POA', color: '#1A1F36' },
            { label: 'Revenue', value: listing.revenue || '—', color: '#697386' },
            { label: 'Location', value: listing.location || '—', color: '#697386' },
            { label: 'Sector', value: listing.industry || '—', color: '#697386' },
          ].map(m => (
            <div key={m.label} style={{
              padding: '12px 14px', background: '#F6F9FC', borderRadius: 8,
              border: '1px solid #E3E8EE',
            }}>
              <p style={{ fontSize: 11, color: '#697386', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {m.label}
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: m.color, marginTop: 4 }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Source info */}
        <div style={{
          padding: '14px 16px', background: '#F6F9FC', borderRadius: 8,
          border: '1px solid #E3E8EE', marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#697386', fontWeight: 500, textTransform: 'uppercase', marginBottom: 8 }}>
            Listed On
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1F36' }}>{listing.source}</span>
            <a href={listing.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#635BFF', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View Original <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '14px 20px', borderTop: '1px solid #E3E8EE',
        display: 'flex', gap: 8,
      }}>
        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
          <Button className="w-full" style={{ background: '#635BFF', color: '#fff', border: 'none' }}>
            <ExternalLink size={14} /> View on {listing.source}
          </Button>
        </a>
      </div>
    </div>
  );
}

// ─── AI Chat Panel ───
function AIChatPanel({ listings, onFilter }: { listings: Listing[]; onFilter: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const query = input.trim().toLowerCase();
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    setLoading(true);

    // Local NLP search — no API needed
    setTimeout(() => {
      const terms = query.split(/\s+/);
      const matches = listings.filter(l => {
        const text = `${l.title} ${l.location} ${l.industry} ${l.source} ${l.price || ''}`.toLowerCase();
        return terms.every(t => text.includes(t));
      });

      let response = '';
      if (matches.length === 0) {
        response = `No businesses found matching "${input}". Try broader terms like "restaurant", "Manchester", or "under £100,000".`;
      } else if (matches.length <= 5) {
        response = `Found ${matches.length} matching businesses:\n\n${matches.map(m => `• **${m.title}** — ${m.price || 'POA'} (${m.source})`).join('\n')}`;
        onFilter(matches.map(m => m.id));
      } else {
        response = `Found ${matches.length} businesses matching "${input}". Showing them in the table now.`;
        onFilter(matches.map(m => m.id));
      }

      setMessages(prev => [...prev, { role: 'ai', text: response }]);
      setLoading(false);
    }, 300);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 20, right: 20, width: 48, height: 48,
        borderRadius: '50%', background: '#635BFF', color: '#fff', border: 'none',
        boxShadow: '0 4px 12px rgba(99,91,255,0.3)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
      }}>
        <MessageSquare size={20} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 380, height: 480,
      background: '#fff', borderRadius: 12, border: '1px solid #E3E8EE',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 40,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', background: '#635BFF', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Search by AI</span>
        <button onClick={() => setOpen(false)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12, color: '#697386', textAlign: 'center', marginTop: 20 }}>
            Try: "restaurants in Manchester under £100k" or "tech businesses" or "freehold"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 8, padding: '8px 12px', borderRadius: 8,
            background: m.role === 'user' ? '#635BFF' : '#F6F9FC',
            color: m.role === 'user' ? '#fff' : '#1A1F36',
            fontSize: 13, lineHeight: 1.5, maxWidth: '85%',
            marginLeft: m.role === 'user' ? 'auto' : 0,
            whiteSpace: 'pre-wrap',
          }}>
            {m.text}
          </div>
        ))}
        {loading && <Loader2 size={16} className="animate-spin" style={{ color: '#697386', margin: '8px auto' }} />}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #E3E8EE', display: 'flex', gap: 8 }}>
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Search businesses..."
          style={{ fontSize: 13 }} />
        <Button size="icon" onClick={handleSend} style={{ background: '#635BFF', color: '#fff', flexShrink: 0 }}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function OnMarket() {
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});

  // Table state
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortCol, setSortCol] = useState<ColKey>('source');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds-saved-listings') || '[]')); }
    catch { return new Set(); }
  });
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { loadListings(); }, []);

  const loadListings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/data/listings.json');
      if (res.ok) {
        const data: ListingsData = await res.json();
        setListings(data.listings);
        setScrapedAt(data.scrapedAt);
        setSourceCounts(data.sources);
      }
    } catch { toast({ title: 'Failed to load', variant: 'destructive' }); }
    setLoading(false);
  };

  const toggleSave = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('ds-saved-listings', JSON.stringify([...next]));
      return next;
    });
  };

  const handleSort = (col: ColKey) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // Deduplicate by normalized title
  const deduped = useMemo(() => {
    const seen = new Map<string, Listing>();
    for (const l of listings) {
      const key = l.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (!seen.has(key)) seen.set(key, l);
    }
    return [...seen.values()];
  }, [listings]);

  const filtered = useMemo(() => {
    let items = [...deduped];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(l =>
        `${l.title} ${l.location} ${l.industry} ${l.source} ${l.price || ''}`.toLowerCase().includes(q)
      );
    }
    if (sourceFilter !== 'all') items = items.filter(l => l.sourceId === sourceFilter);
    if (filteredIds) items = items.filter(l => filteredIds.includes(l.id));

    items.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'price') cmp = parsePrice(a.price) - parsePrice(b.price);
      else cmp = (a[sortCol] || '').localeCompare(b[sortCol] || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [deduped, search, sourceFilter, sortCol, sortDir, filteredIds]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const activeSources = Object.entries(sourceCounts).filter(([_, c]) => c > 0);
  const selectedListing = selectedId ? listings.find(l => l.id === selectedId) : null;

  const exportCSV = () => {
    const header = 'Name,Price,Location,Sector,Source,URL';
    const rows = filtered.map(l => `"${l.title}","${l.price || ''}","${l.location}","${l.industry}","${l.source}","${l.url}"`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dealscope-listings.csv'; a.click();
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 'none' }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1F36' }}>On-Market</h1>
            <p style={{ fontSize: 12, color: '#697386', marginTop: 2 }}>
              {filtered.length} businesses from {activeSources.length} sources
              {scrapedAt && <> · Updated {new Date(scrapedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {filteredIds && (
              <Button variant="outline" size="sm" onClick={() => setFilteredIds(null)} style={{ fontSize: 12 }}>
                <X size={12} /> Clear AI filter
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV} style={{ fontSize: 12 }}>
              <Download size={12} /> Export CSV
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center',
          padding: '8px 12px', background: '#fff', borderRadius: 8,
          border: '1px solid #E3E8EE',
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#697386' }} />
            <Input placeholder="Filter businesses..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ paddingLeft: 32, fontSize: 13, height: 34, border: '1px solid #E3E8EE' }} />
          </div>
          <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(0); }}>
            <SelectTrigger style={{ width: 170, height: 34, fontSize: 12 }}>
              <Filter size={12} className="mr-1" />
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources ({deduped.length})</SelectItem>
              {activeSources.map(([id, count]) => (
                <SelectItem key={id} value={id}>{id} ({count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Excel-like table */}
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #E3E8EE',
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: '#697386', margin: '0 auto' }} />
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{
                display: 'flex', borderBottom: '2px solid #E3E8EE',
                background: '#F6F9FC', userSelect: 'none',
              }}>
                <div style={{ width: 36, flexShrink: 0, padding: '8px 4px', textAlign: 'center' }}>
                  <Star size={12} style={{ color: '#C4C9D2' }} />
                </div>
                {cols.map(col => (
                  <div key={col.key} onClick={() => col.sortable && handleSort(col.key)}
                    style={{
                      width: col.width, flexShrink: 0, padding: '8px 12px',
                      fontSize: 11, fontWeight: 600, color: '#697386',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      cursor: col.sortable ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: 4,
                      borderRight: '1px solid #E3E8EE',
                    }}>
                    {col.label}
                    {sortCol === col.key && (
                      sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    )}
                  </div>
                ))}
                <div style={{ width: 60, flexShrink: 0, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#697386' }}>
                  Link
                </div>
              </div>

              {/* Table rows */}
              {paged.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#697386' }}>
                  <Building2 size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <p style={{ fontSize: 13, fontWeight: 500 }}>No businesses found</p>
                </div>
              ) : (
                paged.map((listing, i) => (
                  <div key={listing.id}
                    onClick={() => setSelectedId(listing.id === selectedId ? null : listing.id)}
                    style={{
                      display: 'flex', borderBottom: '1px solid #E3E8EE',
                      cursor: 'pointer', transition: 'background 0.1s',
                      background: selectedId === listing.id ? '#F0F0FF' : i % 2 === 0 ? '#fff' : '#FAFBFC',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = selectedId === listing.id ? '#F0F0FF' : i % 2 === 0 ? '#fff' : '#FAFBFC')}
                  >
                    {/* Star */}
                    <div style={{ width: 36, flexShrink: 0, padding: '8px 4px', textAlign: 'center' }}
                      onClick={e => { e.stopPropagation(); toggleSave(listing.id); }}>
                      <Star size={13} style={{
                        color: savedIds.has(listing.id) ? '#EAB308' : '#D1D5DB',
                        fill: savedIds.has(listing.id) ? '#EAB308' : 'none',
                        cursor: 'pointer',
                      }} />
                    </div>

                    {/* Title */}
                    <div style={{
                      width: cols[0].width, flexShrink: 0, padding: '8px 12px',
                      fontSize: 13, fontWeight: 500, color: '#1A1F36',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      borderRight: '1px solid #F0F0F0',
                    }}>
                      {listing.title}
                    </div>

                    {/* Price */}
                    <div style={{
                      width: cols[1].width, flexShrink: 0, padding: '8px 12px',
                      fontSize: 13, fontWeight: 600, color: listing.price ? '#1A1F36' : '#C4C9D2',
                      fontFamily: 'JetBrains Mono, monospace',
                      borderRight: '1px solid #F0F0F0',
                    }}>
                      {listing.price || '—'}
                    </div>

                    {/* Location */}
                    <div style={{
                      width: cols[2].width, flexShrink: 0, padding: '8px 12px',
                      fontSize: 12, color: '#697386',
                      borderRight: '1px solid #F0F0F0',
                    }}>
                      {listing.location || '—'}
                    </div>

                    {/* Industry */}
                    <div style={{
                      width: cols[3].width, flexShrink: 0, padding: '8px 12px',
                      fontSize: 12, color: '#697386',
                      borderRight: '1px solid #F0F0F0',
                    }}>
                      {listing.industry || '—'}
                    </div>

                    {/* Source */}
                    <div style={{
                      width: cols[4].width, flexShrink: 0, padding: '8px 12px',
                      borderRight: '1px solid #F0F0F0',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                        background: `${SOURCE_COLOR[listing.sourceId] || '#697386'}10`,
                        color: SOURCE_COLOR[listing.sourceId] || '#697386',
                      }}>
                        {listing.source}
                      </span>
                    </div>

                    {/* External link */}
                    <div style={{ width: 60, flexShrink: 0, padding: '8px 4px', textAlign: 'center' }}
                      onClick={e => e.stopPropagation()}>
                      <a href={listing.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#635BFF' }}>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px', borderTop: '1px solid #E3E8EE', background: '#F6F9FC',
                }}>
                  <span style={{ fontSize: 12, color: '#697386' }}>
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      style={{ fontSize: 11, height: 28 }}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                      style={{ fontSize: 11, height: 28 }}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sources summary bar */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12,
          padding: '10px 12px', background: '#fff', borderRadius: 8,
          border: '1px solid #E3E8EE',
        }}>
          <span style={{ fontSize: 11, color: '#697386', fontWeight: 500, marginRight: 8, lineHeight: '24px' }}>Sources:</span>
          {Object.entries(sourceCounts).filter(([_, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([id, count]) => (
            <button key={id} onClick={() => { setSourceFilter(sourceFilter === id ? 'all' : id); setPage(0); }}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                border: `1px solid ${sourceFilter === id ? SOURCE_COLOR[id] || '#697386' : '#E3E8EE'}`,
                background: sourceFilter === id ? `${SOURCE_COLOR[id] || '#697386'}10` : '#fff',
                color: SOURCE_COLOR[id] || '#697386', cursor: 'pointer',
              }}>
              {id} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selectedListing && <DetailPanel listing={selectedListing} onClose={() => setSelectedId(null)} />}

      {/* AI Chat */}
      <AIChatPanel listings={deduped} onFilter={ids => { setFilteredIds(ids); setPage(0); }} />
    </AppLayout>
  );
}
