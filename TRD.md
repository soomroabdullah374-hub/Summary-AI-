# Technical Requirements Document (`TRD.md`)

## 1. System Architecture Stack
| Layer | Technology | Configuration / Specification |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router, TypeScript) | React 19, Tailwind CSS, Lucide Icons, v0.dev / Vercel ready |
| **Design System** | Claude.ai Editorial Theme | Custom CSS variables (`#FAF9F5`, `#D97757`, `Newsreader` + `Inter`) |
| **Backend Serverless** | Supabase Edge Functions (Deno) | `supabase/functions/summarize/index.ts` |
| **Database** | Supabase PostgreSQL | Name: `summary` · Region: `ap-south-1` (Mumbai) |
| **Supabase Org & Billing** | Organization & Cost Metadata | `organization_id: safbhcyqkucuvdynndkm` · `$0 / month` (`confirm_cost_id: CqqjoMASBvB/J90Ru6jXd/GEsuS03aSoWsm4/oAGmD4=`) |
| **AI Inference Engine** | Groq / Grok OpenAI-Compatible API | Key prefix auto-detection (`gsk_*` $\rightarrow$ Groq `llama-3.3-70b-versatile`; `xai-*` $\rightarrow$ xAI `grok-2-latest`) |
| **Document Parsing** | Client + Edge Parsers | `pdfjs-dist` (PDF), `mammoth` (DOCX), UTF-8 stream reader (TXT/MD/CSV/RTF) |
| **Document Export** | Client Export Generators | `jspdf` / print-to-PDF engine (`.pdf`), `docx` / OpenXML builder (`.docx`), Blob UTF-8 (`.txt`, `.md`) |

---

## 2. Database Schema (`summary` — `ap-south-1` Mumbai)

```sql
-- Migration: 20261026000001_init_summary_schema.sql
-- Project: summary | Region: ap-south-1 (Mumbai) | Org: safbhcyqkucuvdynndkm

create extension if not exists "uuid-ossp";

create table if not exists public.summaries (
    id uuid primary key default uuid_generate_v4(),
    session_id text not null default 'anonymous',
    title text not null,
    source_type text not null check (source_type in ('paste', 'pdf', 'docx', 'txt', 'md', 'csv', 'rtf', 'json')),
    source_filename text,
    source_content text not null,
    source_word_count integer not null check (source_word_count >= 0),
    length_mode text not null check (length_mode in ('custom', 'ai_auto')),
    requested_words integer,
    ai_decided_words integer not null,
    actual_word_count integer not null,
    summary_style text not null default 'executive',
    summary_content text not null,
    key_takeaways jsonb not null default '[]'::jsonb,
    ai_rationale text,
    compression_ratio numeric(5,2) not null default 0.00,
    model_used text not null default 'llama-3.3-70b-versatile',
    latency_ms integer,
    created_at timestamptz not null default now()
);

create index idx_summaries_session_created on public.summaries (session_id, created_at desc);

alter table public.summaries enable row level security;

create policy "Allow public read/insert by session_id"
    on public.summaries
    for all
    using (true)
    with check (true);
```

---

## 3. Supabase Edge Function Specification (`supabase/functions/summarize/index.ts`)

### 3.1 Dual-Endpoint API Routing (`gsk_` vs `xai-`)
Because API keys starting with `gsk_` belong to **Groq Cloud** (`https://api.groq.com/openai/v1/chat/completions`) while `xai-` keys belong to **xAI Grok** (`https://api.x.ai/v1/chat/completions`), the Edge Function inspects the configured `GROK_API_KEY` at runtime and routes to the matching OpenAI-compatible endpoint automatically:

```typescript
const apiKey = Deno.env.get("GROK_API_KEY") || "";
const isGroqKey = apiKey.startsWith("gsk_");
const endpoint = isGroqKey
  ? "https://api.groq.com/openai/v1/chat/completions"
  : "https://api.x.ai/v1/chat/completions";
const model = isGroqKey ? "llama-3.3-70b-versatile" : "grok-2-latest";
```

### 3.2 Request & Response Contract
- **Endpoint**: `POST /functions/v1/summarize`
- **Request Payload**:
  ```json
  {
    "title": "Q3 Architecture Review",
    "content": "Full extracted text from PDF/DOCX/TXT...",
    "sourceType": "pdf",
    "sourceFilename": "q3-architecture.pdf",
    "lengthMode": "custom",
    "targetWords": 120,
    "summaryStyle": "executive"
  }
  ```
- **Response Payload**:
  ```json
  {
    "title": "Q3 Cloud Architecture & Latency Optimization Brief",
    "summary": "The Q3 architecture review demonstrates a 42% reduction in p99 tail latency...",
    "keyTakeaways": [
      "Regional edge caching in ap-south-1 reduced database round-trips by 61%.",
      "Migration to serverless connection pooling saved $14,200/month."
    ],
    "sourceWordCount": 1420,
    "targetWordCount": 120,
    "actualWordCount": 118,
    "lengthMode": "custom",
    "aiRationale": "Strictly matched user-requested 120-word budget (118 words actual, 91.7% compression).",
    "compressionRatio": 91.7,
    "modelUsed": "llama-3.3-70b-versatile",
    "latencyMs": 640
  }
  ```

---

## 4. Multi-Format Ingestion & Export Pipeline

### 4.1 Ingestion Parsers
1. **PDF (`.pdf`)**: Uses `pdfjs-dist` (`pdfjsLib.getDocument({ data: arrayBuffer })`) to iterate through pages `1..N`, calling `page.getTextContent()` and joining text items while preserving paragraph breaks.
2. **Word (`.docx`)**: Uses `mammoth.extractRawText({ arrayBuffer })` (with a ZIP/XML `word/document.xml` fallback parser) to extract clean paragraphs and headings.
3. **Text / Markdown / CSV / JSON / RTF**: Reads via `File.text()`, strips RTF formatting groups if `.rtf`, and normalizes whitespace.

### 4.2 Export Generators
1. **PDF Export (`.pdf`)**: Uses `jsPDF` with multi-page automatic line wrapping (`splitTextToSize`), warm editorial header block, metadata summary bar, body prose, and bulleted takeaways.
2. **Word Export (`.docx`)**: Generates a valid MS Word document (`.docx` / WordprocessingML package) containing styled Title, Metadata summary table, Summary paragraphs, and Bulleted Key Takeaways.
3. **Plain Text (`.txt`) & Markdown (`.md`)**: Formats clean UTF-8 blobs with full metadata headers and triggers immediate browser download via `URL.createObjectURL()`.

---

## 5. Environment & Security Configuration
Store credentials in `.env.local` (for Next.js) and Supabase Vault Secrets (for Edge Functions):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_PROJECT_NAME=summary
SUPABASE_REGION=ap-south-1
SUPABASE_ORG_ID=safbhcyqkucuvdynndkm
GROK_API_KEY=gsk_your_groq_api_key
```
