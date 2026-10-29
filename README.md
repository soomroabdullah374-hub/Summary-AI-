# Claude Summary Studio

A Claude.ai-styled studio that summarizes pasted text or uploaded documents (PDF, Word `.docx`, TXT, Markdown, CSV, JSON, RTF) to an exact word count, or lets AI decide the length, then exports the result as PDF, Word, Text or Markdown.

It is built from the spec in this folder: [PRD.md](PRD.md), [TRD.md](TRD.md), [Design.md](Design.md), [Agent.md](Agent.md) and [Appflow.md](Appflow.md).

**Live app:** https://summary-ai-black.vercel.app

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The Groq key lives in `.env.local`, which git ignores. On a fresh clone, copy `.env.example` to `.env.local` and fill it in.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build`, then `npm start` | Production build and server |
| `npm run check` | Self-check of word budgets, trimming, request validation and the file parsers |

## How it works

- **Frontend**: Next.js 16 (App Router, React 19, Tailwind CSS 4). The Design.md colour tokens, in light and dark, are in `src/app/globals.css`.
- **Summarization**: `POST /api/summarize` calls Groq (for `gsk_` keys) or xAI (for `xai-` keys) on the server. The shared core in `supabase/functions/_shared/summarize.ts` holds:
  - the Agent.md auto-decide curve
  - the system prompt
  - the word-count check (±5% for custom targets, ±10% for auto). A summary that runs long is trimmed at a sentence boundary. One that runs short gets a follow-up asking the model for just the missing words, which models handle far better than rewriting to a count.
  - request validation

  The Next.js route, the browser and the Supabase Edge Function all import this one file.
- **File parsing**: runs in the browser (`src/lib/extract.ts`). PDF uses pdf.js and DOCX uses mammoth; RTF, CSV and JSON use small built-in parsers.
- **Exports**: `src/lib/export.ts` uses jsPDF for PDF and docx for Word, and writes UTF-8 blobs for `.txt` and `.md`.
- **History**: stored in the Supabase `public.summaries` table when `NEXT_PUBLIC_SUPABASE_*` is set, otherwise in the browser.
- **Fallback**: if the AI engine can't be reached (no key, a rate limit or a network error), the browser builds an offline extractive summary and labels it as such.

## Changes from the spec

| Spec | Built | Why |
| --- | --- | --- |
| `llama-3.3-70b-versatile` | `openai/gpt-oss-120b` (override with `LLM_MODEL`) | Groq retired the Llama model. gpt-oss kept exact figures and followed the bullet formats. `qwen/qwen3.8-27b` is faster, but on the free tier it is capped at 1,000 output tokens a minute. |
| Next.js 15.0.3, Tailwind 3 | Next.js 16, Tailwind 4 | Next.js 15.0.3 has published security vulnerabilities. |
| `NEXT_PUBLIC_GROK_API_KEY`, plus the key hard-coded as a fallback | The key is read on the server only | A public or hard-coded key is shipped to every visitor's browser. |
| The browser calls Groq directly when the backend fails | An offline extractive summary instead | Calling Groq from the browser would also put the key there. |
| RLS policy `using (true)` | Each row is scoped to the browser's random session id, sent as the `x-session-id` header | `using (true)` let anyone with the public anon key read and delete every summary. |
| Long documents are sent whole | Sources over 12,000 characters (about 2,000 words) are first cut down to their most informative sentences | Groq's free tier allows 8,000 tokens a minute. Raise `LLM_INPUT_CHARS` on a paid tier. |

## Supabase

History is stored in the Supabase project **summary** (ref `scxmjhftopjldsyhgrap`, region `ap-south-1`, free tier). The migration in `supabase/migrations/` is already applied, and `.env.local` holds the project URL and its publishable key.

- **Another machine, or Vercel**: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) next to `GROK_API_KEY`. If you leave the Supabase variables out, history falls back to the browser.
- **Keeping it awake**: Supabase pauses free projects after a week without activity, so `.github/workflows/keep-supabase-awake.yml` queries the database every 15 minutes. A failed run in the repo's Actions tab means the project is paused; restore it from the Supabase dashboard. Summaries still generate while it's paused, but history won't save or load.
- **Edge Function (optional)**: run `npx supabase login`, then `npx supabase link --project-ref scxmjhftopjldsyhgrap`, then `npx supabase secrets set GROK_API_KEY=...`, then `npx supabase functions deploy summarize`.

## Deploying to Vercel

The live app is the Vercel project `summary-ai`. It already has `GROK_API_KEY` (stored as a secret) and both Supabase variables. To redeploy after a change, run this from the project folder:

```bash
npx vercel --prod
```

Pushing to GitHub doesn't redeploy yet, because the Vercel account isn't linked to the GitHub account. To turn on deploy-on-push:

1. In Vercel, go to **Account Settings → Authentication** and connect the GitHub account `soomroabdullah374-hub`.
2. Open the `summary-ai` project, go to **Settings → Git**, and connect this repository.

## Known limits

- PDF export uses jsPDF's built-in Latin fonts, so Urdu, Hindi or CJK text comes out as "?" in the PDF. The Word, Text and Markdown exports handle any script.
- Scanned, image-only PDFs have no text layer, and there is no OCR.
- Legacy `.doc` files aren't supported. Save them as `.docx` first.
