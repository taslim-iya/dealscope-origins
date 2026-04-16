import { useState, useEffect } from 'react';
import {
  Send, Plus, Pencil, Trash2, Mail, Eye, BarChart3, Users, FileText, Loader2, Search,
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
import { useOutreachStore, type EmailTemplate, type OutreachCampaign, type OutreachItem } from '@/lib/outreachStore';
import { useClientStore } from '@/lib/clientStore';
import { getDealFlowCompanies, type DealFlowCompany } from '@/lib/dealflowService';
import { enrichContacts } from '@/lib/enrichmentService';
import AppLayout from '@/components/layout/AppLayout';

function genId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36); }

export default function Outreach() {
  const { toast } = useToast();
  const store = useOutreachStore();
  const clients = useClientStore((s) => s.clients);
  const [companies, setCompanies] = useState<DealFlowCompany[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });
  const [campaignForm, setCampaignForm] = useState({ name: '', clientId: '', templateId: '' });
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [findingContacts, setFindingContacts] = useState(false);

  useEffect(() => { getDealFlowCompanies().then(setCompanies); }, []);

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.subject) return;
    store.addTemplate({
      id: genId(), ...templateForm, created_at: new Date().toISOString(),
    });
    setTemplateForm({ name: '', subject: '', body: '' });
    setShowTemplateForm(false);
    toast({ title: 'Template created' });
  };

  const handleCreateCampaign = () => {
    if (!campaignForm.name || !campaignForm.clientId || !campaignForm.templateId) return;
    const campaign: OutreachCampaign = {
      id: genId(), ...campaignForm, status: 'draft',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.addCampaign(campaign);

    // Create outreach items for assigned companies
    const client = clients.find((c) => c.id === campaignForm.clientId);
    const template = store.templates.find((t) => t.id === campaignForm.templateId);
    if (client && template) {
      const items: OutreachItem[] = client.assignedCompanyIds.map((companyId) => {
        const co = companies.find((c) => c.id === companyId);
        return {
          id: genId(), campaignId: campaign.id, companyId,
          companyName: co?.company_name || 'Unknown',
          contactName: co?.director_name || null,
          contactEmail: null,
          status: 'pending',
          personalizedSubject: template.subject.replace(/\{\{company_name\}\}/g, co?.company_name || ''),
          personalizedBody: template.body
            .replace(/\{\{company_name\}\}/g, co?.company_name || '')
            .replace(/\{\{contact_name\}\}/g, co?.director_name || '')
            .replace(/\{\{industry\}\}/g, co?.industry || ''),
          sentAt: null, openedAt: null, repliedAt: null,
        };
      });
      store.addItems(items);
    }

    setCampaignForm({ name: '', clientId: '', templateId: '' });
    setShowCampaignForm(false);
    setSelectedCampaign(campaign.id);
    toast({ title: 'Campaign created', description: `${client?.assignedCompanyIds.length || 0} outreach items queued.` });
  };

  const handleFindContacts = async (item: OutreachItem) => {
    const co = companies.find((c) => c.id === item.companyId);
    if (!co?.website) { toast({ title: 'No website', variant: 'destructive' }); return; }
    setFindingContacts(true);
    try {
      const domain = co.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const contacts = await enrichContacts(domain);
      if (contacts.length > 0) {
        const primary = contacts[0];
        store.updateItem(item.id, {
          contactName: [primary.first_name, primary.last_name].filter(Boolean).join(' ') || item.contactName,
          contactEmail: primary.email || item.contactEmail,
        });
        toast({ title: 'Contact found', description: `${primary.first_name} ${primary.last_name} — ${primary.email}` });
      } else {
        toast({ title: 'No contacts found', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Contact search failed', variant: 'destructive' });
    }
    setFindingContacts(false);
  };

  const handleMarkSent = (itemId: string) => {
    store.updateItem(itemId, { status: 'sent', sentAt: new Date().toISOString() });
  };

  const campaignItems = selectedCampaign ? store.items.filter((i) => i.campaignId === selectedCampaign) : [];
  const stats = {
    totalSent: store.items.filter((i) => i.status === 'sent').length,
    totalOpened: store.items.filter((i) => i.status === 'opened').length,
    totalReplied: store.items.filter((i) => i.status === 'replied').length,
    totalPending: store.items.filter((i) => i.status === 'pending').length,
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>Outreach</h1>
              <p className="text-sm mt-1" style={{ color: '#596880' }}>Manage email campaigns and track outreach.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTemplateForm(true)} style={{ borderColor: '#E3E8EE' }}>
                <FileText className="h-4 w-4 mr-2" /> New Template
              </Button>
              <Button onClick={() => setShowCampaignForm(true)} className="gap-2" style={{ background: '#635BFF', color: 'white' }}>
                <Plus className="h-4 w-4" /> New Campaign
              </Button>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Pending', value: stats.totalPending, color: '#596880' },
              { label: 'Sent', value: stats.totalSent, color: '#635BFF' },
              { label: 'Opened', value: stats.totalOpened, color: '#10B981' },
              { label: 'Replied', value: stats.totalReplied, color: '#F59E0B' },
            ].map((s) => (
              <Card key={s.label} className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium" style={{ color: '#596880' }}>{s.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="campaigns">
            <TabsList>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="queue">Queue</TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns" className="mt-4 space-y-3">
              {store.campaigns.length === 0 ? (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardContent className="p-8 text-center">
                    <Send className="h-10 w-10 mx-auto mb-3" style={{ color: '#E3E8EE' }} />
                    <p className="text-sm" style={{ color: '#596880' }}>No campaigns yet. Create one to start outreach.</p>
                  </CardContent>
                </Card>
              ) : (
                store.campaigns.map((c) => {
                  const items = store.items.filter((i) => i.campaignId === c.id);
                  const client = clients.find((cl) => cl.id === c.clientId);
                  return (
                    <Card key={c.id} className={`rounded-xl cursor-pointer transition-all hover:shadow-md ${selectedCampaign === c.id ? 'ring-2 ring-[#635BFF]' : ''}`}
                      style={{ border: '1px solid #E3E8EE' }}
                      onClick={() => setSelectedCampaign(c.id)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold" style={{ color: '#0A2540' }}>{c.name}</h3>
                          <p className="text-xs" style={{ color: '#596880' }}>
                            Client: {client?.name || '—'} · {items.length} contacts
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                          <button onClick={(e) => { e.stopPropagation(); store.deleteCampaign(c.id); }}
                            className="p-1 rounded hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Campaign queue detail */}
              {selectedCampaign && campaignItems.length > 0 && (
                <Card className="rounded-xl mt-4" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>
                      Outreach Queue ({campaignItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {campaignItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                          style={{ borderBottom: '1px solid #E3E8EE' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: '#0A2540' }}>{item.companyName}</p>
                            <p className="text-xs" style={{ color: '#596880' }}>
                              {item.contactName || 'No contact'} · {item.contactEmail || 'No email'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                            {!item.contactEmail && (
                              <Button variant="outline" size="sm" disabled={findingContacts}
                                onClick={() => handleFindContacts(item)} style={{ borderColor: '#E3E8EE' }}>
                                {findingContacts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                <span className="ml-1 text-xs">Find Contact</span>
                              </Button>
                            )}
                            {item.status === 'pending' && (
                              <Button variant="outline" size="sm" onClick={() => handleMarkSent(item.id)}
                                style={{ borderColor: '#E3E8EE' }}>
                                <Mail className="h-3 w-3 mr-1" /> Mark Sent
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="templates" className="mt-4 space-y-3">
              {store.templates.length === 0 ? (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: '#E3E8EE' }} />
                    <p className="text-sm" style={{ color: '#596880' }}>No templates yet.</p>
                  </CardContent>
                </Card>
              ) : (
                store.templates.map((t) => (
                  <Card key={t.id} className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold" style={{ color: '#0A2540' }}>{t.name}</h3>
                        <button onClick={() => store.deleteTemplate(t.id)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                        </button>
                      </div>
                      <p className="text-xs font-medium" style={{ color: '#596880' }}>Subject: {t.subject}</p>
                      <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: '#9CA3AF' }}>{t.body.substring(0, 200)}...</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="queue" className="mt-4">
              <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                <CardContent className="p-4">
                  {store.items.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: '#596880' }}>No outreach items yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E3E8EE' }}>
                          <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Company</th>
                          <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Contact</th>
                          <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Email</th>
                          <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Status</th>
                          <th className="text-left py-2 text-xs font-semibold uppercase" style={{ color: '#596880' }}>Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {store.items.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #E3E8EE' }}>
                            <td className="py-2" style={{ color: '#0A2540' }}>{item.companyName}</td>
                            <td className="py-2" style={{ color: '#596880' }}>{item.contactName || '—'}</td>
                            <td className="py-2" style={{ color: '#596880' }}>{item.contactEmail || '—'}</td>
                            <td className="py-2"><Badge variant="secondary" className="text-xs">{item.status}</Badge></td>
                            <td className="py-2" style={{ color: '#596880' }}>{item.sentAt ? new Date(item.sentAt).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Template dialog */}
        <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Email Template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Template Name</Label><Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
              <div><Label>Subject</Label><Input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Re: {{company_name}} — Acquisition Interest" /></div>
              <div><Label>Body</Label><Textarea value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                placeholder="Dear {{contact_name}},&#10;&#10;I'm reaching out regarding {{company_name}}..." rows={6} /></div>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Variables: {'{{company_name}}'}, {'{{contact_name}}'}, {'{{industry}}'}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateForm(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} style={{ background: '#635BFF', color: 'white' }}>Create Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Campaign dialog */}
        <Dialog open={showCampaignForm} onOpenChange={setShowCampaignForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Campaign Name</Label><Input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} /></div>
              <div>
                <Label>Client</Label>
                <Select value={campaignForm.clientId} onValueChange={(v) => setCampaignForm({ ...campaignForm, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={campaignForm.templateId} onValueChange={(v) => setCampaignForm({ ...campaignForm, templateId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {store.templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCampaignForm(false)}>Cancel</Button>
              <Button onClick={handleCreateCampaign} style={{ background: '#635BFF', color: 'white' }}>Create Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
