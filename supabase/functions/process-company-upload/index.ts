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

function parseCSV(csvText: string): CompanyRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const companies: CompanyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/['"]/g, ""));
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    // Helper to parse numeric values
    const parseNumeric = (value: string | undefined): number | undefined => {
      if (!value) return undefined;
      const cleaned = value.replace(/[£$,\s]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    // Map common header variations
    const company: CompanyRow = {
      company_name:
        row["company_name"] ||
        row["company"] ||
        row["name"] ||
        row["business_name"] ||
        "",
      geography:
        row["geography"] ||
        row["location"] ||
        row["region"] ||
        row["city"] ||
        undefined,
      industry:
        row["industry"] ||
        row["sector"] ||
        row["sic_description"] ||
        undefined,
      description_of_activities:
        row["description_of_activities"] ||
        row["description"] ||
        row["activities"] ||
        row["business_description"] ||
        undefined,
      companies_house_number:
        row["companies_house_number"] ||
        row["company_number"] ||
        row["ch_number"] ||
        row["registration_number"] ||
        undefined,
      website:
        row["website"] ||
        row["url"] ||
        row["web"] ||
        undefined,
      address:
        row["address"] ||
        row["registered_address"] ||
        row["location"] ||
        undefined,
      revenue: parseNumeric(
        row["revenue"] ||
        row["turnover"] ||
        row["sales"]
      ),
      profit_before_tax: parseNumeric(
        row["profit_before_tax"] ||
        row["pbt"] ||
        row["profit"]
      ),
      net_assets: parseNumeric(
        row["net_assets"] ||
        row["net_asset_value"] ||
        row["nav"]
      ),
      total_assets: parseNumeric(
        row["total_assets"] ||
        row["assets"] ||
        row["total_asset_value"]
      ),
      revenue_band: row["revenue_band"] || undefined,
      asset_band: row["asset_band"] || undefined,
      status: row["status"] || "new",
    };

    if (company.company_name) {
      companies.push(company);
    }
  }

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

    // Verify user and get claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

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
        status: "active"
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
        const newRemaining = Math.max(0, domainData.free_companies_remaining - (insertedCompanies?.length || 0));
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
