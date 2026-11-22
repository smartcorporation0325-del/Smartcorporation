# Ancla: plan hacia el producto final

Estado a 22 de noviembre de 2026. Marca `[x]` lo que ya funciona y `[ ]` lo pendiente.
Visión y contexto: [`docs/ideas/muse-tda-braindump.md`](../docs/ideas/muse-tda-braindump.md).

## Dónde estamos
Un prototipo que funciona para una persona: recibe mensajes por WhatsApp, responde con un tono cercano, recuerda lo que le cuentas, te escribe por su cuenta y aprende de tus rutinas.

- [x] Bot de WhatsApp (texto, audios preparados, fotos) conectado a Claude
- [x] Memoria entre días en Supabase: pendientes, personas, notas, perfil, rutinas
- [x] Recordatorios con tus palabras ("esta mañana me dijiste…")
- [x] Observaciones por hora y patrones nocturnos (cuándo rindes, cuándo te distraes)
- [x] Mensajes propios: buenos días, check-ins, cierre del día (reloj en cron-job.org)
- [x] Tono adaptable al país, sin jerga forzada
- [x] Privacidad básica: página `/privacy`, comando `/olvidar todo`
- [x] Token permanente de Meta (usuario del sistema)
- [x] **Botones de respuesta rápida** ("Ya empecé", "10 min más", "Me atasqué")

## Etapa 1: que te sirva de verdad a ti
Usarla unos 7 días y anotar qué sirve y qué molesta. Es lo que más mejora el producto.
- [ ] Conectar notas de voz (Groq u OpenAI: 3 variables en Render) y probar con una nota real
- [ ] Borrar la llave vieja de Claude del Codespace y detener el Codespace
- [ ] Plantilla de WhatsApp aprobada por Meta, para escribir pasadas 24 h sin que hables
- [ ] Plan de pago en Render (el gratis se duerme y a veces tarda en responder)
- [ ] Aviso cuando el servidor falle
- [ ] Cambiar `CRON_SECRET` por una clave aleatoria nueva (opcional)

## Etapa 2: mejoras para TDA (por orden de impacto)
- [x] Botones de respuesta rápida
- [ ] Estimador real de tiempos: medir inicio y fin y decir "dices 10 min, te toma 35"
- [ ] Modo "acompáñame": sesión de trabajo con check-ins suaves
- [ ] Conectar Google Calendar (hoy solo sabe lo que le dices)
- [ ] Respuestas en nota de voz
- [ ] Corregir su memoria ("eso no es así") y resumen semanal de "esto aprendí de ti"
- [ ] Horas de silencio y pausa ("no me escribas hoy")

## Etapa 3: prepararla para otras personas
Aquí hay decisiones que son de la dueña del producto, no solo técnicas.
- [ ] **Número de WhatsApp real.** El de prueba solo permite 5 destinatarios. Hay que registrar un número propio, verificar el negocio con Meta y asumir el costo por conversación
- [ ] Registro de nuevas personas: bienvenida, consentimiento, país, horarios
- [ ] Términos de uso y política de privacidad completas (revisión profesional)
- [ ] Revisión clínica del tono y del protocolo de crisis
- [ ] Robustez para varias personas: cola de mensajes que sobreviva a reinicios (hoy vive en memoria y exige **una sola instancia**), límites de uso, monitoreo y copias de seguridad
- [ ] Cobro (suscripción) y página web con lista de espera
- [ ] Panel web para ver y editar lo que Ancla sabe de cada persona
- [ ] Medir: tareas iniciadas por semana (métrica estrella) y retención a 4 semanas

## Etapa 4: dispositivo y otros canales
Solo después de validar que a la gente le sirve y se queda.
- [ ] Punto de entrada para audio desde un aparato (ESP32 con pantalla y botón)
- [ ] Prototipos hechos a mano (10 a 20) antes de pensar en fabricar
- [ ] Otros canales: app, widget, reloj

## Riesgos conocidos
- Los datos son íntimos (rutinas, personas, estados de ánimo). Cualquier paso hacia otras personas exige tratarlos con cuidado legal y técnico.
- Ancla no es un servicio médico. No diagnostica ni opina sobre medicación.
- WhatsApp solo deja escribir primero dentro de las 24 h posteriores al último mensaje de la persona; fuera de eso hacen falta plantillas aprobadas.
- Lo aprendido (patrones, perfil) lo infiere un modelo: puede equivocarse. Por eso importa poder corregirlo y borrarlo.
- Los precios y límites de Meta, Groq, OpenAI, Render y Supabase cambian: revisar antes de decidir un precio al público.
