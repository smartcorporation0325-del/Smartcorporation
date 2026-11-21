import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.ts";

// Cliente mínimo de la WhatsApp Cloud API (Meta). Documentación:
// https://developers.facebook.com/docs/whatsapp/cloud-api

export interface Sender {
  sendText(to: string, text: string): Promise<void>;
  /** Plantilla aprobada con un parámetro {{1}}; necesaria fuera de la ventana de 24 h. */
  sendTemplate(to: string, param: string): Promise<void>;
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
  sent: { to: string; text: string; template: boolean }[] = [];
  async sendText(to: string, text: string) {
    this.sent.push({ to, text, template: false });
  }
  async sendTemplate(to: string, param: string) {
    this.sent.push({ to, text: param, template: true });
  }
}
