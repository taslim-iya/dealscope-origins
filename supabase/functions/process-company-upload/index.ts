import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

interface ColumnMapping {
  csv_header: string;
  db_field: string;
  confidence: string;
  is_numeric?: boolean;
  multiplier?: number;
}

async function getAIMappings(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<ColumnMapping[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-map-columns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ headers, sample_rows: sampleRows }),
  });

  if (!response.ok) {
    console.warn("AI mapping failed, falling back to hardcoded mapping:", await response.text());
    return [];
  }

  const { mappings } = await response.json();
  return mappings || [];
}

function buildMappingFromAI(mappings: ColumnMapping[]): Map<string, { db_field: string; is_numeric: boolean; multiplier: number }> {
  const map = new Map();
  for (const m of mappings) {
    // Accept ALL confidence levels — better to have data than miss it
    map.set(m.csv_header, {
      db_field: m.db_field,
      is_numeric: m.is_numeric || false,
      multiplier: m.multiplier || 1,
    });
  }
  return map;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function fallbackMapping(headers: string[]): Map<string, { db_field: string; is_numeric: boolean; multiplier: number }> {
  const map = new Map();
  const fieldAliases: Record<string, string[]> = {
    company_name: ["company_name", "company", "name", "business_name", "trading_name", "entity_name"],
    geography: ["geography", "location", "region", "city", "county", "town", "postcode", "country", "state"],
    industry: ["industry", "sector", "sic_description", "sic_text", "sic", "business_type", "trade_classification"],
    description_of_activities: ["description_of_activities", "description", "activities", "business_description", "overview"],
    companies_house_number: ["companies_house_number", "company_number", "ch_number", "registration_number", "crn"],
    website: ["website", "url", "web", "web_address"],
    address: ["address", "registered_address", "office_address", "full_address"],
    revenue: ["revenue", "turnover", "sales", "annual_revenue", "operating_revenue_turnover"],
    profit_before_tax: ["profit_before_tax", "pbt", "profit", "operating_profit", "pre_tax_profit", "ebitda"],
    net_assets: ["net_assets", "net_asset_value", "nav", "shareholders_funds", "equity"],
    total_assets: ["total_assets", "assets", "total_asset_value", "gross_assets"],
    number_of_employees: ["number_of_employees", "employees", "headcount", "staff", "fte", "workforce", "no_of_employees", "num_employees"],
    revenue_band: ["revenue_band"],
    asset_band: ["asset_band"],
    status: ["status"],
  };
  const numericFields = new Set(["revenue", "profit_before_tax", "net_assets", "total_assets", "number_of_employees"]);

  for (const h of headers) {
    const norm = normalizeHeader(h);
    for (const [dbField, aliases] of Object.entries(fieldAliases)) {
      if (aliases.includes(norm)) {
        map.set(h, { db_field: dbField, is_numeric: numericFields.has(dbField), multiplier: 1 });
        break;
      }
    }
  }
  return map;
}

interface CompanyRow {
  company_name: string;
  [key: string]: unknown;
}

function parseCSVWithMapping(
  csvText: string,
  mapping: Map<string, { db_field: string; is_numeric: boolean; multiplier: number }>
): CompanyRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const companies: CompanyRow[] = [];

    const parseNumeric = (value: string, multiplier: number): number | undefined => {
    if (!value) return undefined;
    const cleaned = value.replace(/[£$,\s%]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return undefined;
    // All financial values in source data are stated in thousands — multiply by 1000
    const adjusted = num * multiplier * 1000;
    return adjusted;
  };

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const company: Record<string, unknown> = {};

    headers.forEach((header, idx) => {
      const info = mapping.get(header);
      if (!info) return;
      const rawValue = values[idx] || "";
      if (!rawValue) return;

      if (info.is_numeric) {
        const num = parseNumeric(rawValue, info.multiplier);
        if (num !== undefined) {
          // Sanity check: revenue/financial fields should be > 1000 to avoid year-like values (e.g. 1820)
          if (["revenue", "profit_before_tax", "net_assets", "total_assets"].includes(info.db_field) && num > 0 && num < 1000) {
            // Skip — likely a year or code, not a financial value
          } else {
            company[info.db_field] = num;
          }
        }
      } else {
        if (!company[info.db_field]) {
          company[info.db_field] = rawValue;
        }
      }
    });

    if (company.company_name) {
      if (!company.status) company.status = "new";
      companies.push(company as CompanyRow);
    }
  }

  console.log(`Parsed ${companies.length} companies using AI mapping`);
  return companies;
}

const BATCH_SIZE = 500;
const VALIDATION_BATCH_SIZE = 100;

async function validateCompanyNames(companies: CompanyRow[]): Promise<CompanyRow[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping AI validation");
    return companies;
  }

  const validCompanies: CompanyRow[] = [];

  for (let i = 0; i < companies.length; i += VALIDATION_BATCH_SIZE) {
    const batch = companies.slice(i, i + VALIDATION_BATCH_SIZE);
    const names = batch.map((c, idx) => `${idx}: ${c.company_name}`).join("\n");

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a data quality validator. Given a numbered list of potential company names extracted from a CSV, identify which ones are REAL company or business names.

REJECT entries that are:
- Cell references or numbers (e.g. "A1", "123", "Row 5")
- Column headers or labels (e.g. "Company Name", "Revenue", "Total")
- Summary rows (e.g. "Grand Total", "Sum", "Average", "Count")
- Blank or meaningless strings (e.g. "-", "N/A", "TBD", "...", "null")
- Pure numbers or codes that aren't company identifiers
- Single characters or very short non-name strings
- Generic descriptions that aren't company names (e.g. "Various", "Other", "Unknown")

ACCEPT entries that look like real business/company names, even if abbreviated or informal. When in doubt, ACCEPT — it's better to keep a questionable company than delete a real one.`,
            },
            {
              role: "user",
              content: `Which of these are real company names? Return ONLY the index numbers of valid companies.\n\n${names}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "validate_companies",
                description: "Return the indices of entries that are valid company names",
                parameters: {
                  type: "object",
                  properties: {
                    valid_indices: {
                      type: "array",
                      items: { type: "integer" },
                      description: "Array of 0-based indices of entries that are real company names",
                    },
                    rejected_examples: {
                      type: "array",
                      items: { type: "string" },
                      description: "A few examples of rejected entries for logging",
                    },
                  },
                  required: ["valid_indices"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "validate_companies" } },
        }),
      });

      if (!response.ok) {
        console.warn(`AI validation failed for batch ${i / VALIDATION_BATCH_SIZE + 1}, keeping all entries`);
        validCompanies.push(...batch);
        continue;
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall) {
        console.warn("AI validation returned no tool call, keeping all entries");
        validCompanies.push(...batch);
        continue;
      }

      const { valid_indices, rejected_examples } = JSON.parse(toolCall.function.arguments);

      if (rejected_examples?.length > 0) {
        console.log(`Rejected examples: ${rejected_examples.join(", ")}`);
      }

      const validSet = new Set(valid_indices as number[]);
      const validated = batch.filter((_, idx) => validSet.has(idx));
      validCompanies.push(...validated);

      const rejected = batch.length - validated.length;
      console.log(`Validation batch ${Math.floor(i / VALIDATION_BATCH_SIZE) + 1}: kept ${validated.length}, rejected ${rejected} non-company entries`);
    } catch (e) {
      console.warn("AI validation error, keeping batch:", e);
      validCompanies.push(...batch);
    }
  }

  console.log(`AI validation complete: ${validCompanies.length} valid companies out of ${companies.length} total entries`);
  return validCompanies;
}

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
      company_name: c.company_name as string,
      geography: (c.geography as string) || null,
      industry: (c.industry as string) || null,
      description_of_activities: (c.description_of_activities as string) || null,
      companies_house_number: (c.companies_house_number as string) || null,
      website: (c.website as string) || null,
      address: (c.address as string) || null,
      revenue: (c.revenue as number) || null,
      profit_before_tax: (c.profit_before_tax as number) || null,
      net_assets: (c.net_assets as number) || null,
      total_assets: (c.total_assets as number) || null,
      revenue_band: (c.revenue_band as string) || null,
      asset_band: (c.asset_band as string) || null,
      status: (c.status as string) || "new",
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

async function storeCSV(
  supabase: ReturnType<typeof createClient>,
  mandateId: string,
  csvContent: string,
  fileName: string
) {
  try {
    const blob = new Blob([csvContent], { type: "text/csv" });
    const path = `${mandateId}/${fileName}`;
    await supabase.storage.from("mandate-uploads").upload(path, blob, {
      contentType: "text/csv",
      upsert: true,
    });
    console.log(`Stored CSV at mandate-uploads/${path}`);
  } catch (e) {
    console.error("Failed to store CSV:", e);
  }
}

async function processInBackground(
  authHeader: string,
  mandateId: string,
  csvContent: string
) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Store CSV for future re-analysis
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await storeCSV(supabase, mandateId, csvContent, `upload-${timestamp}.csv`);

    // Extract headers and sample rows for AI
    const lines = csvContent.trim().split(/\r?\n/);
    const headers = parseCSVLine(lines[0]);
    const sampleRows: Record<string, string>[] = [];
    for (let i = 1; i < Math.min(6, lines.length); i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      sampleRows.push(row);
    }

    // Try AI mapping first, fall back to hardcoded
    let mapping: Map<string, { db_field: string; is_numeric: boolean; multiplier: number }>;
    try {
      const aiMappings = await getAIMappings(headers, sampleRows);
      console.log("AI mappings received:", JSON.stringify(aiMappings));
      if (aiMappings.length > 0) {
        mapping = buildMappingFromAI(aiMappings);
        console.log(`Using AI mapping with ${mapping.size} fields:`, JSON.stringify([...mapping.entries()]));
      } else {
        mapping = fallbackMapping(headers);
        console.log(`Using fallback mapping with ${mapping.size} fields:`, JSON.stringify([...mapping.entries()]));
      }
    } catch (e) {
      console.warn("AI mapping error, using fallback:", e);
      mapping = fallbackMapping(headers);
    }

    const companies = parseCSVWithMapping(csvContent, mapping);
    console.log(`Background: parsed ${companies.length} companies`);

    if (companies.length === 0) {
      console.error("Background: No valid companies found");
      return;
    }

    // AI validation: only run for small uploads to avoid timeout
    let validatedCompanies: CompanyRow[];
    if (companies.length <= 500) {
      validatedCompanies = await validateCompanyNames(companies);
      console.log(`Background: ${validatedCompanies.length} companies passed AI validation (${companies.length - validatedCompanies.length} rejected)`);
    } else {
      console.log(`Background: Skipping AI validation for large upload (${companies.length} companies) to avoid timeout`);
      validatedCompanies = companies;
    }

    if (validatedCompanies.length === 0) {
      console.error("Background: No valid companies found after validation");
      return;
    }

    // Deduplicate by company_name (keep first occurrence)
    const seen = new Set<string>();
    const deduplicated = validatedCompanies.filter((c) => {
      const key = (c.company_name as string).trim().toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`Background: ${deduplicated.length} unique companies after deduplication (${validatedCompanies.length - deduplicated.length} duplicates removed)`);

    const totalInserted = await insertInBatches(supabase, mandateId, deduplicated);
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

    const lineCount = csv_content.split("\n").length - 1;

    EdgeRuntime.waitUntil(processInBackground(authHeader, mandate_id, csv_content));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing ~${lineCount} companies with AI-powered field mapping. They will appear shortly.`,
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
