import { DEMO_CALLS } from "@/lib/demo/seed-data";
import type { CallWithRelations } from "@/types/db";

// In-memory store used when Supabase is not configured. Seeded with the demo dataset
// on first access and then mutable for the lifetime of the running server process —
// this lets both the 15 seeded demo calls AND manually-added calls support "re-run
// analysis" / "attach transcript" in demo mode, without a real database. When Supabase
// IS configured, all of this is bypassed in favor of real Postgres reads/writes
// (see lib/pipeline/analyze.ts).
let store: CallWithRelations[] | null = null;

function ensureStore(): CallWithRelations[] {
  if (!store) store = [...DEMO_CALLS];
  return store;
}

export function getAllCalls(): CallWithRelations[] {
  return ensureStore();
}

export function addManualCall(call: CallWithRelations) {
  ensureStore().unshift(call);
}

export function getManualCallById(id: string): CallWithRelations | undefined {
  return ensureStore().find((c) => c.id === id);
}

export function updateManualCall(id: string, updater: (call: CallWithRelations) => CallWithRelations) {
  const s = ensureStore();
  const idx = s.findIndex((c) => c.id === id);
  if (idx >= 0) s[idx] = updater(s[idx]);
}
