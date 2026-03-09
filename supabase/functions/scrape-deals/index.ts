import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function startCrawl(apiKey: string, url: string, searchQuery: string): Promise<string | null> {
  console.log(`Starting crawl for: ${url} with query context: ${searchQuery}`);
  const response = await fetch("https://api.firecrawl.dev/v1/crawl", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url.startsWith("http") ? url : `https://${url}`,
      limit: 500,
      maxDepth: 3,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`Crawl started for ${url}, job id: ${data.id}`);
    return data.id || null;
  } else {
    const errText = await response.text();
    console.error(`Failed to start crawl for ${url}:`, errText);
    return null;
  }
}

async function pollCrawl(apiKey: string, crawlId: string, maxWaitMs: number = 55000): Promise<any[]> {
  const startTime = Date.now();
  let allResults: any[] = [];

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 5000)); // Wait 5s between polls

    const response = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.error(`Poll error for ${crawlId}:`, await response.text());
      break;
    }

    const data = await response.json();
    console.log(`Crawl ${crawlId}: status=${data.status}, completed=${data.completed}/${data.total}`);

    if (data.data && data.data.length > 0) {
      allResults = data.data;
    }

    if (data.status === "completed" || data.status === "failed") {
      break;
    }
  }

  return allResults;
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
        JSON.stringify({ error: sourcesError ? "Failed to fetch scrape sources" : "No active scrape sources configured" }),
        { status: sourcesError ? 500 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scrapeSources.length} active scrape sources`);

    const { data: logData } = await supabase
      .from("scrape_logs")
      .insert({ user_id: userId, source: "Marketplace Crawler", status: "running" })
      .select("id")
      .single();
    const logId = logData?.id;

    try {
      // Start crawls for all sources in parallel
      const crawlJobs = await Promise.all(
        scrapeSources.map(async (source) => ({
          source,
          crawlId: await startCrawl(FIRECRAWL_API_KEY, source.url, source.search_query),
        }))
      );

      const validJobs = crawlJobs.filter((j) => j.crawlId !== null);
      console.log(`Started ${validJobs.length} crawl jobs`);

      // Poll all crawls in parallel with a shared timeout
      const crawlResults = await Promise.all(
        validJobs.map(async (job) => ({
          source: job.source,
          results: await pollCrawl(FIRECRAWL_API_KEY, job.crawlId!, 55000),
        }))
      );

      // Combine all results
      const allPageResults: Array<{ markdown: string; url: string; sourceName: string }> = [];
      for (const cr of crawlResults) {
        console.log(`Crawl for ${cr.source.name}: ${cr.results.length} pages`);
        for (const page of cr.results) {
          if (page.markdown || page.metadata?.sourceURL) {
            allPageResults.push({
              markdown: page.markdown || "",
              url: page.metadata?.sourceURL || "",
              sourceName: cr.source.name,
            });
          }
        }
      }

      console.log(`Total crawled pages: ${allPageResults.length}`);

      // Dedupe by URL
      const uniqueResults = Array.from(
        new Map(allPageResults.map((r) => [r.url, r])).values()
      );
      console.log(`Unique pages after dedup: ${uniqueResults.length}`);

      // Process in chunks for AI extraction (100k char limit per chunk)
      let allDeals: Array<{
        company_name?: string;
        asking_price?: string;
        location?: string;
        industry?: string;
        revenue?: string;
        profit?: string;
        net_assets?: string;
        description?: string;
        source_url?: string;
        source_name?: string;
        ai_summary?: string;
      }> = [];

      const CHUNK_SIZE = 100000;
      let currentChunk = "";
      let chunkIndex = 0;
      const chunks: string[] = [];

      for (const r of uniqueResults) {
        const entry = `\n--- Source: ${r.sourceName} | URL: ${r.url} ---\n${r.markdown.substring(0, 3000)}\n`;
        if (currentChunk.length + entry.length > CHUNK_SIZE) {
          chunks.push(currentChunk);
          currentChunk = entry;
        } else {
          currentChunk += entry;
        }
      }
      if (currentChunk.length > 100) chunks.push(currentChunk);

      console.log(`Processing ${chunks.length} content chunks through AI`);

      // Process chunks through AI (sequentially to avoid rate limits)
      for (const chunk of chunks) {
        if (!LOVABLE_API_KEY || chunk.length < 200) continue;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: `You are extracting business-for-sale listings from UK business marketplace crawl results.

Analyze this content and extract ALL unique business listings you can find. For each listing:
- company_name: The business name/title (REQUIRED - skip if not found)
- asking_price: The sale price (e.g., "£250,000")
- location: UK city/region
- industry: Type of business
- revenue: Annual turnover if mentioned
- profit: Annual profit if mentioned
- description: Brief business description (max 200 chars)
- source_url: The URL where this listing was found
- source_name: The marketplace name from the "Source:" marker

IMPORTANT:
- Extract REAL business listings only, not navigation/ads
- Each listing should be unique
- If no valid listings found, return {"listings": []}
- Return ONLY valid JSON

Return format: {"listings": [...]}

Crawled content:
${chunk}`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            try {
              let cleanContent = content.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
              const jsonMatch = cleanContent.match(/\{[\s\S]*"listings"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const chunkDeals = parsed.listings || [];
                console.log(`AI extracted ${chunkDeals.length} deals from chunk`);
                allDeals.push(...chunkDeals);
              }
            } catch (e) {
              console.error("Failed to parse AI response:", e);
            }
          }
        } catch (e) {
          console.error("AI extraction error:", e);
        }
      }

      // Fallback: extract from page titles if AI found nothing
      if (allDeals.length === 0 && uniqueResults.length > 0) {
        console.log("Falling back to direct extraction...");
        allDeals = uniqueResults
          .filter((r) => r.markdown.length > 50)
          .slice(0, 200)
          .map((r) => {
            const titleMatch = r.markdown.match(/^#\s+(.+)/m);
            return {
              company_name: titleMatch?.[1]?.substring(0, 100) || r.url.split("/").pop() || "Unknown",
              description: r.markdown.substring(0, 200),
              source_url: r.url,
              source_name: r.sourceName,
              location: "UK",
              industry: "Various",
            };
          });
      }

      // Dedupe deals by company name
      const uniqueDeals = Array.from(
        new Map(allDeals.map((d) => [d.company_name?.toLowerCase(), d])).values()
      ).filter((d) => d.company_name);

      console.log(`Total unique deals: ${uniqueDeals.length}`);

      // Store deals in database
      let insertedCount = 0;
      for (const deal of uniqueDeals) {
        if (!deal.company_name) continue;

        const dealUrl = deal.source_url || `https://marketplace.search/#${encodeURIComponent(deal.company_name.substring(0, 50))}`;
        let sourceName = deal.source_name || "Marketplace";
        if (!deal.source_name) {
          try {
            const urlObj = new URL(dealUrl);
            sourceName = urlObj.hostname.replace(/^www\./, "").split(".")[0];
            sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
          } catch (_) {}
        }

        const { error: insertError } = await supabase.from("on_market_deals").upsert(
          {
            user_id: userId,
            source: sourceName,
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

        if (!insertError) insertedCount++;
        else console.error("Insert error:", insertError);
      }

      if (logId) {
        await supabase
          .from("scrape_logs")
          .update({ status: "completed", deals_found: insertedCount, completed_at: new Date().toISOString() })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          deals_found: insertedCount,
          sources_searched: scrapeSources.length,
          pages_crawled: uniqueResults.length,
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
            error_message: sourceError instanceof Error ? sourceError.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      throw sourceError;
    }
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
