import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CompanyRow {
  company_name: string;
  geography?: string;
  industry?: string;
  revenue_band?: string;
  asset_band?: string;
  status?: string;
  description_of_activities?: string;
  companies_house_number?: string;
  website?: string;
  address?: string;
  revenue?: number;
  profit_before_tax?: number;
  net_assets?: number;
  total_assets?: number;
}

/**
 * Parse a single CSV line handling quoted fields with commas inside.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function parseCSV(csvText: string): CompanyRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(normalizeHeader);
  console.log("Detected headers:", headers);

  const companies: CompanyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    const parseNumeric = (value: string | undefined): number | undefined => {
      if (!value) return undefined;
      const cleaned = value.replace(/[£$,\s]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    const get = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        if (row[k]) return row[k];
      }
      return undefined;
    };

    const getNum = (...keys: string[]): number | undefined => {
      for (const k of keys) {
        if (row[k]) {
          const v = parseNumeric(row[k]);
          if (v !== undefined) return v;
        }
      }
      return undefined;
    };

    const company: CompanyRow = {
      company_name: get("company_name", "company", "name", "business_name", "trading_name") || "",
      geography: get(
        "geography", "location", "region", "city", "county", "town",
        "postcode", "registered_office", "country"
      ),
      industry: get(
        "industry", "sector", "sic_description", "sic_text", "sic",
        "sic_code", "trade", "activity", "business_type", "trade_classification",
        "principal_activity", "nature_of_business"
      ),
      description_of_activities: get(
        "description_of_activities", "description", "activities",
        "business_description", "trading_activities"
      ),
      companies_house_number: get(
        "companies_house_number", "company_number", "ch_number",
        "registration_number", "crn", "company_registration_number"
      ),
      website: get("website", "url", "web", "web_address"),
      address: get("address", "registered_address", "office_address", "full_address"),
      revenue: getNum(
        "revenue", "turnover", "sales", "turnover_gbp",
        "annual_revenue", "latest_turnover", "annual_turnover"
      ),
      profit_before_tax: getNum(
        "profit_before_tax", "pbt", "profit", "operating_profit",
        "net_profit", "profit_gbp", "pre_tax_profit"
      ),
      net_assets: getNum(
        "net_assets", "net_asset_value", "nav",
        "shareholders_funds", "equity", "net_worth"
      ),
      total_assets: getNum(
        "total_assets", "assets", "total_asset_value",
        "fixed_assets", "gross_assets"
      ),
      revenue_band: get("revenue_band"),
      asset_band: get("asset_band"),
      status: get("status") || "new",
    };

    if (company.company_name) {
      companies.push(company);
    }
  }

  console.log(`Parsed ${companies.length} companies from CSV`);
  return companies;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { mandate_id, csv_content } = await req.json();

    if (!mandate_id || !csv_content) {
      return new Response(
        JSON.stringify({ error: "mandate_id and csv_content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify mandate exists
    const { data: mandate, error: mandateError } = await supabase
      .from("mandates")
      .select("id, name")
      .eq("id", mandate_id)
      .maybeSingle();

    if (mandateError || !mandate) {
      return new Response(
        JSON.stringify({ error: "Mandate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV
    const companies = parseCSV(csv_content);

    if (companies.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid companies found in CSV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert companies
    const companiesToInsert = companies.map((c) => ({
      mandate_id,
      company_name: c.company_name,
      geography: c.geography || null,
      industry: c.industry || null,
      description_of_activities: c.description_of_activities || null,
      companies_house_number: c.companies_house_number || null,
      website: c.website || null,
      address: c.address || null,
      revenue: c.revenue || null,
      profit_before_tax: c.profit_before_tax || null,
      net_assets: c.net_assets || null,
      total_assets: c.total_assets || null,
      revenue_band: c.revenue_band || null,
      asset_band: c.asset_band || null,
      status: c.status || "new",
    }));

    const { data: insertedCompanies, error: insertError } = await supabase
      .from("companies")
      .insert(companiesToInsert)
      .select("id");

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert companies", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update mandate companies_delivered count
    const { error: updateError } = await supabase
      .from("mandates")
      .update({
        companies_delivered: insertedCompanies?.length || 0,
        status: "active",
      })
      .eq("id", mandate_id);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    // Update domain free allowance
    const { data: mandateData } = await supabase
      .from("mandates")
      .select("domain_id")
      .eq("id", mandate_id)
      .single();

    if (mandateData?.domain_id) {
      const { data: domainData } = await supabase
        .from("domains")
        .select("free_companies_remaining")
        .eq("id", mandateData.domain_id)
        .single();

      if (domainData) {
        const newRemaining = Math.max(
          0,
          domainData.free_companies_remaining - (insertedCompanies?.length || 0)
        );
        await supabase
          .from("domains")
          .update({ free_companies_remaining: newRemaining })
          .eq("id", mandateData.domain_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        companies_added: insertedCompanies?.length || 0,
        mandate_name: mandate.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
