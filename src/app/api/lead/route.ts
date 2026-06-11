import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { auditSite } from "@/lib/audit";
import { qualifyLead, fallbackQualify, type LeadContact } from "@/lib/lead";
import { analyzeLegal, toInternalSummary, toPublicTeaser } from "@/lib/legal";
import { saveLead, updateLeadAnalysis, markLeadFlag, type LeadRecord } from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { buildReportData, renderReportPdf } from "@/lib/report-pdf";
import { sendReportEmail, emailEnabled } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = rateLimit(`lead:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: {
    email?: string;
    name?: string;
    phone?: string;
    company?: string;
    url?: string;
    consent?: boolean;
    marketing?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const url = (body.url || "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: "Falta la URL auditada." }, { status: 400 });
  }
  if (!body.consent) {
    return NextResponse.json(
      { error: "Debes aceptar la política de privacidad para continuar." },
      { status: 400 },
    );
  }

  const contact: LeadContact = {
    email,
    name: body.name?.trim() || undefined,
    phone: body.phone?.trim() || undefined,
    company: body.company?.trim() || undefined,
  };

  try {
    // ── FASE RÁPIDA (~3-5s) ──────────────────────────────────────────────────
    // Re-auditamos sin Claude. Cualificación inmediata por reglas (fallback).
    // Guardamos en Notion y respondemos al visitante SIN esperar a Claude.
    const audit = await auditSite(url);
    const quickQualification = fallbackQualify(audit);

    const record: LeadRecord = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      contact,
      audit: {
        finalUrl: audit.finalUrl,
        domain: audit.domain,
        score: audit.score,
        grade: audit.grade,
      },
      qualification: quickQualification,
      marketingConsent: !!body.marketing,
    };

    const pageId = await saveLead(record);

    // Respondemos inmediatamente — el visitante ve "¡Recibido!" en ~4s.
    const response = NextResponse.json({ ok: true });

    // ── FASE BACKGROUND (after) ───────────────────────────────────────────────
    // Claude cualifica + analiza textos + actualiza Notion + genera PDF + envía email.
    // Se ejecuta DESPUÉS de que la respuesta ya llegó al cliente (el usuario no espera).
    after(async () => {
      try {
        const [fullQualification, legal] = await Promise.all([
          qualifyLead(audit, contact),
          analyzeLegal(url, { mode: "full" }),
        ]);

        // Actualizar Notion con el análisis completo de Claude.
        if (pageId) {
          await updateLeadAnalysis(pageId, {
            qualification: fullQualification,
            legalSummary: legal ? toInternalSummary(legal) : undefined,
          }).catch((e: Error) =>
            console.error("Notion update (background) falló:", e.message),
          );
        }

        // PDF de marca + email (si Resend está configurado).
        if (emailEnabled()) {
          const reportData = buildReportData(
            audit,
            fullQualification.summary,
            fullQualification.recommendations,
            legal ? toPublicTeaser(legal) : null,
          );
          const pdf = await renderReportPdf(reportData);
          const sent = await sendReportEmail({
            to: contact.email,
            name: contact.name,
            domain: audit.domain,
            score: audit.score,
            grade: audit.grade,
            pdf,
            tier: fullQualification.tier,
          });
          // Tracking: el checkbox apagado en Notion = informe no entregado
          // (visible para ventas, y el cron de seguimiento lo repara al 3er día).
          if (sent && pageId) {
            await markLeadFlag(pageId, "Email enviado").catch((e: Error) =>
              console.error("Notion flag 'Email enviado' falló:", e.message),
            );
          }
        }
      } catch (e) {
        console.error("Background lead work failed:", (e as Error).message);
      }
    });

    return response;
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "No se pudo procesar la solicitud." },
      { status: 500 },
    );
  }
}
