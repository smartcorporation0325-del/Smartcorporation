import { config } from "./config.ts";

// Bienvenida, ayuda y privacidad. Son textos fijos a propósito: salen al instante, no gastan IA
// y dicen siempre lo mismo (importante para el consentimiento).

export const WELCOME_BUTTONS = ["Empezar", "¿Qué puedes hacer?"];

export type Command = "help" | "privacy" | "forget" | "forget-all" | null;

const normalize = (t: string) =>
  t
    .trim()
    .toLowerCase()
    .replace(/[¿?¡!.]/g, "")
    .replace(/\s+/g, " ");

/**
 * Comandos que no pasan por el modelo. OJO: "ayuda" a secas NO es un comando, porque alguien en apuro
 * puede escribirlo y merece una respuesta humana, no un manual.
 */
export function matchCommand(text: string): Command {
  const t = normalize(text);
  if (t === "/ayuda" || t === "/help" || t === "qué puedes hacer") return "help";
  if (t === "/privacidad") return "privacy";
  if (t === "/olvidar") return "forget";
  if (t === "/olvidar todo") return "forget-all";
  return null;
}

export function welcomeText(publicUrl = config.publicUrl): string {
  const details = publicUrl ? `Cómo las cuido: ${publicUrl}/privacy` : "Cómo las cuido: escribe /privacidad";
  return [
    "Hola, soy Ancla. Soy como una amiga que te ayuda a empezar las cosas cuando el cerebro no arranca.",
    "Cuéntame lo que traes en la cabeza (escrito, en audio o con una foto) y yo lo ordeno, te doy un primer paso chiquito y te recuerdo lo que me digas.",
    "No soy un servicio médico ni reemplazo a ningún profesional. Guardo lo que me cuentas para ayudarte mejor y puedes borrarlo cuando quieras con /olvidar todo. " +
      `${details}. Al seguir escribiéndome aceptas eso.`,
  ].join("\n\n");
}

export function helpText(audio = Boolean(config.transcribeUrl)): string {
  return [
    "Esto es lo que puedo hacer por ti:",
    [
      "• Vaciar la cabeza: cuéntame todo junto, aunque sea desordenado, y lo ordeno.",
      "• Empezar: te doy un primer paso chiquito para cada cosa.",
      '• Recordarte lo que me digas, por ejemplo "a las 4 llamo al dentista".',
      "• Escribirte yo: buenos días, un check-in y el cierre del día.",
    ].join("\n"),
    `Escríbeme como te salga${audio ? ", mándame audios" : ""} o una foto de lo que te abruma.`,
    "Comandos: /ayuda · /privacidad · /olvidar todo",
  ].join("\n\n");
}

export function privacyText(publicUrl = config.publicUrl): string {
  return [
    "Guardo lo que me cuentas (tus mensajes, pendientes, recordatorios, rutinas y la gente que mencionas) solo para ayudarte mejor. Mis respuestas las genera una IA (Claude, de Anthropic) y los datos viven en servidores de Supabase y Render. No los vendo.",
    ...(publicUrl ? [`Detalles: ${publicUrl}/privacy`] : []),
    "Para borrar todo lo que sé de ti: /olvidar todo",
  ].join("\n\n");
}
