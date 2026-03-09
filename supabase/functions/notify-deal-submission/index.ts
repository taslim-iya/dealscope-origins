import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { company_name, contact_name, contact_email, contact_role } = await req.json();

    console.log(`New deal submission: ${company_name} from ${contact_name} (${contact_role}) - ${contact_email}`);

    // For now, log the notification. When Resend is configured, send email.
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (RESEND_API_KEY) {
      // Get admin emails from user_roles
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const { data: adminProfiles } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .in("id", adminRoles.map((r: any) => r.user_id));

        const adminEmails = adminProfiles?.map((p: any) => p.email).filter(Boolean) || [];

        if (adminEmails.length > 0) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "DealScope <notifications@dealscope.com>",
              to: adminEmails,
              subject: `New Deal Submission: ${company_name}`,
              html: `
                <h2>New Deal Submission</h2>
                <p><strong>Company:</strong> ${company_name}</p>
                <p><strong>Submitted by:</strong> ${contact_name} (${contact_role})</p>
                <p><strong>Email:</strong> ${contact_email}</p>
                <p>Log in to DealScope to review this submission.</p>
              `,
            }),
          });
          console.log(`Notification sent to ${adminEmails.length} admin(s)`);
        }
      }
    } else {
      console.log("Resend not configured - notification logged only");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
