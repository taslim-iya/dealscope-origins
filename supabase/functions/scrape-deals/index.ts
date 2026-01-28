import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// UK business listing sources - using specific category pages for better results
const SOURCES = [
  {
    name: "BusinessesForSale UK",
    searchUrl: "https://uk.businessesforsale.com/uk/search/businesses-for-sale",
  },
  {
    name: "Daltons Business",
    searchUrl: "https://www.daltonsbusiness.com/businesses-for-sale",
  },
  {
    name: "RightBiz",
    searchUrl: "https://www.rightbiz.co.uk/buy-a-business",
  },
  {
    name: "Businesses For Sale UK",
    searchUrl: "https://www.businesses-for-sale.co.uk/search",
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
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }
    const { sources: requestedSources } = body as { sources?: string[] };

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter sources if specific ones requested
    const sourcesToScrape = requestedSources && requestedSources.length > 0
      ? SOURCES.filter((s) => 
          requestedSources.some(rs => 
            s.name.toLowerCase().includes(rs.toLowerCase()) || 
            rs.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
          )
        )
      : SOURCES;

    if (sourcesToScrape.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid sources specified", available: SOURCES.map(s => s.name) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { source: string; success: boolean; deals_found?: number; error?: string }[] = [];

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
        // Step 1: Scrape the page with Firecrawl using correct format
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
            waitFor: 5000,
            timeout: 30000,
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

        const markdown = scrapeData.data?.markdown || "";
        console.log(`Got ${markdown.length} chars of markdown from ${sourceConfig.name}`);

        // Check if we got actual content (not just cookie banners)
        if (markdown.length < 500 || markdown.toLowerCase().includes("page not found")) {
          console.log(`Insufficient content from ${sourceConfig.name}`);
          if (logId) {
            await supabase
              .from("scrape_logs")
              .update({
                status: "error",
                error_message: "Page did not return business listings",
                completed_at: new Date().toISOString(),
              })
              .eq("id", logId);
          }
          results.push({
            source: sourceConfig.name,
            success: false,
            error: "Page did not return business listings",
          });
          continue;
        }

        // Step 2: Use AI to extract listings
        let deals: {
          company_name?: string;
          asking_price?: string;
          location?: string;
          industry?: string;
          revenue?: string;
          profit?: string;
          net_assets?: string;
          description?: string;
          ai_summary?: string;
        }[] = [];

        if (LOVABLE_API_KEY) {
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
                  content: `You are extracting business-for-sale listings from a UK business marketplace website. 
                  
Analyze this webpage content and extract ALL business listings you can find. Look for patterns like:
- Business names or titles
- Asking prices (usually in GBP £)
- Locations in the UK
- Industries/sectors
- Revenue/turnover figures
- Profit figures
- Brief descriptions

For each listing found, extract:
- company_name: The business name/title (REQUIRED - skip if not found)
- asking_price: The sale price (e.g., "£250,000")
- location: UK city/region (e.g., "London", "Manchester")
- industry: Type of business (e.g., "Restaurant", "Retail", "Manufacturing")
- revenue: Annual turnover if mentioned
- profit: Annual profit if mentioned
- description: Brief business description (max 200 chars)

IMPORTANT: 
- Only extract actual business listings, not navigation or ads
- If you find no valid listings, return {"listings": []}
- Return ONLY valid JSON

Return a JSON object with format: {"listings": [...]}

Here is the webpage content from ${sourceConfig.name}:

${markdown.substring(0, 20000)}`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            console.log("AI response preview:", content.substring(0, 500));

            // Try to extract JSON from the response
            try {
              // Clean up the content - remove markdown code blocks if present
              let cleanContent = content
                .replace(/```json\n?/gi, "")
                .replace(/```\n?/gi, "")
                .trim();

              // Look for JSON object in the response
              const jsonMatch = cleanContent.match(/\{[\s\S]*"listings"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                deals = parsed.listings || [];
              } else if (cleanContent.startsWith("{")) {
                const parsed = JSON.parse(cleanContent);
                deals = parsed.listings || [];
              }
              console.log(`AI extracted ${deals.length} deals from ${sourceConfig.name}`);
            } catch (e) {
              console.error("Failed to parse AI response:", e);
            }
          } else {
            const errText = await aiResponse.text();
            console.error("AI error:", aiResponse.status, errText);
          }
        }

        // Step 3: Generate summaries for top deals (limit to 10)
        const dealsToProcess = deals.slice(0, 10);
        for (const deal of dealsToProcess) {
          if (LOVABLE_API_KEY && deal.company_name && !deal.ai_summary) {
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
                      content: `Write a concise 2-sentence investment summary for this UK business listing:
                      
Business: ${deal.company_name}
Industry: ${deal.industry || "Not specified"}
Location: ${deal.location || "UK"}
Asking Price: ${deal.asking_price || "Price on application"}
Revenue: ${deal.revenue || "Not disclosed"}
Description: ${deal.description || "No description available"}

Focus on key investment highlights and potential.`,
                    },
                  ],
                }),
              });

              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                deal.ai_summary = summaryData.choices?.[0]?.message?.content || null;
              }
            } catch (e) {
              console.error("Summary generation error:", e);
            }
          }
        }

        // Step 4: Store deals in database
        let insertedCount = 0;
        for (const deal of dealsToProcess) {
          if (!deal.company_name) continue;

          // Create a unique URL based on source and company name
          const dealUrl = `${sourceConfig.searchUrl}#${encodeURIComponent(deal.company_name.substring(0, 50))}`;

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
