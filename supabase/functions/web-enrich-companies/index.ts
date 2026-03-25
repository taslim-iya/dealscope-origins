import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENRICHABLE_FIELDS = [
  "industry",
  "website",
  "description_of_activities",
  "address",
  "geography",
];

interface CompanyToEnrich {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  description_of_activities: string | null;
  address: string | null;
  geography: string | null;
}

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

    const { mandate_id } = await req.json();

    if (!mandate_id) {
      return new Response(JSON.stringify({ error: "mandate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch companies that have at least one empty enrichable field
    const { data: companies, error: fetchError } = await serviceSupabase
      .from("companies")
      .select("id, company_name, industry, website, description_of_activities, address, geography")
      .eq("mandate_id", mandate_id)
      .limit(1000000);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to companies missing at least one field
    const needsEnrichment = (companies || []).filter((c: CompanyToEnrich) =>
      ENRICHABLE_FIELDS.some((f) => !c[f as keyof CompanyToEnrich])
    );

    if (needsEnrichment.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "All companies already have complete data.", enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Start background enrichment
    EdgeRuntime.waitUntil(
      enrichCompaniesViaWeb(serviceSupabase, needsEnrichment as CompanyToEnrich[])
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Web enrichment started for ${needsEnrichment.length} companies with missing data. Updates will appear as they complete.`,
        companies_to_enrich: needsEnrichment.length,
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

async function enrichCompaniesViaWeb(
  supabase: ReturnType<typeof createClient>,
  companies: CompanyToEnrich[]
) {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY not configured");
    return;
  }
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return;
  }

  let enriched = 0;
  const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limits

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (company) => {
        try {
          const updated = await enrichSingleCompany(supabase, company, FIRECRAWL_API_KEY, LOVABLE_API_KEY);
          if (updated) enriched++;
        } catch (e) {
          console.error(`Failed to enrich ${company.company_name}:`, e);
        }
      })
    );

    console.log(`Web enriched ${Math.min(i + BATCH_SIZE, companies.length)} / ${companies.length} companies (${enriched} updated)`);

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < companies.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`Web enrichment complete. Updated ${enriched} / ${companies.length} companies.`);
}

async function enrichSingleCompany(
  supabase: ReturnType<typeof createClient>,
  company: CompanyToEnrich,
  firecrawlKey: string,
  lovableKey: string
): Promise<boolean> {
  // Figure out which fields are missing
  const missingFields = ENRICHABLE_FIELDS.filter(
    (f) => !company[f as keyof CompanyToEnrich]
  );

  if (missingFields.length === 0) return false;

  // Search for company info using Firecrawl
  const searchQuery = `${company.company_name} UK company`;
  
  const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: searchQuery,
      limit: 3,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!searchResponse.ok) {
    const errText = await searchResponse.text();
    console.error(`Firecrawl search failed for ${company.company_name}: ${searchResponse.status} ${errText}`);
    return false;
  }

  const searchData = await searchResponse.json();
  const results = searchData.data || [];

  if (results.length === 0) {
    console.log(`No search results for ${company.company_name}`);
    return false;
  }

  // Combine search result content (truncate to avoid token limits)
  const combinedContent = results
    .map((r: any) => {
      const parts = [];
      if (r.title) parts.push(`Title: ${r.title}`);
      if (r.url) parts.push(`URL: ${r.url}`);
      if (r.markdown) parts.push(r.markdown.substring(0, 1500));
      else if (r.description) parts.push(r.description);
      return parts.join("\n");
    })
    .join("\n---\n")
    .substring(0, 5000);

  // Use AI to extract structured info
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a company data extraction assistant. Extract company information from web search results. Return ONLY a JSON object with the requested fields. If a field cannot be determined from the search results, set it to null. Be precise and factual.`,
        },
        {
          role: "user",
          content: `Company name: "${company.company_name}"

I need to find the following missing fields: ${missingFields.join(", ")}

Field descriptions:
- industry: The company's primary industry/sector (e.g., "Manufacturing", "Technology", "Retail")
- website: The company's official website URL (e.g., "https://example.com")
- description_of_activities: A brief description of what the company does (1-2 sentences)
- address: The company's registered/main office address
- geography: The region/area where the company is based (e.g., "London", "North West England", "Scotland")

Here are the web search results:

${combinedContent}

Return a JSON object with ONLY the missing fields (${missingFields.join(", ")}). Set any field you can't determine to null.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_company_info",
            description: "Extract company information from search results",
            parameters: {
              type: "object",
              properties: {
                industry: { type: ["string", "null"], description: "Primary industry/sector" },
                website: { type: ["string", "null"], description: "Official website URL" },
                description_of_activities: { type: ["string", "null"], description: "Brief description of activities" },
                address: { type: ["string", "null"], description: "Registered/main office address" },
                geography: { type: ["string", "null"], description: "Region/area" },
              },
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_company_info" } },
    }),
  });

  if (!aiResponse.ok) {
    console.error(`AI extraction failed for ${company.company_name}: ${aiResponse.status}`);
    return false;
  }

  const aiData = await aiResponse.json();
  
  let extracted: Record<string, string | null> = {};
  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      extracted = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    }
  } catch (e) {
    console.error(`Failed to parse AI response for ${company.company_name}:`, e);
    return false;
  }

  // Build update with only non-null extracted values for missing fields
  const updateData: Record<string, string> = {};
  for (const field of missingFields) {
    const value = extracted[field];
    if (value && typeof value === "string" && value.trim()) {
      updateData[field] = value.trim();
    }
  }

  if (Object.keys(updateData).length === 0) {
    console.log(`No data found for ${company.company_name}`);
    return false;
  }

  const { error } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", company.id);

  if (error) {
    console.error(`Update failed for ${company.company_name}:`, error.message);
    return false;
  }

  console.log(`Enriched ${company.company_name}: ${Object.keys(updateData).join(", ")}`);
  return true;
}
