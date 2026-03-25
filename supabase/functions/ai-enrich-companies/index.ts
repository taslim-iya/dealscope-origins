import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mandate_id, fields_to_enrich } = await req.json();

    if (!mandate_id) {
      return new Response(JSON.stringify({ error: "mandate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for the actual work
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if there's a stored CSV in mandate-uploads
    const { data: files } = await serviceSupabase.storage
      .from("mandate-uploads")
      .list(mandate_id, { limit: 10 });

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No uploaded files found for this mandate. Please upload a file first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the most recent file
    const latestFile = files.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from("mandate-uploads")
      .download(`${mandate_id}/${latestFile.name}`);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download stored file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvContent = await fileData.text();

    // Kick off background enrichment
    EdgeRuntime.waitUntil(
      enrichInBackground(serviceSupabase, mandate_id, csvContent, fields_to_enrich)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Re-analyzing ${latestFile.name} to enrich company data. Updates will appear shortly.`,
        file_name: latestFile.name,
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

async function enrichInBackground(
  supabase: ReturnType<typeof createClient>,
  mandateId: string,
  csvContent: string,
  fieldsToEnrich?: string[]
) {
  try {
    const lines = csvContent.trim().split(/\r?\n/);
    if (lines.length < 2) {
      console.error("CSV has no data rows");
      return;
    }

    const headers = parseCSVLine(lines[0]);

    // Build sample rows for AI mapping
    const sampleRows: Record<string, string>[] = [];
    for (let i = 1; i < Math.min(6, lines.length); i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      sampleRows.push(row);
    }

    // Call AI mapping
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return;
    }

    const mapResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-map-columns`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ headers, sample_rows: sampleRows }),
      }
    );

    if (!mapResponse.ok) {
      console.error("AI mapping failed:", await mapResponse.text());
      return;
    }

    const { mappings } = await mapResponse.json();
    console.log("AI mappings:", JSON.stringify(mappings));

    // Build header->field map
    const headerToField: Record<string, { db_field: string; is_numeric: boolean; multiplier: number }> = {};
    for (const m of mappings) {
      // Only use high/medium confidence mappings
      if (m.confidence === "low") continue;
      headerToField[m.csv_header] = {
        db_field: m.db_field,
        is_numeric: m.is_numeric || false,
        multiplier: m.multiplier || 1,
      };
    }

    // Get existing companies for this mandate (to match by name)
    const { data: existingCompanies } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("mandate_id", mandateId);

    const companyMap = new Map<string, string>();
    if (existingCompanies) {
      for (const c of existingCompanies) {
        companyMap.set(c.company_name.toLowerCase().trim(), c.id);
      }
    }

    // Find the company_name header
    let companyNameHeader: string | null = null;
    for (const [csvH, info] of Object.entries(headerToField)) {
      if (info.db_field === "company_name") {
        companyNameHeader = csvH;
        break;
      }
    }

    if (!companyNameHeader) {
      console.error("Could not identify company_name column");
      return;
    }

    const parseNumeric = (value: string, multiplier: number): number | undefined => {
      if (!value) return undefined;
      const cleaned = value.replace(/[£$,\s%]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) return undefined;
      return num * multiplier;
    };

    // Process rows and update existing companies
    let updated = 0;
    const BATCH = 50;
    const updates: { id: string; data: Record<string, unknown> }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      const companyName = row[companyNameHeader];
      if (!companyName) continue;

      const companyId = companyMap.get(companyName.toLowerCase().trim());
      if (!companyId) continue; // Company not in database

      // Build update object
      const updateData: Record<string, unknown> = {};
      for (const [csvH, info] of Object.entries(headerToField)) {
        if (info.db_field === "company_name") continue; // Don't update name
        if (fieldsToEnrich && !fieldsToEnrich.includes(info.db_field)) continue;

        const rawValue = row[csvH];
        if (!rawValue) continue;

        if (info.is_numeric) {
          const num = parseNumeric(rawValue, info.multiplier);
          if (num !== undefined) updateData[info.db_field] = num;
        } else {
          updateData[info.db_field] = rawValue;
        }
      }

      if (Object.keys(updateData).length > 0) {
        updates.push({ id: companyId, data: updateData });
      }
    }

    // Execute updates in batches
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(
        batch.map(({ id, data }) =>
          supabase.from("companies").update(data).eq("id", id)
        )
      );
      updated += batch.length;
      console.log(`Enriched ${updated} / ${updates.length} companies`);
    }

    console.log(`Enrichment complete. Updated ${updated} companies.`);
  } catch (error) {
    console.error("Enrichment error:", error);
  }
}
