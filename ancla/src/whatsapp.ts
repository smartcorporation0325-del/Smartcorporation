import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.ts";
import { cleanQuickReplies } from "./quickReplies.ts";

// Cliente mínimo de la WhatsApp Cloud API (Meta). Documentación:
// https://developers.facebook.com/docs/whatsapp/cloud-api

export interface Sender {
  sendText(to: string, text: string): Promise<void>;
  /** Plantilla aprobada con un parámetro {{1}}; necesaria fuera de la ventana de 24 h. */
  sendTemplate(to: string, param: string): Promise<void>;
  /** Mensaje con hasta 3 botones de respuesta rápida (solo dentro de la ventana de 24 h). */
  sendButtons(to: string, body: string, buttons: string[]): Promise<void>;
  /** Nota de voz (audio Ogg/Opus). */
  sendVoice(to: string, audio: Buffer): Promise<void>;
}

export type InboundMessage =
  | { id: string; from: string; profileName: string; type: "text"; text: string }
  | { id: string; from: string; profileName: string; type: "audio"; mediaId: string }
  | { id: string; from: string; profileName: string; type: "image"; mediaId: string; caption: string }
  | { id: string; from: string; profileName: string; type: "unsupported"; kind: string };

const graph = (path: string) => `https://graph.facebook.com/${config.graphApiVersion}/${path}`;

/** Verifica la cabecera X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el App Secret). */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!appSecret) return true; // sin secreto configurado (solo desarrollo)
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Extrae los mensajes entrantes del payload del webhook (ignora estados de entrega, etc.). */
export function parseWebhook(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const names = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? ""]),
      );
      for (const m of value.messages ?? []) {
        const base = { id: String(m.id), from: String(m.from), profileName: names.get(m.from) ?? "" };
        if (m.type === "text") out.push({ ...base, type: "text", text: m.text?.body ?? "" });
        else if (m.type === "audio") out.push({ ...base, type: "audio", mediaId: m.audio?.id });
        else if (m.type === "image")
          out.push({ ...base, type: "image", mediaId: m.image?.id, caption: m.image?.caption ?? "" });
        else if (m.type === "button") out.push({ ...base, type: "text", text: m.button?.text ?? "" });
        else if (m.type === "interactive")
          out.push({
            ...base,
            type: "text",
            text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "",
          });
        else out.push({ ...base, type: "unsupported", kind: String(m.type) });
      }
    }
  }
  return out;
}

export class WhatsAppSender implements Sender {
  private async post(payload: object) {
    const res = await fetch(graph(`${config.whatsappPhoneNumberId}/messages`), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  }

  async sendText(to: string, text: string) {
    await this.post({ to, type: "text", text: { body: text.slice(0, 4096) } });
  }

  async sendVoice(to: string, audio: Buffer) {
    // 1) subir el archivo a WhatsApp; 2) mandarlo como nota de voz
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "audio/ogg");
    form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/ogg" }), "ancla.ogg");
    const up = await fetch(graph(`${config.whatsappPhoneNumberId}/media`), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.whatsappToken}` },
      body: form,
    });
    if (!up.ok) throw new Error(`WhatsApp subir audio ${up.status}`);
    const { id } = (await up.json()) as { id?: string };
    if (!id) throw new Error("WhatsApp no devolvió el id del audio");
    await this.post({ to, type: "audio", audio: { id, voice: true } });
  }

  async sendButtons(to: string, body: string, buttons: string[]) {
    const titles = cleanQuickReplies(buttons);
    // WhatsApp limita el cuerpo con botones a 1024 caracteres: si no cabe, va como texto normal.
    if (titles.length === 0 || body.length > 1024) return this.sendText(to, body);
    try {
      await this.post({
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: { buttons: titles.map((title, i) => ({ type: "reply", reply: { id: `qr${i + 1}`, title } })) },
        },
      });
    } catch {
      await this.sendText(to, body); // si Meta rechaza los botones, que el mensaje no se pierda
    }
  }

  async sendTemplate(to: string, param: string) {
    await this.post({
      to,
      type: "template",
      template: {
        name: config.whatsappTemplateName,
        language: { code: config.whatsappTemplateLang },
        components: [{ type: "body", parameters: [{ type: "text", text: param.slice(0, 1000) }] }],
      },
    });
  }
}

/**
 * Revisa que la cuenta de WhatsApp Business siga conectada (suscrita) a la app y la reconecta.
 * Si esa conexión se pierde, Meta deja de mandar los mensajes de la gente al webhook, aunque el webhook
 * de la app esté bien configurado (la prueba de Meta llega pero los mensajes reales no).
 * Reconectar una cuenta ya conectada no cambia nada. Devuelve un texto para los registros.
 */
export async function ensureWebhookSubscription(fetchFn: typeof fetch = fetch): Promise<string> {
  const waba = config.whatsappBusinessAccountId;
  if (!waba || !config.whatsappToken) return "WhatsApp: sin WHATSAPP_BUSINESS_ACCOUNT_ID, no se revisa la conexión de la cuenta";
  const url = graph(`${waba}/subscribed_apps`);
  const auth = { Authorization: `Bearer ${config.whatsappToken}` };
  const before = await fetchFn(url, { headers: auth });
  if (!before.ok) return `WhatsApp: no se pudo revisar la conexión de la cuenta (${before.status}: ${await before.text()})`;
  const list = ((await before.json()) as { data?: { whatsapp_business_api_data?: { name?: string } }[] }).data ?? [];
  const names = list.map((a) => a.whatsapp_business_api_data?.name ?? "?").join(", ") || "ninguna";
  const res = await fetchFn(url, { method: "POST", headers: auth });
  if (!res.ok) return `WhatsApp: apps conectadas antes: ${names}. No se pudo reconectar (${res.status}: ${await res.text()})`;
  return `WhatsApp: apps conectadas antes: ${names}. Cuenta conectada a la app: OK`;
}

/** Descarga un archivo multimedia (audio/imagen) que la persona mandó. */
export async function downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }> {
  const auth = { Authorization: `Bearer ${config.whatsappToken}` };
  const meta = await fetch(graph(mediaId), { headers: auth });
  if (!meta.ok) throw new Error(`WhatsApp media ${meta.status}: ${await meta.text()}`);
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
  const file = await fetch(url, { headers: auth });
  if (!file.ok) throw new Error(`WhatsApp media download ${file.status}`);
  return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
}

/** Sender de consola para el simulador y los tests. */
export class ConsoleSender implements Sender {
  sent: { to: string; text: string; template: boolean; buttons?: string[]; voice?: boolean }[] = [];
  async sendText(to: string, text: string) {
    this.sent.push({ to, text, template: false });
  }
  async sendTemplate(to: string, param: string) {
    this.sent.push({ to, text: param, template: true });
  }
  async sendVoice(to: string, _audio: Buffer) {
    this.sent.push({ to, text: "(nota de voz)", template: false, voice: true });
  }
  async sendButtons(to: string, body: string, buttons: string[]) {
    const titles = cleanQuickReplies(buttons);
    this.sent.push(titles.length ? { to, text: body, template: false, buttons: titles } : { to, text: body, template: false });
  }
}
