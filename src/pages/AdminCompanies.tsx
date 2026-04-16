import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Settings2, Download, Sparkles, UserPlus, CheckSquare, ArrowUpDown,
  Loader2, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getDealFlowCompanies, type DealFlowCompany } from '@/lib/dealflowService';
import { useClientStore } from '@/lib/clientStore';
import { enrichCompany } from '@/lib/enrichmentService';
import { updateCompanies } from '@/lib/companyDb';
import AppLayout from '@/components/layout/AppLayout';

const ALL_COLUMNS = [
  { key: 'company_name', label: 'Company Name', default: true },
  { key: 'geography', label: 'Geography', default: true },
  { key: 'industry', label: 'Industry', default: true },
  { key: 'revenue', label: 'Revenue', default: true },
  { key: 'employees', label: 'Employees', default: true },
  { key: 'website', label: 'Website', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'director_name', label: 'Director', default: true },
  { key: 'year_incorporated', label: 'Year Inc.', default: false },
  { key: 'nace', label: 'NACE', default: false },
  { key: 'profit_before_tax', label: 'P/L Before Tax', default: false },
  { key: 'total_assets', label: 'Total Assets', default: false },
  { key: 'net_assets', label: 'Equity', default: false },
  { key: 'description_of_activities', label: 'Description', default: false },
  { key: 'director_title', label: 'Director Title', default: false },
  { key: 'tags', label: 'Tags', default: false },
];

const STATUSES = ['new', 'reviewed', 'shortlisted', 'contacted', 'qualified', 'rejected'];
const statusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700', reviewed: 'bg-slate-100 text-slate-600',
  shortlisted: 'bg-emerald-50 text-emerald-700', contacted: 'bg-amber-50 text-amber-700',
  qualified: 'bg-purple-50 text-purple-700', rejected: 'bg-red-50 text-red-700',
};

const PAGE_SIZE = 50;

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

function getStoredColumns(): string[] {
  try {
    const raw = localStorage.getItem('dealscope-column-config');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter((c) => c.default).map((c) => c.key);
}

function saveColumns(cols: string[]) {
  localStorage.setItem('dealscope-column-config', JSON.stringify(cols));
}

export default function AdminCompanies() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const clients = useClientStore((s) => s.clients);
  const assignCompanies = useClientStore((s) => s.assignCompanies);

  const [companies, setCompanies] = useState<DealFlowCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>(getStoredColumns);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('company_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    getDealFlowCompanies().then((data) => {
      setCompanies(data);
      setLoading(false);
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      saveColumns(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let result = companies;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.company_name?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.geography?.toLowerCase().includes(q) ||
          c.director_name?.toLowerCase().includes(q)
      );
    }
    // Sort
    const numFields = new Set(['revenue', 'profit_before_tax', 'total_assets', 'net_assets']);
    result = [...result].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (sortField === 'employees') {
        va = a.employees ? parseInt(String(a.employees).replace(/,/g, '')) : null;
        vb = b.employees ? parseInt(String(b.employees).replace(/,/g, '')) : null;
      } else if (numFields.has(sortField)) {
        va = (a as unknown as Record<string, number | null>)[sortField];
        vb = (b as unknown as Record<string, number | null>)[sortField];
      } else {
        va = ((a as unknown as Record<string, string | null>)[sortField])?.toLowerCase() ?? null;
        vb = ((b as unknown as Record<string, string | null>)[sortField])?.toLowerCase() ?? null;
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortDir === 'desc' ? 1 : -1;
      if (va > vb) return sortDir === 'desc' ? -1 : 1;
      return 0;
    });
    return result;
  }, [companies, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === pageData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageData.map((c) => c.id)));
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleAssignToClient = (clientId: string) => {
    const ids = Array.from(selected);
    assignCompanies(clientId, ids);
    toast({ title: 'Assigned', description: `${ids.length} companies assigned to client.` });
    setSelected(new Set());
  };

  const handleChangeStatus = async (status: string) => {
    const ids = Array.from(selected);
    await updateCompanies(ids, { status });
    setCompanies((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, status } : c)));
    toast({ title: 'Status updated', description: `${ids.length} companies set to ${status}.` });
    setSelected(new Set());
  };

  const handleExport = (format: 'csv' | 'json') => {
    const ids = Array.from(selected);
    const data = companies.filter((c) => ids.includes(c.id));
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'companies.json'; a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = visibleCols;
      const rows = data.map((c) => headers.map((h) => {
        const v = (c as unknown as Record<string, unknown>)[h];
        return v == null ? '' : String(v);
      }));
      const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'companies.csv'; a.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: 'Exported', description: `${data.length} companies exported as ${format.toUpperCase()}.` });
  };

  const handleEnrichSelected = async () => {
    const ids = Array.from(selected).slice(0, 50);
    setEnrichProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const c = companies.find((co) => co.id === ids[i]);
      if (!c?.website) continue;
      const domain = c.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      try {
        const data = await enrichCompany(domain);
        if (data) {
          await updateCompanies([c.id], { enriched_data: data });
        }
      } catch { /* skip */ }
      setEnrichProgress({ current: i + 1, total: ids.length });
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }
    setEnrichProgress(null);
    toast({ title: 'Enrichment complete', description: `Processed ${ids.length} companies.` });
    setSelected(new Set());
  };

  const renderCell = (company: DealFlowCompany, col: string) => {
    const val = (company as unknown as Record<string, unknown>)[col];
    switch (col) {
      case 'company_name':
        return (
          <button onClick={() => navigate(`/company/${company.id}`)} className="text-sm font-medium hover:underline text-left" style={{ color: '#635BFF' }}>
            {company.company_name}
          </button>
        );
      case 'revenue': case 'profit_before_tax': case 'total_assets': case 'net_assets':
        return <span className="text-sm" style={{ color: '#0A2540' }}>{formatCurrency(val as number | null)}</span>;
      case 'status':
        return <Badge variant="secondary" className={`text-xs ${statusColors[company.status] || ''}`}>{company.status || 'new'}</Badge>;
      case 'website':
        return company.website ? (
          <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1 hover:underline" style={{ color: '#635BFF' }}>
            {company.website.replace(/^https?:\/\//, '').substring(0, 25)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : <span className="text-sm" style={{ color: '#9CA3AF' }}>—</span>;
      case 'tags':
        return (company.tags || []).slice(0, 3).map((t) => (
          <Badge key={t} variant="secondary" className="text-xs mr-1">{t}</Badge>
        ));
      default:
        return <span className="text-sm" style={{ color: '#0A2540' }}>{val != null ? String(val) : '—'}</span>;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>Companies</h1>
          <p className="text-sm mt-1" style={{ color: '#596880' }}>
            {filtered.length.toLocaleString()} companies {search && `matching "${search}"`}
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white px-8 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 text-sm"
              style={{ borderColor: '#E3E8EE' }}
            />
          </div>

          {/* Column config */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                <Settings2 className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleCols.includes(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Batch actions */}
          {selected.size > 0 && (
            <>
              <Badge className="text-xs" style={{ background: '#635BFF', color: 'white' }}>
                <CheckSquare className="h-3 w-3 mr-1" /> {selected.size} selected
              </Badge>

              {clients.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                      <UserPlus className="h-4 w-4" /> Assign to Client
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {clients.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => handleAssignToClient(c.id)}>
                        {c.name} — {c.company}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleChangeStatus(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={handleEnrichSelected} disabled={!!enrichProgress}
                className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                <Sparkles className="h-4 w-4" /> Enrich Selected
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" style={{ borderColor: '#E3E8EE' }}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>Export JSON</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Enrich progress */}
        {enrichProgress && (
          <div className="px-8 py-2 bg-white" style={{ borderBottom: '1px solid #E3E8EE' }}>
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#635BFF' }} />
              <span className="text-sm" style={{ color: '#596880' }}>
                Enriching {enrichProgress.current}/{enrichProgress.total}...
              </span>
              <Progress value={(enrichProgress.current / enrichProgress.total) * 100} className="flex-1 h-2" />
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#635BFF' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E3E8EE' }}>
                  <th className="px-4 py-3 text-left w-10">
                    <Checkbox checked={selected.size === pageData.length && pageData.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  {visibleCols.map((col) => {
                    const colDef = ALL_COLUMNS.find((c) => c.key === col);
                    return (
                      <th key={col} className="px-4 py-3 text-left whitespace-nowrap" style={{ borderBottom: '1px solid #E3E8EE' }}>
                        <button
                          onClick={() => handleSort(col)}
                          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#596880' }}
                        >
                          {colDef?.label}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageData.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-gray-50/50 transition-colors"
                    style={{ borderBottom: '1px solid #E3E8EE' }}
                  >
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(company.id)} onCheckedChange={() => toggleSelect(company.id)} />
                    </td>
                    {visibleCols.map((col) => (
                      <td key={col} className="px-4 py-3 max-w-[200px] truncate">
                        {renderCell(company, col)}
                      </td>
                    ))}
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="px-8 py-16 text-center text-sm" style={{ color: '#596880' }}>
                      No companies found. Sync from DealFlow to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-4 flex items-center justify-between bg-white" style={{ borderTop: '1px solid #E3E8EE' }}>
            <span className="text-sm" style={{ color: '#596880' }}>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
