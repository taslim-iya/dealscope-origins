import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 100;

async function validateBatch(
  companies: { id: string; company_name: string }[]
): Promise<Set<string>> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const names = companies.map((c, idx) => `${idx}: ${c.company_name}`).join("\n");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: `You are a data quality validator. Given a numbered list of entries from a company database, identify which ones are NOT real company or business names and should be REMOVED.

REMOVE entries that are:
- Cell references or numbers (e.g. "A1", "123", "Row 5", "1.0", "2.0")
- Column headers or labels (e.g. "Company Name", "Revenue", "Total")
- Summary rows (e.g. "Grand Total", "Sum", "Average", "Count")
- Blank or meaningless strings (e.g. "-", "N/A", "TBD", "...", "null")
- Pure numbers or numeric codes that clearly aren't company names
- Single characters or very short non-name strings
- Generic descriptions (e.g. "Various", "Other", "Unknown")
- Financial figures or dates stored as names

KEEP entries that look like real business/company names, even if abbreviated. When in doubt, KEEP — it's better to keep a questionable entry than delete a real company.`,
        },
        {
          role: "user",
          content: `Which entries should be REMOVED because they are NOT real company names? Return the indices of entries to DELETE.\n\n${names}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "identify_invalid_entries",
            description: "Return indices of entries that are NOT valid company names and should be deleted",
            parameters: {
              type: "object",
              properties: {
                invalid_indices: {
                  type: "array",
                  items: { type: "integer" },
                  description: "0-based indices of entries to remove",
                },
                examples: {
                  type: "array",
                  items: { type: "string" },
                  description: "Examples of invalid entries found",
                },
              },
              required: ["invalid_indices"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "identify_invalid_entries" } },
    }),
  });

  if (!response.ok) {
    console.warn("AI validation request failed:", response.status);
    return new Set();
  }

  const aiResult = await response.json();
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return new Set();

  const { invalid_indices, examples } = JSON.parse(toolCall.function.arguments);

  if (examples?.length > 0) {
    console.log(`Invalid examples found: ${examples.join(", ")}`);
  }

  const idsToDelete = new Set<string>();
  for (const idx of invalid_indices) {
    if (idx >= 0 && idx < companies.length) {
      idsToDelete.add(companies[idx].id);
    }
  }
  return idsToDelete;
}

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

    // Fetch all companies for this mandate
    const { data: companies, error: fetchError } = await serviceSupabase
      .from("companies")
      .select("id, company_name")
      .eq("mandate_id", mandate_id);

    if (fetchError || !companies) {
      return new Response(JSON.stringify({ error: "Failed to fetch companies" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in background
    EdgeRuntime.waitUntil((async () => {
      let totalDeleted = 0;
      const allIdsToDelete: string[] = [];

      for (let i = 0; i < companies.length; i += BATCH_SIZE) {
        const batch = companies.slice(i, i + BATCH_SIZE);
        try {
          const invalidIds = await validateBatch(batch);
          allIdsToDelete.push(...invalidIds);
          console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: found ${invalidIds.size} invalid entries`);
        } catch (e) {
          console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} validation failed:`, e);
        }
      }

      // Delete invalid entries
      if (allIdsToDelete.length > 0) {
        for (let i = 0; i < allIdsToDelete.length; i += 100) {
          const batch = allIdsToDelete.slice(i, i + 100);
          const { error: deleteError } = await serviceSupabase
            .from("companies")
            .delete()
            .in("id", batch);

          if (deleteError) {
            console.error("Delete error:", deleteError.message);
          } else {
            totalDeleted += batch.length;
          }
        }

        // Update mandate companies_delivered count
        const { count } = await serviceSupabase
          .from("companies")
          .select("id", { count: "exact", head: true })
          .eq("mandate_id", mandate_id);

        await serviceSupabase
          .from("mandates")
          .update({ companies_delivered: count || 0 })
          .eq("id", mandate_id);
      }

      console.log(`Cleanup complete: removed ${totalDeleted} invalid entries out of ${companies.length} total`);
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scanning ${companies.length} entries for non-company data. Invalid entries will be removed automatically.`,
        total_entries: companies.length,
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