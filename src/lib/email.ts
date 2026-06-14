// Envío del informe por email vía Resend (REST, sin SDK extra).
// Se activa SOLO si hay RESEND_API_KEY y RESEND_FROM en el entorno; si no, no-op.
// RESEND_FROM debe usar un dominio verificado en Resend, p. ej.:
//   RESEND_FROM="SoyLegal360 <informe@soylegal360.es>"

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;
const RESEND_BCC = process.env.RESEND_BCC; // opcional: copia interna a ventas
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO; // opcional: dirección de respuesta

export function emailEnabled(): boolean {
  return !!(RESEND_API_KEY && RESEND_FROM);
}

export type LeadTier = "hot" | "warm" | "cold";

interface ReportEmailInput {
  to: string;
  name?: string;
  domain: string;
  score: number;
  grade: string;
  pdf: Buffer;
  tier?: LeadTier;
}

const NAVY = "#06152c";
const GOLD = "#c9a96e";
const SERVICES_URL = "https://www.soylegal360.es/servicios-proteccion-de-datos/";

// Párrafo comercial según la prioridad del lead (la calcula Claude en la cualificación).
// El tono varía; los anclajes (pack 390€, PLC 49€/mes, sanciones desde 600€) son los del catálogo.
function ctaParagraph(tier: LeadTier): string {
  switch (tier) {
    case "hot":
      return `Tu web presenta <strong>fallos relevantes</strong> de cumplimiento. La AEPD sanciona este tipo de incumplimientos —las multas a pymes parten de 600€ y con frecuencia superan los 5.000€—. La buena noticia: se corrige rápido. Con la <strong>Adaptación Web RGPD (desde 390€)</strong> nuestro equipo legal redacta y certifica tus textos legales a medida.`;
    case "cold":
      return `Enhorabuena: tu web está entre las pocas que llegan casi conformes. Para que siga así cuando cambie la normativa (y cambia a menudo), tienes la <strong>Protección Legal Continua desde 49€/mes</strong>: vigilancia y actualización permanente de tus textos legales y cookies.`;
    default:
      return `¿Quieres dejar tu web 100% conforme? Con la <strong>Adaptación Web RGPD (desde 390€)</strong> nuestro equipo legal redacta y certifica tus textos legales a medida: Aviso Legal, Política de Privacidad, Política de Cookies y consentimiento de formularios.`;
  }
}

const BUTTON_LABEL: Record<LeadTier, string> = {
  hot: "Corregir mi web ahora →",
  warm: "Quiero mi web 100% conforme →",
  cold: "Mantener mi web conforme →",
};

// Botón dorado + alternativa de respuesta directa (CTA doble).
// Fondo sólido (sin gradiente): los gradientes no se renderizan en Outlook y otros clientes.
function ctaBlock(tier: LeadTier): string {
  return `<div style="text-align:center;margin:22px 0">
        <a href="${SERVICES_URL}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:bold;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:8px">${BUTTON_LABEL[tier]}</a>
        <div style="font-size:12px;color:#5b6b7b;margin-top:10px">o simplemente responde a este correo y te ayudamos</div>
      </div>`;
}

// Carcasa de marca compartida por todos los emails (cabecera navy + tarjeta blanca + pie legal).
// tagline y footer son parametrizables: los emails de formularios no son "diagnóstico".
function shell(
  content: string,
  opts: { tagline?: string; footer?: string } = {},
): string {
  const tagline = opts.tagline ?? "Diagnóstico de cumplimiento RGPD";
  const footer =
    opts.footer ??
    "Diagnóstico orientativo automático. No sustituye la revisión de un abogado ni constituye asesoramiento jurídico.";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1c2733">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${NAVY};border-radius:10px 10px 0 0;padding:22px 28px">
      <div style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:.5px">SoyLegal<span style="color:${GOLD}">360</span></div>
      <div style="color:#9fb0c4;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px">${tagline}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 10px 10px;padding:28px">
      ${content}
      <p style="font-size:11px;color:#5b6b7b;line-height:1.5;margin:18px 0 0;border-top:1px solid #e4e8ee;padding-top:14px">${footer}<br/>SoyLegal360 · soylegal360.es</p>
    </div>
  </div></body></html>`;
}

function scoreBox(score: number, grade: string): string {
  return `<div style="text-align:center;margin:20px 0">
        <div style="display:inline-block;border:2px solid ${GOLD};border-radius:10px;padding:14px 26px">
          <div style="font-size:34px;font-weight:bold;color:${NAVY};line-height:1">${score}<span style="font-size:14px;color:#5b6b7b">/100</span></div>
          <div style="font-size:13px;color:#5b6b7b;margin-top:2px">Calificación <strong style="color:${NAVY}">${grade}</strong></div>
        </div>
      </div>`;
}

function htmlBody(i: ReportEmailInput): string {
  const saludo = i.name ? `Hola ${i.name}` : "Hola";
  const tier = i.tier || "warm";
  return shell(`<p style="font-size:15px;margin:0 0 14px">${saludo},</p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 18px">Ya tienes tu <strong>diagnóstico RGPD de ${i.domain}</strong>. Lo encontrarás en el PDF adjunto, con el detalle por áreas y el análisis de tus textos legales.</p>
      ${scoreBox(i.score, i.grade)}
      <p style="font-size:14px;line-height:1.5;margin:0 0 6px">${ctaParagraph(tier)}</p>
      ${ctaBlock(tier)}`);
}

async function sendViaResend(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        ...(RESEND_REPLY_TO ? { reply_to: [RESEND_REPLY_TO] } : {}),
        ...(RESEND_BCC ? { bcc: [RESEND_BCC] } : {}),
        ...payload,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("Resend falló:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend excepción:", (e as Error).message);
    return false;
  }
}

// Envía el informe. Devuelve true si se envió, false si está deshabilitado o falló (no lanza).
export async function sendReportEmail(i: ReportEmailInput): Promise<boolean> {
  if (!emailEnabled()) return false;
  return sendViaResend({
    to: [i.to],
    subject: `Tu diagnóstico RGPD de ${i.domain} · ${i.score}/100 (${i.grade})`,
    html: htmlBody(i),
    attachments: [
      {
        filename: `diagnostico-rgpd-${i.domain}.pdf`,
        content: i.pdf.toString("base64"),
      },
    ],
  });
}

// ---------- Emails de los formularios de la web (contacto / auditoría gratuita / B2C) ----------

export type ContactFormType = "contacto" | "auditoria-gratuita" | "ejercicio-derechos" | "chat";

// Bandeja interna que recibe los mensajes (configurable; por defecto el buzón general).
const CONTACT_INBOX = process.env.CONTACT_INBOX || "hola@soylegal360.es";

const FORM_META: Record<ContactFormType, { label: string; ackIntro: string }> = {
  contacto: {
    label: "Contacto",
    ackIntro:
      "Hemos recibido tu mensaje. Te responderemos en menos de 48 horas hábiles.",
  },
  "auditoria-gratuita": {
    label: "Auditoría web gratuita",
    ackIntro:
      "Hemos recibido tu solicitud de auditoría web gratuita. Nuestro equipo legal revisará tu web y recibirás el informe en un plazo de 48 horas hábiles.",
  },
  "ejercicio-derechos": {
    label: "Ejercicio de derechos",
    ackIntro:
      "Hemos recibido tu caso. Lo valoramos sin coste y te contactaremos en menos de 48 horas hábiles para explicarte si procede y los siguientes pasos.",
  },
  chat: {
    label: "Asistente virtual",
    ackIntro:
      "Hemos recibido tu solicitud desde el asistente de la web. Te contactaremos en menos de 48 horas hábiles.",
  },
};

export interface ContactEmailInput {
  formType: ContactFormType;
  email: string;
  name?: string;
  phone?: string;
  message?: string;
  url?: string;
  caso?: string;
  servicio?: string;
  marketing: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Notificación interna a la bandeja de SoyLegal360 con los datos del mensaje.
export async function sendContactNotification(i: ContactEmailInput): Promise<boolean> {
  if (!emailEnabled()) return false;
  const meta = FORM_META[i.formType];
  const row = (k: string, v?: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:#5b6b7b;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`
      : "";
  return sendViaResend({
    to: [CONTACT_INBOX],
    // El BCC global iría también a la bandeja interna → lo anulamos en este envío.
    bcc: undefined,
    reply_to: [i.email],
    subject: `[Web · ${meta.label}] ${i.name || i.email}`,
    html: shell(
      `<p style="font-size:15px;margin:0 0 14px">Nuevo mensaje desde el formulario <strong>${meta.label}</strong>:</p>
      <table style="font-size:14px;line-height:1.5;border-collapse:collapse">
        ${row("Nombre", i.name)}${row("Email", i.email)}${row("Teléfono", i.phone)}${row("Servicio", i.servicio)}${row("Web", i.url)}${row("Caso", i.caso)}${row("Comercial", i.marketing ? "Sí, acepta comunicaciones" : "No")}
      </table>
      ${i.message ? `<p style="font-size:14px;line-height:1.6;margin:14px 0 0;background:#f6f1e7;border-left:3px solid ${GOLD};padding:12px;border-radius:4px">${esc(i.message)}</p>` : ""}`,
      { tagline: meta.label, footer: "Mensaje recibido en soylegal360.es. Responde directamente a este correo para contestar." },
    ),
  });
}

// Acuse de recibo breve al visitante.
export async function sendContactAck(i: ContactEmailInput): Promise<boolean> {
  if (!emailEnabled()) return false;
  const meta = FORM_META[i.formType];
  const saludo = i.name ? `Hola ${i.name}` : "Hola";
  return sendViaResend({
    to: [i.email],
    subject: `Hemos recibido tu ${i.formType === "contacto" ? "mensaje" : "solicitud"} · SoyLegal360`,
    html: shell(
      `<p style="font-size:15px;margin:0 0 14px">${saludo},</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px">${meta.ackIntro}</p>
      <p style="font-size:14px;line-height:1.6;margin:0">Si quieres añadir algo, responde directamente a este correo.</p>`,
      {
        tagline: meta.label,
        footer:
          "Has recibido este correo porque enviaste un formulario en soylegal360.es. Tus datos se tratan según nuestra política de privacidad (soylegal360.es/politica-de-privacidad/).",
      },
    ),
  });
}

// ---------- Email de seguimiento (cron, a los 3 días) ----------
// Sin PDF: se construye solo con los datos que ya viven en Notion. El copy queda SIEMPRE
// ligado al diagnóstico que el lead solicitó (no es comunicación comercial genérica).
export interface FollowupInput {
  to: string;
  name?: string;
  domain: string;
  score: number;
  grade: string;
  tier: LeadTier;
  recommendations: string[];
  reportDelivered: boolean; // false = el primer email falló → este envío lo repara
}

export async function sendFollowupEmail(i: FollowupInput): Promise<boolean> {
  if (!emailEnabled()) return false;
  const saludo = i.name ? `Hola ${i.name}` : "Hola";
  const recos = i.recommendations
    .slice(0, i.reportDelivered ? 3 : 5)
    .map((r) => `<li style="margin:0 0 6px">${r}</li>`)
    .join("");
  const intro = i.reportDelivered
    ? `Hace unos días te enviamos el <strong>diagnóstico RGPD de ${i.domain}</strong>. Por si no tuviste ocasión de revisarlo, este es el resumen:`
    : `Hace unos días solicitaste el <strong>diagnóstico RGPD de ${i.domain}</strong> y no nos consta que el informe llegara bien, así que te lo resumimos aquí:`;
  return sendViaResend({
    to: [i.to],
    subject: i.reportDelivered
      ? `¿Revisaste el diagnóstico RGPD de ${i.domain}?`
      : `Tu diagnóstico RGPD de ${i.domain} (reenvío)`,
    html: shell(`<p style="font-size:15px;margin:0 0 14px">${saludo},</p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 14px">${intro}</p>
      ${scoreBox(i.score, i.grade)}
      ${recos ? `<ul style="font-size:14px;line-height:1.5;margin:0 0 16px;padding-left:20px">${recos}</ul>` : ""}
      <p style="font-size:14px;line-height:1.5;margin:0 0 6px">${ctaParagraph(i.tier)}</p>
      ${ctaBlock(i.tier)}`),
  });
}
