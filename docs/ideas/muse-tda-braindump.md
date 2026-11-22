# Brain dump: un "Muse" para cerebros con TDA

> Idea: un asistente de IA al estilo de Meta Muse / Meta AI, pero diseñado desde cero
> para personas con TDA/TDAH (ADD/ADHD). Documento vivo, sin filtro. Fecha: 2026-11-21.

---

## 1. Qué es Muse (lo que copiamos y lo que no)

**Muse Spark** es el primer modelo de Meta Superintelligence Labs (abril 2026) y es el que mueve a Meta AI.

| Característica de Muse | ¿Nos sirve para TDA? |
|---|---|
| **Modos Instant / Thinking / Contemplating** (varios agentes razonan en paralelo) | Sí, pero escondido. El usuario no debería elegir el modo: elegirlo ya es una decisión más. |
| **Voz natural**: puedes interrumpir, cambiar de tema o de idioma a mitad de frase | **Clave.** Así habla un cerebro con TDA. Hablar cuesta menos que escribir. |
| **Multimodal**: entiende fotos (p. ej. calorías de un plato) | Sí: foto del escritorio, del refri, de una carta del banco → "esto es lo que hay que hacer". |
| **Visuales interactivos** (desgloses, tarjetas) | Sí: el texto largo agota; mejor tarjetas, barras y colores. |
| **Vive donde ya estás**: WhatsApp, Instagram, Messenger y lentes Ray-Ban Meta | **Clave.** Una app que tienes que acordarte de abrir no funciona con TDA. |
| **Side chats** en grupos y subagentes en paralelo | Sí: "body doubling" grupal y agentes que se encargan de lo aburrido. |
| Integración social y de compras, feed de recomendaciones | **No.** Más estímulos = más distracción. Hacemos lo contrario. |

**La tesis:** Muse está hecho para *tenerte enganchado*. El nuestro tiene que *sacarte de la app* y llevarte a hacer las cosas.

---

## 2. Cómo funciona un cerebro con TDA (lo que dice la investigación)

1. **Funciones ejecutivas.** Los modelos neurocognitivos ven como núcleo el déficit en funciones ejecutivas, sobre todo en la inhibición de respuestas, con la corteza prefrontal y el circuito prefrontal-estriado implicados. Las funciones ejecutivas son planear, empezar, priorizar, cambiar de tarea y frenar impulsos.
2. **Dopamina y noradrenalina.** La hipótesis de la dopamina tiene apoyo, pero se discute; también hay evidencia del sistema noradrenérgico. Una lectura útil para producto: el problema no es "falta de voluntad", sino que **la recompensa lejana no se siente**.
3. **Sistema nervioso basado en el interés** (William Dodson; es un marco clínico, no algo demostrado). Lo que activa a la persona no es *importancia* sino **I-N-C-U**:
   - **I**nterés · **N**ovedad · **C**ompetencia/reto · **U**rgencia.
   Este es nuestro motor de diseño.
4. **Ceguera temporal** (Russell Barkley). Cuesta sentir, seguir y estimar el tiempo. Solo existe "ahora" y "no ahora".
5. **Memoria de trabajo limitada.** Los planes no se sostienen en la cabeza, así que hay que **sacarlos afuera**.
6. **Desregulación emocional.** Frustración y ansiedad frente a las tareas → evitación → culpa → más evitación. Encaja aquí la sensibilidad al rechazo (RSD).
7. **Hiperfoco.** El reverso: cuando algo engancha, se pierde la noción de todo lo demás, incluso de comer.
8. **Body doubling.** Trabajar acompañado, aunque sea en virtual, ayuda a empezar y a seguir. Puede ayudar también con la soledad.

**Hueco de mercado:** según un preprint de arXiv (2026), las apps de productividad optimizan *terminar* tareas, pero casi no ayudan a **empezar**, a **estimar el tiempo** ni a **regular la emoción**. Ahí entramos.

---

## 3. Principios de diseño (no negociables)

- **Cero fricción de captura.** Un botón, una nota de voz o un audio por WhatsApp. Nada de formularios.
- **Proactivo, no reactivo.** La IA te busca a ti en el momento justo; no esperamos a que abras la app.
- **Una sola cosa a la vez.** Nunca mostrar una lista de 47 pendientes. Mostrar *la siguiente acción*.
- **Sin culpa.** Nada de rachas que se rompen ni de "llevas 3 días sin...". Reiniciar siempre es gratis.
- **El tiempo se ve.** Barras que se vacían, sonidos, "te quedan 2 canciones".
- **Dopamina honesta.** Recompensas reales y variadas (novedad), pero sin trucos adictivos tipo feed.
- **Elegir por ti.** "¿Qué quieres hacer?" paraliza. Mejor "Propongo X. ¿Va?" (sí, no, otra).
- **Tono:** amigo cómplice, no coach militar ni terapeuta. Humor, pocas palabras y ningún sermón.
- **No es tratamiento médico.** Complementa terapia y medicación, no las sustituye.

---

## 4. Funciones (brain dump crudo)

### Núcleo: "vaciar la cabeza"
- **Brain dump por voz:** hablas 3 minutos sin orden y la IA lo convierte en tareas, ideas, preocupaciones y citas. Pregunta lo mínimo.
- **Bandeja "¿esto qué es?":** todo lo capturado queda sin clasificar y la IA lo ordena después, sin pedirte que decidas al momento.
- **Foto → acción:** foto de una carta, una factura o un cuarto desordenado → "3 pasos, el primero toma 2 minutos".

### Empezar (el problema número uno)
- **Paso ridículamente pequeño:** "No limpies la cocina. Solo lleva un vaso al fregadero."
- **Desglose automático** con nivel de "picante" ajustable (inspirado en Goblin Tools, pero con contexto tuyo).
- **Botón "estoy atascado/a":** la IA pregunta *por qué* (aburrido, abrumador, no sé por dónde, me da miedo) y responde distinto en cada caso.
- **Gamificar con I-N-C-U:** convertir tareas en retos ("¿puedes contestar 5 correos antes de que acabe esta canción?"), meter novedad o crear urgencia falsa pero amable.

### Tiempo
- **Estimador realista:** aprende cuánto *te* tardas de verdad ("dices 10 min; históricamente te toma 35").
- **Cuenta regresiva de salida:** "Para llegar a las 3, sales a las 2:20, te bañas a la 1:40 y empiezas a vestirte YA."
- **Alertas de hiperfoco:** "Llevas 2 h 40 min en esto. ¿Comiste? ¿Tenías algo a las 4?"
- **Timers visuales y sonoros**, no solo números.

### Body doubling con IA
- **Modo "acompáñame":** la IA se queda "presente" por voz o en pantalla y hace check-ins suaves cada X minutos.
- **Salas grupales** (tipo side chat de Muse): gente con TDA trabajando juntos en silencio, con la IA moderando.
- **Integración con lentes** a futuro: "¿sigues en la tarea?" sin sacar el teléfono.

### Emociones
- **Check-in de energía y ánimo** de un toque: el plan del día se adapta (con energía baja → tareas fáciles y tiempos cortos).
- **Primeros auxilios para la abrumación:** respiración, reducir el plan a 1 cosa y validar.
- **Reencuadre de la culpa:** "Hoy hiciste 4 cosas. Ayer cero. Eso es infinito por ciento más."
- **Asistente de RSD:** ayuda a releer un mensaje que "suena a que están enojados conmigo".

### Memoria externa ("segundo cerebro")
- **"¿Dónde dejé...?"** y "¿qué le prometí a Juan?". Recuerda lo que le contaste.
- **Recordatorios por contexto**, no solo por hora: "cuando llegues al súper", "cuando abras la laptop".
- **Resumen del día** sin juicio y con "mañana empiezas por esto".

### Agentes que hacen lo aburrido (los "Contemplating" de Muse, aplicados aquí)
- Redactar el correo difícil, llenar el formulario, comparar 3 opciones y decidir por ti si se lo pides.
- Pagar o recordar facturas antes del recargo (el "impuesto TDA").
- Llamar o reservar citas (más adelante, con permisos).

---

## 5. Dónde vive el producto (canales)

1. **WhatsApp primero.** Es el canal que ya se abre 100 veces al día, sobre todo en Latinoamérica. MVP por WhatsApp Business API.
2. **App móvil** para timers visuales, body doubling y vista del día.
3. **Widget o pantalla de bloqueo:** "tu siguiente paso es...".
4. **Web o escritorio** para sesiones de trabajo.
5. Futuro: **smartwatch** (vibración háptica para la ceguera temporal) y lentes.

---

## 5b. Versión hardware: un "compañero de escritorio" con pantallita

**Cómo funcionan estos aparatos:** el modelo de IA **no corre dentro del aparato**. Un chip barato (ESP32-S3) se encarga del micrófono, el altavoz, la pantalla y los botones, y manda la voz a la nube, donde está el modelo. Así funcionan los proyectos abiertos tipo *xiaozhi-esp32*. Según varias notas, desde octubre de 2026 Meta también ofrece "Muse Gadgets", un SDK abierto para ESP32 y Linux (no lo pude verificar en fuente primaria). Ese camino te ata a Meta, así que conviene **firmware abierto + nuestro propio backend** (el mismo del bot de WhatsApp).

**Por qué tiene sentido para TDA:**
- **Está a la vista:** no depende de acordarte de abrir una app. Un objeto físico en el escritorio funciona como recordatorio permanente.
- **No es el teléfono:** sin feed ni notificaciones de otras apps, así que distrae menos.
- **El tiempo se ve:** un anillo de LEDs o una pantalla redonda que se vacía, como un Time Timer, pero inteligente.
- **Body doubling físico:** una "carita" que te acompaña, se fija en ti y te da check-ins.

**Concepto "Ancla" (nombre provisional):**
- **Pantalla redonda de 1.3–2"** con **una sola cosa**: la siguiente acción y el timer visual.
- **Botón grande "push-to-talk"** para el brain dump. Lo aprietas, hablas y sueltas.
- **Botón "atascado/a"**, que pide un microdesglose del paso.
- **Vibración y luz suave** para transiciones ("en 5 min tienes que salir"), sin pitidos estresantes.
- **Modo acompañante:** la carita "trabaja contigo" y celebra cuando empiezas.
- Se sincroniza con WhatsApp y la app: es **la misma memoria y el mismo asistente** en todos los canales.

**Prototipo (≈ US$30–80 en piezas):**
- Placa ESP32-S3 con pantalla, micrófono y altavoz ya integrados. Opciones: M5Stack (CoreS3 / StickS3), Waveshare ESP32-S3 con LCD redondo, o un kit compatible con xiaozhi.
- Motor de vibración, anillo de LEDs WS2812 y carcasa impresa en 3D.
- Firmware basado en xiaozhi-esp32: la palabra de activación corre en el chip y el resto va a nuestro servidor (transcripción → Claude → voz).

**Riesgos:** fabricar es caro y lento (certificaciones, inventario, devoluciones). Por eso conviene validar primero con software (WhatsApp) y con 10–20 prototipos hechos a mano. Si a la gente le gusta, entonces se busca financiamiento (Kickstarter) o un fabricante.

---

## 6. MVP en 4–6 semanas (propuesta)

**Hipótesis a validar:** *"Si capturar es tan fácil como mandar un audio y la IA me dice el primer paso pequeño, empiezo más tareas."*

1. Bot de WhatsApp: audio o texto → la IA lo transcribe, clasifica y guarda.
2. Cada mañana: "Tu 1 cosa de hoy + el primer paso" (elegido por la IA, con opción de cambiar).
3. Botón "atascado/a" → microdesglose.
4. Check-ins de body doubling ("¿empezaste? 👀") a la hora que elijas.
5. Resumen nocturno sin culpa.

**Métrica estrella:** número de *tareas iniciadas* por semana, no completadas.
Métricas secundarias: retención a 4 semanas y "¿te sentiste peor o mejor contigo?" (1–5).

### Stack posible
- **LLM:** la API de Claude para razonar, desglosar y mantener el tono; un modelo pequeño o rápido para clasificar.
- **Voz:** transcripción (Whisper o similar) y TTS para el modo acompañante.
- **Backend:** Next.js + Supabase (el mismo stack que ya usamos en este repo), colas o cron para los mensajes proactivos.
- **Canal:** WhatsApp Business API (Meta Cloud API o Twilio).
- **Memoria:** Postgres + pgvector en Supabase para "recordar lo que me contaste".

---

## 7. Competencia y diferenciador

> **Corregido el 22 de noviembre de 2026.** La primera versión de esta sección decía que Ancla sería "el único asistente que te busca a ti" y que "ninguna app de TDA" ofrece varios canales. Al revisar el mercado de nuevo, eso no se sostiene: ya existen productos muy parecidos, incluso dentro de WhatsApp y Telegram. Casi toda la información viene de fichas de tiendas de apps y de artículos de los propios desarrolladores, así que lo que dicen de sí mismos **no está verificado**.

| Producto | Qué es (según ellos) | Se parece a Ancla en |
|---|---|---|
| [Ping.me](https://www.producthunt.com/products/ping-me-2) | Asistente de recordatorios para TDAH dentro de WhatsApp, con memoria | Canal y recordatorios (el más cercano) |
| [Sihem](https://www.indiehackers.com/product/sihem) | Mentor de IA en Telegram, tranquilo y sin juicios | Tono y canal |
| [Ari](https://apps.apple.com/us/app/-/id6742913457), [Helpz](https://play.google.com/store/apps/details?id=com.helpz), [Zoe](https://www.producthunt.com/products/ping-me-2) | Coaches de IA con check-ins | Check-ins |
| [shelpful](https://apps.apple.com/py/app/shelpful-ai-for-adhd-tasks/id6741499362?l=en-GB) | Tareas con IA y tono elegible, con recordatorios | Tono adaptable |
| [Recordo](https://apps.apple.com/app/id6756238969), [Goblin Tools](https://apps.apple.com/py/app/goblin-tools-not-boring-habits/id6462700951) | Dividen tareas en micropasos | "Primer paso chiquito" |
| [Tiimo](https://apps.apple.com/es/app/id1480220328) | Planificador visual de tiempo | Ayuda con el tiempo |
| [Focusmate](https://add.org/adhd-tools-for-adults/) | Acompañamiento (*body doubling*) con personas reales | Acompañar mientras trabajas |
| Meta AI / Muse | Voz, multimodal, dentro de WhatsApp; genérico | Canal y voz |

**Lo que NO nos diferencia:** estar en WhatsApp, los recordatorios, los micropasos, el tono amable y los check-ins. Cualquier función que se pueda describir en una frase la puede copiar otro equipo en semanas.

**Lo que podría diferenciarnos (hipótesis, sin comprobar con usuarios):**
1. **Devolverte tus propias palabras en el momento justo**, con la hora en que las dijiste ("esta mañana me dijiste que ibas a llamar al dentista").
2. **Aprender tus patrones por hora** (cuándo rindes, cuándo te distraes) y usarlos para anticiparse.
3. **Español primero**, con tono según el país y sin jerga forzada, en un mercado donde casi todo está en inglés.
4. **Memoria de tu gente y tu contexto**, no solo de tus tareas, con control de borrado (`/olvidar`).
5. **Diseño sin culpa** como principio.
6. Planeado pero **todavía no construido**: estimador real de tiempos y aparato físico.

**Cómo se vuelve un diferenciador de verdad:** no por tener más funciones, sino porque la gente **empiece más cosas** y **se quede**. Las métricas son tareas iniciadas por semana y retención a las 4 semanas. A eso se suma la memoria acumulada de cada persona, que hace costoso irse, y la confianza (revisión clínica, privacidad).

**Frase de posicionamiento para probar:** *"Tu memoria externa en español: te devuelve lo que dijiste, cuando lo necesitas, sin culpa."*

**Qué verificar antes de afirmar algo más:** usar 2 o 3 competidores durante una semana (Ping.me, Goblin Tools, Tiimo), comparar con Ancla y anotar qué hacen mejor ellos.

### 7b. "Más que una app": un cerebro con muchos cuerpos

Como Muse, el producto es **un asistente**, no una app. Hay un solo "cerebro" central y varios "cuerpos" por donde te habla:

```
            ┌───────────── CEREBRO (nuestro backend) ─────────────┐
            │ Memoria de ti · Perfil TDA (qué te activa, cuánto    │
            │ tardas, tu energía) · Motor proactivo (cuándo        │
            │ hablarte) · Agentes (Claude API) · Tono/personaje    │
            └──────────────────────────┬──────────────────────────┘
        ┌──────────┬──────────┬────────┴───┬──────────┬──────────┐
     WhatsApp    App móvil   Voz (llamada) Aparato   Reloj / lentes
                                           "Ancla"   (futuro)
```

**Qué podría ser difícil de copiar (el foso; son hipótesis, ninguna está probada todavía):**
1. **Especialización en TDA:** está diseñado para *empezar*, *sentir el tiempo* y *regular la emoción*. Ojo: varios competidores dicen lo mismo, así que esto solo cuenta si se demuestra con usuarios.
2. **Proactividad con criterio:** sabe cuándo hablarte y cuándo callarse. Ese "cuándo" se aprende con datos de uso: es el activo más valioso.
3. **Memoria y perfil personal:** tus tiempos reales, tus patrones de energía y lo que a ti te activa. Cuanto más lo usas, mejor funciona y más cuesta irse.
4. **Omnicanal:** el mismo compañero en WhatsApp, por voz y en un aparato. Hoy solo existe el canal de WhatsApp; no encontré otra app de TDA que combine los tres, pero no lo verifiqué a fondo.
5. **Español y Latinoamérica primero.** Casi toda la competencia está en inglés.
6. **Personaje propio:** un "amigo" con nombre y personalidad, no un chatbot genérico.
7. **Modelo de negocio alineado:** cobramos por ayudarte, no por tu atención. Privacidad fuerte.
8. **Comunidad:** body doubling grupal con otras personas con TDA.

## 7c. Costos estimados (orden de magnitud, nov 2026)

**IA por usuario activo al mes** (≈30 interacciones al día; los mensajes simples los resuelve un modelo barato y los desgloses o el razonamiento uno mejor):
- Claude Haiku 5.5 para clasificar y responder cosas simples: $0.10/$0.50 por millón de tokens (entrada/salida) → centavos al mes.
- Claude Sonnet 5.5 para desgloses, planes y tono: $2/$10 por millón; con caché del prompt, ≈ $1–2 al mes.
- **Total de IA ≈ $1.5–4 por usuario al mes.**
- Transcripción de audios ≈ $0.5–1. La voz en tiempo real (modo acompañante) cuesta más: es lo que más hay que vigilar.
- Mensajes proactivos de WhatsApp (plantillas): unos centavos cada uno, según el país; ≈ $1–3 al mes.
- **≈ $3–8 por usuario al mes en total**, así que una suscripción de $8–15 al mes deja margen.

**Construir:**
| Etapa | Tiempo | Costo aproximado |
|---|---|---|
| MVP en WhatsApp (1 dev + Claude Code) | 4–8 semanas | Infra < $100/mes + tu tiempo, o ~$5–15k con un freelancer |
| App + voz + memoria (equipo de 2–3) | 3–6 meses | ~$30–100k (equipo en Latinoamérica) |
| Prototipos de hardware (10–20 a mano) | 1–2 meses | $30–80 por unidad + diseño 3D |
| Hardware en serie (diseño industrial, moldes, certificaciones FCC/CE, inventario) | 9–18 meses | $100k+ (a menudo con Kickstarter) |

**No entrenamos un modelo propio:** Meta gastó miles de millones en Muse, pero nosotros alquilamos la inteligencia por API. Lo difícil no es la tecnología, sino el **producto**: acertar con la proactividad, el tono, la memoria y la retención.

---

## 8. Riesgos y preguntas abiertas

- **Notificaciones:** ser proactivo sin volverse ruido que se ignora. ¿Cómo aprende el ritmo de cada persona?
- **Novedad que se gasta:** con TDA todo deja de ser interesante en 2–3 semanas. ¿Cómo rotar mecánicas?
- **Privacidad:** guardamos pensamientos íntimos. Hace falta cifrado y transparencia, y no vender datos jamás (otro contraste con Meta).
- **Límites clínicos:** no diagnosticar y detectar señales de crisis para derivar a ayuda profesional.
- **Dependencia de WhatsApp:** políticas de Meta, costos por conversación y plantillas aprobadas.
- **Modelo de negocio:** ¿freemium? ¿B2B (empresas, universidades, coaches de TDA)? ¿Aliados con psiquiatras?
- **Nombre:** ¿"Chispa"? ¿"Ahora"? ¿"Foco"? ¿"Ancla"? ¿"Copiloto"? (tiene que ser nuestro, no parecido a Muse).

---

## 9. Siguientes pasos sugeridos

1. Entrevistar a 10 personas con TDA: ¿cuál es su peor momento del día?
2. Prototipo "mago de Oz": tú haces de bot por WhatsApp durante una semana con 3–5 amigos.
3. Definir la voz y el tono del asistente (5 ejemplos de mensajes buenos y 5 malos).
4. Construir el MVP del bot de WhatsApp (sección 6).

---

## Fuentes

- Meta — [Introducing Muse Spark](https://about.fb.com/news/2026/04/introducing-muse-spark-meta-superintelligence-labs/)
- [Tom's Guide — I tried Muse Spark](https://www.tomsguide.com/ai/i-tried-muse-spark-heres-what-you-need-to-know-about-metas-new-ai-model)
- [DataCamp — Muse Spark](https://www.datacamp.com/blog/muse-spark) · [Zapier — Meta AI Muse Spark](https://zapier.com/blog/meta-ai-muse-spark/) · [TechRadar review](https://www.techradar.com/ai-platforms-assistants/i-tried-metas-new-muse-spark-ai-model-and-it-feels-like-chatgpt-built-for-the-social-internet)
- [Frontiers in Psychiatry — revisión dopamina/noradrenalina en TDAH](https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2024.1492126/full)
- [PMC — funciones ejecutivas en TDAH](https://pmc.ncbi.nlm.nih.gov/articles/PMC9548548) · [PMC 11604610](https://pmc.ncbi.nlm.nih.gov/articles/PMC11604610/)
- [Landmark College — The neuroscience of ADHD](https://www.landmark.edu/research-and-training/blog/the-neuroscience-of-adhd)
- [Neurodivergent Insights — Interest-based nervous system](https://neurodivergentinsights.com/adhd-motivation/)
- [Psychology Today — Dopamine and ADHD](https://www.psychologytoday.com/us/blog/clinical-psychology-perspectives/202512/whats-the-deal-with-dopamine-and-adhd)
- [Understood — ADHD and time blindness](https://www.understood.org/en/articles/adhd-time-blindness) · [Simply Psychology — Time blindness](https://www.simplypsychology.org/adhd-time-blindness.html)
- [arXiv 2603.17258 — apoyo a adultos con TDAH (preprint 2026)](https://arxiv.org/html/2603.17258v1)
- [ADD.org — ADHD tools for adults](https://add.org/adhd-tools-for-adults/)
- [Saner.ai — neurodivergent apps](https://www.saner.ai/blogs/best-neurodivergent-apps-for-adults) (fuente comercial) · [ClickUp — AI tools for neurodivergent people](https://clickup.com/blog/ai-tools-for-neurodivergent-people/)
