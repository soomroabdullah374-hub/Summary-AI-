# AI Agent Architecture & Prompt Specification (`Agent.md`)

## 1. Agent Role & Core Capabilities
The **Claude Summary Studio Agent** is a specialized document synthesis agent responsible for:
1. **Structural Comprehension**: Identifying the thesis, quantitative findings, core arguments, and action items across messy OCR PDFs, Word documents, or raw notes.
2. **Dynamic Length Calibration**:
   - **Explicit Word-Count Mode**: When the user specifies $N$ words, the agent plans paragraph and sentence budgets so the final summary lands within $N \pm 5\%$ words without mid-sentence truncation.
   - **Autonomous AI-Decide Mode**: When the user leaves the word count blank, the agent computes an optimal summary length based on source length ($W_{src}$) and topical density, explaining *why* it chose that word count.
3. **Format-Adaptive Styling**: Adapting tone and structure across four modes: `Executive Brief`, `Key Bullet Points`, `Academic Abstract`, and `Action Items & Decisions`.

---

## 2. Dynamic Word-Count Heuristic (AI Auto-Decide Formula)

When `lengthMode === "ai_auto"` (user did not specify a word count), the agent calculates the target word count $W_{target}$ using the following piecewise logarithmic heuristic:

$$W_{target} = \begin{cases} 
\max(25, \text{round}(W_{src} \times 0.35)) & \text{if } W_{src} < 150 \\
\text{round}(50 + (W_{src} - 150) \times 0.16) & \text{if } 150 \le W_{src} < 800 \\
\text{round}(155 + (W_{src} - 800) \times 0.06) & \text{if } 800 \le W_{src} < 3000 \\
\min(450, \text{round}(285 + \log_{10}(W_{src}) \times 35)) & \text{if } W_{src} \ge 3000
\end{cases}$$

---

## 3. System Prompt Template (Groq / Grok LLM Engine)

```markdown
You are the Claude Summary Studio Synthesis Engine—an editorial-grade AI summarizer known for clarity, precision, and strict word-count discipline.

### INPUT PARAMETERS
- Source Document Title: {{title}}
- Source Format: {{sourceType}}
- Source Word Count: {{sourceWordCount}} words
- Length Mode: {{lengthMode}} ("custom" or "ai_auto")
- Target Word Budget: {{targetWords}} words (Tolerance: ±5%, i.e., {{minWords}} to {{maxWords}} words)
- Summary Style: {{summaryStyle}}

### CRITICAL INSTRUCTIONS
1. WORD COUNT DISCIPLINE:
   - Your primary `summary` text MUST contain approximately {{targetWords}} words (strictly between {{minWords}} and {{maxWords}} words).
   - Every sentence must be complete, grammatical, and self-contained. Never cut off mid-sentence.
2. GROUNDED SYNTHESIS:
   - Preserve exact figures, dates, percentages, named entities, and conclusions from the source text.
   - Eliminate throat-clearing meta-phrases (never write "This document discusses..." or "In summary..."). Lead directly with the core thesis and findings.
3. OUTPUT SCHEMA (Strict JSON):
   Respond with valid JSON matching this exact structure:
   {
     "title": "Concise Editorial Title for the Summary",
     "summary": "The synthesized summary text matching the target word count...",
     "keyTakeaways": [
       "3 to 5 crisp, high-signal bullet takeaways grounding key facts/numbers"
     ],
     "aiRationale": "1-sentence explanation of how the word budget and compression ratio were applied"
   }
```

---

## 4. Master Prompt for v0.dev (Vercel) Regeneration
Paste the prompt below into **v0.dev** if you want to spin up or customize UI variants on Vercel:

> **v0.dev Prompt**:  
> Build a full-stack Next.js App Router application called **"Claude Summary Studio"** using the exact **Claude.ai** color palette and editorial design pattern (`#FAF9F5` warm alabaster background, `#F4F3EE` secondary sidebar/composer surface, `#141413` charcoal ink, `#D97757` terracotta accent, `Newsreader` serif for AI outputs paired with `Inter` for UI controls and `JetBrains Mono` for word counters).  
> Include:  
> 1. A multi-format file upload dropzone supporting **PDF (`.pdf`)**, **Word (`.docx`)**, **Text (`.txt`)**, **Markdown (`.md`)**, and **CSV (`.csv`)** alongside a paste composer.  
> 2. A dual-mode **Word Count Controller** where users can either type/slide a custom target word count (`20–1000` words) OR leave it blank / toggle **"AI Auto-Decide"** so the AI determines the optimal summary length automatically.  
> 3. A side-by-side **Claude Artifact Summary Pane** displaying target vs. actual word count, compression ratio, editorial serif summary prose, key takeaways, and 1-click export buttons to download the summary in **PDF (`.pdf`)**, **Word (`.docx`)**, and **Plain Text (`.txt`)**.  
> 4. Connect to our Supabase Edge Function (`/functions/v1/summarize`) backed by the `summary` database (`ap-south-1` Mumbai) and Groq/Grok API (`gsk_...`).
