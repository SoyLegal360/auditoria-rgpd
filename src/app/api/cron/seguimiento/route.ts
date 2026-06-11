import { NextResponse } from "next/server";
import { queryFollowupCandidates, markLeadFlag } from "@/lib/store";
import { sendFollowupEmail, emailEnabled, type LeadTier } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const FOLLOWUP_DAYS = 3;
const MAX_PER_RUN = 20;

// Cron diario (vercel.json): envía UN email de seguimiento a los leads con ≥3 días
// sin seguimiento. Idempotente vía el checkbox "Seguimiento enviado" en Notion.
// Vercel añade "Authorization: Bearer ${CRON_SECRET}" automáticamente a los crons
// cuando esa env var existe; sin secret configurado la ruta es un no-op seguro.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!emailEnabled()) {
    return NextResponse.json({ candidatos: 0, enviados: 0, fallos: 0, nota: "Resend no configurado." });
  }

  try {
    const candidates = await queryFollowupCandidates(FOLLOWUP_DAYS, MAX_PER_RUN);
    let enviados = 0;
    let fallos = 0;
    for (const c of candidates) {
      const ok = await sendFollowupEmail({
        to: c.email,
        name: c.name,
        domain: c.domain,
        score: c.score,
        grade: c.grade,
        tier: (["hot", "warm", "cold"].includes(c.tier) ? c.tier : "warm") as LeadTier,
        recommendations: c.recommendations,
        reportDelivered: c.emailSent,
      });
      if (ok) {
        enviados++;
        // Si el flag falla, el próximo run reintentará el envío: preferible un
        // duplicado raro a perder el seguimiento.
        await markLeadFlag(c.pageId, "Seguimiento enviado").catch((e: Error) =>
          console.error("Notion flag 'Seguimiento enviado' falló:", e.message),
        );
      } else {
        fallos++;
      }
    }
    return NextResponse.json({ candidatos: candidates.length, enviados, fallos });
  } catch (e) {
    console.error("Cron seguimiento falló:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
