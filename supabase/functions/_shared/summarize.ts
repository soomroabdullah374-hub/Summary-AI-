// Shared summarization core, imported by the Next.js API route, the browser (offline fallback and
// live word-budget preview) and the Supabase Edge Function. Keep it dependency-free and use only
// fetch, so Node, Deno and the browser can all load it.

export type LengthMode = "custom" | "ai_auto";
export type SummaryStyle = "executive" | "bullets" | "academic" | "actions";
export const SOURCE_TYPES = ["paste", "pdf", "docx", "txt", "md", "csv", "rtf", "json"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const STYLES: Record<SummaryStyle, { label: string; guide: string }> = {
  executive: {
    label: "Executive Brief",
    guide: "1-3 tight paragraphs of flowing prose that lead with the core thesis and the most decision-relevant findings.",
  },
  bullets: {
    label: "Key Bullet Points",
    guide: '4-8 bullets, each on its own line starting with "• ", each a complete sentence.',
  },
  academic: {
    label: "Academic Abstract",
    guide: "One formal paragraph covering background, method or approach, key findings and implications.",
  },
  actions: {
    label: "Action Items & Decisions",
    guide: 'One framing sentence, then decisions and action items as "• " bullets on their own lines, naming owners and dates when the source gives them.',
  },
};

export const MIN_SOURCE_WORDS = 15;
export const MAX_SOURCE_CHARS = 100_000;
export const MIN_TARGET = 20;
export const MAX_TARGET = 1500;

export interface SummaryRequest {
  title: string;
  content: string;
  sourceType: SourceType;
  sourceFilename: string | null;
  lengthMode: LengthMode;
  targetWords: number | null;
  summaryStyle: SummaryStyle;
}

export interface SummaryResult {
  title: string;
  summary: string;
  keyTakeaways: string[];
  keywords: string[];
  sourceType: SourceType;
  sourceFilename: string | null;
  sourceWordCount: number;
  requestedWords: number | null;
  targetWordCount: number;
  actualWordCount: number;
  lengthMode: LengthMode;
  summaryStyle: SummaryStyle;
  aiRationale: string;
  compressionRatio: number;
  modelUsed: string;
  latencyMs: number;
}

export interface SavedSummary extends SummaryResult {
  id: string;
  createdAt: string;
  sourceContent: string;
}

// ---------- text metrics ----------

/** Words are whitespace-separated tokens containing a letter or digit, so "•" and "—" don't count. */
export const countWords = (text: string) => text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

/** Lines, then sentences: splits after . ! ? only when the next word starts a new sentence. */
export const splitSentences = (text: string) =>
  text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?[\p{Lu}\p{N}])/u))
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);

export const compression = (sourceWords: number, summaryWords: number) =>
  sourceWords > 0 ? Math.max(0, Math.round((1 - summaryWords / sourceWords) * 1000) / 10) : 0;

// ---------- word budget ----------

export const toleranceFor = (mode: LengthMode) => (mode === "custom" ? 0.05 : 0.1);

export function band(target: number, mode: LengthMode) {
  const t = toleranceFor(mode);
  return { min: Math.floor(target * (1 - t)), max: Math.ceil(target * (1 + t)) };
}

/** The AI Auto-Decide curve from Agent.md. */
export function autoTarget(w: number) {
  if (w < 150) return Math.max(25, Math.round(w * 0.35));
  if (w < 800) return Math.round(50 + (w - 150) * 0.16);
  if (w < 3000) return Math.round(155 + (w - 800) * 0.06);
  return Math.min(450, Math.round(285 + Math.log10(w) * 35));
}

export function planBudget(sourceWords: number, mode: LengthMode, requested: number | null) {
  const custom = mode === "custom" && requested != null;
  const wanted = custom ? requested : autoTarget(sourceWords);
  // A summary as long as its source can only be padded out, so cap at 90% of the source.
  const target = Math.max(1, Math.min(wanted, Math.floor(sourceWords * 0.9)));
  const capped = target < wanted;
  const n = sourceWords.toLocaleString("en-US");
  const size =
    sourceWords < 150 ? "a short text" : sourceWords < 800 ? "a medium-length article" : sourceWords < 3000 ? "a multi-section report" : "an extensive document";
  const rationale = custom
    ? capped
      ? `Capped your ${wanted}-word request at ${target} words because the source only has ${n} words.`
      : `Held to your ${target}-word budget (±5%).`
    : capped
      ? `AI chose ${target} words: the source is only ${n} words, so the summary stays concise instead of padding.`
      : `AI selected ${target} words (${Math.round((target / sourceWords) * 100)}% of ${n} source words) using the sizing curve for ${size}.`;
  const resolved: LengthMode = custom ? "custom" : "ai_auto";
  return { mode: resolved, requested: custom ? requested : null, target, ...band(target, resolved), rationale };
}

// ---------- trimming and extractive fallback ----------

/** Cut to at most `max` words at a sentence boundary, keeping line breaks (bullets). */
export function trimToWords(text: string, max: number): string {
  const lines: string[] = [];
  let total = 0;
  for (const line of text.split("\n")) {
    const kept: string[] = [];
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const n = countWords(sentence);
      if (total + n > max) {
        if (total === 0) return text.split(/\s+/).slice(0, max).join(" ") + "…";
        if (kept.length) lines.push(kept.join(" "));
        return lines.join("\n").trim();
      }
      kept.push(sentence);
      total += n;
    }
    lines.push(kept.join(" "));
  }
  return lines.join("\n").trim();
}

const STOPWORDS = new Set(
  "about above after again against also among and any are because been before being below between both but can could did does doing down during each few for from further had has have having her here hers him his how into its itself just more most must not now off once only other our ours out over own same shall she should some such than that the their theirs them then there these they this those through too under until upon very was were what when where which while who whom why will with would you your yours".split(" "),
);

const terms = (s: string) =>
  (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w));

// ponytail: word-frequency sentence scoring is enough for an offline fallback and for pre-condensing
// long inputs; swap in TextRank or embeddings if extractive quality ever matters.
export function extractive(text: string, maxWords: number) {
  const sentences = splitSentences(text);
  const freq = new Map<string, number>();
  for (const s of sentences) for (const w of terms(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const ranked = sentences
    .map((s, i) => {
      const ts = terms(s);
      const base = ts.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(ts.length || 1);
      // Favour quantitative findings and the lead sentence.
      return { s, i, words: countWords(s), score: base * (/\d/.test(s) ? 1.3 : 1) * (i === 0 ? 1.2 : 1) };
    })
    .sort((a, b) => b.score - a.score);
  // Skip headings and fragments ("3. Risk tiers") unless the text has nothing longer.
  const full = ranked.filter((x) => x.words >= 8);
  const pool = full.length ? full : ranked;
  const picked: typeof ranked = [];
  let total = 0;
  for (const x of pool) {
    if (total + x.words > maxWords) continue;
    picked.push(x);
    total += x.words;
  }
  const summary = picked.length
    ? picked.sort((a, b) => a.i - b.i).map((x) => x.s).join(" ")
    : trimToWords(pool[0]?.s ?? "", maxWords);
  return {
    summary,
    takeaways: pool.slice(0, 3).map((x) => x.s),
    keywords: [...freq].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w),
  };
}

// ---------- request validation (trust boundary) ----------

export function parseRequest(body: unknown): SummaryRequest | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.content !== "string") return { error: "Request body needs a `content` string." };
  const content = b.content.trim();
  if (content.length > MAX_SOURCE_CHARS)
    return { error: `Source text is over the ${MAX_SOURCE_CHARS.toLocaleString("en-US")}-character limit.` };
  if (countWords(content) < MIN_SOURCE_WORDS) return { error: `Add at least ${MIN_SOURCE_WORDS} words of source text to summarize.` };
  const lengthMode: LengthMode = b.lengthMode === "custom" ? "custom" : "ai_auto";
  const targetWords = lengthMode === "custom" ? Math.round(Number(b.targetWords)) : null;
  if (targetWords !== null && !(targetWords >= MIN_TARGET && targetWords <= MAX_TARGET))
    return { error: `Custom word count must be between ${MIN_TARGET} and ${MAX_TARGET.toLocaleString("en-US")}.` };
  const style = String(b.summaryStyle);
  const type = String(b.sourceType);
  return {
    title: typeof b.title === "string" ? b.title.trim().slice(0, 200) : "",
    content,
    sourceType: (SOURCE_TYPES as readonly string[]).includes(type) ? (type as SourceType) : "paste",
    sourceFilename: typeof b.sourceFilename === "string" && b.sourceFilename ? b.sourceFilename.slice(0, 255) : null,
    lengthMode,
    targetWords,
    summaryStyle: Object.hasOwn(STYLES, style) ? (style as SummaryStyle) : "executive",
  };
}

// ---------- LLM synthesis ----------

export class LlmError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

/** gsk_ keys belong to Groq, xai- keys to xAI; both speak the OpenAI chat-completions API. */
export function resolveProvider(apiKey: string, model?: string) {
  const groq = apiKey.startsWith("gsk_");
  return {
    provider: groq ? "Groq" : "xAI",
    endpoint: groq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions",
    model: model || (groq ? "openai/gpt-oss-120b" : "grok-4-latest"),
  };
}

type Message = { role: "system" | "user" | "assistant"; content: string };
type Draft = { title: string; summary: string; keyTakeaways: string[]; keywords: string[] };

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

async function chat(endpoint: string, apiKey: string, model: string, messages: Message[], maxTokens: number): Promise<Draft> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_effort: "none" } : {}),
    }),
  });
  const data = await res.json().catch(() => null);
  // json_validate_failed usually means hidden reasoning used up max_tokens; a second attempt tends to succeed.
  if (!res.ok)
    throw new LlmError(data?.error?.message ?? `AI provider returned HTTP ${res.status}`, res.status, data?.error?.code === "json_validate_failed");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "");
  } catch {
    throw new LlmError("The AI response was cut off or wasn't valid JSON.", 502);
  }
  const summary = Array.isArray(parsed.summary)
    ? strings(parsed.summary).map((s) => (s.startsWith("•") ? s : `• ${s}`)).join("\n")
    : typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) throw new LlmError("The AI returned an empty summary.", 502);
  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    summary,
    keyTakeaways: strings(parsed.keyTakeaways),
    keywords: strings(parsed.keywords),
  };
}

function systemPrompt(req: SummaryRequest, sourceWords: number, plan: ReturnType<typeof planBudget>) {
  const style = STYLES[req.summaryStyle];
  return `You are the Claude Summary Studio Synthesis Engine—an editorial-grade AI summarizer known for clarity, precision, and strict word-count discipline.

### INPUT PARAMETERS
- Source Document Title: ${req.title || "Untitled"}
- Source Format: ${req.sourceType}
- Source Word Count: ${sourceWords} words
- Length Mode: ${plan.mode}
- Target Word Budget: ${plan.target} words (Tolerance: ±${Math.round(toleranceFor(plan.mode) * 100)}%, i.e., ${plan.min} to ${plan.max} words)
- Summary Style: ${style.label}

### CRITICAL INSTRUCTIONS
1. WORD COUNT DISCIPLINE:
   - Your primary "summary" text MUST contain approximately ${plan.target} words (strictly between ${plan.min} and ${plan.max} words).
   - Every sentence must be complete, grammatical, and self-contained. Never cut off mid-sentence.
2. GROUNDED SYNTHESIS:
   - Preserve exact figures, dates, percentages, named entities, and conclusions from the source text. Write numbers as digits.
   - Use only information from the source. If it is too thin for the budget, stay concise instead of adding filler.
   - Eliminate throat-clearing meta-phrases (never write "This document discusses..." or "In summary..."). Lead directly with the core thesis and findings.
3. FORMAT (${style.label}): ${style.guide} Inside the JSON string, separate lines with \\n.
4. OUTPUT SCHEMA (Strict JSON):
   Respond with valid JSON matching this exact structure:
   {
     "title": "Concise Editorial Title for the Summary",
     "summary": "The synthesized summary text matching the target word count...",
     "keyTakeaways": ["3 to 5 crisp, high-signal takeaways grounding key facts/numbers"],
     "keywords": ["3 to 6 key entities or terms"]
   }`;
}

export interface LlmConfig {
  apiKey: string;
  model?: string;
  inputChars?: number;
}

export async function summarize(req: SummaryRequest, cfg: LlmConfig): Promise<SummaryResult> {
  const started = Date.now();
  const sourceWords = countWords(req.content);
  const plan = planBudget(sourceWords, req.lengthMode, req.targetWords);
  const { endpoint, model } = resolveProvider(cfg.apiKey, cfg.model);
  // ponytail: free-tier Groq allows ~8k tokens a minute, so a long source is pre-condensed extractively
  // into one request; switch to map-reduce chunking once the API tier has the throughput.
  const limit = cfg.inputChars || 12_000;
  const input = req.content.length > limit ? extractive(req.content, Math.floor(limit / 6.5)).summary : req.content;
  // Reasoning models (gpt-oss) spend a variable number of hidden tokens before answering. Groq bills
  // tokens actually used, so a generous ceiling costs nothing and prevents truncated JSON.
  const maxTokens = 4096;
  const messages: Message[] = [
    { role: "system", content: systemPrompt(req, sourceWords, plan) },
    { role: "user", content: `Document Title: ${req.title || "Untitled"}\n\nCONTENT:\n${input}` },
  ];

  const first = () => chat(endpoint, cfg.apiKey, model, messages, maxTokens);
  const draft = await first().catch((e) => (e instanceof LlmError && e.retryable ? first() : Promise.reject(e)));

  // Too long: trim at a sentence boundary, for free. Too short: models can't reliably rewrite to a word
  // count, but they can write "about N more words", so ask for just the missing part and append it.
  if (countWords(draft.summary) > plan.max) draft.summary = trimToWords(draft.summary, plan.max);
  const have = countWords(draft.summary);
  if (have < plan.min) {
    const bullets = /^• /m.test(draft.summary);
    try {
      const more = await chat(endpoint, cfg.apiKey, model, [
        ...messages,
        { role: "assistant", content: JSON.stringify(draft) },
        {
          role: "user",
          content: `That summary has ${have} words; it needs ${plan.min}-${plan.max}. Write ${
            bullets ? "one more bullet" : "one or two more sentences"
          } of ${plan.min - have} to ${plan.max - have} words in total, using facts from the source that the summary doesn't cover yet. Respond with JSON {"summary": "<only the new text>"}.`,
        },
      ], maxTokens);
      draft.summary = bullets ? `${draft.summary}\n• ${more.summary.replace(/^•\s*/, "")}` : `${draft.summary} ${more.summary}`;
      if (countWords(draft.summary) > plan.max) draft.summary = trimToWords(draft.summary, plan.max);
    } catch {
      // Best effort: if the follow-up is rate-limited, keep the shorter summary.
    }
  }
  const words = countWords(draft.summary);

  const condensed = input !== req.content;
  return {
    title: draft.title || req.title || "Document Summary",
    summary: draft.summary,
    keyTakeaways: draft.keyTakeaways.slice(0, 5),
    keywords: draft.keywords.slice(0, 6),
    sourceType: req.sourceType,
    sourceFilename: req.sourceFilename,
    sourceWordCount: sourceWords,
    requestedWords: plan.requested,
    targetWordCount: plan.target,
    actualWordCount: words,
    lengthMode: plan.mode,
    summaryStyle: req.summaryStyle,
    aiRationale:
      plan.rationale +
      (condensed
        ? ` The ${sourceWords.toLocaleString("en-US")}-word source was first narrowed to its ${countWords(input).toLocaleString("en-US")} most informative words to fit the API's per-request limit.`
        : ""),
    compressionRatio: compression(sourceWords, words),
    modelUsed: model,
    latencyMs: Date.now() - started,
  };
}

/** Offline extractive summary, used when the AI engine can't be reached. */
export function localSummary(req: SummaryRequest, reason: string): SummaryResult {
  const started = Date.now();
  const sourceWords = countWords(req.content);
  const plan = planBudget(sourceWords, req.lengthMode, req.targetWords);
  const { summary, takeaways, keywords } = extractive(req.content, plan.max);
  const words = countWords(summary);
  return {
    title: req.title || req.sourceFilename?.replace(/\.[^.]+$/, "") || "Document Summary",
    summary,
    keyTakeaways: takeaways,
    keywords,
    sourceType: req.sourceType,
    sourceFilename: req.sourceFilename,
    sourceWordCount: sourceWords,
    requestedWords: plan.requested,
    targetWordCount: plan.target,
    actualWordCount: words,
    lengthMode: plan.mode,
    summaryStyle: req.summaryStyle,
    aiRationale: `${plan.rationale} Built offline by extractive sentence selection because the AI engine was unavailable (${reason}).`,
    compressionRatio: compression(sourceWords, words),
    modelUsed: "local-extractive",
    latencyMs: Date.now() - started,
  };
}

// ---------- public.summaries row mapping ----------

export interface SummaryRow {
  id: string;
  session_id: string;
  title: string;
  source_type: SourceType;
  source_filename: string | null;
  source_content: string;
  source_word_count: number;
  length_mode: LengthMode;
  requested_words: number | null;
  ai_decided_words: number;
  actual_word_count: number;
  summary_style: SummaryStyle;
  summary_content: string;
  key_takeaways: string[] | null;
  keywords: string[] | null;
  ai_rationale: string | null;
  compression_ratio: number | string;
  model_used: string;
  latency_ms: number | null;
  created_at: string;
}

export const toRow = (s: SummaryResult & { sourceContent: string }, sessionId: string) => ({
  session_id: sessionId,
  title: s.title,
  source_type: s.sourceType,
  source_filename: s.sourceFilename,
  source_content: s.sourceContent,
  source_word_count: s.sourceWordCount,
  length_mode: s.lengthMode,
  requested_words: s.requestedWords,
  ai_decided_words: s.targetWordCount,
  actual_word_count: s.actualWordCount,
  summary_style: s.summaryStyle,
  summary_content: s.summary,
  key_takeaways: s.keyTakeaways,
  keywords: s.keywords,
  ai_rationale: s.aiRationale,
  compression_ratio: s.compressionRatio,
  model_used: s.modelUsed,
  latency_ms: s.latencyMs,
});

export const fromRow = (r: SummaryRow): SavedSummary => ({
  id: r.id,
  createdAt: r.created_at,
  sourceContent: r.source_content,
  title: r.title,
  summary: r.summary_content,
  keyTakeaways: r.key_takeaways ?? [],
  keywords: r.keywords ?? [],
  sourceType: r.source_type,
  sourceFilename: r.source_filename,
  sourceWordCount: r.source_word_count,
  requestedWords: r.requested_words,
  targetWordCount: r.ai_decided_words,
  actualWordCount: r.actual_word_count,
  lengthMode: r.length_mode,
  summaryStyle: r.summary_style,
  aiRationale: r.ai_rationale ?? "",
  compressionRatio: Number(r.compression_ratio),
  modelUsed: r.model_used,
  latencyMs: r.latency_ms ?? 0,
});
