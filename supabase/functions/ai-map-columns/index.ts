import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const samplePreview = sample_rows
      ? `\n\nHere are some sample data rows:\n${JSON.stringify(sample_rows.slice(0, 5), null, 2)}`
      : "";

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
            content: `You are a data mapping expert. Given CSV column headers and sample data, determine which CSV column maps to each company database field.

The target database fields are:
- company_name: The name of the company/business
- geography: Location, region, country, city, county, postcode, town
- industry: Industry sector, SIC description, SIC text, business type, trade classification, sector
- description_of_activities: What the company does, business description, overview, principal activities, products/services, trade description
- companies_house_number: Company registration number, CRN, BVD ID, company number, CH number
- website: Company website URL, web address
- address: Full address, registered office address, office address
- revenue: Annual revenue, turnover, sales, operating revenue (numeric)
- profit_before_tax: Profit, PBT, EBITDA, operating profit, pre-tax profit (numeric)
- net_assets: Net assets, shareholders funds, equity, NAV, net asset value (numeric)
- total_assets: Total assets, gross assets (numeric)
- number_of_employees: Number of employees, headcount, staff count, FTE, workforce size (numeric, integer)
- revenue_band: Revenue range/band (text)
- asset_band: Asset range/band (text)
- status: Company status

IMPORTANT RULES:
1. Map as many columns as possible. Be GENEROUS with mappings — it is far better to map a column that might be relevant than to miss a column that has useful data.
2. Look at both the header names AND the sample data to determine mappings.
3. ALL numeric/financial values in the source data are stated in THOUSANDS. Set multiplier to 1 (the system will multiply by 1000 automatically). Only set a different multiplier if the header explicitly says millions (multiplier=1000) or the values are clearly in full units (multiplier=0.001).
4. number_of_employees should NOT be multiplied — it is a raw count. Set is_numeric=true but the system handles it separately.

For example:
- "Turnover (£000s)" -> revenue, multiplier=1
- "Revenue th GBP" -> revenue, multiplier=1
- "SIC 2007 Description" -> industry
- "Trade description" -> description_of_activities
- "Postcode" -> geography
- Any column with URLs -> website
- "Registered office address" -> address
- "Number of employees" -> number_of_employees
- "Employees" -> number_of_employees

Map EVERY column that could reasonably correspond to a database field. Use "low" confidence only if truly uncertain, but still include it.`,
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
                            "net_assets", "total_assets", "number_of_employees",
                            "revenue_band", "asset_band", "status",
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
