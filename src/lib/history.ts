// Summary history (PRD FR-4): the Supabase `summaries` table when configured, otherwise this browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fromRow, toRow, type SavedSummary, type SummaryResult, type SummaryRow } from "@core";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseEnabled = Boolean(url && anonKey);

const LOCAL_KEY = "summary-studio:history";
const SESSION_KEY = "summary-studio:session";

let memorySession: string | undefined;
function sessionId(): string {
  try {
    const id = localStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return (memorySession ??= crypto.randomUUID());
  }
}

let client: SupabaseClient | undefined;
// Row-level security matches rows to this x-session-id header (see the migration),
// so each browser only ever sees its own history.
const db = () =>
  (client ??= createClient(url!, anonKey!, {
    auth: { persistSession: false },
    global: { headers: { "x-session-id": sessionId() } },
  }));

function readLocal(): SavedSummary[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal(items: SavedSummary[]) {
  for (let n = items.length; ; n = Math.floor(n / 2)) {
    try {
      return localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, n)));
    } catch {
      if (n === 0) return; // storage unavailable
    } // otherwise over quota: keep halving the history until it fits
  }
}

export async function listHistory(): Promise<SavedSummary[]> {
  if (!supabaseEnabled) return readLocal();
  const { data, error } = await db().from("summaries").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data as SummaryRow[]).map(fromRow);
}

export async function saveHistory(result: SummaryResult, sourceContent: string): Promise<SavedSummary> {
  if (!supabaseEnabled) {
    const saved = { ...result, id: crypto.randomUUID(), createdAt: new Date().toISOString(), sourceContent: sourceContent.slice(0, 20_000) };
    writeLocal([saved, ...readLocal()].slice(0, 25));
    return saved;
  }
  const { data, error } = await db().from("summaries").insert(toRow({ ...result, sourceContent }, sessionId())).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data as SummaryRow);
}

export async function renameHistory(id: string, title: string) {
  if (!supabaseEnabled) return writeLocal(readLocal().map((s) => (s.id === id ? { ...s, title } : s)));
  const { error } = await db().from("summaries").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteHistory(id: string) {
  if (!supabaseEnabled) return writeLocal(readLocal().filter((s) => s.id !== id));
  const { error } = await db().from("summaries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
