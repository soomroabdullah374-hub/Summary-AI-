// POST /api/summarize: the server-side summarization endpoint (mirrors supabase/functions/summarize).
// The Groq/xAI key stays on the server; the browser never sees it.
import { LlmError, parseRequest, resolveProvider, summarize } from "@core";

function engine() {
  const apiKey = process.env.GROK_API_KEY?.trim();
  return apiKey ? { apiKey, ...resolveProvider(apiKey, process.env.LLM_MODEL) } : null;
}

/** Engine status for the sidebar footer. */
export function GET() {
  const e = engine();
  return Response.json(e ? { configured: true, provider: e.provider, model: e.model } : { configured: false });
}

export async function POST(request: Request) {
  const e = engine();
  if (!e) return Response.json({ error: "GROK_API_KEY isn't set on the server" }, { status: 503 });
  const req = parseRequest(await request.json().catch(() => null));
  if ("error" in req) return Response.json(req, { status: 400 });
  try {
    return Response.json(
      await summarize(req, { apiKey: e.apiKey, model: e.model, inputChars: Number(process.env.LLM_INPUT_CHARS) || undefined }),
    );
  } catch (err) {
    // 400 is reserved for our own validation errors, so a provider-side 400 is reported as 502.
    const status = err instanceof LlmError && err.status > 400 && err.status < 600 ? err.status : 502;
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
