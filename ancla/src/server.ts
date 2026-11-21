import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { handleInbound, runTick, type AppDeps } from "./app.ts";
import { ClaudeBrain } from "./brain.ts";
import { config } from "./config.ts";
import { privacyHtml } from "./privacy.ts";
import { MemoryStore } from "./store/memory.ts";
import { SupabaseStore } from "./store/supabase.ts";
import { parseWebhook, verifySignature, WhatsAppSender } from "./whatsapp.ts";

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp(deps: AppDeps) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      // Verificación del webhook (Meta llama una vez al configurarlo)
      if (req.method === "GET" && url.pathname === "/webhook") {
        const ok =
          url.searchParams.get("hub.mode") === "subscribe" &&
          config.whatsappVerifyToken !== "" &&
          url.searchParams.get("hub.verify_token") === config.whatsappVerifyToken;
        res.writeHead(ok ? 200 : 403).end(ok ? (url.searchParams.get("hub.challenge") ?? "") : "forbidden");
        return;
      }

      // Mensajes entrantes
      if (req.method === "POST" && url.pathname === "/webhook") {
        const raw = await readBody(req);
        if (!verifySignature(raw, req.headers["x-hub-signature-256"] as string | undefined, config.whatsappAppSecret)) {
          log("webhook RECHAZADO: la firma no coincide (revisa que WHATSAPP_APP_SECRET sea la clave secreta de la app)");
          res.writeHead(401).end("bad signature");
          return;
        }
        res.writeHead(200).end("ok"); // responder rápido; Meta reintenta si tardamos
        const incoming = parseWebhook(JSON.parse(raw.toString("utf8")));
        // Solo tipos y cantidad: nunca el contenido ni el número de la persona.
        log(
          incoming.length
            ? `webhook recibido: ${incoming.length} mensaje(s) [${incoming.map((m) => m.type).join(", ")}]`
            : "webhook recibido: sin mensajes (estado de entrega u otro evento)",
        );
        for (const msg of incoming) {
          handleInbound(deps, msg).catch((err) => log(`mensaje ${msg.id}: ${(err as Error).message}`));
        }
        return;
      }

      // Disparador de mensajes proactivos (llamarlo desde un cron externo cada ~10 min)
      if (req.method === "POST" && url.pathname === "/cron/tick") {
        const auth = req.headers.authorization ?? "";
        if (!config.cronSecret || !safeEqual(auth, `Bearer ${config.cronSecret}`)) {
          res.writeHead(401).end("unauthorized");
          return;
        }
        const sent = await runTick(deps);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ sent }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/privacy") {
        res
          .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          .end(privacyHtml(config.privacyOperator, config.privacyContactEmail));
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200).end("ok");
        return;
      }
      res.writeHead(404).end("not found");
    } catch (err) {
      log(`error ${req.method} ${url.pathname}: ${(err as Error).message}`);
      if (!res.headersSent) res.writeHead(500).end("error");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store =
    config.supabaseUrl && config.supabaseServiceRoleKey
      ? new SupabaseStore(config.supabaseUrl, config.supabaseServiceRoleKey)
      : new MemoryStore();
  if (store instanceof MemoryStore) log("AVISO: sin Supabase; los datos viven en memoria y se pierden al reiniciar");

  const deps: AppDeps = { store, brain: new ClaudeBrain(), sender: new WhatsAppSender(), log };
  createApp(deps).listen(config.port, () => log(`Ancla escuchando en :${config.port}`));

  if (config.internalCron) {
    setInterval(() => runTick(deps).catch((e) => log(`tick: ${(e as Error).message}`)), 5 * 60_000);
    log("cron interno activado (cada 5 min)");
  }
}
