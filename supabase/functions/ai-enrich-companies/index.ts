import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENRICH_BATCH_SIZE = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Count companies needing enrichment
    const { count } = await serviceSupabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("mandate_id", mandate_id)
      .or("industry.is.null,description_of_activities.is.null,geography.is.null");

    EdgeRuntime.waitUntil(
      enrichWithAIKnowledge(serviceSupabase, mandate_id)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Enriching ~${count || 0} companies using AI knowledge. Updates will appear as they complete.`,
        companies_to_enrich: count || 0,
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

async function enrichWithAIKnowledge(
  supabase: ReturnType<typeof createClient>,
  mandateId: string
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return;
  }

  try {
    // Fetch all companies missing key fields
    let allCompanies: { id: string; company_name: string; industry: string | null; geography: string | null; description_of_activities: string | null; revenue: number | null; website: string | null }[] = [];
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("companies")
        .select("id, company_name, industry, geography, description_of_activities, revenue, website")
        .eq("mandate_id", mandateId)
        .or("industry.is.null,description_of_activities.is.null,geography.is.null")
        .range(offset, offset + PAGE - 1);

      if (error) {
        console.error("Fetch error:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allCompanies = allCompanies.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`Found ${allCompanies.length} companies needing enrichment`);
    if (allCompanies.length === 0) return;

    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < allCompanies.length; i += ENRICH_BATCH_SIZE) {
      const batch = allCompanies.slice(i, i + ENRICH_BATCH_SIZE);

      const companySummaries = batch.map((c, idx) => {
        const parts = [`${idx}: "${c.company_name}"`];
        if (c.website) parts.push(`website: ${c.website}`);
        if (c.industry) parts.push(`industry: ${c.industry}`);
        if (c.geography) parts.push(`location: ${c.geography}`);
        return parts.join(" | ");
      }).join("\n");

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a business research assistant. Given a list of company names (and any known info), provide the most likely industry, a brief description of activities, and geographic location for each.

Use your knowledge of real companies. If you recognise the company, provide accurate information. If you don't recognise it, make a reasonable inference from the company name (e.g. "Smith's Bakery" is likely a bakery in the food industry).

For revenue: only provide if you have reliable knowledge of the company's approximate annual revenue in GBP or USD. Use the raw number (e.g. 5000000 for £5M). Set to null if unknown — do NOT guess revenue.

IMPORTANT: Be accurate. It's better to return null for a field than to guess incorrectly.`,
              },
              {
                role: "user",
                content: `Enrich these companies with missing details:\n\n${companySummaries}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "enrich_companies",
                  description: "Return enriched company data",
                  parameters: {
                    type: "object",
                    properties: {
                      companies: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "integer", description: "0-based index from input" },
                            industry: { type: "string", description: "Industry sector (e.g. Insurance, Technology, Healthcare). Null if truly unknown.", nullable: true },
                            description_of_activities: { type: "string", description: "Brief 1-2 sentence description of what the company does. Null if truly unknown.", nullable: true },
                            geography: { type: "string", description: "Location/region (e.g. 'California, USA' or 'London, UK'). Null if unknown.", nullable: true },
                            revenue: { type: "number", description: "Approximate annual revenue as raw number. Null if unknown — do NOT guess.", nullable: true },
                          },
                          required: ["index"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["companies"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "enrich_companies" } },
            max_tokens: 8192,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`AI enrichment failed for batch ${Math.floor(i / ENRICH_BATCH_SIZE) + 1}: ${response.status} ${errText}`);
          failed += batch.length;

          if (response.status === 429) {
            console.log("Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
          }
          continue;
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall) {
          console.warn("No tool call in AI response, skipping batch");
          failed += batch.length;
          continue;
        }

        const { companies: enrichedData } = JSON.parse(toolCall.function.arguments);

        // Apply updates
        const updatePromises = (enrichedData || []).map(async (enrichment: { index: number; industry?: string | null; description_of_activities?: string | null; geography?: string | null; revenue?: number | null }) => {
          const company = batch[enrichment.index];
          if (!company) return;

          const updateData: Record<string, unknown> = {};

          // Only update fields that are currently null and AI provided a value
          if (!company.industry && enrichment.industry) {
            updateData.industry = enrichment.industry;
          }
          if (!company.description_of_activities && enrichment.description_of_activities) {
            updateData.description_of_activities = enrichment.description_of_activities;
          }
          if (!company.geography && enrichment.geography) {
            updateData.geography = enrichment.geography;
          }
          if (!company.revenue && enrichment.revenue && enrichment.revenue > 1000) {
            // Basic sanity check: revenue should be > 1000 to avoid year-like values
            updateData.revenue = enrichment.revenue;
          }

          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("companies")
              .update(updateData)
              .eq("id", company.id);

            if (error) {
              console.warn(`Failed to update ${company.company_name}: ${error.message}`);
            }
          }
        });

        await Promise.all(updatePromises);
        enriched += batch.length;
        console.log(`Enriched ${enriched} / ${allCompanies.length} companies`);

        // Small delay to avoid rate limits
        if (i + ENRICH_BATCH_SIZE < allCompanies.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        console.warn(`Batch error:`, e);
        failed += batch.length;
      }
    }

    console.log(`AI enrichment complete: ${enriched} enriched, ${failed} failed out of ${allCompanies.length}`);
  } catch (error) {
    console.error("Enrichment error:", error);
  }
}
