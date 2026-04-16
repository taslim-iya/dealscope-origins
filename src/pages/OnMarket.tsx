import { useState, useEffect, useMemo } from 'react';
import {
  Globe, RefreshCw, ExternalLink, Search, ArrowUpDown, Filter,
  Building2, MapPin, PoundSterling, Clock, ChevronDown, Star, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOnMarketStore } from '@/lib/onMarketStore';
import AppLayout from '@/components/layout/AppLayout';

interface ScrapedListing {
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
  listings: ScrapedListing[];
}

const SOURCE_COLORS: Record<string, string> = {
  hiltonsmythe: '#1E3A5F',
  smergers: '#6366F1',
  flippa: '#059669',
  intelligent: '#D97706',
  daltons: '#2563EB',
  rightbiz: '#10B981',
  businessesforsale: '#F97316',
  nationwidebusinesses: '#374151',
  bizdaq: '#0EA5E9',
};

const SOURCE_INFO: Record<string, { name: string; emoji: string; url: string; estimate: string }> = {
  rightbiz: { name: 'Rightbiz', emoji: '🟢', url: 'https://www.rightbiz.co.uk/businesses-for-sale', estimate: '10,000+' },
  daltons: { name: 'Daltons Business', emoji: '🔵', url: 'https://www.daltonsbusiness.com/buy/business-for-sale', estimate: '20,000+' },
  businessesforsale: { name: 'BusinessesForSale.com', emoji: '🟠', url: 'https://uk.businessesforsale.com/uk/search/businesses-for-sale', estimate: '13,600+' },
  businesssale: { name: 'Business Sale Report', emoji: '🟣', url: 'https://www.business-sale.com/businesses-for-sale', estimate: '5,000+' },
  dealopportunities: { name: 'Deal Opportunities', emoji: '🟡', url: 'https://www.dealopportunities.co.uk', estimate: '500+' },
  bizdaq: { name: 'Bizdaq', emoji: '🔷', url: 'https://www.bizdaq.com/businesses-for-sale', estimate: '3,000+' },
  hiltonsmythe: { name: 'Hilton Smythe', emoji: '🏛️', url: 'https://www.hiltonsmythe.com/businesses-for-sale/', estimate: '200+' },
  smergers: { name: 'SMERGERS', emoji: '🤖', url: 'https://www.smergers.com/businesses-for-sale-and-investment-in-uk/c83b/', estimate: '400+' },
  flippa: { name: 'Flippa', emoji: '💻', url: 'https://flippa.com/online-businesses-united-kingdom', estimate: '1,000+' },
  intelligent: { name: 'Intelligent', emoji: '🧠', url: 'https://www.intelligent.co.uk/businesses-for-sale', estimate: '286' },
  nationwidebusinesses: { name: 'Nationwide Businesses', emoji: '🏴', url: 'https://www.nationwidebusinesses.co.uk', estimate: '500+' },
  businessbuyers: { name: 'Business Buyers', emoji: '🤝', url: 'https://www.businessbuyers.co.uk', estimate: '300+' },
  transworld: { name: 'Transworld', emoji: '🌍', url: 'https://www.tworld.com/locations/united-kingdom/', estimate: '100+' },
  buymybiz: { name: 'BuyMyBiz', emoji: '💼', url: 'https://www.buymybiz.co.uk', estimate: '150+' },
  bizquest: { name: 'BizQuest', emoji: '🔍', url: 'https://www.bizquest.com/businesses-for-sale-in-united-kingdom/', estimate: '200+' },
  sovereign: { name: 'Sovereign BT', emoji: '👑', url: 'https://www.sovereignbt.co.uk/businesses-for-sale/', estimate: '50+' },
  hornblower: { name: 'Hornblower', emoji: '📯', url: 'https://hornblower-businesses.co.uk/businesses-for-sale/', estimate: '30+' },
  sellingmybusiness: { name: 'SellingMyBusiness', emoji: '🏷️', url: 'https://www.sellingmybusiness.co.uk/buy-a-business', estimate: '800+' },
  cogogo: { name: 'Cogogo', emoji: '🚀', url: 'https://letscogogo.com/businesses-for-sale/', estimate: '200+' },
  mybizdaq: { name: 'MyBizdaq', emoji: '📊', url: 'https://www.mybizdaq.com/businesses-for-sale', estimate: '1,155' },
  christie: { name: 'Christie & Co', emoji: '🏨', url: 'https://www.christie.com/businesses-for-sale/', estimate: '500+' },
  blacksbrokers: { name: 'Blacks Brokers', emoji: '⬛', url: 'https://www.blacksbrokers.com/', estimate: '100+' },
};

export default function OnMarket() {
  const { toast } = useToast();
  const [listings, setListings] = useState<ScrapedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'title' | 'source' | 'price'>('source');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('ds-saved-listings') || '[]'));
    } catch { return new Set(); }
  });

  useEffect(() => {
    loadListings();
  }, []);

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
    } catch (e) {
      toast({ title: 'Failed to load listings', variant: 'destructive' });
    }
    setLoading(false);
  };

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('ds-saved-listings', JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = useMemo(() => {
    let items = [...listings];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (l) => l.title.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q)
      );
    }
    if (sourceFilter !== 'all') {
      items = items.filter((l) => l.sourceId === sourceFilter);
    }
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'source') cmp = a.source.localeCompare(b.source);
      else if (sortField === 'price') {
        const pa = parseFloat((a.price || '0').replace(/[^0-9.]/g, '')) || 0;
        const pb = parseFloat((b.price || '0').replace(/[^0-9.]/g, '')) || 0;
        cmp = pa - pb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [listings, search, sourceFilter, sortField, sortDir]);

  const activeSources = Object.entries(sourceCounts).filter(([_, c]) => c > 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">On-Market Businesses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live listings scraped from UK business marketplace sites.
            {scrapedAt && (
              <> Last updated: {new Date(scrapedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
        </div>

        {/* Source Cards */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" /> Sources ({Object.keys(SOURCE_INFO).length} UK marketplaces)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(SOURCE_INFO).map(([id, info]) => {
              const count = sourceCounts[id] || 0;
              const hasListings = count > 0;
              return (
                <a key={id} href={info.url} target="_blank" rel="noopener noreferrer"
                  className={`group relative rounded-lg border p-3 transition-all hover:shadow-md ${
                    hasListings ? 'bg-card border-border' : 'bg-muted/30 border-dashed border-muted-foreground/20'
                  }`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-lg">{info.emoji}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs font-semibold truncate">{info.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {hasListings ? (
                      <span className="text-green-600 font-medium">{count} scraped</span>
                    ) : (
                      <span>{info.estimate} est. (CF blocked)</span>
                    )}
                  </p>
                </a>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search listings..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {activeSources.map(([id, count]) => (
                <SelectItem key={id} value={id}>
                  {SOURCE_INFO[id]?.emoji || '📋'} {SOURCE_INFO[id]?.name || id} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={(v) => setSortField(v as any)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="title">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            <ChevronDown className={`h-4 w-4 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{savedIds.size} saved</span>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((listing) => (
              <Card key={listing.id} className="group hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Source badge */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${SOURCE_COLORS[listing.sourceId] || '#374151'}15` }}>
                      {SOURCE_INFO[listing.sourceId]?.emoji || '📋'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{listing.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] py-0"
                              style={{ borderColor: SOURCE_COLORS[listing.sourceId] || '#374151', color: SOURCE_COLORS[listing.sourceId] || '#374151' }}>
                              {listing.source}
                            </Badge>
                            {listing.location && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{listing.location}
                              </span>
                            )}
                            {listing.industry && (
                              <span className="text-xs text-muted-foreground">{listing.industry}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {listing.price && (
                            <p className="font-bold text-sm">{listing.price}</p>
                          )}
                          {(listing as any).revenue && (
                            <p className="text-xs text-muted-foreground">Rev: {(listing as any).revenue}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toggleSave(listing.id)}>
                        <Star className={`h-4 w-4 ${savedIds.has(listing.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                      </Button>
                      <a href={listing.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Browse Sources CTA */}
        <div className="rounded-lg border border-dashed p-6 text-center">
          <h3 className="font-semibold mb-2">Browse Directly</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Some major sites block automated scraping. Visit them directly for the full catalogue.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(SOURCE_INFO)
              .filter(([id]) => !sourceCounts[id])
              .map(([id, info]) => (
                <a key={id} href={info.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    {info.emoji} {info.name}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
