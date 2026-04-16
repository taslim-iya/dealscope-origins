import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Building2, Mail, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useClientStore, type Client } from '@/lib/clientStore';
import { getDealFlowCompanies, type DealFlowCompany } from '@/lib/dealflowService';
import { useSettingsStore } from '@/lib/settingsStore';
import AppLayout from '@/components/layout/AppLayout';

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const emptyClient: Omit<Client, 'id' | 'created_at' | 'updated_at'> = {
  name: '', company: '', email: '',
  searchCriteria: {
    industries: [], geographies: [], revenueMin: null, revenueMax: null,
    employeesMin: null, employeesMax: null, keywords: [], description: '',
  },
  assignedCompanyIds: [],
};

export default function Clients() {
  const { toast } = useToast();
  const { clients, addClient, updateClient, deleteClient, assignCompanies } = useClientStore();
  const settings = useSettingsStore((s) => s.settings);

  const [companies, setCompanies] = useState<DealFlowCompany[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Omit<Client, 'id' | 'created_at' | 'updated_at'>>(emptyClient);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<{ companyId: string; name: string; score: number; reason: string }[]>([]);

  useEffect(() => {
    getDealFlowCompanies().then(setCompanies);
  }, []);

  const handleSave = () => {
    if (!editingClient.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (editingId) {
      updateClient(editingId, editingClient);
      toast({ title: 'Client updated' });
    } else {
      const newClient: Client = {
        ...editingClient,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addClient(newClient);
      toast({ title: 'Client added' });
    }
    setShowForm(false);
    setEditingClient(emptyClient);
    setEditingId(null);
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setEditingClient({
      name: client.name, company: client.company, email: client.email,
      searchCriteria: { ...client.searchCriteria },
      assignedCompanyIds: client.assignedCompanyIds,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
    if (selectedClient?.id === id) setSelectedClient(null);
    toast({ title: 'Client deleted' });
  };

  const handleAIMatch = async () => {
    if (!selectedClient) return;
    if (!settings.aiApiKey) {
      toast({ title: 'API key required', description: 'Set your OpenAI/Claude API key in Settings.', variant: 'destructive' });
      return;
    }
    setMatching(true);
    try {
      const criteria = selectedClient.searchCriteria;
      const companySummaries = companies.slice(0, 200).map((c) => ({
        id: c.id, name: c.company_name, industry: c.industry, geography: c.geography,
        revenue: c.revenue, employees: c.employees,
      }));
      const prompt = `You are a deal sourcing AI. Score each company 0-100 on how well it matches this client's criteria.
Client search criteria:
- Industries: ${criteria.industries.join(', ') || 'any'}
- Geographies: ${criteria.geographies.join(', ') || 'any'}
- Revenue: ${criteria.revenueMin || 'no min'} to ${criteria.revenueMax || 'no max'}
- Employees: ${criteria.employeesMin || 'no min'} to ${criteria.employeesMax || 'no max'}
- Keywords: ${criteria.keywords.join(', ') || 'none'}
- Description: ${criteria.description || 'none'}

Companies (JSON):
${JSON.stringify(companySummaries)}

Return JSON array: [{"companyId":"...","name":"...","score":0-100,"reason":"..."}]
Only include companies with score > 50. Sort by score descending. Max 20 results.`;

      const isOpenAI = settings.aiProvider === 'openai';
      const url = isOpenAI
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages';

      const body = isOpenAI
        ? { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }
        : { model: 'claude-sonnet-4-20250514', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isOpenAI) headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
      else { headers['x-api-key'] = settings.aiApiKey; headers['anthropic-version'] = '2023-06-01'; }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();

      let text = '';
      if (isOpenAI) text = data.choices?.[0]?.message?.content || '';
      else text = data.content?.[0]?.text || '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        setMatchResults(results);
      }
    } catch (err) {
      toast({ title: 'AI matching failed', description: String(err), variant: 'destructive' });
    }
    setMatching(false);
  };

  const handleAutoAssign = (n: number) => {
    if (!selectedClient) return;
    const topIds = matchResults.slice(0, n).map((r) => r.companyId);
    assignCompanies(selectedClient.id, topIds);
    toast({ title: `Auto-assigned ${topIds.length} companies` });
    setMatchResults([]);
  };

  const assignedCompanies = selectedClient
    ? companies.filter((c) => selectedClient.assignedCompanyIds.includes(c.id))
    : [];

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>Clients</h1>
              <p className="text-sm mt-1" style={{ color: '#596880' }}>{clients.length} clients</p>
            </div>
            <Button onClick={() => { setEditingClient(emptyClient); setEditingId(null); setShowForm(true); }}
              className="gap-2" style={{ background: '#635BFF', color: 'white' }}>
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </div>
        </div>

        <div className="p-8 flex gap-6">
          {/* Client list */}
          <div className="w-80 flex-shrink-0 space-y-3">
            {clients.length === 0 ? (
              <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                <CardContent className="p-8 text-center">
                  <Users className="h-10 w-10 mx-auto mb-3" style={{ color: '#E3E8EE' }} />
                  <p className="text-sm" style={{ color: '#596880' }}>No clients yet. Add your first client.</p>
                </CardContent>
              </Card>
            ) : (
              clients.map((client) => (
                <Card
                  key={client.id}
                  className={`rounded-xl cursor-pointer transition-all hover:shadow-md ${selectedClient?.id === client.id ? 'ring-2' : ''}`}
                  style={{
                    border: '1px solid #E3E8EE',
                    ringColor: '#635BFF',
                  }}
                  onClick={() => { setSelectedClient(client); setMatchResults([]); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold" style={{ color: '#0A2540' }}>{client.name}</h3>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="p-1 rounded hover:bg-gray-100">
                          <Pencil className="h-3.5 w-3.5" style={{ color: '#596880' }} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="p-1 rounded hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: '#596880' }}>{client.company}</p>
                    <p className="text-xs" style={{ color: '#596880' }}>{client.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" /> {client.assignedCompanyIds.length} companies
                      </Badge>
                    </div>
                    {client.searchCriteria.description && (
                      <p className="text-xs mt-2 truncate" style={{ color: '#9CA3AF' }}>
                        {client.searchCriteria.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Client detail */}
          <div className="flex-1 min-w-0">
            {selectedClient ? (
              <div className="space-y-6">
                {/* Search criteria */}
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>
                      Search Criteria — {selectedClient.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedClient.searchCriteria.description && (
                      <p style={{ color: '#596880' }}>{selectedClient.searchCriteria.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium" style={{ color: '#0A2540' }}>Industries:</span>{' '}
                        <span style={{ color: '#596880' }}>{selectedClient.searchCriteria.industries.join(', ') || 'Any'}</span>
                      </div>
                      <div>
                        <span className="font-medium" style={{ color: '#0A2540' }}>Geographies:</span>{' '}
                        <span style={{ color: '#596880' }}>{selectedClient.searchCriteria.geographies.join(', ') || 'Any'}</span>
                      </div>
                      <div>
                        <span className="font-medium" style={{ color: '#0A2540' }}>Revenue:</span>{' '}
                        <span style={{ color: '#596880' }}>
                          {selectedClient.searchCriteria.revenueMin?.toLocaleString() || '—'} — {selectedClient.searchCriteria.revenueMax?.toLocaleString() || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium" style={{ color: '#0A2540' }}>Employees:</span>{' '}
                        <span style={{ color: '#596880' }}>
                          {selectedClient.searchCriteria.employeesMin || '—'} — {selectedClient.searchCriteria.employeesMax || '—'}
                        </span>
                      </div>
                    </div>
                    {selectedClient.searchCriteria.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedClient.searchCriteria.keywords.map((k) => (
                          <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleAIMatch} disabled={matching} className="gap-2"
                        style={{ background: '#635BFF', color: 'white' }}>
                        {matching ? <span className="animate-spin">⏳</span> : <Sparkles className="h-4 w-4" />}
                        AI Match
                      </Button>
                      {matchResults.length > 0 && (
                        <>
                          <Button variant="outline" onClick={() => handleAutoAssign(5)} style={{ borderColor: '#E3E8EE' }}>
                            Auto-Assign Top 5
                          </Button>
                          <Button variant="outline" onClick={() => handleAutoAssign(10)} style={{ borderColor: '#E3E8EE' }}>
                            Auto-Assign Top 10
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Match results */}
                {matchResults.length > 0 && (
                  <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                        <Sparkles className="h-4 w-4" style={{ color: '#635BFF' }} />
                        AI Match Results ({matchResults.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {matchResults.map((r) => (
                          <div key={r.companyId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                            <div>
                              <span className="text-sm font-medium" style={{ color: '#0A2540' }}>{r.name}</span>
                              <p className="text-xs" style={{ color: '#596880' }}>{r.reason}</p>
                            </div>
                            <Badge style={{ background: r.score > 80 ? '#ECFDF5' : r.score > 60 ? '#FFF7ED' : '#FEF2F2',
                              color: r.score > 80 ? '#10B981' : r.score > 60 ? '#F59E0B' : '#EF4444' }}>
                              {r.score}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Assigned companies */}
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>
                      Assigned Companies ({assignedCompanies.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {assignedCompanies.length === 0 ? (
                      <p className="text-sm py-4 text-center" style={{ color: '#596880' }}>
                        No companies assigned yet. Use AI Match or assign from the Companies table.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E3E8EE' }}>
                            <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Company</th>
                            <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Industry</th>
                            <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Geography</th>
                            <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedCompanies.map((c) => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #E3E8EE' }}>
                              <td className="py-2" style={{ color: '#635BFF' }}>{c.company_name}</td>
                              <td className="py-2" style={{ color: '#596880' }}>{c.industry || '—'}</td>
                              <td className="py-2" style={{ color: '#596880' }}>{c.geography || '—'}</td>
                              <td className="py-2" style={{ color: '#0A2540' }}>
                                {c.revenue ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(c.revenue) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-sm" style={{ color: '#596880' }}>Select a client to view details.</p>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Client' : 'Add Client'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={editingClient.name} onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })} />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={editingClient.company} onChange={(e) => setEditingClient({ ...editingClient, company: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={editingClient.email} onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })} />
              </div>
              <div>
                <Label>What are they looking for?</Label>
                <Textarea
                  value={editingClient.searchCriteria.description}
                  onChange={(e) => setEditingClient({
                    ...editingClient,
                    searchCriteria: { ...editingClient.searchCriteria, description: e.target.value },
                  })}
                  placeholder="e.g. Manufacturing businesses in the Midlands with £2-10m revenue..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Industries (comma-separated)</Label>
                  <Input
                    value={editingClient.searchCriteria.industries.join(', ')}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, industries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                    })}
                  />
                </div>
                <div>
                  <Label>Geographies (comma-separated)</Label>
                  <Input
                    value={editingClient.searchCriteria.geographies.join(', ')}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, geographies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min Revenue</Label>
                  <Input type="number" value={editingClient.searchCriteria.revenueMin ?? ''}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, revenueMin: e.target.value ? Number(e.target.value) : null },
                    })} />
                </div>
                <div>
                  <Label>Max Revenue</Label>
                  <Input type="number" value={editingClient.searchCriteria.revenueMax ?? ''}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, revenueMax: e.target.value ? Number(e.target.value) : null },
                    })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min Employees</Label>
                  <Input type="number" value={editingClient.searchCriteria.employeesMin ?? ''}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, employeesMin: e.target.value ? Number(e.target.value) : null },
                    })} />
                </div>
                <div>
                  <Label>Max Employees</Label>
                  <Input type="number" value={editingClient.searchCriteria.employeesMax ?? ''}
                    onChange={(e) => setEditingClient({
                      ...editingClient,
                      searchCriteria: { ...editingClient.searchCriteria, employeesMax: e.target.value ? Number(e.target.value) : null },
                    })} />
                </div>
              </div>
              <div>
                <Label>Keywords (comma-separated)</Label>
                <Input
                  value={editingClient.searchCriteria.keywords.join(', ')}
                  onChange={(e) => setEditingClient({
                    ...editingClient,
                    searchCriteria: { ...editingClient.searchCriteria, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} style={{ background: '#635BFF', color: 'white' }}>
                {editingId ? 'Update' : 'Add'} Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
