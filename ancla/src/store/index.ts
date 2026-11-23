import type { ChatMessage, Item, Observation, Reminder, User } from "../types.ts";
import type { InboundMessage } from "../whatsapp.ts";

export type NewItem = Omit<Item, "id" | "createdAt" | "startedAt" | "doneAt" | "status">;
export type NewReminder = Omit<Reminder, "id" | "status">;

/** Respuesta ya generada para un mensaje (se guarda antes de enviarla, por si el envío falla). */
export interface SavedReply {
  reply: string;
  quickReplies: string[];
}

/** Un mensaje de WhatsApp que llegó pero todavía no se contestó del todo. */
export interface PendingInbound {
  msg: InboundMessage;
  /** Cuántas veces se intentó procesar (incluido el intento en curso). */
  attempts: number;
  receivedAt: string; // ISO
  /** Si el cerebro ya respondió pero el envío no se completó: solo falta entregar esto. */
  reply?: SavedReply;
}

/** Persistencia. Hay dos implementaciones: memoria (dev/tests) y Supabase (producción). */
export interface Store {
  getUserByPhone(phone: string): Promise<User | null>;
  createUser(phone: string, defaults: Pick<User, "name" | "timezone" | "morningTime" | "eveningTime">): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<User, "id" | "phone" | "createdAt">>): Promise<User>;
  listUsers(): Promise<User[]>;

  listActiveItems(userId: string): Promise<Item[]>; // open + started
  addItems(items: NewItem[]): Promise<Item[]>;
  updateItem(id: string, patch: Partial<Pick<Item, "status" | "startedAt" | "doneAt" | "estimateMinutes">>): Promise<void>;
  countDoneSince(userId: string, sinceIso: string): Promise<number>;
  /** Tareas terminadas desde esa fecha que tienen inicio y cálculo de minutos (para el estimador de tiempos). */
  listTimedItemsSince(userId: string, sinceIso: string, limit: number): Promise<Item[]>;

  addMessage(msg: Omit<ChatMessage, "createdAt">): Promise<void>;
  recentMessages(userId: string, limit: number): Promise<ChatMessage[]>; // orden cronológico

  addReminders(reminders: NewReminder[]): Promise<Reminder[]>;
  listPendingReminders(userId: string): Promise<Reminder[]>; // orden por fecha
  setReminderStatus(ids: string[], status: "sent" | "cancelled"): Promise<void>;

  addObservation(o: Observation): Promise<void>;
  listObservationsSince(userId: string, sinceIso: string, limit: number): Promise<Observation[]>; // cronológico

  /** Borra todo lo que Ancla sabe de la persona (conserva solo su número). */
  wipeUserData(userId: string): Promise<void>;

  /**
   * Devuelve true la primera vez que ve este mensaje (WhatsApp reintenta webhooks) y lo deja guardado
   * como pendiente (intento 1) hasta que se marque terminado: así sobrevive a un reinicio del servidor.
   */
  claimInboundMessage(msg: InboundMessage): Promise<boolean>;
  /** Actualiza un pendiente: intentos y, si ya hay, la respuesta generada. */
  updatePendingInbound(p: PendingInbound): Promise<void>;
  /** Cierra un mensaje y borra su contenido guardado. */
  finishInbound(waMessageId: string, status: "done" | "failed"): Promise<void>;
  /** Pendientes recibidos antes de esa fecha (los que se quedaron a medias), del más viejo al más nuevo. */
  listStuckInbound(beforeIso: string, limit: number): Promise<PendingInbound[]>;
}
