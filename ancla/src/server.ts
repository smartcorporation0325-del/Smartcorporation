import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { handleInbound, inFlightCount, recoverInbound, runTick, STUCK_AFTER_MS, type AppDeps } from "./app.ts";
import { ClaudeBrain } from "./brain.ts";
import { config } from "./config.ts";
import { privacyHtml } from "./privacy.ts";
import { MemoryStore } from "./store/memory.ts";
import { SupabaseStore } from "./store/supabase.ts";
import { ensureWebhookSubscription, parseWebhook, verifySignature, WhatsAppSender } from "./whatsapp.ts";

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
  let tickRunning = false; // evita que dos revisiones del reloj corran a la vez
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
          handleInbound(deps, msg).catch((err) => log(`mensaje no se pudo registrar: ${(err as Error).message}`));
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
        // Se responde al instante y el trabajo sigue en segundo plano: así ninguna tarea lenta (llamadas a Claude,
        // el cierre del día) puede hacer que cron-job.org marque la llamada como fallida y apague el reloj.
        if (tickRunning) {
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ busy: true }));
          return;
        }
        tickRunning = true;
        res.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify({ accepted: true }));
        runTick(deps)
          .then((sent) => {
            if (sent > 0) log(`tick: ${sent} mensaje(s) proactivo(s)`);
          })
          .catch((err) => log(`tick falló: ${(err as Error).message}`))
          .finally(() => {
            tickRunning = false;
          });
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

  const deps: AppDeps = { store, brain: new ClaudeBrain(undefined, log), sender: new WhatsAppSender(), log };
  const server = createApp(deps).listen(config.port, () => log(`Ancla escuchando en :${config.port}`));

  // Que Meta siga mandando los mensajes de la gente a este servidor.
  ensureWebhookSubscription()
    .then(log)
    .catch((err) => log(`WhatsApp: revisar la conexión de la cuenta falló: ${(err as Error).message}`));

  // Al arrancar (por ejemplo, tras un despliegue), retoma los mensajes que el servidor anterior dejó a medias.
  // Se espera un poco más que el umbral de "a medias" para no pisar al servidor viejo si sigue terminando.
  setTimeout(() => {
    recoverInbound(deps)
      .then((n) => n > 0 && log(`arranque: ${n} mensaje(s) a medias retomado(s)`))
      .catch((err) => log(`arranque: recuperar mensajes falló: ${(err as Error).message}`));
  }, STUCK_AFTER_MS + 15_000).unref();

  // Render avisa con SIGTERM antes de apagar (despliegues, reinicios) y espera unos 30 s:
  // se deja de aceptar conexiones y se terminan los mensajes en curso. Lo que no alcance, se retoma después.
  process.once("SIGTERM", () => {
    log(`apagando: ${inFlightCount()} mensaje(s) en curso`);
    server.close();
    const started = Date.now();
    const wait = setInterval(() => {
      if (inFlightCount() === 0 || Date.now() - started > 25_000) {
        clearInterval(wait);
        log(inFlightCount() === 0 ? "apagado limpio" : `apagado con ${inFlightCount()} mensaje(s) a medias (se retoman al volver)`);
        process.exit(0);
      }
    }, 250);
  });

  if (config.internalCron) {
    setInterval(() => runTick(deps).catch((e) => log(`tick: ${(e as Error).message}`)), 5 * 60_000);
    log("cron interno activado (cada 5 min)");
  }
}
