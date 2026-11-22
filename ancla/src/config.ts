// Configuración leída de variables de entorno. Ver .env.example.

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(env("PORT", "3000")),

  // Claude
  model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
  effort: env("ANTHROPIC_EFFORT", "low") as "low" | "medium" | "high",

  // WhatsApp Cloud API (Meta)
  whatsappToken: env("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappVerifyToken: env("WHATSAPP_VERIFY_TOKEN"),
  whatsappAppSecret: env("WHATSAPP_APP_SECRET"),
  graphApiVersion: env("GRAPH_API_VERSION", "v23.0"),
  // Plantilla aprobada por Meta para escribir fuera de la ventana de 24 h.
  // Debe tener un parámetro {{1}} en el cuerpo. Vacío = no escribir fuera de la ventana.
  whatsappTemplateName: env("WHATSAPP_TEMPLATE_NAME"),
  whatsappTemplateLang: env("WHATSAPP_TEMPLATE_LANG", "es"),

  // Transcripción de audios (cualquier endpoint compatible con /audio/transcriptions)
  transcribeUrl: env("TRANSCRIBE_URL"),
  transcribeApiKey: env("TRANSCRIBE_API_KEY"),
  transcribeModel: env("TRANSCRIBE_MODEL", "whisper-1"),

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
