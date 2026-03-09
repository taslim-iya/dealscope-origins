import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Search for listings and return results immediately
async function searchListings(apiKey: string, query: string, limit: number = 20): Promise<any[]> {
  console.log(`Searching: "${query}" (limit: ${limit})`);
  
  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      lang: "en",
      country: "gb",
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`Search returned ${data.data?.length || 0} results`);
    return data.data || [];
  } else {
    const errText = await response.text();
    console.error(`Search failed:`, errText);
    return [];
  }
}

// Extract deals from search results using AI
async function extractDealsFromResults(
  results: any[],
  lovableApiKey: string
): Promise<any[]> {
  if (!lovableApiKey || results.length === 0) return [];

  const content = results
    .map((r) => `--- URL: ${r.url} ---\nTitle: ${r.title}\n${r.markdown?.substring(0, 2000) || r.description || ""}`)
    .join("\n\n");

  if (content.length < 200) return [];

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `Extract business-for-sale listings from these search results. For each listing extract:
- company_name: Business name (REQUIRED)
- asking_price: Sale price (e.g., "£250,000")
- location: UK city/region
- industry: Business type
- revenue: Annual turnover
- profit: Annual profit
- description: Brief description (max 200 chars)
- source_url: The URL

Only extract REAL business listings. Return JSON: {"listings": [...]}

Results:
${content.substring(0, 80000)}`,
          },
        ],
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const responseContent = aiData.choices?.[0]?.message?.content || "";
      const cleanContent = responseContent.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*"listings"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.listings || [];
      }
    }
  } catch (e) {
    console.error("AI extraction error:", e);
  }
  return [];
}

serve(async (req) => {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: scrapeSources, error: sourcesError } = await supabaseAdmin
      .from("scrape_sources")
      .select("*")
      .eq("is_active", true);

    if (sourcesError || !scrapeSources || scrapeSources.length === 0) {
      return new Response(
        JSON.stringify({ error: sourcesError ? "Failed to fetch sources" : "No active sources" }),
        { status: sourcesError ? 500 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scrapeSources.length} active scrape sources`);

    const { data: logData } = await supabase
      .from("scrape_logs")
      .insert({ user_id: userId, source: "Marketplace Search", status: "running" })
      .select("id")
      .single();
    const logId = logData?.id;

    let totalInserted = 0;
    let totalSearchResults = 0;

    try {
      // Build search queries for each source
      const searchQueries = scrapeSources.flatMap((source) => {
        const baseQuery = `${source.search_query} site:${source.url}`;
        // Run multiple searches with different filters to get more results
        return [
          { query: baseQuery, sourceName: source.name },
          { query: `${source.search_query} for sale site:${source.url}`, sourceName: source.name },
          { query: `business acquisition ${source.search_query} site:${source.url}`, sourceName: source.name },
        ];
      });

      // Process each search query
      for (const { query, sourceName } of searchQueries) {
        console.log(`Processing: ${query}`);
        
        // Get search results (up to 20 per query)
        const searchResults = await searchListings(FIRECRAWL_API_KEY, query, 20);
        totalSearchResults += searchResults.length;

        if (searchResults.length === 0) continue;

        // Extract deals using AI
        const deals = await extractDealsFromResults(searchResults, LOVABLE_API_KEY!);
        console.log(`Extracted ${deals.length} deals from ${sourceName}`);

        // Save each deal immediately (incremental saving)
        for (const deal of deals) {
          if (!deal.company_name) continue;

          const dealUrl = deal.source_url || searchResults[0]?.url || `https://${sourceName.toLowerCase()}.com`;
          
          // Determine source name from URL
          let finalSourceName = sourceName;
          try {
            const urlObj = new URL(dealUrl);
            finalSourceName = urlObj.hostname.replace(/^www\./, "").split(".")[0];
            finalSourceName = finalSourceName.charAt(0).toUpperCase() + finalSourceName.slice(1);
          } catch (_) {}

          const { error: insertError } = await supabaseAdmin.from("on_market_deals").upsert(
            {
              user_id: userId,
              source: finalSourceName,
              source_url: dealUrl,
              company_name: deal.company_name,
              asking_price: deal.asking_price || null,
              location: deal.location || null,
              industry: deal.industry || null,
              revenue: deal.revenue || null,
              profit: deal.profit || null,
              net_assets: deal.net_assets || null,
              description: deal.description || null,
              ai_summary: deal.ai_summary || null,
              scraped_at: new Date().toISOString(),
            },
            { onConflict: "source_url" }
          );

          if (!insertError) {
            totalInserted++;
          } else {
            console.error("Insert error:", insertError.message);
          }
        }

        // Small delay between searches to avoid rate limits
        await new Promise((r) => setTimeout(r, 500));
      }

      if (logId) {
        await supabase
          .from("scrape_logs")
          .update({ status: "completed", deals_found: totalInserted, completed_at: new Date().toISOString() })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          deals_found: totalInserted,
          search_results: totalSearchResults,
          sources_searched: scrapeSources.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (sourceError) {
      console.error("Scrape error:", sourceError);
      if (logId) {
        await supabase
          .from("scrape_logs")
          .update({
            status: "error",
            deals_found: totalInserted,
            error_message: sourceError instanceof Error ? sourceError.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      
      // Return partial results even on error
      return new Response(
        JSON.stringify({
          success: totalInserted > 0,
          deals_found: totalInserted,
          error: sourceError instanceof Error ? sourceError.message : "Partial failure",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});