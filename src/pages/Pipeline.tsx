import { useState, useEffect, useRef } from 'react';
import { Kanban, GripVertical, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getDealFlowCompanies, type DealFlowCompany } from '@/lib/dealflowService';
import { updateCompany } from '@/lib/companyDb';
import { useClientStore } from '@/lib/clientStore';
import AppLayout from '@/components/layout/AppLayout';

const STAGES = ['new', 'reviewed', 'shortlisted', 'contacted', 'qualified', 'closed'] as const;
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  reviewed: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  shortlisted: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  contacted: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  qualified: { bg: '#F5F3FF', text: '#7C3AED', border: '#C4B5FD' },
  closed: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

export default function Pipeline() {
  const { toast } = useToast();
  const clients = useClientStore((s) => s.clients);
  const [companies, setCompanies] = useState<DealFlowCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => {
    getDealFlowCompanies().then((data) => { setCompanies(data); setLoading(false); });
  }, []);

  const industries = [...new Set(companies.map((c) => c.industry).filter(Boolean))] as string[];

  let filtered = companies;
  if (clientFilter !== 'all') {
    const client = clients.find((c) => c.id === clientFilter);
    if (client) filtered = filtered.filter((c) => client.assignedCompanyIds.includes(c.id));
  }
  if (industryFilter !== 'all') {
    filtered = filtered.filter((c) => c.industry === industryFilter);
  }

  const stageData = STAGES.map((stage) => ({
    stage,
    companies: filtered.filter((c) => (c.status || 'new') === stage),
  }));

  const handleDrop = async (stage: string) => {
    if (!dragItem) return;
    await updateCompany(dragItem, { status: stage });
    setCompanies((prev) => prev.map((c) => (c.id === dragItem ? { ...c, status: stage } : c)));
    setDragItem(null);
    toast({ title: `Moved to ${stage}` });
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>Pipeline</h1>
              <p className="text-sm mt-1" style={{ color: '#596880' }}>Drag companies between stages to update their status.</p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: '#596880' }} />
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-40 h-8 text-xs" style={{ borderColor: '#E3E8EE' }}>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-40 h-8 text-xs" style={{ borderColor: '#E3E8EE' }}>
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6 flex gap-4 overflow-x-auto min-h-[calc(100vh-120px)]">
          {stageData.map(({ stage, companies: stageCompanies }) => {
            const colors = STAGE_COLORS[stage] || STAGE_COLORS.new;
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-72 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors.text }} />
                    <span className="text-sm font-semibold capitalize" style={{ color: '#0A2540' }}>{stage}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stageCompanies.length}</Badge>
                </div>

                {/* Column body */}
                <div className="flex-1 rounded-xl p-2 space-y-2" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                  {stageCompanies.length === 0 && (
                    <div className="py-8 text-center text-xs" style={{ color: '#9CA3AF' }}>
                      Drop companies here
                    </div>
                  )}
                  {stageCompanies.map((company) => (
                    <div
                      key={company.id}
                      draggable
                      onDragStart={() => setDragItem(company.id)}
                      className="bg-white rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
                      style={{ border: '1px solid #E3E8EE' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#0A2540' }}>
                            {company.company_name}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#596880' }}>
                            {company.industry || 'No industry'}
                          </p>
                        </div>
                        <GripVertical className="h-4 w-4 flex-shrink-0" style={{ color: '#D1D5DB' }} />
                      </div>
                      {company.revenue != null && (
                        <p className="text-xs font-medium mt-2" style={{ color: colors.text }}>
                          {formatCurrency(company.revenue)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
