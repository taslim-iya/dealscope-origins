import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Building2, Loader2, Plus, Check, ExternalLink, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MandateCriteria {
  id: string;
  industry_description: string | null;
  regions: string[] | null;
  country: string;
  revenue_min: number | null;
  revenue_max: number | null;
  total_assets_min: number | null;
  total_assets_max: number | null;
  net_assets_min: number | null;
  net_assets_max: number | null;
}

interface MatchedCompany {
  id: string;
  company_name: string;
  geography: string | null;
  industry: string | null;
  revenue: number | null;
  revenue_band: string | null;
  status: string | null;
  mandate_id: string;
  matchScore: number;
  matchReasons: string[];
}

interface SuggestedMatchesProps {
  mandate: MandateCriteria;
  onCompanyAdded?: () => void;
}

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${(value / 1000).toFixed(0)}K`;
  return `£${value.toFixed(0)}`;
};

// Default threshold stored in localStorage
const THRESHOLD_STORAGE_KEY = "dealscope_match_threshold";
const DEFAULT_THRESHOLD = 20;

export default function SuggestedMatches({ mandate, onCompanyAdded }: SuggestedMatchesProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [allMatches, setAllMatches] = useState<MatchedCompany[]>([]);
  const [addingCompanyId, setAddingCompanyId] = useState<string | null>(null);
  const [addedCompanyIds, setAddedCompanyIds] = useState<Set<string>>(new Set());
  const [threshold, setThreshold] = useState(() => {
    const stored = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_THRESHOLD;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Filter matches based on threshold
  const matches = useMemo(() => {
    return allMatches.filter((company) => company.matchScore >= threshold);
  }, [allMatches, threshold]);

  // Save threshold to localStorage when it changes
  const handleThresholdChange = (value: number[]) => {
    const newThreshold = value[0];
    setThreshold(newThreshold);
    localStorage.setItem(THRESHOLD_STORAGE_KEY, newThreshold.toString());
  };

  useEffect(() => {
    const findMatches = async () => {
      setLoading(true);

      // Fetch all companies NOT already in this mandate
      const { data: companiesData, error } = await supabase
        .from("companies")
        .select("*")
        .neq("mandate_id", mandate.id)
        .limit(100000);

      if (error) {
        console.error("Error fetching companies:", error);
        setLoading(false);
        return;
      }

      if (!companiesData || companiesData.length === 0) {
        setAllMatches([]);
        setLoading(false);
        return;
      }

      // Score and filter companies based on mandate criteria
      const scoredCompanies: MatchedCompany[] = companiesData
        .map((company) => {
          let score = 0;
          const reasons: string[] = [];

          // Geography matching
          if (company.geography && mandate.regions && mandate.regions.length > 0) {
            const companyGeo = company.geography.toLowerCase();
            const matchingRegion = mandate.regions.find(
              (region) => companyGeo.includes(region.toLowerCase()) || region.toLowerCase().includes(companyGeo)
            );
            if (matchingRegion) {
              score += 30;
              reasons.push(`Geography: ${company.geography}`);
            }
          }

          // Industry matching (fuzzy text match)
          if (company.industry && mandate.industry_description) {
            const companyIndustry = company.industry.toLowerCase();
            const mandateIndustry = mandate.industry_description.toLowerCase();
            
            // Check for keyword overlap
            const mandateKeywords = mandateIndustry.split(/[\s,]+/).filter((w) => w.length > 3);
            const matchingKeywords = mandateKeywords.filter((keyword) =>
              companyIndustry.includes(keyword)
            );
            
            if (matchingKeywords.length > 0) {
              score += 20 + matchingKeywords.length * 10;
              reasons.push(`Industry: ${company.industry}`);
            }
          }

          // Revenue range matching
          if (company.revenue !== null) {
            const inRevenueRange =
              (mandate.revenue_min === null || company.revenue >= mandate.revenue_min) &&
              (mandate.revenue_max === null || company.revenue <= mandate.revenue_max);
            
            if (inRevenueRange && (mandate.revenue_min !== null || mandate.revenue_max !== null)) {
              score += 25;
              reasons.push(`Revenue: ${formatCurrency(company.revenue)}`);
            }
          }

          // Total assets range matching
          if (company.total_assets !== null) {
            const inAssetsRange =
              (mandate.total_assets_min === null || company.total_assets >= mandate.total_assets_min) &&
              (mandate.total_assets_max === null || company.total_assets <= mandate.total_assets_max);
            
            if (inAssetsRange && (mandate.total_assets_min !== null || mandate.total_assets_max !== null)) {
              score += 15;
              reasons.push("Assets in range");
            }
          }

          return {
            ...company,
            matchScore: score,
            matchReasons: reasons,
          } as MatchedCompany;
        })
        .filter((company) => company.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20); // Top 20 matches (threshold applied via useMemo)

      setAllMatches(scoredCompanies);
      setLoading(false);
    };

    findMatches();
  }, [mandate]);

  const handleAddToMandate = async (company: MatchedCompany) => {
    setAddingCompanyId(company.id);

    // Insert a copy of the company for this mandate
    const { error } = await supabase.from("companies").insert({
      company_name: company.company_name,
      geography: company.geography,
      industry: company.industry,
      revenue: company.revenue,
      revenue_band: company.revenue_band,
      mandate_id: mandate.id,
      status: "new",
    });

    if (error) {
      toast({
        title: "Failed to add company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAddedCompanyIds((prev) => new Set(prev).add(company.id));
      toast({
        title: "Company added",
        description: `${company.company_name} has been added to this mandate.`,
      });
      onCompanyAdded?.();
    }

    setAddingCompanyId(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Suggested Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const thresholdSettings = (
    <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          Settings
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 p-4 rounded-lg border border-border bg-background">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Minimum Match Score</Label>
            <span className="text-sm font-semibold text-primary">{threshold}%</span>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={handleThresholdChange}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Only show companies with a match score of {threshold}% or higher.
            {allMatches.length > 0 && (
              <span className="block mt-1">
                {matches.length} of {allMatches.length} companies meet this threshold.
              </span>
            )}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  if (matches.length === 0 && allMatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Suggested Matches
            </CardTitle>
          </div>
          <CardDescription>
            Companies from your database that match this mandate's criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No matching companies found in your database.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload more companies to build your database for future matches.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0 && allMatches.length > 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Suggested Matches
            </CardTitle>
          </div>
          <CardDescription>
            Companies from your database that match this mandate's criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {thresholdSettings}
          <div className="text-center py-8 mt-4">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No companies meet the {threshold}% threshold.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lower the threshold to see {allMatches.length} potential matches.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Suggested Matches
            <Badge variant="secondary" className="ml-2">
              {matches.length} found
            </Badge>
          </CardTitle>
        </div>
        <CardDescription>
          Companies from your database that match this mandate's criteria. Add them to fulfill this request.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {thresholdSettings}
        <div className="space-y-3 mt-4">
          {matches.map((company) => {
            const isAdded = addedCompanyIds.has(company.id);
            const isAdding = addingCompanyId === company.id;

            return (
              <div
                key={company.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {company.company_name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {company.matchScore}% match
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {company.matchReasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/company/${company.id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {isAdded ? (
                    <Button variant="outline" size="sm" disabled>
                      <Check className="h-4 w-4 mr-1" />
                      Added
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAddToMandate(company)}
                      disabled={isAdding}
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
