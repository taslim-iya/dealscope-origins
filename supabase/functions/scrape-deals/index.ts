import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Search queries for UK business listings
const SEARCH_QUERIES = [
  "UK businesses for sale 2026",
  "buy a business United Kingdom",
  "business acquisition opportunities UK",
  "SME for sale England Scotland Wales",
  "company for sale UK owner retiring",
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

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a log entry
    const { data: logData } = await supabase
      .from("scrape_logs")
      .insert({
        user_id: userId,
        source: "Firecrawl Search",
        status: "running",
      })
      .select("id")
      .single();

    const logId = logData?.id;

    try {
      // Use Firecrawl Search API for more reliable results
      const allSearchResults: Array<{
        url: string;
        title: string;
        description: string;
        markdown?: string;
      }> = [];

      // Run multiple search queries in parallel
      console.log("Starting Firecrawl searches...");
      
      const searchPromises = SEARCH_QUERIES.slice(0, 3).map(async (query) => {
        console.log(`Searching: ${query}`);
        
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 10,
            lang: "en",
            country: "gb",
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
            },
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`Got ${searchData.data?.length || 0} results for: ${query}`);
          return searchData.data || [];
        } else {
          const errText = await searchResponse.text();
          console.error(`Search error for "${query}":`, errText);
          return [];
        }
      });

      const searchResults = await Promise.all(searchPromises);
      searchResults.forEach((results) => {
        allSearchResults.push(...results);
      });

      console.log(`Total search results: ${allSearchResults.length}`);

      // Dedupe by URL
      const uniqueResults = Array.from(
        new Map(allSearchResults.map((r) => [r.url, r])).values()
      );

      console.log(`Unique results after dedup: ${uniqueResults.length}`);

      // Filter to business listing sites and combine content
      const relevantSites = [
        "businessesforsale",
        "daltonsbusiness",
        "rightbiz",
        "businesses-for-sale",
        "bizbuysell",
        "businessesforsal",
        "acquirebusiness",
        "sellingmybusiness",
      ];

      const businessListings = uniqueResults.filter((r) =>
        relevantSites.some((site) => r.url.toLowerCase().includes(site)) ||
        r.title?.toLowerCase().includes("for sale") ||
        r.description?.toLowerCase().includes("business for sale")
      );

      console.log(`Business listing results: ${businessListings.length}`);

      // Combine all markdown content for AI extraction
      const combinedContent = businessListings
        .map((r) => `\n--- Source: ${r.url} ---\nTitle: ${r.title}\n${r.markdown || r.description || ""}`)
        .join("\n\n")
        .substring(0, 50000);

      let deals: Array<{
        company_name?: string;
        asking_price?: string;
        location?: string;
        industry?: string;
        revenue?: string;
        profit?: string;
        net_assets?: string;
        description?: string;
        source_url?: string;
        ai_summary?: string;
      }> = [];

      if (combinedContent.length > 500 && LOVABLE_API_KEY) {
        console.log("Using AI to extract listings from combined search results...");

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
                content: `You are extracting business-for-sale listings from UK business marketplace search results.

Analyze this content and extract ALL unique business listings you can find. For each listing:
- company_name: The business name/title (REQUIRED - skip if not found)
- asking_price: The sale price (e.g., "£250,000")
- location: UK city/region
- industry: Type of business
- revenue: Annual turnover if mentioned
- profit: Annual profit if mentioned
- description: Brief business description (max 200 chars)
- source_url: The URL where this listing was found

IMPORTANT:
- Extract REAL business listings only, not navigation/ads
- Each listing should be unique
- If no valid listings found, return {"listings": []}
- Return ONLY valid JSON

Return format: {"listings": [...]}

Search results content:
${combinedContent}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          console.log("AI response preview:", content.substring(0, 500));

          try {
            let cleanContent = content
              .replace(/```json\n?/gi, "")
              .replace(/```\n?/gi, "")
              .trim();

            const jsonMatch = cleanContent.match(/\{[\s\S]*"listings"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              deals = parsed.listings || [];
            }
            console.log(`AI extracted ${deals.length} deals`);
          } catch (e) {
            console.error("Failed to parse AI response:", e);
          }
        }
      }

      // If AI extraction didn't work, try to extract from search result titles/descriptions
      if (deals.length === 0 && businessListings.length > 0) {
        console.log("Falling back to direct extraction from search results...");
        deals = businessListings
          .filter((r) => r.title && r.title.length > 10)
          .slice(0, 15)
          .map((r) => ({
            company_name: r.title.replace(/\s*[-|]\s*BusinessesForSale.*$/i, "").trim(),
            description: r.description?.substring(0, 200),
            source_url: r.url,
            location: "UK",
            industry: "Various",
          }));
        console.log(`Extracted ${deals.length} deals from search results directly`);
      }

      // Generate summaries for deals
      const dealsToProcess = deals.slice(0, 15);
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

      // Store deals in database
      let insertedCount = 0;
      for (const deal of dealsToProcess) {
        if (!deal.company_name) continue;

        const dealUrl = deal.source_url || `https://search.firecrawl.dev/#${encodeURIComponent(deal.company_name.substring(0, 50))}`;

        const { error: insertError } = await supabase.from("on_market_deals").upsert(
          {
            user_id: userId,
            source: "Firecrawl Search",
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

      return new Response(
        JSON.stringify({
          success: true,
          deals_found: insertedCount,
          search_results: uniqueResults.length,
          business_listings: businessListings.length,
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
