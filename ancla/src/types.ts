// Tipos del dominio de Ancla.

export type ItemKind = "task" | "idea" | "worry" | "appointment" | "note";
export type ItemStatus = "open" | "started" | "done" | "dropped";
export type Energy = "unknown" | "low" | "medium" | "high";

export interface User {
  id: string;
  phone: string; // E.164 sin "+", tal como lo manda WhatsApp (p. ej. "5215512345678")
  name: string;
  timezone: string; // IANA, p. ej. "America/Mexico_City"
  morningTime: string; // "HH:MM" hora local del buenos días
  eveningTime: string; // "HH:MM" hora local del cierre del día
  proactive: boolean; // si false, Ancla solo responde (no inicia conversaciones)
  energy: Energy;
  focusItemId: string | null; // "tu 1 cosa" de hoy
  notes: string[]; // cosas que Ancla aprendió de la persona
  voice: string; // cómo hablarle (dialecto, confianza, modismos, emojis); lo mantiene el modelo
  routines: string[]; // rutinas y hábitos observados
  lastInboundAt: string | null; // ISO; para la ventana de 24 h de WhatsApp
  lastMorningDate: string | null; // "YYYY-MM-DD" local del último buenos días enviado
  lastEveningDate: string | null; // "YYYY-MM-DD" local del último cierre enviado
  checkinAt: string | null; // ISO; próximo check-in programado ("¿empezaste?")
  createdAt: string;
}

export interface Item {
  id: string;
  userId: string;
  kind: ItemKind;
  title: string;
  firstStep: string;
  due: string | null; // "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM"
  estimateMinutes: number | null;
  status: ItemStatus;
  createdAt: string;
  startedAt: string | null;
  doneAt: string | null;
}

export interface ChatMessage {
  userId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

/** Lo que dispara un turno de Ancla: un mensaje de la persona o un evento del sistema. */
export type TurnInput =
  | { type: "message"; text: string; image?: { mediaType: string; base64: string } }
  | { type: "event"; name: "morning" | "evening" | "checkin" };

/** Salida estructurada que devuelve el modelo en cada turno. */
export interface BrainOutput {
  reply: string;
  new_items: {
    kind: ItemKind;
    title: string;
    first_step: string;
    due: string; // "" si no hay
    estimate_minutes: number; // 0 si no se sabe
  }[];
  started_item_refs: string[]; // refs cortas tipo "t3"
  completed_item_refs: string[];
  dropped_item_refs: string[];
  focus_item_ref: string; // "" = sin cambio; "new:0" = el primer new_item
  energy: Energy | "no_change";
  checkin_in_minutes: number; // 0 = no programar
  new_notes: string[];
  voice: string; // "" = sin cambio
  new_routines: string[];
  settings: {
    name: string;
    timezone: string;
    morning_time: string;
    evening_time: string;
    proactive: "no_change" | "on" | "off";
  };
}
