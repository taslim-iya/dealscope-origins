import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { companyId, mandateId, buyerName, buyerCompany } = await req.json();

    if (!companyId || !mandateId) {
      return new Response(JSON.stringify({ error: "Missing companyId or mandateId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company data
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch mandate data for context
    const { data: mandate, error: mandateError } = await supabase
      .from("mandates")
      .select("*")
      .eq("id", mandateId)
      .single();

    if (mandateError || !mandate) {
      return new Response(JSON.stringify({ error: "Mandate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert M&A outreach specialist helping buyers draft professional, personalized acquisition inquiry emails.

Your task is to generate a compelling but professional email that:
1. Is addressed to the business owner/director
2. Clearly states the buyer's interest in discussing a potential acquisition
3. References specific details about the target company to show genuine interest
4. Maintains a professional, non-pushy tone
5. Invites a confidential conversation
6. Is concise (under 200 words for the body)

Important guidelines:
- Never use aggressive or salesy language
- Don't mention specific valuations or offers
- Keep the focus on mutual benefit and strategic fit
- Be respectful of the owner's time and legacy`;

    const companyContext = `
Target Company: ${company.company_name}
Industry: ${company.industry || "Not specified"}
Location: ${company.geography || company.address || "UK"}
Description: ${company.description_of_activities || "Not available"}
Revenue: ${company.revenue ? `£${company.revenue.toLocaleString()}` : "Not disclosed"}
Net Assets: ${company.net_assets ? `£${company.net_assets.toLocaleString()}` : "Not disclosed"}

Buyer: ${buyerName || "The buyer"}
Buyer Company: ${buyerCompany || "A private investment firm"}
Mandate Focus: ${mandate.industry_description || mandate.name}
`;

    const userPrompt = `Generate a professional acquisition inquiry email for the following:

${companyContext}

Please provide:
1. A clear, professional subject line
2. The email body

Format your response as JSON with "subject" and "body" fields.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Generate a professional acquisition inquiry email",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email body text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const emailData = JSON.parse(toolCall.function.arguments);

    // Generate tracking pixel URL (will be embedded when email is actually sent)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const trackingPixelPlaceholder = `{{TRACKING_PIXEL_URL}}`;

    // Add tracking pixel to email body
    const bodyWithTracking = `${emailData.body}\n\n<img src="${trackingPixelPlaceholder}" width="1" height="1" alt="" style="display:none;" />`;

    return new Response(JSON.stringify({
      success: true,
      subject: emailData.subject,
      body: emailData.body,
      bodyWithTracking: bodyWithTracking,
      companyName: company.company_name,
      supabaseUrl: supabaseUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-outreach error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
