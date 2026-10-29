// Summary exports (PRD FR-3): PDF via jsPDF, Word via docx, plain text and Markdown as UTF-8 blobs.
import { STYLES, type SummaryResult } from "@core";

type Doc = SummaryResult & { createdAt?: string };

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "summary";

function meta(d: Doc): [string, string][] {
  return [
    ["Source", d.sourceFilename ?? "Pasted text"],
    ["Generated", new Date(d.createdAt ?? Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })],
    ["Length", `${d.actualWordCount} words (target ${d.targetWordCount}, ${d.lengthMode === "custom" ? "custom" : "AI auto-decided"})`],
    ["Compression", `${d.sourceWordCount.toLocaleString("en-US")} to ${d.actualWordCount} words, ${d.compressionRatio}% condensed`],
    ["Style", STYLES[d.summaryStyle]?.label ?? d.summaryStyle],
    ["Model", d.modelUsed],
  ];
}

function save(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1_000);
}

export const toMarkdown = (d: Doc) =>
  [
    `# ${d.title}`,
    "",
    ...meta(d).map(([k, v]) => `- **${k}:** ${v}`),
    "",
    "## Summary",
    "",
    d.summary.replace(/^• /gm, "- "),
    "",
    "## Key Takeaways",
    "",
    ...d.keyTakeaways.map((t) => `- ${t}`),
    ...(d.keywords.length ? ["", `**Keywords:** ${d.keywords.join(", ")}`] : []),
  ].join("\n");

export const toPlainText = (d: Doc) =>
  [
    d.title,
    "=".repeat(Math.min(d.title.length, 72)),
    ...meta(d).map(([k, v]) => `${k}: ${v}`),
    "",
    "SUMMARY",
    "",
    d.summary,
    "",
    "KEY TAKEAWAYS",
    "",
    ...d.keyTakeaways.map((t) => `• ${t}`),
    ...(d.keywords.length ? ["", `Keywords: ${d.keywords.join(", ")}`] : []),
  ].join("\n");

export const exportMarkdown = (d: Doc) =>
  save(new Blob([toMarkdown(d)], { type: "text/markdown;charset=utf-8" }), `${slug(d.title)}.md`);

export const exportText = (d: Doc) =>
  save(new Blob([toPlainText(d)], { type: "text/plain;charset=utf-8" }), `${slug(d.title)}.txt`);

export async function exportDocx(d: Doc) {
  const { BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } =
    await import("docx");
  const rule = { style: BorderStyle.SINGLE, size: 4, color: "E5E2D9" };
  const cell = (text: string, label: boolean) =>
    new TableCell({
      width: { size: label ? 2200 : 7000, type: WidthType.DXA },
      shading: label ? { type: ShadingType.CLEAR, color: "auto", fill: "F4F3EE" } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: label, size: 19, font: "Calibri", color: label ? "66655F" : "141413" })] })],
    });
  const doc = new Document({
    title: d.title,
    creator: "Claude Summary Studio",
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 23, color: "141413" } },
        title: { run: { font: "Georgia", size: 44, color: "141413" }, paragraph: { spacing: { after: 200 } } },
        heading1: { run: { font: "Georgia", size: 28, bold: true, color: "C46142" }, paragraph: { spacing: { before: 360, after: 120 } } },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.title)] }),
          new Table({
            width: { size: 9200, type: WidthType.DXA },
            columnWidths: [2200, 7000],
            borders: { top: rule, bottom: rule, left: rule, right: rule, insideHorizontal: rule, insideVertical: rule },
            rows: meta(d).map(([k, v]) => new TableRow({ children: [cell(k, true), cell(v, false)] })),
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Summary")] }),
          ...d.summary
            .split(/\n+/)
            .filter((line) => line.trim())
            .map((line) =>
              line.startsWith("• ")
                ? new Paragraph({ bullet: { level: 0 }, children: [new TextRun(line.slice(2))] })
                : new Paragraph({ spacing: { after: 160, line: 320 }, children: [new TextRun(line)] }),
            ),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Key Takeaways")] }),
          ...d.keyTakeaways.map((t) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(t)] })),
          ...(d.keywords.length
            ? [new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "Keywords: ", bold: true }), new TextRun(d.keywords.join(", "))] })]
            : []),
        ],
      },
    ],
  });
  save(await Packer.toBlob(doc), `${slug(d.title)}.docx`);
}

// jsPDF's built-in fonts use Windows-1252, and one character outside it garbles the whole line, so map
// common Unicode punctuation (the model likes U+2011 non-breaking hyphens) and replace the rest.
// ponytail: other scripts (Urdu, Hindi, CJK) become "?"; embed a Unicode TTF via pdf.addFont() if needed.
const winAnsi = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[‐-‒⁃−]/g, "-")
    .replace(/―/g, "—")
    .replace(/[ -   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/′/g, "'")
    .replace(/″/g, '"')
    .replace(/[^\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "?");

type Rgb = [number, number, number];
const INK: Rgb = [20, 20, 19];
const GRAPHITE: Rgb = [102, 101, 95];
const CLAY: Rgb = [174, 82, 50];

export async function exportPdf(d: Doc) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  let y = 44;

  const write = (
    text: string,
    size: number,
    { font = "times", style = "normal", color = INK, indent = 0, after = 6, bullet = false } = {} as {
      font?: string; style?: string; color?: Rgb; indent?: number; after?: number; bullet?: boolean;
    },
  ) => {
    pdf.setFont(font, style).setFontSize(size).setTextColor(...color);
    const lineHeight = size * 1.45;
    (pdf.splitTextToSize(winAnsi(text), W - 2 * M - indent) as string[]).forEach((line, i) => {
      if (y + lineHeight > H - M) {
        pdf.addPage();
        y = M;
      }
      if (bullet && i === 0) pdf.setFillColor(217, 119, 87).circle(M + 4, y + size * 0.52, 1.8, "F");
      pdf.text(line, M + indent, y, { baseline: "top" });
      y += lineHeight;
    });
    y += after;
  };
  const section = (label: string) => write(label, 9, { font: "helvetica", style: "bold", color: CLAY, after: 8 });

  pdf.setFillColor(217, 119, 87).rect(0, 0, W, 5, "F");
  write("SUMMARY STUDIO", 8, { font: "helvetica", style: "bold", color: CLAY, after: 6 });
  write(d.title, 21, { style: "bold", after: 8 });
  write(meta(d).map(([k, v]) => `${k}: ${v}`).join("   ·   "), 8.5, { font: "helvetica", color: GRAPHITE, after: 14 });
  pdf.setDrawColor(229, 226, 217).setLineWidth(0.75).line(M, y, W - M, y);
  y += 22;

  section("SUMMARY");
  for (const p of d.summary.split(/\n+/).filter((line) => line.trim()))
    if (p.startsWith("• ")) write(p.slice(2), 12, { indent: 14, bullet: true, after: 4 });
    else write(p, 12, { after: 10 });
  y += 8;
  section("KEY TAKEAWAYS");
  for (const t of d.keyTakeaways) write(t, 11.5, { indent: 14, bullet: true, after: 4 });
  if (d.keywords.length) {
    y += 8;
    write(`Keywords: ${d.keywords.join(", ")}`, 9.5, { font: "helvetica", color: GRAPHITE });
  }

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++)
    pdf
      .setPage(p)
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(148, 146, 138)
      .text(`Claude Summary Studio  ·  ${p} / ${pages}`, W / 2, H - 28, { align: "center" });
  pdf.save(`${slug(d.title)}.pdf`);
}
