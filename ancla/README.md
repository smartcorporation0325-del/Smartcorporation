# Ancla: tu compañero de TDA por WhatsApp (MVP)

Primera versión del asistente descrito en [`docs/ideas/muse-tda-braindump.md`](../docs/ideas/muse-tda-braindump.md).
La persona le escribe (o le manda audios y fotos) por WhatsApp, y Ancla:

- **Vacía la cabeza:** convierte lo que le cuentas en pendientes, citas, ideas y preocupaciones.
- **Da el primer paso ridículamente pequeño** de cada tarea.
- **Ayuda cuando estás atascado/a:** pregunta por qué (aburrido, abrumador, no sé por dónde o miedo) y responde distinto.
- **Escribe primero:** "tu 1 cosa de hoy" por la mañana, check-ins de *body doubling* ("¿empezaste?") y un cierre del día sin culpa.
- **Te va conociendo:** guarda notas sobre ti, tu energía y tus horarios.

## Cómo se adapta a cada persona
- **Dialecto:** el prefijo del teléfono da una pista inicial de país, zona horaria y modismos (`src/dialect.ts`). Un número +58 arranca con tono venezolano y hora de Caracas.
- **Voz:** Ancla mantiene una descripción corta de *cómo hablarle a esa persona* (confianza, modismos que ella usa, emojis, largo de mensajes) y la reescribe cuando nota algo nuevo. Si la persona dice de dónde es, eso manda sobre el teléfono.
- **Rutinas:** va guardando hábitos que la persona cuenta o que se notan (a qué hora despierta, cuándo rinde mejor) y los usa para proponerle cosas.
- No es un entrenamiento del modelo: son notas que se guardan y se le pasan a Claude en cada mensaje. **Para que se conserven entre sesiones hace falta Supabase**; en el simulador todo se borra al salir.

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
- El "aprendizaje" es simple: notas en texto y fechas de inicio y fin de cada pendiente, todavía sin un estimador de tiempos.
- No hay modo de voz en tiempo real ni aparato físico (eso viene después, ver el brain dump).
- La cola que ordena los mensajes de cada persona vive en memoria: corre **una sola instancia** del servidor.
