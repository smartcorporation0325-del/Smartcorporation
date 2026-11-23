// Configuración leída de variables de entorno. Ver .env.example.

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(env("PORT", "3000")),

  // Claude
  model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
  effort: env("ANTHROPIC_EFFORT", "low") as "low" | "medium" | "high",
  // Modos de respuesta (ver src/modes.ts). Vacío = usar el modelo principal.
  fastModel: env("ANTHROPIC_FAST_MODEL"),
  deepModel: env("ANTHROPIC_DEEP_MODEL"),
  deepEffort: env("ANTHROPIC_DEEP_EFFORT", "high") as "medium" | "high" | "xhigh" | "max",

  // WhatsApp Cloud API (Meta)
  whatsappToken: env("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappVerifyToken: env("WHATSAPP_VERIFY_TOKEN"),
  whatsappAppSecret: env("WHATSAPP_APP_SECRET"),
  // Id de la cuenta de WhatsApp Business (no es secreto). Si está, al arrancar se revisa que la cuenta
  // siga conectada a la app (si se desconecta, Meta deja de mandar los mensajes al webhook) y se reconecta.
  whatsappBusinessAccountId: env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
  graphApiVersion: env("GRAPH_API_VERSION", "v23.0"),
  // Plantilla aprobada por Meta para escribir fuera de la ventana de 24 h.
  // Debe tener un parámetro {{1}} en el cuerpo. Vacío = no escribir fuera de la ventana.
  whatsappTemplateName: env("WHATSAPP_TEMPLATE_NAME"),
  whatsappTemplateLang: env("WHATSAPP_TEMPLATE_LANG", "es"),

  // Transcripción de audios (cualquier endpoint compatible con /audio/transcriptions)
  transcribeUrl: env("TRANSCRIBE_URL"),
  transcribeApiKey: env("TRANSCRIBE_API_KEY"),
  transcribeModel: env("TRANSCRIBE_MODEL", "whisper-1"),

  // Respuestas en nota de voz (OpenAI por defecto). Sin TTS_API_KEY, Ancla contesta siempre en texto.
  ttsUrl: env("TTS_URL", "https://api.openai.com/v1/audio/speech"),
  ttsApiKey: env("TTS_API_KEY"),
  ttsModel: env("TTS_MODEL", "gpt-4o-mini-tts"),
  ttsVoice: env("TTS_VOICE", "coral"),
  ttsInstructions: env(
    "TTS_INSTRUCTIONS",
    "Habla en español como una amiga cercana: cálida, tranquila y natural, sin sonar a locutora ni a asistente virtual.",
  ),

  // Almacenamiento: si hay Supabase se usa; si no, memoria (solo para desarrollo)
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),

  // Mensajes proactivos
  cronSecret: env("CRON_SECRET"),
  internalCron: env("INTERNAL_CRON", "false") === "true",
  // Dirección pública del servicio (Render la da sola en RENDER_EXTERNAL_URL); se usa en la bienvenida
  publicUrl: env("PUBLIC_URL", env("RENDER_EXTERNAL_URL")).replace(/\/+$/, ""),

  // Política de privacidad pública (/privacy)
  privacyOperator: env("PRIVACY_OPERATOR", "Ancla"),
  privacyContactEmail: env("PRIVACY_CONTACT_EMAIL"),

  defaultTimezone: env("DEFAULT_TIMEZONE", "America/Mexico_City"),
  defaultMorningTime: env("DEFAULT_MORNING_TIME", "08:30"),
  defaultEveningTime: env("DEFAULT_EVENING_TIME", "21:00"),
};
