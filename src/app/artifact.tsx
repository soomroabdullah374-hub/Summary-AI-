"use client";

import { useState } from "react";
import { Check, Copy, FileCode, FileDown, FileText, FileType, ScrollText, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { STYLES, band, type SummaryResult } from "@core";
import { exportDocx, exportMarkdown, exportPdf, exportText } from "@/lib/export";

export type Shown = SummaryResult & { id?: string; createdAt?: string };
type Toast = (text: string, tone?: "info" | "success" | "warning" | "error") => void;

export const card = "rounded-[20px] border border-rule bg-surface shadow-[0_4px_20px_-2px_rgba(20,20,19,0.05)]";
const dot = "relative pl-5 before:absolute before:left-1 before:top-[0.68em] before:size-1.5 before:rounded-full before:bg-accent";
const fmt = (n: number) => n.toLocaleString("en-US");

const EXPORTS: { label: string; icon: LucideIcon; run: (d: Shown) => unknown }[] = [
  { label: "PDF", icon: FileDown, run: exportPdf },
  { label: "Word", icon: FileType, run: exportDocx },
  { label: "Text", icon: FileText, run: exportText },
  { label: "Markdown", icon: FileCode, run: exportMarkdown },
];

/** Paragraphs, with runs of "• " lines rendered as a list. */
function Prose({ text }: { text: string }) {
  const groups: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[•*-]\s+/.test(line);
    const last = groups.at(-1);
    const clean = line.replace(/^[•*-]\s+/, "");
    if (bullet && last?.bullets) last.lines.push(clean);
    else groups.push({ bullets: bullet, lines: [clean] });
  }
  return groups.map((g, i) =>
    g.bullets ? (
      <ul key={i} className="space-y-2">
        {g.lines.map((l, j) => (
          <li key={j} className={dot}>
            {l}
          </li>
        ))}
      </ul>
    ) : (
      <p key={i}>{g.lines[0]}</p>
    ),
  );
}

export function Artifact({
  result,
  loading,
  onRename,
  toast,
}: {
  result: Shown | null;
  loading: boolean;
  onRename: (title: string) => void;
  toast: Toast;
}) {
  const [title, setTitle] = useState(result?.title ?? "");
  const [copied, setCopied] = useState(false);

  if (loading)
    return (
      <article className={`${card} p-6 sm:p-7 lg:h-full`} aria-busy="true">
        <div className="skeleton h-3 w-44" />
        <div className="skeleton mt-4 h-7 w-3/4" />
        <div className="mt-3 flex gap-2">
          <div className="skeleton h-6 w-44 rounded-full" />
          <div className="skeleton h-6 w-28 rounded-full" />
        </div>
        <div className="mt-8 space-y-3">
          {[100, 96, 98, 90, 94, 62].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="skeleton mt-8 h-28 w-full rounded-2xl" />
        <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-2" role="status">
          <Sparkles className="size-4 text-accent" /> Synthesizing your summary…
        </p>
      </article>
    );

  if (!result)
    return (
      <article className={`${card} grid min-h-[360px] place-items-center p-10 text-center lg:h-full`}>
        <div className="max-w-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-subtle text-accent-ink">
            <ScrollText className="size-6" />
          </span>
          <h2 className="mt-4 font-serif text-[22px] font-medium tracking-[-0.01em]">Your summary artifact appears here</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            Exact word counts, compression stats and key takeaways, with one-click export to PDF, Word, Text or Markdown.
          </p>
        </div>
      </article>
    );

  const doc = { ...result, title: title.trim() || result.title };
  const { min, max } = band(result.targetWordCount, result.lengthMode);
  const onTarget = result.actualWordCount >= min && result.actualWordCount <= max;
  const minutes = Math.max(1, Math.round(result.actualWordCount / 230));

  async function run(label: string, fn: (d: Shown) => unknown) {
    try {
      await fn(doc);
    } catch (e) {
      toast(`${label} export failed: ${e instanceof Error ? e.message : e}`, "error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        [doc.title, "", doc.summary, "", "Key takeaways:", ...doc.keyTakeaways.map((t) => `• ${t}`)].join("\n"),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("The browser blocked clipboard access.", "error");
    }
  }

  return (
    <article className={`${card} rise flex flex-col overflow-hidden lg:h-full`}>
      <header className="border-b border-rule px-5 pb-4 pt-5 sm:px-7">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
          <FileText className="size-3.5 text-accent" />
          {STYLES[result.summaryStyle]?.label ?? "Summary"} · {minutes} min read
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => doc.title !== result.title && onRename(doc.title)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Summary title"
          className="-mx-1.5 mt-1.5 w-[calc(100%+0.75rem)] rounded-lg bg-transparent px-1.5 py-0.5 font-serif text-[19px] font-semibold leading-snug tracking-[-0.01em] outline-none transition-colors hover:bg-sand focus:bg-sand sm:text-[22px]"
        />
        <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[12px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${onTarget ? "bg-success/10 text-success" : "bg-warning/10 text-ink"}`}
            title={`Accepted range ${min}–${max} words`}
          >
            {onTarget ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5 text-warning" />}
            Target: {result.targetWordCount}w · Actual: {result.actualWordCount}w
          </span>
          <span className="rounded-full bg-pill px-2.5 py-1 text-ink-2">{result.compressionRatio}% condensed</span>
          <span className="rounded-full bg-pill px-2.5 py-1 text-ink-2">{fmt(result.sourceWordCount)} source words</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        {result.modelUsed === "local-extractive" && (
          <p className="mb-4 flex gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] leading-relaxed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            Offline extractive summary: the AI engine couldn&apos;t be reached, so these are the source&apos;s most informative sentences.
          </p>
        )}
        <p className="flex gap-2.5 rounded-xl bg-accent-subtle px-4 py-3 text-[13px] leading-relaxed">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>
            <span className="font-semibold text-accent-ink">AI sizing rationale. </span>
            {result.aiRationale}
          </span>
        </p>

        <div className="mt-6 space-y-4 font-serif text-[16px] leading-[1.75] tracking-[-0.005em] sm:text-[17px]">
          <Prose text={result.summary} />
        </div>

        {result.keyTakeaways.length > 0 && (
          <section className="mt-7 rounded-2xl border border-rule bg-sand px-5 py-4">
            <h3 className="text-[13px] font-semibold tracking-[0.01em]">Key takeaways</h3>
            <ul className="mt-2.5 space-y-2 font-serif text-[15.5px] leading-relaxed">
              {result.keyTakeaways.map((t, i) => (
                <li key={i} className={dot}>
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.keywords.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Keywords">
            {result.keywords.map((k) => (
              <li key={k} className="rounded-full border border-rule px-2.5 py-1 text-[12px] text-ink-2">
                {k}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-rule px-5 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          {EXPORTS.map(({ label, icon: Icon, run: fn }) => (
            <button
              key={label}
              type="button"
              onClick={() => run(label, fn)}
              aria-label={`Download as ${label}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sand px-3 py-1.5 text-[13px] font-medium transition-colors duration-180 ease-claude hover:bg-pill"
            >
              <Icon className="size-4 text-accent" /> {label}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-180 ease-claude hover:bg-pill hover:text-ink"
          >
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-ink-2">
          {result.modelUsed} · {fmt(result.latencyMs)} ms{result.sourceFilename ? ` · ${result.sourceFilename}` : ""}
        </p>
      </footer>
    </article>
  );
}
