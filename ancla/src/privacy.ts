// Página pública de política de privacidad (Meta la pide para publicar la app de WhatsApp).
// Es un texto básico y honesto sobre lo que hace Ancla; conviene que lo revise quien opera el servicio.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function privacyHtml(operator: string, contactEmail: string): string {
  const who = esc(operator || "Ancla");
  const contact = contactEmail
    ? `<a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a>`
    : "<strong>(el responsable debe configurar un correo de contacto en el servidor)</strong>";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de privacidad de Ancla</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#222}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.8rem}</style></head>
<body>
<h1>Política de privacidad de Ancla</h1>
<p>Última actualización: 21 de noviembre de 2026.</p>
<p>Ancla es un asistente por WhatsApp para personas con TDA/TDAH. Lo opera <strong>${who}</strong>. Esta página explica qué datos usa Ancla y cómo puedes borrarlos.</p>

<h2>Qué datos guardamos</h2>
<ul>
<li>Tu número de WhatsApp y el nombre de tu perfil de WhatsApp.</li>
<li>Los mensajes que le escribes a Ancla y las respuestas que recibes. Si mandas una nota de voz, guardamos su transcripción en texto, no el audio. Si mandas una foto, la analizamos para responderte y guardamos solo el texto que la acompañe.</li>
<li>Lo que Ancla aprende para ayudarte: tus pendientes y recordatorios, tus rutinas, las personas que mencionas, notas sobre ti, cómo te gusta que te hablen y observaciones sobre lo que haces y cómo te sientes durante el día.</li>
<li>Tu zona horaria y tus horarios de mensajes.</li>
</ul>

<h2>Para qué los usamos</h2>
<p>Solo para darte el servicio: responderte, recordarte lo que dijiste que harías y adaptarse a tus rutinas. No vendemos tus datos ni los usamos para publicidad.</p>

<h2>Con quién se procesan</h2>
<ul>
<li><strong>Meta (WhatsApp)</strong>, que transporta los mensajes.</li>
<li><strong>Anthropic</strong>, cuyo modelo de IA (Claude) lee tus mensajes y el contexto necesario para generar cada respuesta.</li>
<li><strong>Supabase</strong>, donde se guarda la base de datos, y <strong>Render</strong>, donde corre el servidor.</li>
<li>Si está activado, un servicio de <strong>transcripción de audio</strong> para convertir tus notas de voz en texto.</li>
</ul>

<h2>Cuánto tiempo los guardamos</h2>
<p>Mientras uses Ancla o hasta que los borres.</p>

<h2>Cómo borrar tus datos</h2>
<p>En el chat con Ancla escribe <strong>/olvidar</strong> y luego <strong>/olvidar todo</strong>. Esto borra tus pendientes, recordatorios, rutinas, notas, personas, observaciones, perfil e historial de mensajes. Si además quieres que borremos tu número, escríbenos a ${contact} y lo eliminamos.</p>

<h2>Lo que Ancla no es</h2>
<p>Ancla no es un servicio médico ni de salud mental, y no reemplaza a un profesional. Es para personas mayores de 18 años. Si estás en una crisis o piensas en hacerte daño, contacta de inmediato a alguien de confianza o a los servicios de emergencia de tu país.</p>

<h2>Cambios y contacto</h2>
<p>Si esta política cambia, actualizaremos la fecha de arriba. Para cualquier duda o solicitud: ${contact}.</p>
</body></html>`;
}
