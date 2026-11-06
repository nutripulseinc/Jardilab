// Edge Function "ai-render" – aperçu réaliste d'un massif (Google Gemini)
// Secret requis : GEMINI_API_KEY   (facultatif : GEMINI_IMAGE_MODEL, défaut gemini-2.5-flash-image)
// Utilise la table/fonction de quota de jardilab_quota_ia.sql (type 'g')
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const LIM = { user: 6, site: 60 }; // images par jour (heure de Zurich)
const VIP = (Deno.env.get("AI_VIP_EMAILS") ?? "jeffizo@outlook.fr").toLowerCase().split(",").map((x) => x.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "auth" }, 401);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "config" }, 503);

    const { prompt, image } = await req.json();
    if (typeof prompt !== "string" || prompt.length > 5000 || (image && String(image).length > 3_000_000))
      return json({ error: "bad request" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const vip = VIP.includes((user.email ?? "").toLowerCase()) ? 10 : 1;
    const { data: q, error: qe } = await admin.rpc("ai_take", {
      p_uid: user.id, p_kind: "g", p_user_max: LIM.user * vip, p_global_max: LIM.site * vip,
    });
    if (qe) return json({ error: "quota-check" }, 500);
    if (q !== "ok") return json({ error: "quota", scope: q }, 429);

    const parts: unknown[] = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image } });

    const model = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-2.5-flash-image";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: "ia", status: r.status, detail: String(j?.error?.message ?? "").slice(0, 200) }, 502);
    const ps = (j.candidates?.[0]?.content?.parts ?? []) as { inlineData?: { data: string; mimeType?: string }; inline_data?: { data: string; mime_type?: string } }[];
    const p = ps.find((x) => x.inlineData || x.inline_data);
    const d = p?.inlineData ?? p?.inline_data;
    if (!d) return json({ error: "noimage" }, 502);
    return json({ image: d.data, mime: (p?.inlineData?.mimeType ?? p?.inline_data?.mime_type) || "image/png" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
