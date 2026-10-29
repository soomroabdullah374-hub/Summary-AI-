// Client-side text extraction for uploaded files (PRD FR-1.2). Heavy parsers load on demand.
import type { SourceType } from "@core";

export const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.rtf";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function extractFile(file: File): Promise<{ type: SourceType; text: string }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (file.size > MAX_FILE_BYTES) throw new Error("Files up to 15 MB are supported.");
  switch (ext) {
    case "pdf":
      return { type: "pdf", text: await pdfText(file) };
    case "docx": {
      const { extractRawText } = await import("mammoth");
      const { value } = await extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return { type: "docx", text: tidy(value) };
    }
    case "rtf":
      return { type: "rtf", text: tidy(stripRtf(await file.text())) };
    case "csv":
      return { type: "csv", text: flattenCsv(await file.text()) };
    case "json": {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error(`“${file.name}” isn't valid JSON.`);
      }
      return { type: "json", text: flattenJson(data) };
    }
    case "md":
    case "markdown":
      return { type: "md", text: tidy(await file.text()) };
    case "txt":
      return { type: "txt", text: tidy(await file.text()) };
    case "doc":
      throw new Error("Legacy .doc files aren't supported. Save it as .docx and try again.");
    default:
      throw new Error(`.${ext} files aren't supported. Use PDF, DOCX, TXT, MD, CSV, JSON or RTF.`);
  }
}

async function pdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const { items } = await (await pdf.getPage(n)).getTextContent();
      pages.push(items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join(""));
    }
    return tidy(pages.join("\n\n"));
  } finally {
    await task.destroy();
  }
}

export const tidy = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const RTF_SKIP = /^\\(\*|fonttbl|colortbl|stylesheet|info|pict|header|footer|listtable|listoverridetable|generator)/;

/** Minimal RTF to text: drops header and destination groups, decodes \'hh and \uN, maps \par to newlines. */
export function stripRtf(rtf: string): string {
  let out = "";
  let depth = 0;
  let skipDepth = 0; // depth of the group being skipped; 0 = none
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === "{") {
      depth++;
      if (!skipDepth && RTF_SKIP.test(rtf.slice(i + 1, i + 24))) skipDepth = depth;
    } else if (c === "}") {
      if (depth === skipDepth) skipDepth = 0;
      depth--;
    } else if (c === "\\") {
      const m = /^\\(?:([a-z]+)(-?\d+)? ?|'([0-9a-f]{2})|([\s\S]))/i.exec(rtf.slice(i, i + 32));
      if (!m) continue;
      i += m[0].length - 1;
      if (skipDepth) continue;
      const [, word, num, hex, symbol] = m;
      if (hex) out += String.fromCharCode(parseInt(hex, 16));
      else if (word === "par" || word === "line" || symbol === "\n" || symbol === "\r") out += "\n";
      else if (word === "tab") out += "\t";
      else if (word === "u" && num) {
        out += String.fromCharCode((Number(num) + 65536) % 65536);
        // Skip the one-character fallback that follows \uN (either \'hh or a plain character).
        if (rtf.startsWith("\\'", i + 1)) i += 4;
        else if (i + 1 < rtf.length && !"\\{}".includes(rtf[i + 1])) i++;
      } else if (symbol && "{}\\".includes(symbol)) out += symbol;
    } else if (!skipDepth && c !== "\r" && c !== "\n") out += c;
  }
  return out;
}

/** CSV to one "header: value · header: value" line per row, so rows read (and count) as words. */
export function flattenCsv(text: string): string {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  if (!head || !body.length) return tidy(text);
  return body.map((r) => head.map((h, i) => `${h.trim() || `Column ${i + 1}`}: ${(r[i] ?? "").trim()}`).join(" · ")).join("\n");
}

/** JSON to "path.to.key: value" lines. */
export function flattenJson(value: unknown, path = ""): string {
  if (value !== null && typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => flattenJson(v, path ? `${path}.${k}` : k))
      .filter(Boolean)
      .join("\n");
  return path ? `${path}: ${String(value)}` : String(value);
}
