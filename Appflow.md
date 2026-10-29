# Application Flow & User Journey (`Appflow.md`)

## 1. End-to-End Architecture & Data Flow Diagram

```
+-----------------------------------------------------------------------------------+
|                        CLAUDE SUMMARY STUDIO (Next.js / v0.dev)                   |
|                                                                                   |
|  +-----------------------+     +-----------------------------------------------+  |
|  | 1. CONTENT INGESTION  |     | 2. WORD-COUNT & STYLE CONTROLLER              |  |
|  | - Paste / Type Text   | --> | - Mode A: Custom Word Count (e.g., 120 words) |  |
|  | - Upload PDF (.pdf)   |     | - Mode B: AI Auto-Decide (Blank / Automatic)  |  |
|  | - Upload Word (.docx) |     | - Style: Executive / Bullets / Academic       |  |
|  | - Upload TXT/MD/CSV   |     +-----------------------+-----------------------+  |
|  +-----------------------+                             |                          |
+--------------------------------------------------------|--------------------------+
                                                         v
+-----------------------------------------------------------------------------------+
|                     3. SUPABASE BACKEND (`summary` | ap-south-1 Mumbai)           |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Edge Function: `POST /functions/v1/summarize`                               |  |
|  | - Validates input & calculates AI Auto-Decide word budget if unspecified    |  |
|  | - Detects `gsk_` (Groq API) vs `xai-` (Grok API) key & dispatches prompt   |  |
|  | - Enforces word-count tolerance & parses structured JSON response           |  |
|  | - Persists record to PostgreSQL `public.summaries` table                    |  |
|  +-------------------------------------+---------------------------------------+  |
+----------------------------------------|------------------------------------------+
                                         v
+-----------------------------------------------------------------------------------+
|                     4. CLAUDE ARTIFACT VIEWER & MULTI-FORMAT EXPORT               |
|                                                                                   |
|  +-------------------------------------+   +-----------------------------------+  |
|  | Artifact Preview Card               |   | Multi-Format Export Engine        |  |
|  | - Newsreader Serif Typography       |   | -> Export PDF (.pdf via jsPDF)    |  |
|  | - Word Accuracy Badge (Target/Real) |   | -> Export Word (.docx document)   |  |
|  | - Key Takeaways & AI Rationale      |   | -> Export Text (.txt) & MD (.md)  |  |
|  +-------------------------------------+   +-----------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Step-by-Step User Journeys

### Journey A: Uploading a Document with a Specific Word Count
1. **Landing**: User opens the workspace (`#FAF9F5` warm canvas). The left sidebar shows saved history and database connection status (`summary · ap-south-1`).
2. **File Upload**: User drags a 12-page `Q3-Strategy.pdf` or `Proposal.docx` onto the Composer Dropzone.
3. **Client Extraction**:
   - If `.pdf`: `pdf.js` extracts text page-by-page and displays an attachment pill: `Q3-Strategy.pdf · 2,480 words`.
   - If `.docx`: `mammoth.js` extracts raw text and populates the source inspector.
   - If `.txt` / `.md` / `.csv`: Native UTF-8 reader loads text immediately.
4. **Word Target Selection**: User switches to **Custom Word Count** and types `150` words (or clicks the `150w` preset pill).
5. **Generation**: User clicks **Generate Summary** (`#D97757` Terracotta button).
6. **Artifact Rendering**: The right-hand **Claude Artifact Drawer** animates open, displaying the 150-word summary in editorial serif type, a `149 / 150 words (94% condensed)` accuracy pill, and bulleted takeaways.
7. **Multi-Format Download**: User clicks **PDF**, **Word (.docx)**, or **Text (.txt)** in the Artifact toolbar to download the formatted file immediately.

### Journey B: Pasting Content Without Specifying Word Count (AI Auto-Decide)
1. **Input**: User pastes an article or uploads a file and leaves the word-count field **blank** (default **AI Auto-Decide** mode).
2. **Heuristic Calculation**: The system analyzes the source length (e.g., `620 words`) and information density, automatically selecting an optimal target of `125 words` (~80% reduction).
3. **Transparent Explanation**: Inside the Artifact Drawer, an **AI Sizing Rationale** banner explains: *"AI automatically selected a 125-word target (20% of the 620-word source) to preserve all 4 core quantitative findings."*

---

## 3. Edge Cases & Error Recovery Flows
- **Empty or Scanned Image-Only PDF**: Displays an inline warm-ochre notice informing the user that no selectable text layer was found and offers sample text or manual paste.
- **Ultra-Short Input (`< 30` words)**: When the user requests a 200-word summary of a 25-word note, the agent automatically caps the target or provides a concise distillation without hallucinating filler.
- **API / Network Interruption**: If the Edge Function or external API is unreachable from a restricted network, the client automatically falls back to direct Groq/Grok inference and intelligent local synthesis so the user can always complete their task and export PDF/DOCX/TXT files.
