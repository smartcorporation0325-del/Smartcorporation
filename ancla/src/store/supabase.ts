import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Item, Observation, Reminder, User } from "../types.ts";
import type { InboundMessage } from "../whatsapp.ts";
import type { NewItem, NewReminder, PendingInbound, Store } from "./index.ts";

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
  profile: r.profile ?? "",
  people: r.people ?? [],
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
    profile: "profile",
    people: "people",
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

const reminderFromRow = (r: Row): Reminder => ({
  id: r.id,
  userId: r.user_id,
  remindAt: r.remind_at,
  text: r.text,
  quote: r.quote,
  saidAt: r.said_at,
  status: r.status,
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

  async updateItem(id: string, patch: Partial<Pick<Item, "status" | "startedAt" | "doneAt" | "estimateMinutes">>) {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
    if (patch.doneAt !== undefined) row.done_at = patch.doneAt;
    if (patch.estimateMinutes !== undefined) row.estimate_minutes = patch.estimateMinutes;
    check(await this.db.from("ancla_items").update(row).eq("id", id));
  }

  async listTimedItemsSince(userId: string, sinceIso: string, limit: number) {
    const rows = check(
      await this.db
        .from("ancla_items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "done")
        .gte("done_at", sinceIso)
        .not("started_at", "is", null)
        .gt("estimate_minutes", 0)
        .order("done_at", { ascending: false })
        .limit(limit),
    );
    return (rows ?? []).reverse().map(itemFromRow);
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

  async addReminders(rs: NewReminder[]) {
    if (rs.length === 0) return [];
    const rows = check(
      await this.db
        .from("ancla_reminders")
        .insert(rs.map((r) => ({ user_id: r.userId, remind_at: r.remindAt, text: r.text, quote: r.quote, said_at: r.saidAt })))
        .select(),
    );
    return (rows ?? []).map(reminderFromRow);
  }

  async listPendingReminders(userId: string) {
    const rows = check(
      await this.db.from("ancla_reminders").select("*").eq("user_id", userId).eq("status", "pending").order("remind_at"),
    );
    return (rows ?? []).map(reminderFromRow);
  }

  async setReminderStatus(ids: string[], status: "sent" | "cancelled") {
    if (ids.length === 0) return;
    check(await this.db.from("ancla_reminders").update({ status }).in("id", ids));
  }

  async addObservation(o: Observation) {
    check(
      await this.db
        .from("ancla_observations")
        .insert({ user_id: o.userId, at: o.at, activity: o.activity, state: o.state, note: o.note }),
    );
  }

  async listObservationsSince(userId: string, sinceIso: string, limit: number) {
    const rows = check(
      await this.db
        .from("ancla_observations")
        .select("*")
        .eq("user_id", userId)
        .gte("at", sinceIso)
        .order("at", { ascending: false })
        .limit(limit),
    );
    return (rows ?? [])
      .reverse()
      .map((r: Row): Observation => ({ userId: r.user_id, at: r.at, activity: r.activity, state: r.state, note: r.note }));
  }

  async wipeUserData(userId: string) {
    if (!this.inboundLegacy) {
      const user = check(await this.db.from("ancla_users").select("phone").eq("id", userId).maybeSingle());
      if (user?.phone) {
        check(
          await this.db.from("ancla_inbound_ids").update({ status: "done", phone: null, payload: null }).eq("phone", user.phone),
        );
      }
    }
    for (const table of ["ancla_items", "ancla_messages", "ancla_reminders", "ancla_observations"]) {
      check(await this.db.from(table).delete().eq("user_id", userId));
    }
    check(
      await this.db
        .from("ancla_users")
        .update({ notes: [], voice: "", routines: [], profile: "", people: [], energy: "unknown", focus_item_id: null, checkin_at: null })
        .eq("id", userId),
    );
  }

  /**
   * true si la base todavía no tiene las columnas nuevas de ancla_inbound_ids (falta correr el SQL):
   * entonces solo se evita procesar duplicados, como antes, y no se recuperan mensajes a medias.
   */
  private inboundLegacy = false;

  async claimInboundMessage(msg: InboundMessage) {
    if (!this.inboundLegacy) {
      const res = await this.db
        .from("ancla_inbound_ids")
        .insert({ id: msg.id, status: "pending", phone: msg.from, payload: { msg }, attempts: 1 });
      if (!res.error) return true;
      if (res.error.code === "23505") return false; // unique_violation: ya procesado
      // 42703 / PGRST204: columna inexistente → la base es la versión anterior.
      if (res.error.code !== "42703" && res.error.code !== "PGRST204") throw new Error(`Supabase: ${res.error.message}`);
      this.inboundLegacy = true;
      console.warn(
        "AVISO: falta actualizar la tabla ancla_inbound_ids (corre supabase/schema.sql); los mensajes a medias no se podrán recuperar",
      );
    }
    const res = await this.db.from("ancla_inbound_ids").insert({ id: msg.id });
    if (!res.error) return true;
    if (res.error.code === "23505") return false;
    throw new Error(`Supabase: ${res.error.message}`);
  }

  async updatePendingInbound(p: PendingInbound) {
    if (this.inboundLegacy) return;
    check(
      await this.db
        .from("ancla_inbound_ids")
        .update({ attempts: p.attempts, payload: { msg: p.msg, ...(p.reply && { reply: p.reply }) } })
        .eq("id", p.msg.id)
        .eq("status", "pending"),
    );
  }

  async finishInbound(waMessageId: string, status: "done" | "failed") {
    if (this.inboundLegacy) return;
    // Se borra el contenido y el número: solo queda el id para seguir ignorando reintentos de Meta.
    check(await this.db.from("ancla_inbound_ids").update({ status, phone: null, payload: null }).eq("id", waMessageId));
  }

  async listStuckInbound(beforeIso: string, limit: number) {
    if (this.inboundLegacy) return [];
    const res = await this.db
      .from("ancla_inbound_ids")
      .select("id, attempts, payload, created_at")
      .eq("status", "pending")
      .lt("created_at", beforeIso)
      .order("created_at")
      .limit(limit);
    if (res.error) {
      if (res.error.code === "42703" || res.error.code === "PGRST204") {
        this.inboundLegacy = true;
        return [];
      }
      throw new Error(`Supabase: ${res.error.message}`);
    }
    return (res.data ?? [])
      .filter((r: Row) => r.payload?.msg)
      .map((r: Row): PendingInbound => ({
        msg: r.payload.msg,
        attempts: r.attempts ?? 0,
        receivedAt: r.created_at,
        ...(r.payload.reply && { reply: r.payload.reply }),
      }));
  }
}
