# Ancla: tu compañero de TDA por WhatsApp (MVP)

Primera versión del asistente descrito en [`docs/ideas/muse-tda-braindump.md`](../docs/ideas/muse-tda-braindump.md).
La persona le escribe (o le manda audios y fotos) por WhatsApp, y Ancla:

- **Vacía la cabeza:** convierte lo que le cuentas en pendientes, citas, ideas y preocupaciones.
- **Da el primer paso ridículamente pequeño** de cada tarea.
- **Ayuda cuando estás atascado/a:** pregunta por qué (aburrido, abrumador, no sé por dónde o miedo) y responde distinto.
- **Escribe primero:** "tu 1 cosa de hoy" por la mañana, check-ins de *body doubling* ("¿empezaste?") y un cierre del día sin culpa.
- **Te va conociendo:** guarda notas sobre ti, tu energía y tus horarios.

## Cómo se adapta y aprende de cada persona

**Tono:** el prefijo del teléfono da una pista inicial de país, zona horaria y modismos (`src/dialect.ts`): un número +58 arranca en venezolano y con hora de Caracas. Después Ancla guarda una descripción de *cómo hablarle* (confianza, modismos que usa la persona, emojis, largo) y la corrige sola. Si la persona dice de dónde es, eso manda sobre el teléfono.

**Memoria que va armando mientras la usas:**
| Qué | Cómo se usa |
|---|---|
| **Recordatorios con sus palabras** | Si dices "después del almuerzo llamo al dentista", guarda la hora y tu frase textual. A la hora te escribe: *"esta mañana me dijiste que ibas a llamar al dentista y se te está pasando"*. Si lo haces, lo cancela. |
| **Lo que dijiste hoy, con hora** | Ve tus mensajes de hoy con la hora, así puede decirte "me dijiste X a las 8:42". |
| **Gente de tu vida** | Guarda nombre, relación y una nota por cada persona que menciones (jefa, mamá, pareja…) y la usa por su nombre. |
| **Qué haces y cómo estás** | En cada mensaje anota qué estás haciendo y tu estado (enfocada, distraída, atascada, cansada…) con la hora. |
| **Patrones** | Cada noche, antes del cierre del día, analiza las observaciones de los últimos 14 días y actualiza tus **rutinas** y tu **perfil** ("a media tarde se distrae con redes", "rinde mejor de noche"). Necesita al menos 3 observaciones. |
| **Perfil y voz** | Resumen de quién eres, qué te motiva y qué te bloquea; y cómo hablarte. |

Todo esto lo usa para proponerte cosas a la hora en que rindes mejor y adelantarse a tus momentos de distracción.

**Privacidad:** es información íntima. Si preguntas "¿qué sabes de mí?", te lo cuenta. Escribir `/olvidar` pide confirmación y `/olvidar todo` borra rutinas, perfil, personas, notas, recordatorios, pendientes, observaciones e historial. Los datos solo viven en tu base de Supabase y se mandan a la API de Claude para generar cada respuesta.

**No es entrenar un modelo:** son notas que se guardan y se le pasan a Claude en cada mensaje. **Para que se conserven entre sesiones hace falta Supabase** (en el simulador se borran al salir). Si ya habías creado las tablas, vuelve a correr `supabase/schema.sql` completo.

## Botones de respuesta rápida
Cuando tiene sentido (una propuesta, un check-in, un recordatorio), Ancla ofrece hasta 3 botones ("Ya empecé", "10 min más", "Me atasqué") para tocar en vez de escribir. Al tocarlos le llegan como si hubieras escrito esas palabras. Solo funcionan dentro de las 24 h de la última vez que escribiste; fuera de eso se usa la plantilla. Si Meta rechaza los botones, el mensaje sale como texto normal. En el simulador (`npm run chat`) se ven como etiquetas resaltadas.

## Respuestas en nota de voz
Cuando le mandas una **nota de voz**, Ancla te contesta con una **nota de voz** (si hay servicio de voz configurado); cuando escribes, contesta en texto. Los botones de respuesta rápida van en un mensaje de texto aparte ("Toca una opción si te sirve:"), porque WhatsApp no deja pegarlos a un audio. Se quedan en texto las respuestas de más de 600 caracteres y los planes del modo "Piénsalo bien". Si la voz falla por cualquier motivo, te llega el texto: nunca se queda sin responder.

Cómo se activa: en Render agrega `TTS_API_KEY` con una llave de OpenAI. Opcionales: `TTS_VOICE` (por defecto `coral`), `TTS_MODEL` (`gpt-4o-mini-tts`) y `TTS_INSTRUCTIONS` (cómo debe sonar; el acento del país se agrega solo según el prefijo del teléfono). WhatsApp solo muestra una nota de voz si el archivo es Ogg/Opus: se le pide ese formato al servicio y se comprueba la cabecera del archivo antes de enviarlo.

## Modos de respuesta (rápido, normal y "Piénsalo bien")
Inspirado en el "Instantáneo" y el "Pensar" de Muse. El modo se elige solo, con reglas simples (sin otra llamada a la IA, así que no suma costo ni demora):
- **Rápido:** acuses y botones simples ("gracias", "ok", "Ya empecé", "10 min más"). Respuesta de 1 o 2 líneas.
- **Normal:** la conversación de siempre. Los mensajes que Ancla manda por su cuenta (buenos días, check-ins, recordatorios) van siempre en normal.
- **Profundo:** cuando tocas el botón **"Piénsalo bien"**, pides planear algo ("ayúdame a planear mi semana") o mandas un desahogo larguísimo (900 caracteres o más). Usa más razonamiento, avisa antes ("Dame un momentito, esto lo quiero pensar bien.") y responde con un plan corto de máximo 5 pasos.

Por defecto **los tres modos usan el mismo modelo**, así que Ancla suena igual que antes. Para probar un modelo más rápido en el modo rápido, en Render agrega `ANTHROPIC_FAST_MODEL` (por ejemplo `claude-sonnet-5-5`) y compara. Cada respuesta deja una línea en los registros, solo con cifras (sin contenido ni teléfonos), por ejemplo `turno: modo=fast modelo=… esfuerzo=low 2310ms entrada=… salida=… cache=…`. Para volver atrás, borra la variable. Otras variables: `ANTHROPIC_DEEP_MODEL` y `ANTHROPIC_DEEP_EFFORT` (por defecto `high`). Haiku no tiene respaldo del lado del servidor y es el que más puede cambiar el tono: compara con cuidado antes de dejarlo.

## Bienvenida y ayuda
La primera vez que escribe un número nuevo, Ancla manda una bienvenida corta (quién es, qué puede hacer, que no es un servicio médico, cómo se cuidan los datos y `/olvidar todo`) con los botones **Empezar** y **¿Qué puedes hacer?**. Después responde normal, sin volver a presentarse. Los comandos `/ayuda` y `/privacidad` responden al instante con texto fijo, sin gastar IA. Además, el modelo enseña como mucho un dato útil por día y solo cuando viene al caso. La dirección pública para el enlace de privacidad sale sola de `RENDER_EXTERNAL_URL` (o de `PUBLIC_URL`).

## Plan
Lo hecho y lo que falta para llegar al producto final: [`ROADMAP.md`](./ROADMAP.md).

## Cómo está hecho

```
WhatsApp ──webhook──► src/server.ts ──► src/app.ts ──► src/handler.ts ──► src/brain.ts (Claude)
                                             │                 │
                     cron ──► /cron/tick ────┘           src/store (Supabase o memoria)
```

| Archivo | Qué hace |
|---|---|
| `src/prompt.ts` | **La personalidad de Ancla** y sus reglas. Aquí se ajusta el tono. |
| `src/brain.ts` | Una llamada a Claude por turno con salida JSON estructurada (respuesta + cambios). |
| `src/handler.ts` | Aplica los cambios: pendientes nuevos, completados, "1 cosa", check-ins, notas y ajustes. |
| `src/scheduler.ts` | Decide cuándo toca el buenos días, el cierre o un check-in según la hora local de cada persona. |
| `src/whatsapp.ts` | WhatsApp Cloud API: verificar firma, leer mensajes, enviar texto o plantilla, bajar audios y fotos. |
| `src/transcribe.ts` | Audio → texto (cualquier servicio compatible con `/audio/transcriptions`). |
| `supabase/schema.sql` | Tablas `ancla_*`. |

## Probarlo en 2 minutos (sin WhatsApp)

```bash
cd ancla
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run chat
```

Escribe como en WhatsApp. El simulador usa un número de Venezuela (+58); para otro país: `SIM_PHONE=5215512345678 npm run chat`. Comandos del simulador: `/manana` (buenos días), `/noche` (cierre), `/checkin`, `/pendientes`, `/perfil`, `/salir`.

Pruebas automáticas (no necesitan llaves): `npm test` y `npm run typecheck`.

## Ponerlo en WhatsApp

1. **Supabase:** crea un proyecto y corre `supabase/schema.sql` en el SQL Editor. Copia la URL y la *service role key*. Esa llave solo va en el servidor; nunca en el navegador.
2. **Meta:** en [developers.facebook.com](https://developers.facebook.com) crea una app de tipo *Business* y agrégale el producto **WhatsApp**. Ahí obtienes:
   - `WHATSAPP_PHONE_NUMBER_ID` y un token. Para producción, crea un token permanente con un *System User*.
   - El *App Secret* (Configuración → Básica) para `WHATSAPP_APP_SECRET`.
   - Al principio Meta te da un número de prueba al que solo pueden escribir los números que registres. Perfecto para probar con 3–5 amigos.
3. **Desplegar** el servidor en cualquier hosting de Node 22+ (Railway, Render, Fly.io, un VPS…). Usa `npm start` con las variables de `.env.example`.
4. **Webhook:** en Meta → WhatsApp → Configuración pon:
   - URL: `https://TU-DOMINIO/webhook`
   - Token de verificación: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo `messages`.
5. **Mensajes proactivos:** programa un cron cada 10 minutos (cron-job.org, GitHub Actions, el cron de tu hosting…) que llame:
   ```bash
   curl -X POST https://TU-DOMINIO/cron/tick -H "Authorization: Bearer $CRON_SECRET"
   ```
   O pon `INTERNAL_CRON=true` si el servidor está siempre encendido.

### La regla de las 24 horas de WhatsApp
WhatsApp solo deja mandar texto libre si la persona escribió en las últimas 24 h. Pasado ese tiempo, solo se pueden mandar **plantillas aprobadas por Meta**.

Para que Ancla siga escribiendo aunque la persona lleve días callada, crea en el WhatsApp Manager una plantilla de categoría *Utility* cuyo cuerpo sea solo `{{1}}` y pon su nombre en `WHATSAPP_TEMPLATE_NAME`. Meta puede rechazar plantillas demasiado genéricas; si pasa, usa algo como `Hola, soy Ancla: {{1}}`.

Sin plantilla, Ancla simplemente no escribe fuera de la ventana. No pasa nada: cuando la persona vuelva a escribir, todo sigue.

## Costos y modelo
- Por defecto usa `claude-opus-5-5` con esfuerzo `low`. Para bajar costos prueba `ANTHROPIC_MODEL=claude-sonnet-5-5` y compara las respuestas en el simulador.
- El system prompt se guarda en caché, así que la parte fija de cada mensaje cuesta mucho menos.
- Las peticiones activan el *fallback* del lado del servidor (`fallbacks: "default"`): si un filtro de seguridad rechaza una petición, la API la reintenta sola con el modelo de respaldo.

## Limitaciones conocidas de esta versión
- Sin panel web: todo pasa por WhatsApp. Puedes ver los datos en Supabase.
- Los patrones los saca el modelo leyendo las observaciones; todavía no hay un estimador numérico de cuánto tardas en cada tipo de tarea.
- Los recordatorios salen con la precisión del cron (cada ~10 min) y solo si pasaron menos de 6 h de su hora; si no, aparecen como "vencidos" cuando la persona vuelve a escribir.
- No hay modo de voz en tiempo real ni aparato físico (eso viene después, ver el brain dump).
- La cola que ordena los mensajes de cada persona vive en memoria: corre **una sola instancia** del servidor.
