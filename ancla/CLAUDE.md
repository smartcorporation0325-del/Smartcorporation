# Ancla: guía para trabajar en este proyecto

Ancla es un asistente por WhatsApp para personas con TDA/TDAH. Contexto y visión: `../docs/ideas/muse-tda-braindump.md`. Estado y siguientes pasos: `ROADMAP.md`. Cómo se instala y se conecta: `README.md`.

## Qué es, técnicamente
Un servidor Node 22 + TypeScript (sin paso de build: `node --experimental-strip-types`) que:
1. recibe los mensajes de WhatsApp por webhook (`src/server.ts`, `src/whatsapp.ts`),
2. arma el contexto de la persona (memoria en Postgres/Supabase) y hace **una llamada a Claude por turno** con salida JSON estructurada (`src/brain.ts`): la respuesta más las acciones (pendientes, recordatorios, notas, observaciones, botones),
3. aplica esas acciones (`src/handler.ts`) y responde,
4. y un reloj externo (cron-job.org, cada 10 min → `POST /cron/tick`) le permite escribir primero (`src/scheduler.ts`, `src/app.ts`). `/cron/tick` responde al instante (`202 {"accepted":true}`) y trabaja en segundo plano; si ya hay una revisión corriendo responde `{"busy":true}`. Un reloj que recibe respuestas lentas o raras se apaga solo tras muchos fallos.

No es un agente autónomo: no tiene herramientas libres (no navega, no manda correos). Es un asistente conversacional con memoria y mensajes proactivos.

## Comandos
- `npm test` y `npm run typecheck`: deben pasar siempre (no necesitan llaves).
- `npm run chat`: simulador en la terminal (necesita `ANTHROPIC_API_KEY`; la memoria se borra al salir).
- `npm start`: servidor.

## Mapa del código
`prompt.ts` (personalidad y reglas, lo más delicado) · `brain.ts` (llamada a Claude, esquema de salida, contexto) · `handler.ts` (aplica cambios) · `scheduler.ts` (qué mensaje toca a cada hora) · `app.ts` (entrada de mensajes y tick) · `store/` (memoria y Supabase) · `whatsapp.ts` (Cloud API de Meta) · `dialect.ts` (país y zona horaria por prefijo) · `privacy.ts` (página `/privacy`) · `onboarding.ts` (bienvenida, ayuda y comandos fijos) · `modes.ts` (modo rápido/normal/profundo según el mensaje) · `tts.ts` (respuestas en nota de voz; OpenAI o ElevenLabs) · `estimates.ts` (estimador real de tiempos) · `pricing.ts` (costo de cada llamada; se guarda en `ancla_usage`) · `supabase/schema.sql`.

## Reglas del proyecto
- **Nunca** subir llaves ni tokens. Las variables reales viven en Render (ver `.env.example`).
- **Privacidad:** son datos íntimos. No registrar el contenido de los mensajes ni números de teléfono en logs. Mantener `/olvidar todo` funcionando y actualizar `src/privacy.ts` si cambia qué se guarda.
- **Tono (`src/prompt.ts`):** amiga cercana, mensajes cortos, cero culpa, sin jerga forzada, sin abreviaciones tipo "pa'l", botones sin género. No debilitar el protocolo de crisis ni los límites (no es servicio médico).
- **Si cambias la salida del modelo:** actualizar a la vez `OUTPUT_SCHEMA` y `normalizeOutput` (brain.ts), `types.ts`, el prompt y las pruebas.
- **Si cambias datos guardados:** actualizar `supabase/schema.sql` **con sentencias `alter table ... if not exists`**, porque la base real ya existe (se creó pegando el SQL a mano en Supabase) y nadie corre migraciones automáticas.
- Las pruebas usan un cerebro falso (`FakeBrain`); las que dependen de variables de entorno van en archivos propios.
- Modelo por defecto `claude-opus-5-5` (variable `ANTHROPIC_MODEL`), con `fallbacks: "default"`.

## Mensajes que no se pierden
Cada mensaje entrante se guarda como pendiente en `ancla_inbound_ids` (con su contenido) antes de procesarlo, y se cierra (borrando contenido y número) al contestar. La respuesta del cerebro se guarda antes de enviarla, para no repetir acciones si solo falla el envío. Lo que queda a medias más de 3 min lo retoma `recoverInbound` (en cada tick y al arrancar), con la hora original del mensaje; tras 3 intentos o 12 h se le pide a la persona que lo repita. Con `SIGTERM` el servidor espera hasta 25 s a que terminen los mensajes en curso. Si la base no tiene aún las columnas nuevas, funciona como antes (solo evita duplicados).

Al arrancar, `ensureWebhookSubscription` (whatsapp.ts) reconecta la cuenta de WhatsApp Business a la app (`POST /{WABA}/subscribed_apps`) si existe `WHATSAPP_BUSINESS_ACCOUNT_ID`. El 23 de noviembre de 2026 Meta dejó de entregar los mensajes reales (desde la noche anterior) aunque el webhook estaba bien y el botón **Test** sí llegaba; la app figuraba suscrita, pero justo después de volver a suscribirla los mensajes volvieron a llegar.

## Límites conocidos
- La cola que ordena los mensajes de cada persona vive en memoria: **una sola instancia** del servidor.
- WhatsApp solo deja escribir primero dentro de 24 h del último mensaje de la persona; fuera de eso hace falta plantilla aprobada. Los botones solo funcionan dentro de esa ventana.
- El número de WhatsApp es el de prueba de Meta (máximo 5 destinatarios) y el token es de un usuario del sistema.

## Despliegue
Render despliega automáticamente la rama `claude/muse-tda-braindump-8un9c3` (carpeta `ancla`). No borrar ni renombrar esa rama sin cambiarla antes en Render. No crear pull requests salvo que se pida.

El repositorio también está conectado a **Vercel** (el CRM de la raíz). Sin las variables de Supabase del CRM, su compilación falla en `/login` (pasa igual antes de Ancla). `vercel.json` hace que Vercel se salte los despliegues cuando un commit solo toca `ancla/` o `docs/`, para no recibir correos de "deployment failed" por cada cambio de Ancla.

## Cómo colaborar con quien lo lleva
No es una persona técnica en infraestructura: dar instrucciones **precisas, paso a paso, con los nombres exactos de los botones**, y pedir captura cuando algo pueda variar. Confirmar antes de acciones irreversibles o públicas. Hablar en español.
