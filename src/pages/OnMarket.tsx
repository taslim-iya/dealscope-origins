import { useState } from 'react';
import {
  Globe, Plus, Trash2, ExternalLink, Sparkles, Loader2, Search, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useOnMarketStore, type OnMarketDeal, type ScrapeSource } from '@/lib/onMarketStore';
import { useSettingsStore } from '@/lib/settingsStore';
import AppLayout from '@/components/layout/AppLayout';

function genId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36); }

const emptyDeal = {
  companyName: '', description: '', industry: '', location: '',
  askingPrice: null as number | null, revenue: null as number | null,
  sourceUrl: '', sourceName: 'Manual',
};

export default function OnMarket() {
  const { toast } = useToast();
  const store = useOnMarketStore();
  const settings = useSettingsStore((s) => s.settings);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [dealForm, setDealForm] = useState(emptyDeal);
  const [sourceForm, setSourceForm] = useState({ name: '', url: '' });
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleAddDeal = () => {
    if (!dealForm.companyName.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    store.addDeal({
      id: genId(), ...dealForm, status: 'new', aiSummary: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    setDealForm(emptyDeal);
    setShowAddDeal(false);
    toast({ title: 'Deal added' });
  };

  const handleAddSource = () => {
    if (!sourceForm.name || !sourceForm.url) return;
    store.addSource({
      id: genId(), name: sourceForm.name, url: sourceForm.url,
      enabled: true, isBuiltIn: false, lastScrapedAt: null,
    });
    setSourceForm({ name: '', url: '' });
    setShowAddSource(false);
    toast({ title: 'Source added' });
  };

  const handleAISummary = async (deal: OnMarketDeal) => {
    if (!settings.aiApiKey) {
      toast({ title: 'API key required', description: 'Set your AI API key in Settings.', variant: 'destructive' });
      return;
    }
    setAiLoading(deal.id);
    try {
      const prompt = `Provide a brief M&A analysis of this business listing:
Company: ${deal.companyName}
Industry: ${deal.industry}
Location: ${deal.location}
Asking Price: ${deal.askingPrice ? `£${deal.askingPrice.toLocaleString()}` : 'Not specified'}
Revenue: ${deal.revenue ? `£${deal.revenue.toLocaleString()}` : 'Not specified'}
Description: ${deal.description}

Provide: 1) Key strengths 2) Risks 3) Valuation assessment 4) Recommendation. Keep concise (200 words max).`;

      const isOpenAI = settings.aiProvider === 'openai';
      const url = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages';
      const body = isOpenAI
        ? { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }
        : { model: 'claude-sonnet-4-20250514', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isOpenAI) headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
      else { headers['x-api-key'] = settings.aiApiKey; headers['anthropic-version'] = '2023-06-01'; }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      const text = isOpenAI ? data.choices?.[0]?.message?.content : data.content?.[0]?.text;
      if (text) {
        store.updateDeal(deal.id, { aiSummary: text });
        toast({ title: 'AI Summary generated' });
      }
    } catch {
      toast({ title: 'AI Summary failed', variant: 'destructive' });
    }
    setAiLoading(null);
  };

  const filtered = store.deals
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return d.companyName.toLowerCase().includes(q) || d.industry.toLowerCase().includes(q) || d.location.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const va = (a as unknown as Record<string, unknown>)[sortField];
      const vb = (b as unknown as Record<string, unknown>)[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortDir === 'desc' ? 1 : -1;
      if (va > vb) return sortDir === 'desc' ? -1 : 1;
      return 0;
    });

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const formatPrice = (v: number | null) => v == null ? '—' : `£${v.toLocaleString()}`;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>On-Market Deals</h1>
              <p className="text-sm mt-1" style={{ color: '#596880' }}>{store.deals.length} deals tracked</p>
            </div>
            <Button onClick={() => setShowAddDeal(true)} className="gap-2" style={{ background: '#635BFF', color: 'white' }}>
              <Plus className="h-4 w-4" /> Add Deal
            </Button>
          </div>
        </div>

        <div className="p-8">
          <Tabs defaultValue="deals">
            <TabsList>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>

            <TabsContent value="deals" className="mt-4">
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
                  <Input placeholder="Search deals..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-sm" style={{ borderColor: '#E3E8EE' }} />
                </div>
              </div>

              {filtered.length === 0 ? (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardContent className="p-8 text-center">
                    <Globe className="h-10 w-10 mx-auto mb-3" style={{ color: '#E3E8EE' }} />
                    <p className="text-sm" style={{ color: '#596880' }}>No on-market deals yet. Add one manually or configure sources.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <table className="w-full bg-white">
                    <thead>
                      <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E3E8EE' }}>
                        {[
                          { key: 'companyName', label: 'Company' },
                          { key: 'industry', label: 'Industry' },
                          { key: 'location', label: 'Location' },
                          { key: 'askingPrice', label: 'Asking Price' },
                          { key: 'revenue', label: 'Revenue' },
                          { key: 'status', label: 'Status' },
                        ].map((col) => (
                          <th key={col.key} className="px-4 py-3 text-left">
                            <button onClick={() => handleSort(col.key)}
                              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                              style={{ color: '#596880' }}>
                              {col.label} <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#596880' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((deal) => (
                        <tr key={deal.id} style={{ borderBottom: '1px solid #E3E8EE' }} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#0A2540' }}>{deal.companyName}</p>
                              {deal.sourceUrl && (
                                <a href={deal.sourceUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-xs inline-flex items-center gap-1 hover:underline" style={{ color: '#635BFF' }}>
                                  {deal.sourceName} <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#596880' }}>{deal.industry || '—'}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#596880' }}>{deal.location || '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: '#0A2540' }}>{formatPrice(deal.askingPrice)}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#0A2540' }}>{formatPrice(deal.revenue)}</td>
                          <td className="px-4 py-3">
                            <Select value={deal.status} onValueChange={(v) => store.updateDeal(deal.id, { status: v as OnMarketDeal['status'] })}>
                              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['new', 'reviewed', 'contacted', 'passed'].map((s) => (
                                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleAISummary(deal)}
                                disabled={aiLoading === deal.id}>
                                {aiLoading === deal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => store.deleteDeal(deal.id)}>
                                <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Summaries */}
              {filtered.filter((d) => d.aiSummary).length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: '#0A2540' }}>AI Summaries</h3>
                  {filtered.filter((d) => d.aiSummary).map((deal) => (
                    <Card key={deal.id} className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-2" style={{ color: '#0A2540' }}>{deal.companyName}</h4>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#596880' }}>{deal.aiSummary}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sources" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold" style={{ color: '#0A2540' }}>Scrape Sources</h3>
                <Button variant="outline" size="sm" onClick={() => setShowAddSource(true)} style={{ borderColor: '#E3E8EE' }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Source
                </Button>
              </div>
              <div className="space-y-3">
                {store.sources.map((source) => (
                  <Card key={source.id} className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5" style={{ color: '#635BFF' }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium" style={{ color: '#0A2540' }}>{source.name}</h4>
                            {source.isBuiltIn && <Badge variant="secondary" className="text-xs">Coming Soon</Badge>}
                          </div>
                          <a href={source.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs hover:underline" style={{ color: '#635BFF' }}>
                            {source.url}
                          </a>
                        </div>
                      </div>
                      {!source.isBuiltIn && (
                        <Button variant="ghost" size="sm" onClick={() => store.deleteSource(source.id)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Deal Dialog */}
        <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add On-Market Deal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Company Name *</Label><Input value={dealForm.companyName} onChange={(e) => setDealForm({ ...dealForm, companyName: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Industry</Label><Input value={dealForm.industry} onChange={(e) => setDealForm({ ...dealForm, industry: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={dealForm.location} onChange={(e) => setDealForm({ ...dealForm, location: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Asking Price (£)</Label><Input type="number" value={dealForm.askingPrice ?? ''} onChange={(e) => setDealForm({ ...dealForm, askingPrice: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Revenue (£)</Label><Input type="number" value={dealForm.revenue ?? ''} onChange={(e) => setDealForm({ ...dealForm, revenue: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div><Label>Source URL</Label><Input value={dealForm.sourceUrl} onChange={(e) => setDealForm({ ...dealForm, sourceUrl: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={dealForm.description} onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })} rows={3} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDeal(false)}>Cancel</Button>
              <Button onClick={handleAddDeal} style={{ background: '#635BFF', color: 'white' }}>Add Deal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Source Dialog */}
        <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Scrape Source</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} /></div>
              <div><Label>URL</Label><Input value={sourceForm.url} onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSource(false)}>Cancel</Button>
              <Button onClick={handleAddSource} style={{ background: '#635BFF', color: 'white' }}>Add Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
