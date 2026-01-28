import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCES = [
  {
    name: "BusinessesForSale.com",
    searchUrl: "https://www.businessesforsale.com/search/businesses-for-sale/united-kingdom",
  },
  {
    name: "Daltons Business",
    searchUrl: "https://www.daltonsbusiness.com/buy-a-business",
  },
  {
    name: "RightBiz",
    searchUrl: "https://www.rightbiz.co.uk/businesses-for-sale",
  },
  {
    name: "BizBuySell UK",
    searchUrl: "https://www.bizbuysell.com/united-kingdom-businesses-for-sale/",
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
    const { source } = await req.json();

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter sources if specific one requested
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

      // Create scrape log
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
        // Step 1: Use Firecrawl to scrape the search results page
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

        // Step 2: Use AI to extract business listings from the markdown
        let deals: any[] = [];

        if (LOVABLE_API_KEY && markdown.length > 100) {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  content: `You are a data extraction expert. Extract business listings from the provided content. For each business, extract: company_name, asking_price, location, industry, revenue (if mentioned), profit (if mentioned), net_assets (if mentioned), description (brief), source_url (if available). Return a JSON array of objects. If no clear listings are found, return an empty array []. Only return valid JSON, no explanations.`,
                },
                {
                  role: "user",
                  content: `Extract business listings from this ${sourceConfig.name} page content:\n\n${markdown.substring(0, 15000)}`,
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_listings",
                    description: "Extract structured business listings",
                    parameters: {
                      type: "object",
                      properties: {
                        listings: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              company_name: { type: "string" },
                              asking_price: { type: "string" },
                              location: { type: "string" },
                              industry: { type: "string" },
                              revenue: { type: "string" },
                              profit: { type: "string" },
                              net_assets: { type: "string" },
                              description: { type: "string" },
                              source_url: { type: "string" },
                            },
                            required: ["company_name"],
                          },
                        },
                      },
                      required: ["listings"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "extract_listings" } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.arguments) {
              try {
                const parsed = JSON.parse(toolCall.function.arguments);
                deals = parsed.listings || [];
              } catch (e) {
                console.error("Failed to parse AI response:", e);
              }
            }
          } else {
            const errorText = await aiResponse.text();
            console.error("AI API error:", aiResponse.status, errorText);
          }
        }

        // Step 3: Generate AI summaries for each deal
        for (const deal of deals) {
          if (LOVABLE_API_KEY && deal.description) {
            try {
              const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                      content: "You are a business analyst. Provide a 2-3 sentence summary of this business opportunity, highlighting key investment considerations.",
                    },
                    {
                      role: "user",
                      content: `Business: ${deal.company_name}\nIndustry: ${deal.industry || "Unknown"}\nLocation: ${deal.location || "UK"}\nAsking Price: ${deal.asking_price || "Not disclosed"}\nRevenue: ${deal.revenue || "Not disclosed"}\nDescription: ${deal.description}`,
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
        for (const deal of deals) {
          if (!deal.company_name) continue;

          const dealUrl = deal.source_url || `${sourceConfig.searchUrl}#${deal.company_name.replace(/\s+/g, "-").toLowerCase()}`;

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
          }
        }

        // Update scrape log
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

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
