// Supabase Edge Function: POST /functions/v1/summarize
// Same contract as the Next.js route (src/app/api/summarize/route.ts), plus persistence to public.summaries.
// Deploy: npx supabase secrets set GROK_API_KEY=... && npx supabase functions deploy summarize
import { createClient } from "npm:@supabase/supabase-js@2";
import { LlmError, parseRequest, summarize, toRow } from "../_shared/summarize.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const apiKey = Deno.env.get("GROK_API_KEY");
  if (!apiKey) return json({ error: "Set the GROK_API_KEY secret: npx supabase secrets set GROK_API_KEY=..." }, 503);

  const body = await request.json().catch(() => null);
  const req = parseRequest(body);
  if ("error" in req) return json(req, 400);

  let result;
  try {
    result = await summarize(req, { apiKey, model: Deno.env.get("LLM_MODEL") });
  } catch (err) {
    const status = err instanceof LlmError && err.status > 400 && err.status < 600 ? err.status : 502;
    return json({ error: err instanceof Error ? err.message : String(err) }, status);
  }

  // Persist with the service role (bypasses RLS), keyed to the caller's browser session id.
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 64) : "anonymous";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db
    .from("summaries")
    .insert(toRow({ ...result, sourceContent: req.content }, sessionId))
    .select("id, created_at")
    .single();
  return json({ ...result, id: data?.id, createdAt: data?.created_at, persisted: !error });
});
