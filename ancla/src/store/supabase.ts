import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Item, User } from "../types.ts";
import type { NewItem, Store } from "./index.ts";

// Mapeo entre columnas snake_case de Postgres (supabase/schema.sql) y los tipos camelCase.

type Row = Record<string, any>;

const userFromRow = (r: Row): User => ({
  id: r.id,
  phone: r.phone,
  name: r.name,
  timezone: r.timezone,
  morningTime: r.morning_time,
  eveningTime: r.evening_time,
  proactive: r.proactive,
  energy: r.energy,
  focusItemId: r.focus_item_id,
  notes: r.notes ?? [],
  voice: r.voice ?? "",
  routines: r.routines ?? [],
  lastInboundAt: r.last_inbound_at,
  lastMorningDate: r.last_morning_date,
  lastEveningDate: r.last_evening_date,
  checkinAt: r.checkin_at,
  createdAt: r.created_at,
});

const userToRow = (u: Partial<User>): Row => {
  const map: Record<string, string> = {
    name: "name",
    timezone: "timezone",
    morningTime: "morning_time",
    eveningTime: "evening_time",
    proactive: "proactive",
    energy: "energy",
    focusItemId: "focus_item_id",
    notes: "notes",
    voice: "voice",
    routines: "routines",
    lastInboundAt: "last_inbound_at",
    lastMorningDate: "last_morning_date",
    lastEveningDate: "last_evening_date",
    checkinAt: "checkin_at",
  };
  const row: Row = {};
  for (const [k, v] of Object.entries(u)) if (map[k]) row[map[k]] = v;
  return row;
};

const itemFromRow = (r: Row): Item => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  title: r.title,
  firstStep: r.first_step,
  due: r.due,
  estimateMinutes: r.estimate_minutes,
  status: r.status,
  createdAt: r.created_at,
  startedAt: r.started_at,
  doneAt: r.done_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async getUserByPhone(phone: string) {
    const row = check(await this.db.from("ancla_users").select("*").eq("phone", phone).maybeSingle());
    return row ? userFromRow(row) : null;
  }

  async createUser(phone: string, d: Pick<User, "name" | "timezone" | "morningTime" | "eveningTime">) {
    const row = check(
      await this.db
        .from("ancla_users")
        .insert({ phone, name: d.name, timezone: d.timezone, morning_time: d.morningTime, evening_time: d.eveningTime })
        .select()
        .single(),
    );
    return userFromRow(row);
  }

  async updateUser(id: string, patch: Partial<User>) {
    const row = check(await this.db.from("ancla_users").update(userToRow(patch)).eq("id", id).select().single());
    return userFromRow(row);
  }

  async listUsers() {
    return (check(await this.db.from("ancla_users").select("*")) ?? []).map(userFromRow);
  }

  async listActiveItems(userId: string) {
    const rows = check(
      await this.db
        .from("ancla_items")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["open", "started"])
        .order("created_at"),
    );
    return (rows ?? []).map(itemFromRow);
  }

  async addItems(items: NewItem[]) {
    if (items.length === 0) return [];
    const rows = check(
      await this.db
        .from("ancla_items")
        .insert(
          items.map((i) => ({
            user_id: i.userId,
            kind: i.kind,
            title: i.title,
            first_step: i.firstStep,
            due: i.due,
            estimate_minutes: i.estimateMinutes,
          })),
        )
        .select(),
    );
    return (rows ?? []).map(itemFromRow);
  }

  async updateItem(id: string, patch: Partial<Pick<Item, "status" | "startedAt" | "doneAt">>) {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
    if (patch.doneAt !== undefined) row.done_at = patch.doneAt;
    check(await this.db.from("ancla_items").update(row).eq("id", id));
  }

  async countDoneSince(userId: string, sinceIso: string) {
    const res = await this.db
      .from("ancla_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("done_at", sinceIso);
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.count ?? 0;
  }

  async addMessage(msg: Omit<ChatMessage, "createdAt">) {
    check(await this.db.from("ancla_messages").insert({ user_id: msg.userId, role: msg.role, text: msg.text }));
  }

  async recentMessages(userId: string, limit: number) {
    const rows = check(
      await this.db
        .from("ancla_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return (rows ?? [])
      .reverse()
      .map((r: Row): ChatMessage => ({ userId: r.user_id, role: r.role, text: r.text, createdAt: r.created_at }));
  }

  async claimInboundMessage(waMessageId: string) {
    const res = await this.db.from("ancla_inbound_ids").insert({ id: waMessageId });
    if (!res.error) return true;
    if (res.error.code === "23505") return false; // unique_violation: ya procesado
    throw new Error(`Supabase: ${res.error.message}`);
  }
}
