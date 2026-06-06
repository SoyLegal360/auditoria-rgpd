import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auditSite } from "@/lib/audit";
import { qualifyLead, type LeadContact } from "@/lib/lead";
import { saveLead, type LeadRecord } from "@/lib/store";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: {
    email?: string;
    name?: string;
    phone?: string;
    company?: string;
    url?: string;
    consent?: boolean;
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
    // Re-auditamos en el servidor para no fiarnos del informe enviado por el cliente.
    const audit = await auditSite(url);
    const qualification = await qualifyLead(audit, contact);

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
      qualification,
    };

    await saveLead(record);

    // Al visitante solo le devolvemos lo público (no el tier comercial interno).
    return NextResponse.json({
      ok: true,
      summary: qualification.summary,
      recommendations: qualification.recommendations,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "No se pudo procesar la solicitud." },
      { status: 500 },
    );
  }
}
