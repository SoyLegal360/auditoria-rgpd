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

interface ReportEmailInput {
  to: string;
  name?: string;
  domain: string;
  score: number;
  grade: string;
  pdf: Buffer;
}

const NAVY = "#06152c";
const GOLD = "#c9a96e";

function htmlBody(i: ReportEmailInput): string {
  const saludo = i.name ? `Hola ${i.name}` : "Hola";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1c2733">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${NAVY};border-radius:10px 10px 0 0;padding:22px 28px">
      <div style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:.5px">SoyLegal<span style="color:${GOLD}">360</span></div>
      <div style="color:#9fb0c4;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px">Diagnóstico de cumplimiento RGPD</div>
    </div>
    <div style="background:#fff;border-radius:0 0 10px 10px;padding:28px">
      <p style="font-size:15px;margin:0 0 14px">${saludo},</p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 18px">Ya tienes tu <strong>diagnóstico RGPD de ${i.domain}</strong>. Lo encontrarás en el PDF adjunto, con el detalle por áreas y el análisis de tus textos legales.</p>
      <div style="text-align:center;margin:20px 0">
        <div style="display:inline-block;border:2px solid ${GOLD};border-radius:10px;padding:14px 26px">
          <div style="font-size:34px;font-weight:bold;color:${NAVY};line-height:1">${i.score}<span style="font-size:14px;color:#5b6b7b">/100</span></div>
          <div style="font-size:13px;color:#5b6b7b;margin-top:2px">Calificación <strong style="color:${NAVY}">${i.grade}</strong></div>
        </div>
      </div>
      <p style="font-size:14px;line-height:1.5;margin:0 0 18px">¿Quieres dejar tu web 100% conforme? Con la <strong>Adaptación Web RGPD (desde 390€)</strong> nuestro equipo legal redacta y certifica tus textos legales a medida. Responde a este correo y te ayudamos.</p>
      <p style="font-size:11px;color:#5b6b7b;line-height:1.5;margin:18px 0 0;border-top:1px solid #e4e8ee;padding-top:14px">Diagnóstico orientativo automático. No sustituye la revisión de un abogado ni constituye asesoramiento jurídico.<br/>SoyLegal360 · soylegal360.es</p>
    </div>
  </div></body></html>`;
}

// Envía el informe. Devuelve true si se envió, false si está deshabilitado o falló (no lanza).
export async function sendReportEmail(i: ReportEmailInput): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [i.to],
        ...(RESEND_REPLY_TO ? { reply_to: [RESEND_REPLY_TO] } : {}),
        ...(RESEND_BCC ? { bcc: [RESEND_BCC] } : {}),
        subject: `Tu diagnóstico RGPD de ${i.domain} · ${i.score}/100 (${i.grade})`,
        html: htmlBody(i),
        attachments: [
          {
            filename: `diagnostico-rgpd-${i.domain}.pdf`,
            content: i.pdf.toString("base64"),
          },
        ],
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
