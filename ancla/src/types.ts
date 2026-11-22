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
  profile: string; // quién es: personalidad, contexto de vida, qué la motiva (lo mantiene el modelo)
  people: Person[]; // gente importante en su vida
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
  | { type: "message"; text: string; image?: { mediaType: string; base64: string }; firstContact?: boolean; voiceReply?: boolean }
  | { type: "event"; name: "morning" | "evening" | "checkin" }
  | { type: "event"; name: "reminder"; reminders: Reminder[] };

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
  reminders: { when: string; text: string; quote: string }[]; // when = hora local YYYY-MM-DDTHH:MM
  cancel_reminder_refs: string[]; // refs cortas tipo "r2"
  observation: { activity: string; state: ActivityState; note: string }; // activity "" = nada que anotar
  people: Person[];
  profile: string; // "" = sin cambio
  quick_replies: string[]; // 0 a 3 botones de respuesta rápida para que ella toque en vez de escribir
  settings: {
    name: string;
    timezone: string;
    morning_time: string;
    evening_time: string;
    proactive: "no_change" | "on" | "off";
  };
}

export interface Person {
  name: string;
  relation: string; // "mamá", "jefa", "pareja"...
  note: string; // lo que importa de esa persona
}

export type ActivityState = "focused" | "distracted" | "stuck" | "tired" | "energetic" | "anxious" | "resting" | "unknown";
export const ACTIVITY_STATES: readonly ActivityState[] = [
  "focused", "distracted", "stuck", "tired", "energetic", "anxious", "resting", "unknown",
];

/** Algo que la persona dijo que haría (o pidió que le recordaran), con sus palabras originales. */
export interface Reminder {
  id: string;
  userId: string;
  remindAt: string; // ISO UTC
  text: string; // qué recordarle
  quote: string; // lo que ella dijo, textual
  saidAt: string; // ISO UTC de cuándo lo dijo
  status: "pending" | "sent" | "cancelled";
}

/** Una foto de lo que estaba haciendo y cómo estaba en un momento; de noche se analizan juntas. */
export interface Observation {
  userId: string;
  at: string; // ISO UTC
  activity: string;
  state: ActivityState;
  note: string;
}
