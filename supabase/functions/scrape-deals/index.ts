import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCES = [
  {
    name: "BusinessesForSale UK",
    searchUrl: "https://uk.businessesforsale.com/uk/search/businesses-for-sale",
  },
  {
    name: "Rightmove Business",
    searchUrl: "https://www.rightmove.co.uk/commercial-property-for-sale.html",
  },
];

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }
    const { source } = body;

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourcesToScrape = source
      ? SOURCES.filter((s) => s.name === source)
      : SOURCES;

    if (sourcesToScrape.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid source specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const sourceConfig of sourcesToScrape) {
      console.log(`Scraping ${sourceConfig.name}...`);

      const { data: logData } = await supabase
        .from("scrape_logs")
        .insert({
          user_id: userId,
          source: sourceConfig.name,
          status: "running",
        })
        .select("id")
        .single();

      const logId = logData?.id;

      try {
        // Step 1: Scrape the page with Firecrawl
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: sourceConfig.searchUrl,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        const scrapeData = await scrapeResponse.json();

        if (!scrapeResponse.ok || !scrapeData.success) {
          console.error(`Firecrawl error for ${sourceConfig.name}:`, scrapeData);
          if (logId) {
            await supabase
              .from("scrape_logs")
              .update({
                status: "error",
                error_message: scrapeData.error || "Failed to scrape",
                completed_at: new Date().toISOString(),
              })
              .eq("id", logId);
          }
          results.push({
            source: sourceConfig.name,
            success: false,
            error: scrapeData.error || "Failed to scrape",
          });
          continue;
        }

        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        console.log(`Got ${markdown.length} chars of markdown from ${sourceConfig.name}`);

        // Step 2: Use AI to extract listings
        let deals: any[] = [];

        if (LOVABLE_API_KEY && markdown.length > 200) {
          console.log(`Using AI to extract listings from ${sourceConfig.name}...`);

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
                  content: `You are extracting business-for-sale listings. Analyze this webpage content and extract ALL business listings you can find.

For each listing, return:
- company_name: The business name/title (REQUIRED)
- asking_price: The sale price if shown
- location: UK city/region
- industry: Type of business
- revenue: Annual turnover if mentioned
- profit: Annual profit if mentioned  
- description: Brief business description

Return a JSON object with format: {"listings": [...]}

Here is the webpage content from ${sourceConfig.name}:

${markdown.substring(0, 15000)}`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            console.log("AI response preview:", content.substring(0, 300));
            
            // Try to extract JSON from the response
            try {
              // Look for JSON in the response
              const jsonMatch = content.match(/\{[\s\S]*"listings"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                deals = parsed.listings || [];
              } else if (content.includes("[")) {
                // Try to find array directly
                const arrayMatch = content.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                  deals = JSON.parse(arrayMatch[0]);
                }
              }
              console.log(`AI extracted ${deals.length} deals`);
            } catch (e) {
              console.error("Failed to parse AI response:", e, "Content:", content.substring(0, 500));
            }
          } else {
            const errText = await aiResponse.text();
            console.error("AI error:", aiResponse.status, errText);
          }
        }

        // Step 3: Generate summaries (limit to 10)
        const dealsToProcess = deals.slice(0, 10);
        for (const deal of dealsToProcess) {
          if (LOVABLE_API_KEY && deal.company_name) {
            try {
              const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    {
                      role: "user",
                      content: `Write a 2 sentence investment summary for: ${deal.company_name}, ${deal.industry || "business"} in ${deal.location || "UK"}. Price: ${deal.asking_price || "TBD"}. ${deal.description || ""}`,
                    },
                  ],
                }),
              });

              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                deal.ai_summary = summaryData.choices?.[0]?.message?.content || null;
              }
            } catch (e) {
              console.error("Summary error:", e);
            }
          }
        }

        // Step 4: Store deals
        let insertedCount = 0;
        for (const deal of dealsToProcess) {
          if (!deal.company_name) continue;

          const dealUrl = `${sourceConfig.searchUrl}#${encodeURIComponent(deal.company_name)}`;

          const { error: insertError } = await supabase.from("on_market_deals").upsert(
            {
              user_id: userId,
              source: sourceConfig.name,
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
            insertedCount++;
          } else {
            console.error("Insert error:", insertError);
          }
        }

        if (logId) {
          await supabase
            .from("scrape_logs")
            .update({
              status: "completed",
              deals_found: insertedCount,
              completed_at: new Date().toISOString(),
            })
            .eq("id", logId);
        }

        results.push({
          source: sourceConfig.name,
          success: true,
          deals_found: insertedCount,
        });
      } catch (sourceError) {
        console.error(`Error processing ${sourceConfig.name}:`, sourceError);
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
        results.push({
          source: sourceConfig.name,
          success: false,
          error: sourceError instanceof Error ? sourceError.message : "Unknown error",
        });
      }
    }

    const totalDeals = results.reduce((sum, r) => sum + (r.deals_found || 0), 0);

    return new Response(
      JSON.stringify({ success: true, results, deals_found: totalDeals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
