import type { ChatMessage, Item, User } from "../types.ts";

export type NewItem = Omit<Item, "id" | "createdAt" | "startedAt" | "doneAt" | "status">;

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

  /** Devuelve true la primera vez que ve este id (WhatsApp reintenta webhooks). */
  claimInboundMessage(waMessageId: string): Promise<boolean>;
}
