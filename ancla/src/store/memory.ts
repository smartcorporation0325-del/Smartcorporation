import { randomUUID } from "node:crypto";
import type { ChatMessage, Item, Observation, Reminder, User } from "../types.ts";
import type { NewItem, NewReminder, Store } from "./index.ts";

/** Store en memoria: se pierde al reiniciar. Solo para desarrollo y tests. */
export class MemoryStore implements Store {
  users = new Map<string, User>();
  items = new Map<string, Item>();
  messages: ChatMessage[] = [];
  seen = new Set<string>();
  reminders = new Map<string, Reminder>();
  observations: Observation[] = [];

  async getUserByPhone(phone: string) {
    for (const u of this.users.values()) if (u.phone === phone) return { ...u };
    return null;
  }

  async createUser(phone: string, d: Pick<User, "name" | "timezone" | "morningTime" | "eveningTime">) {
    const user: User = {
      id: randomUUID(),
      phone,
      ...d,
      proactive: true,
      energy: "unknown",
      focusItemId: null,
      notes: [],
      voice: "",
      routines: [],
      profile: "",
      people: [],
      lastInboundAt: null,
      lastMorningDate: null,
      lastEveningDate: null,
      checkinAt: null,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  async updateUser(id: string, patch: Partial<User>) {
    const u = this.users.get(id);
    if (!u) throw new Error(`usuario no existe: ${id}`);
    Object.assign(u, patch);
    return { ...u };
  }

  async listUsers() {
    return [...this.users.values()].map((u) => ({ ...u }));
  }

  async listActiveItems(userId: string) {
    return [...this.items.values()]
      .filter((i) => i.userId === userId && (i.status === "open" || i.status === "started"))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((i) => ({ ...i }));
  }

  async addItems(newItems: NewItem[]) {
    const now = new Date().toISOString();
    return newItems.map((n) => {
      const item: Item = { ...n, id: randomUUID(), status: "open", createdAt: now, startedAt: null, doneAt: null };
      this.items.set(item.id, item);
      return { ...item };
    });
  }

  async updateItem(id: string, patch: Partial<Item>) {
    const i = this.items.get(id);
    if (i) Object.assign(i, patch);
  }

  async countDoneSince(userId: string, sinceIso: string) {
    return [...this.items.values()].filter(
      (i) => i.userId === userId && i.status === "done" && i.doneAt !== null && i.doneAt >= sinceIso,
    ).length;
  }

  async addMessage(msg: Omit<ChatMessage, "createdAt">) {
    this.messages.push({ ...msg, createdAt: new Date().toISOString() });
  }

  async recentMessages(userId: string, limit: number) {
    return this.messages.filter((m) => m.userId === userId).slice(-limit);
  }

  async addReminders(rs: NewReminder[]) {
    return rs.map((r) => {
      const x: Reminder = { ...r, id: randomUUID(), status: "pending" };
      this.reminders.set(x.id, x);
      return { ...x };
    });
  }

  async listPendingReminders(userId: string) {
    return [...this.reminders.values()]
      .filter((r) => r.userId === userId && r.status === "pending")
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
      .map((r) => ({ ...r }));
  }

  async setReminderStatus(ids: string[], status: "sent" | "cancelled") {
    for (const id of ids) {
      const r = this.reminders.get(id);
      if (r) r.status = status;
    }
  }

  async addObservation(o: Observation) {
    this.observations.push({ ...o });
  }

  async listObservationsSince(userId: string, sinceIso: string, limit: number) {
    return this.observations
      .filter((o) => o.userId === userId && o.at >= sinceIso)
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-limit)
      .map((o) => ({ ...o }));
  }

  async wipeUserData(userId: string) {
    for (const [id, i] of this.items) if (i.userId === userId) this.items.delete(id);
    for (const [id, r] of this.reminders) if (r.userId === userId) this.reminders.delete(id);
    this.messages = this.messages.filter((m) => m.userId !== userId);
    this.observations = this.observations.filter((o) => o.userId !== userId);
    const u = this.users.get(userId);
    if (u) {
      Object.assign(u, { notes: [], voice: "", routines: [], profile: "", people: [], energy: "unknown", focusItemId: null, checkinAt: null });
    }
  }

  async claimInboundMessage(id: string) {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }
}
