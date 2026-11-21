import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.ts";
import { countryFromPhone } from "./dialect.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { localParts } from "./time.ts";
import type { BrainOutput, ChatMessage, Item, TurnInput, User } from "./types.ts";

export interface BrainContext {
  user: User;
  items: Item[]; // pendientes activos; su posición define la ref (t1 = items[0])
  history: ChatMessage[];
  input: TurnInput;
  now: Date;
  doneToday: number;
}

/** El "cerebro": decide qué responder y qué cambios hacer. Se puede sustituir en tests. */
export interface Brain {
  think(ctx: BrainContext): Promise<BrainOutput>;
}

export const itemRef = (index: number) => `t${index + 1}`;

const KINDS = ["task", "idea", "worry", "appointment", "note"] as const;
const ENERGIES = ["unknown", "low", "medium", "high"] as const;

/** JSON Schema de la salida estructurada (todos los campos requeridos; vacío = sin cambio). */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "new_items",
    "started_item_refs",
    "completed_item_refs",
    "dropped_item_refs",
    "focus_item_ref",
    "energy",
    "checkin_in_minutes",
    "new_notes",
    "voice",
    "new_routines",
    "settings",
  ],
  properties: {
    reply: { type: "string", description: "Mensaje de WhatsApp para la persona" },
    new_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "title", "first_step", "due", "estimate_minutes"],
        properties: {
          kind: { type: "string", enum: [...KINDS] },
          title: { type: "string" },
          first_step: { type: "string", description: "Acción física de menos de 2 minutos; vacío si no es task" },
          due: { type: "string", description: "YYYY-MM-DD o YYYY-MM-DDTHH:MM; vacío si no hay" },
          estimate_minutes: { type: "integer", description: "0 si no se sabe" },
        },
      },
    },
    started_item_refs: { type: "array", items: { type: "string" } },
    completed_item_refs: { type: "array", items: { type: "string" } },
    dropped_item_refs: { type: "array", items: { type: "string" } },
    focus_item_ref: { type: "string", description: "t3, new:0 o vacío" },
    energy: { type: "string", enum: ["no_change", ...ENERGIES] },
    checkin_in_minutes: { type: "integer", description: "0 = no programar check-in" },
    new_notes: { type: "array", items: { type: "string" } },
    voice: {
      type: "string",
      description: "Descripción completa y actualizada de cómo hablarle a esta persona; vacío si no cambia",
    },
    new_routines: { type: "array", items: { type: "string" } },
    settings: {
      type: "object",
      additionalProperties: false,
      required: ["name", "timezone", "morning_time", "evening_time", "proactive"],
      properties: {
        name: { type: "string" },
        timezone: { type: "string" },
        morning_time: { type: "string" },
        evening_time: { type: "string" },
        proactive: { type: "string", enum: ["no_change", "on", "off"] },
      },
    },
  },
} as const;

const EVENT_TEXT: Record<"morning" | "evening" | "checkin", string> = {
  morning: "EVENTO morning: es la hora del buenos días. Escríbele primero tú.",
  evening: "EVENTO evening: es la hora del cierre del día. Escríbele primero tú.",
  checkin: "EVENTO checkin: toca el check-in que quedó programado. Escríbele primero tú.",
};

/** Contexto dinámico de cada turno (va al final para no romper la caché del system prompt). */
export function buildContext(ctx: BrainContext): string {
  const { user, items, now, doneToday } = ctx;
  const local = localParts(now, user.timezone);
  const lines: string[] = [
    "<contexto>",
    `Ahora: ${local.weekday} ${local.date} ${local.time} (${user.timezone})`,
    `Nombre: ${user.name || "(no lo sabemos todavía)"}`,
    `Energía reportada: ${user.energy}`,
    `Buenos días a las ${user.morningTime}, cierre a las ${user.eveningTime}, mensajes proactivos: ${user.proactive ? "sí" : "no"}`,
    `Completadas hoy: ${doneToday}`,
  ];
  const c = countryFromPhone(user.phone);
  lines.push(
    `Pista por su número de teléfono: ${c ? `${c.country} → ${c.dialect}` : "no se sabe"} (si ella dice de dónde es o escribe con otros modismos, eso manda)`,
    `Cómo hablarle (lo que ya aprendiste): ${user.voice || "(todavía nada: empieza cercana, como amiga, y copia su forma de escribir)"}`,
  );
  if (user.routines.length) lines.push("Sus rutinas:", ...user.routines.map((r) => `- ${r}`));
  if (user.notes.length) lines.push("Lo que sabes de la persona:", ...user.notes.map((n) => `- ${n}`));
  const focusIndex = items.findIndex((i) => i.id === user.focusItemId);
  if (items.length === 0) {
    lines.push("Pendientes: ninguno guardado.");
  } else {
    lines.push("Pendientes:");
    items.forEach((it, idx) => {
      const extra = [
        it.status === "started" ? "EMPEZADA" : "",
        it.due ? `fecha: ${it.due}` : "",
        it.estimateMinutes ? `~${it.estimateMinutes} min` : "",
        it.firstStep ? `primer paso: ${it.firstStep}` : "",
        idx === focusIndex ? "← ES SU 1 COSA DE HOY" : "",
      ].filter(Boolean);
      lines.push(`${itemRef(idx)} [${it.kind}] ${it.title}${extra.length ? ` (${extra.join("; ")})` : ""}`);
    });
  }
  lines.push("</contexto>");
  return lines.join("\n");
}

/** Historial reciente como turnos alternos; la API exige que el primero sea del usuario. */
export function buildMessages(ctx: BrainContext): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = ctx.history.map((m) => ({ role: m.role, content: m.text }));
  if (messages.length > 0 && messages[0].role === "assistant") {
    messages.unshift({ role: "user", content: "(inicio de la conversación)" });
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: buildContext(ctx) }];
  if (ctx.input.type === "event") {
    content.push({ type: "text", text: EVENT_TEXT[ctx.input.name] });
  } else {
    if (ctx.input.image) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: ctx.input.image.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: ctx.input.image.base64,
        },
      });
    }
    content.push({ type: "text", text: `Mensaje de la persona:\n${ctx.input.text || "(mandó solo una imagen)"}` });
  }
  messages.push({ role: "user", content });
  return messages;
}

const FALLBACK_REPLY = "Uy, se me cruzaron los cables un momento. ¿Me lo repites en un mensaje cortito?";

/** Valida y normaliza la salida del modelo para que un campo raro no tumbe el turno. */
export function normalizeOutput(raw: unknown): BrainOutput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const s = (o.settings ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : 0);
  return {
    reply: str(o.reply) || FALLBACK_REPLY,
    new_items: (Array.isArray(o.new_items) ? o.new_items : [])
      .filter((i: any) => i && typeof i.title === "string" && i.title.trim())
      .map((i: any) => ({
        kind: (KINDS as readonly string[]).includes(i.kind) ? i.kind : "task",
        title: i.title.trim(),
        first_step: str(i.first_step),
        due: str(i.due),
        estimate_minutes: int(i.estimate_minutes),
      })),
    started_item_refs: strArr(o.started_item_refs),
    completed_item_refs: strArr(o.completed_item_refs),
    dropped_item_refs: strArr(o.dropped_item_refs),
    focus_item_ref: str(o.focus_item_ref),
    energy: (["no_change", ...ENERGIES] as string[]).includes(o.energy) ? o.energy : "no_change",
    checkin_in_minutes: Math.min(int(o.checkin_in_minutes), 24 * 60),
    new_notes: strArr(o.new_notes).map((n) => n.trim()).filter(Boolean),
    voice: str(o.voice).slice(0, 600),
    new_routines: strArr(o.new_routines).map((n) => n.trim()).filter(Boolean),
    settings: {
      name: str(s.name),
      timezone: str(s.timezone),
      morning_time: str(s.morning_time),
      evening_time: str(s.evening_time),
      proactive: s.proactive === "on" || s.proactive === "off" ? s.proactive : "no_change",
    },
  };
}

export function emptyOutput(reply: string): BrainOutput {
  return normalizeOutput({ reply });
}

/** Implementación con Claude: una llamada por turno con salida estructurada (JSON Schema). */
export class ClaudeBrain implements Brain {
  private client: Anthropic;

  constructor(client = new Anthropic()) {
    this.client = client;
  }

  async think(ctx: BrainContext): Promise<BrainOutput> {
    const response = await this.client.beta.messages.create({
      model: config.model,
      max_tokens: 8000,
      // Si un clasificador de seguridad rechaza la petición, la API reintenta en el modelo
      // de respaldo recomendado por Anthropic dentro de la misma llamada.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: buildMessages(ctx),
      output_config: {
        effort: config.effort,
        format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
      },
    });

    if (response.stop_reason === "refusal") {
      return emptyOutput("Eso no lo puedo ayudar a hacer, pero aquí sigo para lo demás. ¿Qué traes en la cabeza?");
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return normalizeOutput(JSON.parse(text));
    } catch {
      return emptyOutput(FALLBACK_REPLY);
    }
  }
}
