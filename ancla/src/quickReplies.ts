// Botones de respuesta rápida de WhatsApp: hasta 3, títulos de máximo 20 caracteres, sin repetir.

export const MAX_QUICK_REPLIES = 3;
export const MAX_QUICK_REPLY_CHARS = 20;

export function cleanQuickReplies(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const title = [...item.trim()].slice(0, MAX_QUICK_REPLY_CHARS).join("").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length === MAX_QUICK_REPLIES) break;
  }
  return out;
}
