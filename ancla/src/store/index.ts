import type { ChatMessage, Item, Observation, Reminder, User } from "../types.ts";

export type NewItem = Omit<Item, "id" | "createdAt" | "startedAt" | "doneAt" | "status">;
export type NewReminder = Omit<Reminder, "id" | "status">;

/** Persistencia. Hay dos implementaciones: memoria (dev/tests) y Supabase (producción). */
export interface Store {
  getUserByPhone(phone: string): Promise<User | null>;
  createUser(phone: string, defaults: Pick<User, "name" | "timezone" | "morningTime" | "eveningTime">): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<User, "id" | "phone" | "createdAt">>): Promise<User>;
  listUsers(): Promise<User[]>;

  listActiveItems(userId: string): Promise<Item[]>; // open + started
  addItems(items: NewItem[]): Promise<Item[]>;
  updateItem(id: string, patch: Partial<Pick<Item, "status" | "startedAt" | "doneAt">>): Promise<void>;
  countDoneSince(userId: string, sinceIso: string): Promise<number>;

  addMessage(msg: Omit<ChatMessage, "createdAt">): Promise<void>;
  recentMessages(userId: string, limit: number): Promise<ChatMessage[]>; // orden cronológico

  addReminders(reminders: NewReminder[]): Promise<Reminder[]>;
  listPendingReminders(userId: string): Promise<Reminder[]>; // orden por fecha
  setReminderStatus(ids: string[], status: "sent" | "cancelled"): Promise<void>;

  addObservation(o: Observation): Promise<void>;
  listObservationsSince(userId: string, sinceIso: string, limit: number): Promise<Observation[]>; // cronológico

  /** Borra todo lo que Ancla sabe de la persona (conserva solo su número). */
  wipeUserData(userId: string): Promise<void>;

  /** Devuelve true la primera vez que ve este id (WhatsApp reintenta webhooks). */
  claimInboundMessage(waMessageId: string): Promise<boolean>;
}
