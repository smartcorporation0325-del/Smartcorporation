import { test } from "node:test";
import assert from "node:assert/strict";

// Archivo propio (proceso propio): se fijan las variables antes de importar la configuración.
process.env.ANTHROPIC_FAST_MODEL = "claude-haiku-5-5";
process.env.ANTHROPIC_DEEP_EFFORT = "xhigh";
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { ClaudeBrain } = await import("../src/brain.ts");
const { planFor } = await import("../src/modes.ts");

const OUTPUT = {
  reply: "Listo", new_items: [], started_item_refs: [], completed_item_refs: [], dropped_item_refs: [],
  focus_item_ref: "", energy: "no_change", checkin_in_minutes: 0, new_notes: [], voice: "", new_routines: [],
  reminders: [], cancel_reminder_refs: [], observation: { activity: "", state: "unknown", note: "" },
  people: [], profile: "", quick_replies: [],
  settings: { name: "", timezone: "", morning_time: "", evening_time: "", proactive: "no_change" },
};

const requests: { body: any; beta: string | null }[] = [];
const client = new Anthropic({
  apiKey: "test",
  fetch: (async (_url: string, init: RequestInit) => {
    requests.push({ body: JSON.parse(String(init.body)), beta: new Headers(init.headers).get("anthropic-beta") });
    return new Response(
      JSON.stringify({
        id: "m", type: "message", role: "assistant", model: "x", stop_reason: "end_turn", stop_details: null,
        content: [{ type: "text", text: JSON.stringify(OUTPUT) }],
        usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 1000 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch,
});

const ctx = (mode?: "fast" | "normal" | "deep") => ({
  user: {
    id: "u", phone: "584120000000", name: "", timezone: "America/Caracas", morningTime: "08:30", eveningTime: "21:00",
    proactive: true, energy: "unknown" as const, focusItemId: null, notes: [], voice: "", routines: [], profile: "",
    people: [], lastInboundAt: null, lastMorningDate: null, lastEveningDate: null, checkinAt: null, createdAt: "",
  },
  items: [], history: [], reminders: [], observations: [], doneToday: 0,
  now: new Date("2026-11-23T14:40:00Z"), input: { type: "message" as const, text: "hola" }, mode,
});

test("cada modo manda a Claude el modelo, el esfuerzo y el límite que le corresponden", async () => {
  const logs: string[] = [];
  const brain = new ClaudeBrain(client, (m) => logs.push(m));

  await brain.think(ctx("fast"));
  await brain.think(ctx("normal"));
  await brain.think(ctx("deep"));
  await brain.think(ctx(undefined)); // sin modo = normal

  const [fast, normal, deep, none] = requests;
  // rápido: modelo rápido configurado, poco razonamiento; Haiku no usa el respaldo del servidor
  assert.equal(fast.body.model, "claude-haiku-5-5");
  assert.equal(fast.body.output_config.effort, "low");
  assert.equal(fast.body.max_tokens, 4000);
  assert.equal(fast.body.fallbacks, undefined);
  assert.ok(!(fast.beta ?? "").includes("server-side-fallback"));
  // normal: el modelo principal, con respaldo
  assert.equal(normal.body.model, "claude-opus-5-5");
  assert.equal(normal.body.output_config.effort, "low");
  assert.equal(normal.body.max_tokens, 8000);
  assert.equal(normal.body.fallbacks, "default");
  assert.ok((normal.beta ?? "").includes("server-side-fallback-2026-07-01"));
  // profundo: mismo modelo (no se configuró otro), más razonamiento y más espacio
  assert.equal(deep.body.model, "claude-opus-5-5");
  assert.equal(deep.body.output_config.effort, "xhigh");
  assert.equal(deep.body.max_tokens, 16000);
  assert.equal(deep.body.fallbacks, "default");
  assert.equal(none.body.output_config.effort, "low");
  // todas llevan el esquema de salida
  for (const r of requests) assert.equal(r.body.output_config.format.type, "json_schema");

  // El registro trae solo cifras y nombres, nunca contenido ni teléfonos
  assert.equal(logs.length, 4);
  assert.match(logs[2], /^turno: modo=deep modelo=claude-opus-5-5 esfuerzo=xhigh \d+ms entrada=1200 salida=80 cache=1000 costo=US\$0\.0170$/);
  assert.doesNotMatch(logs.join("\n"), /hola|58412/);
});

test("planFor respeta las variables de entorno y cae al modelo principal si no hay otra", () => {
  assert.equal(planFor("fast").model, "claude-haiku-5-5");
  assert.equal(planFor("deep").model, "claude-opus-5-5");
  assert.equal(planFor("normal").model, "claude-opus-5-5");
});
