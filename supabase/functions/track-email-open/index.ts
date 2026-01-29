import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent PNG pixel
const TRANSPARENT_PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

serve(async (req) => {
  const url = new URL(req.url);
  const messageId = url.searchParams.get("id");

  // Always return the pixel, even if we can't track
  const pixelResponse = new Response(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });

  if (!messageId) {
    console.log("No message ID provided");
    return pixelResponse;
  }

  try {
    // Use service role to update without auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check current status - only update if not already opened
    const { data: message, error: fetchError } = await supabase
      .from("outreach_messages")
      .select("id, status, opened_at")
      .eq("id", messageId)
      .single();

    if (fetchError) {
      console.error("Error fetching message:", fetchError);
      return pixelResponse;
    }

    // Only update if sent and not yet opened
    if (message && message.status === "sent" && !message.opened_at) {
      const { error: updateError } = await supabase
        .from("outreach_messages")
        .update({
          status: "opened",
          opened_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (updateError) {
        console.error("Error updating message:", updateError);
      } else {
        console.log(`Message ${messageId} marked as opened`);
      }
    }
  } catch (error) {
    console.error("Track email open error:", error);
  }

  return pixelResponse;
});
