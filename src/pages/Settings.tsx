import { useState } from 'react';
import {
  Settings as SettingsIcon, Key, Brain, Download, Upload, Trash2, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSettingsStore } from '@/lib/settingsStore';
import { useClientStore } from '@/lib/clientStore';
import { useOutreachStore } from '@/lib/outreachStore';
import { useOnMarketStore } from '@/lib/onMarketStore';
import { getDealFlowCompanies, clearCompanies } from '@/lib/dealflowService';
import AppLayout from '@/components/layout/AppLayout';

export default function Settings() {
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const clientStore = useClientStore();
  const outreachStore = useOutreachStore();
  const onMarketStore = useOnMarketStore();

  const [apolloKey, setApolloKey] = useState(settings.apolloApiKey);
  const [aiKey, setAiKey] = useState(settings.aiApiKey);
  const [aiProvider, setAiProvider] = useState(settings.aiProvider);

  const handleSaveKeys = () => {
    updateSettings({ apolloApiKey: apolloKey, aiApiKey: aiKey, aiProvider });
    toast({ title: 'Settings saved' });
  };

  const handleExportAll = async () => {
    const companies = await getDealFlowCompanies();
    const data = {
      exportedAt: new Date().toISOString(),
      companies,
      clients: clientStore.clients,
      outreach: {
        templates: outreachStore.templates,
        campaigns: outreachStore.campaigns,
        items: outreachStore.items,
      },
      onMarket: {
        deals: onMarketStore.deals,
        sources: onMarketStore.sources,
      },
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealscope-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup exported' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.clients) {
          for (const c of data.clients) clientStore.addClient(c);
        }
        if (data.settings) {
          updateSettings(data.settings);
        }
        toast({ title: 'Import complete', description: 'Data restored from backup.' });
      } catch {
        toast({ title: 'Import failed', description: 'Invalid backup file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = async () => {
    await clearCompanies();
    // Reset Zustand stores
    localStorage.removeItem('dealscope-clients-v1');
    localStorage.removeItem('dealscope-outreach-v1');
    localStorage.removeItem('dealscope-onmarket-v1');
    localStorage.removeItem('dealscope-settings');
    localStorage.removeItem('dealscope-column-config');
    resetSettings();
    toast({ title: 'All data cleared', description: 'Refresh the page to reset completely.' });
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: '#596880' }}>Configure API keys, preferences, and manage data.</p>
        </div>

        <div className="p-8 max-w-2xl space-y-6">
          {/* API Keys */}
          <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                <Key className="h-4 w-4" style={{ color: '#635BFF' }} /> API Keys
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Enrichment API Key</Label>
                <Input value={apolloKey} onChange={(e) => setApolloKey(e.target.value)} type="password"
                  placeholder="Your enrichment API key" />
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Pre-configured. Used for company and contact enrichment.</p>
              </div>
              <div>
                <Label>AI API Key (OpenAI / Claude)</Label>
                <Input value={aiKey} onChange={(e) => setAiKey(e.target.value)} type="password"
                  placeholder="sk-... or sk-ant-..." />
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Required for AI matching and summaries.</p>
              </div>
              <div>
                <Label className="mb-2 block">AI Provider</Label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setAiProvider('openai')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      aiProvider === 'openai' ? 'border-[#635BFF] bg-[#F0EEFF]' : 'border-[#E3E8EE]'
                    }`}
                    style={{ color: aiProvider === 'openai' ? '#635BFF' : '#596880' }}
                  >
                    OpenAI
                  </button>
                  <button
                    onClick={() => setAiProvider('claude')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      aiProvider === 'claude' ? 'border-[#635BFF] bg-[#F0EEFF]' : 'border-[#E3E8EE]'
                    }`}
                    style={{ color: aiProvider === 'claude' ? '#635BFF' : '#596880' }}
                  >
                    Claude
                  </button>
                </div>
              </div>
              <Button onClick={handleSaveKeys} style={{ background: '#635BFF', color: 'white' }}>
                Save API Settings
              </Button>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                <Database className="h-4 w-4" style={{ color: '#635BFF' }} /> Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#0A2540' }}>Export All Data</p>
                  <p className="text-xs" style={{ color: '#596880' }}>Download a backup of all companies, clients, campaigns, and settings.</p>
                </div>
                <Button variant="outline" onClick={handleExportAll} className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>

              <div className="flex items-center justify-between" style={{ borderTop: '1px solid #E3E8EE', paddingTop: '16px' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#0A2540' }}>Import Data</p>
                  <p className="text-xs" style={{ color: '#596880' }}>Restore from a previous backup file.</p>
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-md text-sm font-medium px-4 py-2 border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: '#E3E8EE', color: '#0A2540' }}>
                    <Upload className="h-4 w-4" /> Import
                  </span>
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
              </div>

              <div className="flex items-center justify-between" style={{ borderTop: '1px solid #E3E8EE', paddingTop: '16px' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#EF4444' }}>Clear All Data</p>
                  <p className="text-xs" style={{ color: '#596880' }}>Permanently delete all companies, clients, campaigns, and settings.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your data including companies, clients, outreach campaigns, and settings. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll} className="bg-red-600 text-white hover:bg-red-700">
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
