import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sample_rows } = await req.json();

    if (!headers || !Array.isArray(headers)) {
      return new Response(
        JSON.stringify({ error: "headers array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const samplePreview = sample_rows
      ? `\n\nHere are some sample data rows:\n${JSON.stringify(sample_rows.slice(0, 5), null, 2)}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a data mapping expert. Given CSV column headers and sample data, determine which CSV column maps to each company database field. 

The target database fields are:
- company_name: The name of the company/business
- geography: Location, region, country, city, county, postcode
- industry: Industry sector, SIC description, business type, trade classification
- description_of_activities: What the company does, business description, products/services
- companies_house_number: Company registration number, CRN, BVD ID
- website: Company website URL
- address: Full address, registered office address
- revenue: Annual revenue, turnover, sales (numeric)
- profit_before_tax: Profit, PBT, EBITDA, operating profit (numeric)
- net_assets: Net assets, shareholders funds, equity, NAV (numeric)
- total_assets: Total assets, gross assets (numeric)
- revenue_band: Revenue range/band (text)
- asset_band: Asset range/band (text)
- status: Company status

Be smart about it — look at both the header names AND the sample data to determine the best mapping. For example if a column is called "Turnover (£000s)" it maps to revenue. If data looks like "Manufacturing of widgets" it's likely description_of_activities even if the header is ambiguous.

Return ONLY mappings you are confident about. Use the original CSV header name (exactly as provided) as the key.`,
          },
          {
            role: "user",
            content: `Map these CSV headers to company database fields:\n\nHeaders: ${JSON.stringify(headers)}${samplePreview}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "column_mapping",
              description: "Return the mapping from CSV column headers to database fields.",
              parameters: {
                type: "object",
                properties: {
                  mappings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        csv_header: { type: "string", description: "The exact CSV column header name" },
                        db_field: {
                          type: "string",
                          enum: [
                            "company_name", "geography", "industry",
                            "description_of_activities", "companies_house_number",
                            "website", "address", "revenue", "profit_before_tax",
                            "net_assets", "total_assets", "revenue_band",
                            "asset_band", "status",
                          ],
                          description: "The target database field",
                        },
                        confidence: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                          description: "Confidence level of this mapping",
                        },
                        is_numeric: {
                          type: "boolean",
                          description: "Whether this field contains numeric data that needs parsing",
                        },
                        multiplier: {
                          type: "number",
                          description: "If values are in thousands or millions, the multiplier to apply (e.g. 1000 for 'th', 1000000 for 'mn'). Default 1.",
                        },
                      },
                      required: ["csv_header", "db_field", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["mappings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "column_mapping" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI column mapping failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured mapping data");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
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
