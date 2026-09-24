// ============================================================
// notify-rfq — edge function called by the database webhook
// whenever a new RFQ is inserted into public.rfqs.
//
// Supabase Dashboard → Database → Webhooks → "New RFQ inserted"
//   Event: INSERT on table `rfqs`
//   URL:   https://<project-ref>.supabase.co/functions/v1/notify-rfq
//   Headers: Authorization: Bearer <service-role-key>
//
// Notification channels are opt-in via env vars:
//   - Email:   RESEND_API_KEY + NOTIFY_EMAIL_TO (+ FROM)
//   - WhatsApp: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
//               WHATSAPP_FROM (e.g. whatsapp:+14155238886) + WHATSAPP_TO
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_EMAIL_TO = Deno.env.get("NOTIFY_EMAIL_TO") ?? "trade@argentumcommodities.co.in";
const EMAIL_FROM = Deno.env.get("NOTIFY_EMAIL_FROM") ?? "Desk <trading@argentumcommodities.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = req.headers.get("authorization") ?? "";
  const gated = Deno.env.get("WEBHOOK_SECRET");
  if (gated && !auth.startsWith(`Bearer ${gated}`)) {
    return new Response("unauthorized", { status: 401, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400, headers: corsHeaders });
  }

  const rec = payload?.record ?? {};
  const rfq = {
    company: rec.company_name ?? "—",
    commodity: rec.commodity ?? "—",
    quantity: rec.quantity != null ? String(rec.quantity) : "—",
    city: rec.delivery_city ?? "—",
    phone: rec.phone ?? "—",
    purity: rec.purity ?? "—",
    id: rec.id ?? "",
  };

  // 1) Email via Resend (if configured)
  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [NOTIFY_EMAIL_TO],
          subject: `New RFQ — ${rfq.company}`,
          html:
            `<div style="font-family:ui-sans-serif,system-ui;background:#000;color:#f2f2f2;padding:32px;border:1px solid #2a2a2a">` +
            `<h2 style="font-family:Georgia,serif;letter-spacing:.12em">NEW RFQ — TRADING DESK</h2>` +
            `<p><b style="color:#c8ccd1">${rfq.company}</b><br/>${rfq.quantity} kg · ${rfq.commodity}${rfq.purity ? " · " + rfq.purity : ""}<br/>Delivery: ${rfq.city}<br/>Phone: ${rfq.phone}</p>` +
            `<p style="color:#8a8a8a">Open the desk to verify: ${SUPABASE_URL ? "/desk" : "/desk"} (RFQ ${rfq.id.slice(0, 8)})</p>` +
            `</div>`,
        }),
      });
    } catch (err) {
      console.error("resend error", err);
    }
  }

  // 2) WhatsApp via Twilio (if configured)

  return new Response(
    JSON.stringify({ ok: true, got: rfq, channels: { email: !!RESEND_API_KEY, whatsapp: false } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});