# Product Requirements Document (`PRD.md`)

## 1. Product Overview & Vision
**Product Name**: Claude Summary Studio  
**Platform**: v0.dev (Vercel) + Next.js App Router + Supabase (`summary`, `ap-south-1` Mumbai) + Groq/Grok LLM API  
**Vision**: Empower professionals, researchers, students, and executives to distill any text or uploaded document (PDF, Word `.docx`, TXT, Markdown, CSV, RTF, JSON) into a clear, accurate brief summary—either strictly constrained to a user-specified word count or autonomously sized by AI based on source complexity—and immediately export the result in **PDF, Word (`.docx`), or Text (`.txt` / `.md`)** within a calm, Claude.ai-inspired workspace.

---

## 2. Target Audience & User Personas
1. **Executive & Product Leader ("Maya")**: Uploads 20-page strategy PDFs or `.docx` memos and needs an exact 120-word executive summary she can export as a `.docx` or `.pdf` brief for leadership meetings.
2. **Academic Researcher & Student ("Arjun")**: Drops multiple research papers or lecture notes without knowing the ideal summary length; relies on **AI Auto-Decide Mode** to calculate the optimal compression ratio and downloads clean `.pdf` study briefs.
3. **Content Editor & Copywriter ("Sara")**: Pastes raw transcripts or `.txt` drafts and needs strict word-count enforcement (e.g., "Summarize in exactly 75 words") to fit newsletter or social media character/word budgets.

---

## 3. Functional Requirements (FR)

### FR-1: Multi-Format Content Ingestion
- **FR-1.1 Direct Text & Paste Composer**: Support pasting or typing up to 100,000 characters with real-time word, character, sentence, and estimated reading-time counters.
- **FR-1.2 Multi-Format File Upload**:
  - **PDF (`.pdf`)**: Extract full text across all pages in-browser via `pdf.js` (`pdfjs-dist`) and server-side fallback.
  - **Microsoft Word (`.docx` / `.doc`)**: Extract clean semantic text and headings via `mammoth.js`.
  - **Plain Text & Markup (`.txt`, `.md`, `.csv`, `.json`, `.rtf`)**: Parse via UTF-8 FileReader with automatic RTF control-word stripping and CSV/JSON table flattening.
- **FR-1.3 Sample Presets**: Provide 1-click sample documents (e.g., *Q3 Cloud Infrastructure Report*, *AI Governance Whitepaper*, *Clinical Trial Protocol*) so new users can test immediately without uploading a file.

### FR-2: Dual-Mode Word Count Control Engine
- **FR-2.1 User-Specified Word Count Mode**:
  - Users can enter any target word count (between `20` and `1,500` words) via a direct number input, interactive slider, or preset pills (`50`, `100`, `150`, `250`, `500` words).
  - The AI summarization engine enforces a strict $\pm 5\%$ word-count tolerance and performs an automatic post-processing trim/expansion check.
- **FR-2.2 AI Auto-Decide Mode (Default when blank/unspecified)**:
  - When the user leaves the word count empty or selects **AI Auto-Decide**, the system analyzes source word count ($W_{src}$), paragraph structure, and lexical density to determine the optimal target length ($W_{opt}$):
    - Short inputs ($< 200$ words) $\rightarrow$ `40–60` words (~30% ratio)
    - Medium articles ($200–1,000$ words) $\rightarrow$ `90–160` words (~18% ratio)
    - Long reports ($1,000–5,000$ words) $\rightarrow$ `200–350` words (~10% ratio)
    - Extensive documents ($> 5,000$ words) $\rightarrow$ `350–500` words (~5–8% ratio)
  - Displays a transparent rationale badge (e.g., *"AI selected 135 words based on high information density across 840 source words"*).

### FR-3: Multi-Format Summary Generation & Export
- **FR-3.1 Export as PDF (`.pdf`)**: Generate a formatted document styled with Claude editorial typography, header metadata (source filename, date, word count reduction, compression ratio), summary body, and key takeaways.
- **FR-3.2 Export as Microsoft Word (`.docx`)**: Generate a standards-compliant Word document (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) that opens cleanly in Microsoft Word, Google Docs, and LibreOffice.
- **FR-3.3 Export as Plain Text (`.txt`) & Markdown (`.md`)**: Provide clean UTF-8 downloads and 1-click clipboard copy.

### FR-4: Persistence & History (Supabase `summary` Database)
- Save generated summaries, source metadata, target vs. actual word counts, and compression ratios to the `summaries` table in Supabase (`ap-south-1` Mumbai).
- Allow users to inspect, reload, re-export, or delete past summaries from the left history drawer.

---

## 4. Non-Functional Requirements (NFR)
- **Performance**: Client-side file extraction under `1.5s` for documents up to 15 MB; LLM summary generation under `2.5s` via Groq/Grok high-speed inference (`llama-3.3-70b-versatile` / `grok-2-latest`).
- **Reliability & Offline Resilience**: If network/CORS blocks direct edge function calls inside preview sandboxes, automatically fall back to direct API execution and deterministic extractive+abstractive synthesis so the user never experiences a dead error screen.
- **Accessibility**: WCAG 2.1 AA contrast compliance (`>= 4.5:1` on warm paper backgrounds), full keyboard navigation (`Cmd/Ctrl + Enter` to summarize), and ARIA live regions.

---

## 5. Success Metrics (KPIs)
- **Word-Count Accuracy Rate**: $\ge 95\%$ of user-specified summaries land within $\pm 5\%$ of the requested word count.
- **File Ingestion Success Rate**: $\ge 99\%$ successful text extraction across PDF, DOCX, TXT, and MD files.
- **Time-to-Export**: $< 5$ seconds from file drop to downloaded PDF/DOCX summary.
