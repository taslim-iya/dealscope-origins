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
    const { csv_content } = await req.json();

    if (!csv_content) {
      return new Response(
        JSON.stringify({ error: "csv_content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Take first 30 rows as sample for AI analysis
    const lines = csv_content.trim().split(/\r?\n/);
    const sample = lines.slice(0, Math.min(31, lines.length)).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
            content: `You are a data analyst. Given a CSV sample, extract suggested mandate criteria. Respond using the provided tool.`,
          },
          {
            role: "user",
            content: `Analyze this CSV sample and suggest mandate criteria based on the data patterns:\n\n${sample}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_mandate_criteria",
              description: "Return suggested mandate criteria based on CSV data analysis.",
              parameters: {
                type: "object",
                properties: {
                  suggested_name: { type: "string", description: "A suggested mandate name based on the data" },
                  industries: { type: "string", description: "Comma-separated list of industries found in the data" },
                  sic_codes: { type: "string", description: "Comma-separated SIC codes if found" },
                  regions: { type: "string", description: "Comma-separated regions/geographies found" },
                  revenue_min: { type: "number", description: "Suggested minimum revenue based on data range" },
                  revenue_max: { type: "number", description: "Suggested maximum revenue based on data range" },
                  total_assets_min: { type: "number", description: "Suggested minimum total assets" },
                  total_assets_max: { type: "number", description: "Suggested maximum total assets" },
                  net_assets_min: { type: "number", description: "Suggested minimum net assets" },
                  net_assets_max: { type: "number", description: "Suggested maximum net assets" },
                  summary: { type: "string", description: "Brief summary of what the data contains" },
                },
                required: ["summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_mandate_criteria" } },
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
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ suggestions }),
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
