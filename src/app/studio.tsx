"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Asterisk,
  CircleCheck,
  Cpu,
  Database,
  Hash,
  History,
  Info,
  LoaderCircle,
  Menu,
  Moon,
  Paperclip,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  MAX_SOURCE_CHARS,
  MAX_TARGET,
  MIN_SOURCE_WORDS,
  MIN_TARGET,
  STYLES,
  countWords,
  localSummary,
  parseRequest,
  planBudget,
  splitSentences,
  type LengthMode,
  type SavedSummary,
  type SourceType,
  type SummaryResult,
  type SummaryStyle,
} from "@core";
import { ACCEPT, extractFile } from "@/lib/extract";
import { deleteHistory, listHistory, renameHistory, saveHistory, supabaseEnabled } from "@/lib/history";
import { SAMPLES } from "@/lib/samples";
import { Artifact, card, type Shown } from "./artifact";

type View = "studio" | "history";
type Tone = "info" | "success" | "warning" | "error";
type Engine = { configured: boolean; provider?: string; model?: string };
type Attachment = { name: string; type: SourceType; words: number; chars: number };

const PRESETS = [50, 100, 150, 250, 500];
const fmt = (n: number) => n.toLocaleString("en-US");
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pill = "rounded-full border border-rule px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-180 ease-claude";
const TONES: Record<Tone, { icon: LucideIcon; color: string }> = {
  info: { icon: Info, color: "text-ink-2" },
  success: { icon: CircleCheck, color: "text-success" },
  warning: { icon: TriangleAlert, color: "text-warning" },
  error: { icon: TriangleAlert, color: "text-accent" },
};

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Studio() {
  const [view, setView] = useState<View>("studio");
  const [drawer, setDrawer] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lengthMode, setLengthMode] = useState<LengthMode>("ai_auto");
  const [targetWords, setTargetWords] = useState(150);
  const [style, setStyle] = useState<SummaryStyle>("executive");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Shown | null>(null);
  const [history, setHistory] = useState<SavedSummary[]>([]);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: Tone }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const artifactRef = useRef<HTMLElement>(null);

  const toast = useCallback((text: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    fetch("/api/summarize")
      .then((r) => r.json())
      .then(setEngine, () => setEngine({ configured: false }));
    listHistory().then(setHistory, (e) => toast(`Couldn't load history: ${errorText(e)}`, "warning"));
  }, [toast]);

  const words = useMemo(() => countWords(content), [content]);
  const sentences = useMemo(() => splitSentences(content).length, [content]);
  const plan = planBudget(words, lengthMode, lengthMode === "custom" ? targetWords : null);
  const ready = words >= MIN_SOURCE_WORDS && !loading && !extracting;

  async function handleFile(file: File) {
    setExtracting(file.name);
    setNotice(null);
    try {
      const { type, text } = await extractFile(file);
      if (!countWords(text)) {
        setNotice(
          type === "pdf"
            ? `“${file.name}” has no selectable text layer, so it may be a scanned image. Paste its text instead, or try a sample.`
            : `“${file.name}” doesn't contain any readable text.`,
        );
        return;
      }
      const kept = text.slice(0, MAX_SOURCE_CHARS);
      if (kept.length < text.length) toast(`Long document: kept the first ${fmt(MAX_SOURCE_CHARS)} characters.`, "warning");
      setContent(kept);
      setTitle((t) => t || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      setAttachment({ name: file.name, type, words: countWords(kept), chars: kept.length });
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setExtracting(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function generate() {
    if (!ready) return;
    const req = parseRequest({
      title,
      content,
      sourceType: attachment?.type ?? "paste",
      sourceFilename: attachment?.name ?? null,
      lengthMode,
      targetWords,
      summaryStyle: style,
    });
    if ("error" in req) return toast(req.error, "error");
    setLoading(true);
    if (matchMedia("(max-width: 1023px)").matches) artifactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    let summary: SummaryResult;
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400) {
        setLoading(false);
        return toast(data.error ?? "That request wasn't valid.", "error");
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      summary = data;
    } catch (e) {
      // NFR: never a dead end. Fall back to a local extractive summary.
      summary = localSummary(req, errorText(e));
      toast(`AI engine unavailable (${errorText(e)}). Showing an offline extractive summary instead.`, "warning");
    }

    try {
      const saved = await saveHistory(summary, req.content);
      setResult(saved);
      setHistory((h) => [saved, ...h]);
    } catch (e) {
      setResult(summary);
      toast(`Summary ready, but it couldn't be saved to history: ${errorText(e)}`, "warning");
    } finally {
      setLoading(false);
    }
  }

  function openSummary(s: SavedSummary) {
    setResult(s);
    setContent(s.sourceContent);
    setTitle("");
    setNotice(null);
    setAttachment(
      s.sourceFilename
        ? { name: s.sourceFilename, type: s.sourceType, words: countWords(s.sourceContent), chars: s.sourceContent.length }
        : null,
    );
    setLengthMode(s.lengthMode);
    if (s.requestedWords) setTargetWords(s.requestedWords);
    setStyle(s.summaryStyle);
    setView("studio");
    setDrawer(false);
  }

  async function removeSummary(id: string) {
    try {
      await deleteHistory(id);
      setHistory((h) => h.filter((s) => s.id !== id));
      setResult((r) => (r?.id === id ? null : r));
      toast("Summary deleted.", "success");
    } catch (e) {
      toast(`Couldn't delete that summary: ${errorText(e)}`, "error");
    }
  }

  function rename(next: string) {
    if (!result) return;
    setResult({ ...result, title: next });
    if (!result.id) return;
    const id = result.id;
    setHistory((h) => h.map((s) => (s.id === id ? { ...s, title: next } : s)));
    renameHistory(id, next).catch((e) => toast(`Couldn't save the new title: ${errorText(e)}`, "warning"));
  }

  function reset() {
    setTitle("");
    setContent("");
    setAttachment(null);
    setNotice(null);
    setResult(null);
    setView("studio");
    setDrawer(false);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("summary-studio:theme", next);
    } catch {}
    setTheme(next);
  }

  const nav: [View, string, LucideIcon][] = [
    ["studio", "Summarizer Studio", Sparkles],
    ["history", "Saved Summaries", History],
  ];

  const sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[260px] shrink-0 flex-col border-r border-rule bg-sand transition-transform duration-200 ease-claude lg:static lg:translate-x-0 ${
        drawer ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
          <Asterisk className="size-5" strokeWidth={2.5} />
        </span>
        <span className="font-serif text-[19px] font-medium tracking-[-0.01em]">Summary Studio</span>
        <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="ml-auto rounded-lg p-1.5 hover:bg-pill lg:hidden">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={reset}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-180 ease-claude hover:bg-pill"
        >
          <span className="grid size-6 place-items-center rounded-full bg-accent text-white">
            <Plus className="size-4" />
          </span>
          New summary
        </button>
      </div>

      <nav className="mt-3 space-y-0.5 px-3" aria-label="Workspace">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              setDrawer(false);
            }}
            aria-current={view === id ? "page" : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors duration-180 ease-claude hover:bg-pill ${
              view === id ? "bg-pill font-medium" : "text-ink-2"
            }`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      <p className="mt-5 px-6 text-[11px] font-semibold uppercase tracking-wider text-ink-2">Recent</p>
      <ul className="mt-1 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {history.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-2">No summaries yet.</li>}
        {history.slice(0, 15).map((s) => (
          <li key={s.id} className="group relative">
            <button
              type="button"
              onClick={() => openSummary(s)}
              className={`w-full rounded-lg py-2 pl-3 pr-8 text-left transition-colors duration-180 ease-claude hover:bg-pill ${
                result?.id === s.id ? "bg-pill" : ""
              }`}
            >
              <span className="block truncate text-[13.5px]">{s.title}</span>
              <span className="mt-0.5 flex gap-2 font-mono text-[11px] text-ink-2">
                <span>
                  {s.actualWordCount}/{s.targetWordCount}w
                </span>
                <span>{ago(s.createdAt)}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeSummary(s.id)}
              aria-label={`Delete “${s.title}”`}
              className="absolute right-1.5 top-2 rounded-md p-1 text-ink-2 opacity-0 transition-opacity hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <footer className="space-y-2 border-t border-rule px-4 py-3 font-mono text-[11px] text-ink-2">
        <p className="flex items-center gap-2" title={supabaseEnabled ? "Supabase project summary, ap-south-1 (Mumbai)" : "Saved in this browser's storage"}>
          <span className={`size-1.5 rounded-full ${supabaseEnabled ? "bg-success" : "bg-ink-3"}`} />
          <Database className="size-3.5" />
          {supabaseEnabled ? "Supabase · summary (ap-south-1)" : "History · this browser"}
        </p>
        <p className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${engine?.configured ? "bg-success" : "bg-warning"}`} />
          <Cpu className="size-3.5" />
          <span className="truncate">
            {engine == null ? "AI engine · checking…" : engine.configured ? `${engine.provider} · ${engine.model}` : "AI engine · offline mode"}
          </span>
        </p>
        <button type="button" onClick={toggleTheme} className="flex items-center gap-2 rounded-md py-0.5 hover:text-ink">
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </footer>
    </aside>
  );

  const studio = (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:gap-8 lg:p-8">
      <section
        aria-label="Composer"
        className="min-w-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            generate();
          }
        }}
      >
        <h1 className="font-serif text-2xl font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">What shall we distill today?</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          Drop a PDF, Word, text or data file, or paste anything. Set an exact word budget, or let AI decide.
        </p>

        <div
          className={`${card} relative mt-6 transition-colors duration-180 ease-claude focus-within:border-accent`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={onDrop}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[20px] border-2 border-dashed border-accent bg-accent-subtle/90 text-[14px] font-medium text-accent-ink">
              <span className="flex items-center gap-2">
                <Upload className="size-5" /> Drop to extract text
              </span>
            </div>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title (optional)"
            aria-label="Document title"
            maxLength={200}
            className="w-full rounded-t-[20px] bg-transparent px-5 pt-4 font-serif text-[18px] outline-none placeholder:text-ink-3"
          />
          {(extracting || attachment) && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-rule bg-sand px-3 py-2.5">
              {extracting ? (
                <>
                  <LoaderCircle className="size-5 animate-spin text-accent" />
                  <p className="min-w-0 flex-1 truncate text-[13.5px]" role="status">
                    Extracting text from {extracting}…
                  </p>
                </>
              ) : (
                attachment && (
                  <>
                    <span className="rounded-md bg-accent-subtle px-1.5 py-1 font-mono text-[10.5px] font-semibold uppercase text-accent-ink">
                      {attachment.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{attachment.name}</p>
                      <p className="font-mono text-[11.5px] text-ink-2">
                        {fmt(attachment.words)} words · {fmt(attachment.chars)} chars
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        setContent("");
                      }}
                      aria-label={`Remove ${attachment.name}`}
                      className="rounded-md p-1 text-ink-2 hover:bg-pill hover:text-ink"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )
              )}
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            maxLength={MAX_SOURCE_CHARS}
            placeholder="Paste or type the text to summarize, or drop a file here…"
            aria-label="Source text"
            className="block min-h-[220px] w-full resize-y bg-transparent px-5 py-3 text-[14.5px] leading-relaxed outline-none placeholder:text-ink-3"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-3 py-2.5">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-180 ease-claude hover:bg-pill hover:text-ink"
            >
              <Paperclip className="size-4" /> Attach file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <span className="text-[11.5px] text-ink-2">PDF · DOCX · TXT · MD · CSV · JSON · RTF</span>
            <span className="ml-auto font-mono text-[12px] text-ink-2" aria-live="polite">
              {fmt(words)} words · {fmt(content.length)} chars · {sentences} sentences
              {words > 0 && ` · ${Math.max(1, Math.round(words / 230))} min read`}
            </span>
          </div>
        </div>

        {notice && (
          <p role="status" className="mt-3 flex gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] leading-relaxed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> {notice}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-ink-2">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setContent(s.text);
                setTitle(s.label);
                setAttachment(null);
                setNotice(null);
              }}
              className={`${pill} bg-sand hover:bg-pill`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-rule bg-sand p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold">Length</span>
            <div role="radiogroup" aria-label="Length mode" className="inline-flex rounded-xl border border-rule bg-surface p-1">
              {(
                [
                  ["ai_auto", "AI Auto-Decide", Sparkles],
                  ["custom", "Custom word count", Hash],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={lengthMode === mode}
                  onClick={() => setLengthMode(mode)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-180 ease-claude ${
                    lengthMode === mode ? "bg-accent-subtle text-accent-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            {lengthMode === "ai_auto" && (
              <span className="font-mono text-[12px] text-ink-2">
                {words >= MIN_SOURCE_WORDS ? `≈ ${plan.target} words for ${fmt(words)} source words` : "sized from your source"}
              </span>
            )}
          </div>

          {lengthMode === "custom" && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTargetWords(n)}
                    aria-pressed={targetWords === n}
                    className={`${pill} font-mono ${targetWords === n ? "border-accent bg-accent-subtle text-accent-ink" : "bg-surface hover:bg-pill"}`}
                  >
                    {n}w
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-2 font-mono text-[12px] text-ink-2">
                  <input
                    type="number"
                    min={MIN_TARGET}
                    max={MAX_TARGET}
                    value={targetWords || ""}
                    onChange={(e) => setTargetWords(Number(e.target.value))}
                    onBlur={() => setTargetWords((t) => Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(t) || 150)))}
                    aria-label="Target word count"
                    className="w-20 rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
                  />
                  words
                </label>
              </div>
              <input
                type="range"
                min={MIN_TARGET}
                max={1000}
                step={5}
                value={Math.min(targetWords, 1000)}
                onChange={(e) => setTargetWords(Number(e.target.value))}
                aria-label="Target word count slider"
                className="w-full"
              />
              {words >= MIN_SOURCE_WORDS && plan.target < targetWords && (
                <p className="text-[12.5px] text-ink-2">
                  <TriangleAlert className="mr-1 inline size-3.5 text-warning" />
                  Capped at {plan.target} words: the source only has {fmt(words)} words.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              Style
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as SummaryStyle)}
                className="rounded-xl border border-rule bg-surface px-3 py-1.5 text-[13px] font-medium outline-none focus:border-accent"
              >
                {Object.entries(STYLES).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={!ready}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors duration-180 ease-claude hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? "Synthesizing…" : "Generate summary"}
            </button>
          </div>
          <p className="mt-2 text-right text-[11.5px] text-ink-2">
            {words < MIN_SOURCE_WORDS ? (
              `Add at least ${MIN_SOURCE_WORDS} words to summarize`
            ) : (
              <>
                or press <kbd className="rounded border border-rule bg-surface px-1 font-mono">Ctrl</kbd> /{" "}
                <kbd className="rounded border border-rule bg-surface px-1 font-mono">⌘</kbd> +{" "}
                <kbd className="rounded border border-rule bg-surface px-1 font-mono">Enter</kbd>
              </>
            )}
          </p>
        </div>
      </section>

      <section ref={artifactRef} aria-label="Summary artifact" className="min-w-0 scroll-mt-16 lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)]">
        <Artifact key={result?.id ?? result?.title ?? "empty"} result={result} loading={loading} onRename={rename} toast={toast} />
      </section>
    </div>
  );

  const historyView = (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="font-serif text-[28px] font-medium tracking-[-0.02em]">Saved summaries</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        {supabaseEnabled
          ? "Saved to the Supabase summary database (ap-south-1), scoped to this browser session."
          : "Saved in this browser. Add Supabase keys to .env.local to sync history to the summary database."}
      </p>
      {history.length === 0 ? (
        <p className={`${card} mt-6 p-8 text-center text-[14px] text-ink-2`}>Summaries you generate will be listed here.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {history.map((s) => (
            <li key={s.id} className={`${card} flex items-start gap-3 p-4 sm:p-5`}>
              <button type="button" onClick={() => openSummary(s)} className="min-w-0 flex-1 text-left">
                <span className="block font-serif text-[17px] font-semibold leading-snug">{s.title}</span>
                <span className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{s.summary}</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px] text-ink-2">
                  <span>
                    {s.actualWordCount}/{s.targetWordCount}w
                  </span>
                  <span>{s.compressionRatio}% condensed</span>
                  <span>{STYLES[s.summaryStyle]?.label}</span>
                  <span>{s.sourceFilename ?? "pasted text"}</span>
                  <span>{new Date(s.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeSummary(s.id)}
                aria-label={`Delete “${s.title}”`}
                className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-pill hover:text-ink"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      {drawer && <div className="fixed inset-0 z-30 bg-ink/25 lg:hidden" onClick={() => setDrawer(false)} aria-hidden="true" />}
      {sidebar}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-rule bg-canvas/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-lg p-1.5 hover:bg-pill">
            <Menu className="size-5" />
          </button>
          <span className="font-serif text-[18px] font-medium">Summary Studio</span>
        </header>
        {view === "studio" ? studio : historyView}
      </main>

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const { icon: Icon, color } = TONES[t.tone];
          return (
            <div key={t.id} className={`${card} rise pointer-events-auto flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed shadow-lg`}>
              <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
              <span className="flex-1">{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
                className="rounded p-0.5 text-ink-2 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
