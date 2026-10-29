# Design System & UI/UX Specification (`Design.md`)

## 1. Aesthetic Direction & Philosophy (Claude.ai Editorial Pattern)
**Claude Summary Studio** adopts the signature visual language of **Claude.ai (Anthropic)**—an approachable, human-centric, literary interface that replaces cold, high-contrast tech chrome with warm paper surfaces, refined editorial serif typography for AI-generated prose, crisp geometric sans-serif controls, and tactile terracotta accents.

### Core Design Principles
- **Warm Paper Surfaces Over Stark White**: Primary backgrounds use soft alabaster and warm parchment tones (`#FAF9F5` and `#F4F3EE`) to reduce eye strain during long-form reading and document synthesis.
- **Literary Serif for AI Output, Clean Sans for Controls**: Summary outputs, key takeaways, and document titles render in a high-contrast editorial serif (`Newsreader`, `Tiempos Text`, or `Georgia`), while UI badges, word-count sliders, file dropzones, and action buttons use `Inter` and `JetBrains Mono`.
- **Composer-Centric Input & Split Artifact Drawer**: Inspired by Claude's composer and Artifact side-by-side workspace, users draft or drop files in a centered, rounded container with inline pill controls on the left/center and view structured, export-ready summaries in a dedicated **Summary Artifact Card** on the right.
- **Whisper-Quiet Borders & Subtle Elevation**: Hairline borders (`1px solid #E5E2D9`) and diffused warm shadows replace heavy drop shadows or neon gradients.

---

## 2. Color Palette & Design Tokens

| Token Name | CSS Variable | Light Mode (Default) | Dark Mode (`[data-theme="dark"]`) | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Background Primary** | `--bg-primary` | `#FAF9F5` (Warm Alabaster) | `#191918` (Warm Obsidian) | Main viewport canvas |
| **Background Secondary** | `--bg-secondary` | `#F4F3EE` (Parchment Sand) | `#232220` (Deep Charcoal) | Sidebar, Composer box, Dropzone |
| **Surface / Artifact Card** | `--bg-surface` | `#FFFFFF` (Pure Crisp Paper) | `#2A2926` (Elevated Slate) | Summary Artifact viewer, Modals |
| **Surface Hover / Pill** | `--bg-pill` | `#ECE9E0` (Warm Stone) | `#35332F` (Muted Umber) | Mode toggles, File chips, Presets |
| **Text Primary** | `--text-primary` | `#141413` (Anthropic Ink) | `#F0EFEA` (Warm Ivory) | Headings, body copy, summary text |
| **Text Secondary** | `--text-secondary` | `#66655F` (Muted Graphite) | `#A6A49B` (Warm Ash) | Subtitles, metadata, word counts |
| **Text Muted** | `--text-muted` | `#94928A` (Stone Gray) | `#75736B` (Dim Pewter) | Placeholders, disabled controls |
| **Accent Primary** | `--accent-primary` | `#D97757` (Claude Terracotta) | `#E08364` (Warm Terracotta) | Primary CTA, active slider, badges |
| **Accent Hover** | `--accent-hover` | `#C46142` (Deep Clay) | `#C96A4B` (Burnished Clay) | Primary button hover state |
| **Accent Subtle** | `--accent-subtle` | `#F9EBE5` (Terracotta Wash) | `#3D2922` (Dark Clay Tint) | Active mode highlight, AI badge |
| **Border Hairline** | `--border-subtle` | `#E5E2D9` (Warm Rule) | `#383632` (Dark Rule) | Card outlines, dividers, inputs |
| **Semantic Success** | `--status-success` | `#2E6F40` (Forest Sage) | `#52A768` (Soft Jade) | Word-count target met, DB synced |
| **Semantic Warning** | `--status-warning` | `#B86B14` (Warm Ochre) | `#E0963E` (Amber Glow) | Long file chunking alert |

---

## 3. Typography Scale & Font Stack

### Font Families
- **Editorial Serif (`--font-serif`)**: `'Newsreader', 'Tiempos Text', 'Charter', 'Georgia', serif` — Applied to workspace greetings, summary artifact headlines, and generated summary paragraphs.
- **UI Sans-Serif (`--font-sans`)**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` — Applied to navigation, file upload cards, word-count controls, dropdowns, and export buttons.
- **Technical Monospace (`--font-mono`)**: `'JetBrains Mono', 'Fira Code', monospace` — Applied to exact word counters (`148 / 150 words`), compression percentages (`82% reduction`), latency metrics, and API logs.

### Typographic Hierarchy
| Element | Font Family | Size (Desktop / Mobile) | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Workspace Greeting** | `--font-serif` | `32px / 24px` (`2rem`) | `500` | `1.25` | `-0.02em` |
| **Artifact Title** | `--font-serif` | `22px / 19px` (`1.375rem`) | `600` | `1.3` | `-0.01em` |
| **Summary Prose Body** | `--font-serif` | `17px / 16px` (`1.0625rem`) | `400` | `1.75` | `-0.005em` |
| **Section Subheader** | `--font-sans` | `14px` (`0.875rem`) | `600` | `1.4` | `0.01em` |
| **UI Control / Button** | `--font-sans` | `13.5px` (`0.843rem`) | `500` | `1.2` | `0.005em` |
| **Metric Pill / Counter** | `--font-mono` | `12px` (`0.75rem`) | `500` | `1.0` | `0.02em` |

---

## 4. Core Component Specifications

### 4.1 Left Collapsible Sidebar (Claude History & Navigation Drawer)
- **Width**: `260px` expanded, collapsible on mobile/tablet.
- **Surface**: `--bg-secondary` (`#F4F3EE`) with right border `1px solid #E5E2D9`.
- **Elements**:
  - Brand header with terracotta starburst emblem + `Summary Studio` wordmark.
  - `+ New Summary` pill button (`#D97757` icon with `#ECE9E0` hover background).
  - **Workspace Views**: `Summarizer Studio`, `Supabase History`, and `Project Blueprints (Docs)`.
  - **Recent Summaries List**: Chronological list showing document title, target vs. actual word count badge, and timestamp.
  - **Database Status Footer**: Live indicator showing `Supabase: summary (ap-south-1)` and API engine status.

### 4.2 Claude-Style Multi-Format Composer & Dropzone
- **Container**: Rounded `20px` card (`--bg-surface`), `1px solid #E5E2D9`, subtle shadow `0 4px 20px -2px rgba(20, 20, 19, 0.05)`, focus-within border `#D97757`.
- **Multi-Format Upload Bar**:
  - Drag-and-drop zone + attachment button supporting **PDF (`.pdf`)**, **Word (`.docx`)**, **Plain Text (`.txt`)**, **Markdown (`.md`)**, **CSV (`.csv`)**, **JSON (`.json`)**, and **RTF (`.rtf`)**.
  - Uploaded file renders as a Claude-style **Attachment Card** displaying a file-type badge (`PDF`, `DOCX`, `TXT`, `MD`), filename, extracted word/character count, and quick remove (`×`) button.
- **Word-Count Intelligence Bar**:
  - **Mode Toggle**: Segmented pill switch between **`AI Auto-Decide Length`** (default smart heuristic) and **`Custom Word Count`** (user-specified target).
  - **Custom Target Input**: Numeric input + quick-select chips (`50w`, `100w`, `150w`, `250w`, `500w`) + interactive range slider (`25` to `1000` words).
  - **Summary Style Selector**: Dropdown pill for `Executive Brief`, `Key Bullet Points`, `Academic Abstract`, or `Action Items & Decisions`.

### 4.3 Claude Artifact Pane (Summary Output & Multi-Format Exporter)
- **Header Bar**: Displays Artifact icon, editable document title, reading time, and word-accuracy badge (e.g., `Target: 100w · Actual: 98w · 79% condensed`).
- **Body Canvas**: Generous `28px` padding, editorial serif typography, structured paragraphs, key takeaway callout box, and entity/keyword pills.
- **Export Action Bar**:
  - **Download PDF (`.pdf`)**: Generates a clean, print-styled editorial PDF report with metadata header and serif body.
  - **Download Word (`.docx`)**: Generates a native Microsoft Word document with proper heading styles, metadata table, and body paragraphs.
  - **Download Text (`.txt`) & Markdown (`.md`)**: Instant UTF-8 file download.
  - **Copy to Clipboard**: One-click copy with animated checkmark feedback.

---

## 5. Responsive Layout & Motion Guidelines
- **Desktop (`>= 1024px`)**: Split two-column studio (`50%` Composer & Source Inspector on the left, `50%` Claude Artifact Summary Viewer on the right) alongside the `260px` navigation sidebar.
- **Tablet & Mobile (`< 1024px`)**: Single-column stacked flow where the Artifact pane smoothly scrolls into view upon generation, with a slide-over drawer for history.
- **Micro-Interactions**: `180ms cubic-bezier(0.16, 1, 0.3, 1)` transitions on all pills, warmth-tinted skeleton shimmer during LLM streaming/generation, and non-blocking toast notifications at the bottom-right.
