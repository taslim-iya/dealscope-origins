import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Send, Globe, RefreshCw, Upload, Loader2,
  ArrowRight, Plus, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  getDealFlowCompanies, getDealFlowConfig, syncFromDealFlow, importFromJsonFile,
  type DealFlowConfig, type DealFlowCompany,
} from '@/lib/dealflowService';
import { useClientStore } from '@/lib/clientStore';
import { useOutreachStore } from '@/lib/outreachStore';
import { useOnMarketStore } from '@/lib/onMarketStore';
import AppLayout from '@/components/layout/AppLayout';

const STAGES = ['new', 'reviewed', 'shortlisted', 'contacted', 'qualified', 'closed'];
const STAGE_COLORS: Record<string, string> = {
  new: '#3B82F6', reviewed: '#64748B', shortlisted: '#10B981',
  contacted: '#F59E0B', qualified: '#7C3AED', closed: '#EF4444',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const clients = useClientStore((s) => s.clients);
  const outreachItems = useOutreachStore((s) => s.items);
  const onMarketDeals = useOnMarketStore((s) => s.deals);

  const [companies, setCompanies] = useState<DealFlowCompany[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [dealFlowCfg] = useState<DealFlowConfig>(getDealFlowConfig());

  useEffect(() => {
    getDealFlowCompanies().then(setCompanies);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncFromDealFlow(dealFlowCfg);
      setCompanies(result);
      toast({ title: 'Sync complete!', description: `${result.length.toLocaleString()} companies pulled.` });
    } catch (err: unknown) {
      toast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);
    try {
      const result = await importFromJsonFile(file);
      setCompanies(result);
      toast({ title: 'Import complete!', description: `${result.length.toLocaleString()} companies loaded.` });
    } catch (err: unknown) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
    setSyncing(false);
    e.target.value = '';
  };

  const activeOutreach = outreachItems.filter((i) => i.status === 'pending' || i.status === 'sent').length;

  // Pipeline distribution
  const stageCounts = STAGES.map((stage) => ({
    stage,
    count: companies.filter((c) => (c.status || 'new') === stage).length,
  }));
  const maxStageCount = Math.max(...stageCounts.map((s) => s.count), 1);

  // Top clients
  const topClients = [...clients]
    .sort((a, b) => b.assignedCompanyIds.length - a.assignedCompanyIds.length)
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#0A2540' }}>Dashboard</h1>
              <p className="text-sm mt-1" style={{ color: '#596880' }}>Overview of your deal sourcing platform.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing || !dealFlowCfg.clientApiKey}
                className="gap-2" style={{ background: '#635BFF', color: 'white' }}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync from DealFlow
              </Button>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md text-sm font-medium px-4 py-2 border cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: '#E3E8EE', color: '#0A2540' }}>
                  <Upload className="h-4 w-4" /> Import JSON
                </span>
                <input type="file" accept=".json" className="hidden" onChange={handleJsonImport} disabled={syncing} />
              </label>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Companies', value: companies.length.toLocaleString(), icon: Building2, color: '#635BFF', path: '/companies' },
              { label: 'Total Clients', value: clients.length.toString(), icon: Users, color: '#A259FF', path: '/clients' },
              { label: 'Active Outreach', value: activeOutreach.toString(), icon: Send, color: '#10B981', path: '/outreach' },
              { label: 'On-Market Deals', value: onMarketDeals.length.toString(), icon: Globe, color: '#F59E0B', path: '/on-market' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="rounded-xl cursor-pointer hover:shadow-md transition-shadow"
                  style={{ border: '1px solid #E3E8EE' }}
                  onClick={() => navigate(stat.path)}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#596880' }}>{stat.label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#0A2540', letterSpacing: '-0.02em' }}>{stat.value}</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: stat.color + '10' }}>
                        <Icon className="h-5 w-5" style={{ color: stat.color }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Pipeline distribution */}
            <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                  <BarChart3 className="h-4 w-4" style={{ color: '#635BFF' }} />
                  Pipeline Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageCounts.map(({ stage, count }) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs font-medium capitalize w-20" style={{ color: '#596880' }}>{stage}</span>
                    <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${(count / maxStageCount) * 100}%`,
                          background: STAGE_COLORS[stage] || '#635BFF',
                          minWidth: count > 0 ? '24px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold w-8 text-right" style={{ color: '#0A2540' }}>{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top clients */}
            <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                    <Users className="h-4 w-4" style={{ color: '#A259FF' }} />
                    Top Clients
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="text-xs gap-1" style={{ color: '#635BFF' }}>
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {topClients.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: '#596880' }}>
                    No clients yet.{' '}
                    <button onClick={() => navigate('/clients')} className="underline" style={{ color: '#635BFF' }}>
                      Add your first client
                    </button>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topClients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#0A2540' }}>{client.name}</p>
                          <p className="text-xs" style={{ color: '#596880' }}>{client.company}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: '#635BFF' }}>
                          {client.assignedCompanyIds.length}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Browse Companies', desc: 'Search and filter your company database', icon: Building2, path: '/companies', color: '#635BFF' },
              { label: 'Add Client', desc: 'Create a new buyer client profile', icon: Plus, path: '/clients', color: '#A259FF' },
              { label: 'View Pipeline', desc: 'Drag & drop deal pipeline kanban', icon: BarChart3, path: '/pipeline', color: '#10B981' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.label} className="rounded-xl cursor-pointer hover:shadow-md transition-shadow"
                  style={{ border: '1px solid #E3E8EE' }}
                  onClick={() => navigate(action.path)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: action.color + '10' }}>
                        <Icon className="h-5 w-5" style={{ color: action.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#0A2540' }}>{action.label}</p>
                        <p className="text-xs" style={{ color: '#596880' }}>{action.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
