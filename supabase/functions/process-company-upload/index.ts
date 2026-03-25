import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
          i++;
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
  console.log("Detected headers:", headers.slice(0, 10));

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
      company_name: get("company_name", "company", "name", "business_name", "trading_name",
        "company_name_latin_alphabet", "company_name_local_alphabet", "entity_name") || "",
      geography: get(
        "geography", "location", "region", "city", "county", "town",
        "postcode", "registered_office", "country", "country_iso_code",
        "state", "province", "country_name"
      ),
      industry: get(
        "industry", "sector", "sic_description", "sic_text", "sic",
        "sic_code", "trade", "activity", "business_type", "trade_classification",
        "principal_activity", "nature_of_business", "nace_rev_2_main_section",
        "nace_rev_2_core_code_4_digits", "nace_rev_2_description",
        "bvd_major_sector", "nace_rev_2_secondary_code"
      ),
      description_of_activities: get(
        "description_of_activities", "description", "activities",
        "business_description", "trading_activities",
        "trade_description_english", "trade_description_original_language",
        "overview", "products_services"
      ),
      companies_house_number: get(
        "companies_house_number", "company_number", "ch_number",
        "registration_number", "crn", "company_registration_number",
        "bvd_id_number", "national_id"
      ),
      website: get("website", "url", "web", "web_address", "website_address"),
      address: get("address", "registered_address", "office_address", "full_address",
        "address_line_1", "city_internat", "postcode"
      ),
      revenue: getNum(
        "revenue", "turnover", "sales", "turnover_gbp",
        "annual_revenue", "latest_turnover", "annual_turnover",
        "operating_revenue_turnover", "operating_revenue_turnover_th_usd",
        "operating_revenue_turnover_th_eur", "operating_revenue_turnover_th_gbp"
      ),
      profit_before_tax: getNum(
        "profit_before_tax", "pbt", "profit", "operating_profit",
        "net_profit", "profit_gbp", "pre_tax_profit",
        "p_l_before_tax", "p_l_before_tax_th_usd", "profit_loss_before_tax",
        "ebitda", "ebitda_th_usd"
      ),
      net_assets: getNum(
        "net_assets", "net_asset_value", "nav",
        "shareholders_funds", "equity", "net_worth",
        "shareholders_funds_th_usd", "shareholders_funds_th_eur"
      ),
      total_assets: getNum(
        "total_assets", "assets", "total_asset_value",
        "fixed_assets", "gross_assets",
        "total_assets_th_usd", "total_assets_th_eur", "total_assets_th_gbp"
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

const BATCH_SIZE = 500;

async function insertInBatches(
  supabase: ReturnType<typeof createClient>,
  mandateId: string,
  companies: CompanyRow[]
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const rows = batch.map((c) => ({
      mandate_id: mandateId,
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

    const { data, error } = await supabase
      .from("companies")
      .insert(rows)
      .select("id");

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} insert error:`, error.message);
    } else {
      totalInserted += data?.length || 0;
    }
    console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total so far: ${totalInserted}`);
  }

  return totalInserted;
}

async function processInBackground(
  authHeader: string,
  mandateId: string,
  csvContent: string
) {
  try {
    // Use service role for background work since the original auth context may expire
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const companies = parseCSV(csvContent);
    console.log(`Background: parsed ${companies.length} companies`);

    if (companies.length === 0) {
      console.error("Background: No valid companies found");
      return;
    }

    const totalInserted = await insertInBatches(supabase, mandateId, companies);
    console.log(`Background: inserted ${totalInserted} companies total`);

    // Update mandate
    await supabase
      .from("mandates")
      .update({ companies_delivered: totalInserted, status: "active" })
      .eq("id", mandateId);

    // Update domain allowance
    const { data: mandateData } = await supabase
      .from("mandates")
      .select("domain_id")
      .eq("id", mandateId)
      .single();

    if (mandateData?.domain_id) {
      const { data: domainData } = await supabase
        .from("domains")
        .select("free_companies_remaining")
        .eq("id", mandateData.domain_id)
        .single();

      if (domainData) {
        const newRemaining = Math.max(0, domainData.free_companies_remaining - totalInserted);
        await supabase
          .from("domains")
          .update({ free_companies_remaining: newRemaining })
          .eq("id", mandateData.domain_id);
      }
    }

    console.log("Background processing complete");
  } catch (error) {
    console.error("Background processing error:", error);
  }
}

Deno.serve(async (req) => {
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

    // Check admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
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

    // Quick row count estimate for the response
    const lineCount = csv_content.split("\n").length - 1;

    // Kick off background processing so we don't hit CPU time limits
    EdgeRuntime.waitUntil(processInBackground(authHeader, mandate_id, csv_content));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing ~${lineCount} companies in the background. They will appear shortly.`,
        mandate_name: mandate.name,
        estimated_companies: lineCount,
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
