import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Factory, Globe, Banknote, TrendingUp, Wallet, BarChart3,
  Users, Tag, Loader2, ExternalLink, Sparkles, Calendar, Linkedin, Twitter, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getDealFlowCompanies, type DealFlowCompany } from '@/lib/dealflowService';
import { enrichCompany, type EnrichedData } from '@/lib/enrichmentService';
import { updateCompany } from '@/lib/companyDb';
import AppLayout from '@/components/layout/AppLayout';

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewed: 'bg-slate-100 text-slate-600 border-slate-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

type ExtendedCompany = DealFlowCompany & { enriched_data?: EnrichedData };

export default function CompanyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<ExtendedCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    (async () => {
      const companies = await getDealFlowCompanies();
      const found = companies.find((c) => c.id === id);
      if (found) {
        setCompany(found as ExtendedCompany);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleEnrich = async () => {
    if (!company) return;
    const domain = company.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) {
      toast({ title: 'No website', description: 'Company needs a website to enrich.', variant: 'destructive' });
      return;
    }
    setEnriching(true);
    try {
      const data = await enrichCompany(domain);
      if (data) {
        await updateCompany(company.id, { enriched_data: data });
        setCompany({ ...company, enriched_data: data });
        toast({ title: 'Enriched', description: 'Company data has been enriched successfully.' });
      } else {
        toast({ title: 'No data found', description: 'Could not find enrichment data for this domain.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Enrichment failed', description: 'An error occurred.', variant: 'destructive' });
    }
    setEnriching(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#635BFF' }} />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p style={{ color: '#596880' }}>Company not found.</p>
          <Button onClick={() => navigate('/companies')} variant="outline">Back to Companies</Button>
        </div>
      </AppLayout>
    );
  }

  const enriched = company.enriched_data;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        {/* Sub-header */}
        <div className="bg-white px-8 py-6" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <button
            onClick={() => navigate('/companies')}
            className="inline-flex items-center gap-2 text-sm mb-4 transition-colors"
            style={{ color: '#596880' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl" style={{ background: '#F0EEFF' }}>
                <Building2 className="h-6 w-6" style={{ color: '#635BFF' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#0A2540' }}>{company.company_name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {company.geography && (
                    <span className="inline-flex items-center gap-1 text-sm" style={{ color: '#596880' }}>
                      <MapPin className="h-3.5 w-3.5" /> {company.geography}
                    </span>
                  )}
                  {company.industry && (
                    <span className="inline-flex items-center gap-1 text-sm" style={{ color: '#596880' }}>
                      <Factory className="h-3.5 w-3.5" /> {company.industry}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className={statusColors[company.status] || statusColors.new}>
                {company.status || 'new'}
              </Badge>
              <Button
                onClick={handleEnrich}
                disabled={enriching}
                className="gap-2"
                style={{ background: '#635BFF', color: 'white' }}
              >
                {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enrich
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Financial overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Revenue', value: formatCurrency(company.revenue), icon: Banknote, color: '#635BFF' },
                  { label: 'P/L Before Tax', value: formatCurrency(company.profit_before_tax), icon: TrendingUp, color: '#10B981' },
                  { label: 'Total Assets', value: formatCurrency(company.total_assets), icon: BarChart3, color: '#0EA5E9' },
                  { label: 'Equity', value: formatCurrency(company.net_assets), icon: Wallet, color: '#F59E0B' },
                  { label: 'Employees', value: company.employees?.toString() || '—', icon: Users, color: '#A259FF' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Card key={stat.label} className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" style={{ color: stat.color }} />
                          <span className="text-xs font-medium" style={{ color: '#596880' }}>{stat.label}</span>
                        </div>
                        <p className="text-lg font-bold" style={{ color: '#0A2540' }}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Description */}
              {(company.description_of_activities || company.description) && (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed" style={{ color: '#596880' }}>
                      {company.description_of_activities || company.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Enriched data */}
              {enriched && (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                      <Sparkles className="h-4 w-4" style={{ color: '#635BFF' }} />
                      Enriched Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {enriched.short_description && (
                      <p className="text-sm" style={{ color: '#596880' }}>{enriched.short_description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {enriched.founded_year && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" style={{ color: '#596880' }} />
                          <span style={{ color: '#596880' }}>Founded: <strong style={{ color: '#0A2540' }}>{enriched.founded_year}</strong></span>
                        </div>
                      )}
                      {enriched.estimated_num_employees && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" style={{ color: '#596880' }} />
                          <span style={{ color: '#596880' }}>Employees: <strong style={{ color: '#0A2540' }}>{enriched.estimated_num_employees.toLocaleString()}</strong></span>
                        </div>
                      )}
                      {enriched.annual_revenue && (
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4" style={{ color: '#596880' }} />
                          <span style={{ color: '#596880' }}>Revenue: <strong style={{ color: '#0A2540' }}>{formatCurrency(enriched.annual_revenue)}</strong></span>
                        </div>
                      )}
                      {enriched.total_funding && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" style={{ color: '#596880' }} />
                          <span style={{ color: '#596880' }}>Total Funding: <strong style={{ color: '#0A2540' }}>{formatCurrency(enriched.total_funding)}</strong></span>
                        </div>
                      )}
                      {enriched.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" style={{ color: '#596880' }} />
                          <span style={{ color: '#0A2540' }}>{enriched.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {enriched.linkedin_url && (
                        <a href={enriched.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:underline" style={{ color: '#635BFF' }}>
                          <Linkedin className="h-4 w-4" /> LinkedIn
                        </a>
                      )}
                      {enriched.twitter_url && (
                        <a href={enriched.twitter_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:underline" style={{ color: '#635BFF' }}>
                          <Twitter className="h-4 w-4" /> Twitter
                        </a>
                      )}
                    </div>
                    {enriched.technologies.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: '#596880' }}>Tech Stack</p>
                        <div className="flex flex-wrap gap-1">
                          {enriched.technologies.slice(0, 20).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Directors */}
              <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>Directors</CardTitle>
                </CardHeader>
                <CardContent>
                  {company.directors && company.directors.length > 0 ? (
                    <div className="space-y-3">
                      {company.directors.map((d, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#635BFF' }}>
                            {d.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#0A2540' }}>{d.name}</p>
                            <p className="text-xs" style={{ color: '#596880' }}>{d.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : company.director_name ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#635BFF' }}>
                        {company.director_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#0A2540' }}>{company.director_name}</p>
                        {company.director_title && <p className="text-xs" style={{ color: '#596880' }}>{company.director_title}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: '#596880' }}>No director information available.</p>
                  )}
                </CardContent>
              </Card>

              {/* Website */}
              {company.website && (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>Website</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm hover:underline"
                      style={{ color: '#635BFF' }}
                    >
                      <Globe className="h-4 w-4" />
                      {company.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Tags */}
              {company.tags && company.tags.length > 0 && (
                <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0A2540' }}>
                      <Tag className="h-4 w-4" /> Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {company.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Info */}
              <Card className="rounded-xl" style={{ border: '1px solid #E3E8EE' }}>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold" style={{ color: '#0A2540' }}>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {company.year_incorporated && (
                    <div className="flex justify-between">
                      <span style={{ color: '#596880' }}>Year Inc.</span>
                      <span style={{ color: '#0A2540' }}>{company.year_incorporated}</span>
                    </div>
                  )}
                  {company.nace && (
                    <div className="flex justify-between">
                      <span style={{ color: '#596880' }}>NACE</span>
                      <span style={{ color: '#0A2540' }}>{company.nace}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
