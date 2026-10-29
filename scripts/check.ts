// Self-check for the summarization core and file parsers. Run: npm run check
import assert from "node:assert/strict";
import {
  autoTarget,
  countWords,
  extractive,
  parseRequest,
  planBudget,
  splitSentences,
  trimToWords,
} from "../supabase/functions/_shared/summarize.ts";
import { flattenCsv, flattenJson, stripRtf } from "../src/lib/extract.ts";

// Word counting ignores bullets and dashes.
assert.equal(countWords("• Revenue grew 18% — to $4.2M."), 5);

// Sentence splitting keeps abbreviations and decimals intact.
assert.deepEqual(splitSentences("Costs fell 12.5% in Q3. e.g. this stays. Next point!\n• A bullet"), [
  "Costs fell 12.5% in Q3. e.g. this stays.",
  "Next point!",
  "• A bullet",
]);

// Agent.md auto-decide curve (620 words -> 125 is the Appflow.md example).
assert.equal(autoTarget(100), 35);
assert.equal(autoTarget(620), 125);
assert.equal(autoTarget(1420), 192);
assert.equal(autoTarget(1_000_000), 450);

// Custom budgets get ±5%, auto ±10%, and nothing exceeds 90% of the source.
assert.deepEqual(
  (({ target, min, max }) => ({ target, min, max }))(planBudget(1000, "custom", 120)),
  { target: 120, min: 114, max: 126 },
);
assert.equal(planBudget(620, "ai_auto", null).max, 138);
assert.equal(planBudget(25, "custom", 200).target, 22);
assert.equal(planBudget(20, "ai_auto", null).target, 18);

// Trimming stops at a sentence boundary and keeps bullet lines.
assert.equal(trimToWords("One two three. Four five six. Seven eight nine.", 7), "One two three. Four five six.");
assert.equal(trimToWords("• First point here.\n• Second point here.\n• Third.", 5), "• First point here.");

// Extractive fallback respects the word budget.
const long = Array.from({ length: 40 }, (_, i) => `Sentence ${i} reports revenue growth of ${i}% in region ${i % 4}.`).join(" ");
assert.ok(countWords(extractive(long, 30).summary) <= 30);

// Request validation at the trust boundary.
assert.ok("error" in parseRequest({}));
assert.ok("error" in parseRequest({ content: "word ".repeat(20), lengthMode: "custom", targetWords: 5 }));
const ok = parseRequest({ content: "word ".repeat(20), summaryStyle: "toString", sourceType: "exe" });
assert.ok(!("error" in ok) && ok.summaryStyle === "executive" && ok.sourceType === "paste");

// File parsers.
const rtf = stripRtf("{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}{\\*\\generator Riched20;}\\f0\\pard Caf\\'e9 sales rose 12%.\\par Next \\u8217\\'92s line.}");
assert.ok(rtf.includes("Café sales rose 12%.\nNext ’s line."), rtf);
assert.ok(!rtf.includes("Helvetica") && !rtf.includes("Riched"), rtf);
assert.equal(flattenCsv('region,revenue,note\nAPAC,1.2M,"Strong, ""steady"""\n'), 'region: APAC · revenue: 1.2M · note: Strong, "steady"');
assert.equal(flattenJson({ a: { b: 1 }, list: ["x"] }), "a.b: 1\nlist.0: x");

console.log("✓ all checks passed");
