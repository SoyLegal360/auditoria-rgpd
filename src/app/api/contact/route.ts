import { NextResponse } from "next/server";
import { saveContact, TEST_EMAIL_RE, type ContactFormType } from "@/lib/store";
import { sendContactNotification, sendContactAck } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Los formularios viven en la web estática (otro origen) y postean aquí cross-origin.
const ALLOWED_ORIGINS = new Set([
  "https://www.soylegal360.es",
  "https://soylegal360.es",
  "http://localhost:8765", // preview local de la web estática
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_TYPES = new Set<ContactFormType>(["contacto", "auditoria-gratuita", "ejercicio-derechos", "chat"]);

export async function POST(req: Request) {
  const cors = corsHeaders(req);

  const rl = rateLimit(`contact:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: {
    formType?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    url?: string;
    caso?: string;
    servicio?: string;
    consent?: boolean;
    marketing?: boolean;
    website?: string; // honeypot: campo oculto que un humano nunca rellena
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400, headers: cors });
  }

  // Honeypot relleno = bot → 200 silencioso (no guardamos ni delatamos el filtro).
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true }, { headers: cors });
  }

  const email = (body.email || "").trim();
  const formType = (body.formType || "contacto") as ContactFormType;

  if (!FORM_TYPES.has(formType)) {
    return NextResponse.json({ error: "Tipo de formulario no válido." }, { status: 400, headers: cors });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Introduce un email válido." }, { status: 400, headers: cors });
  }
  if (!body.consent) {
    return NextResponse.json(
      { error: "Debes aceptar la política de privacidad para continuar." },
      { status: 400, headers: cors },
    );
  }
  if (formType === "auditoria-gratuita" && !(body.url || "").trim()) {
    return NextResponse.json({ error: "Indica la URL de tu web." }, { status: 400, headers: cors });
  }

  const record = {
    formType,
    receivedAt: new Date().toISOString(),
    email,
    name: body.name?.trim().slice(0, 200) || undefined,
    phone: body.phone?.trim().slice(0, 40) || undefined,
    message: body.message?.trim().slice(0, 4000) || undefined,
    url: body.url?.trim().slice(0, 300) || undefined,
    caso: body.caso?.trim().slice(0, 60) || undefined,
    servicio: body.servicio?.trim().slice(0, 80) || undefined,
    marketingConsent: !!body.marketing,
  };

  try {
    await saveContact(record);

    // Las direcciones de prueba no reciben emails (misma regla que el cron de seguimiento).
    if (!TEST_EMAIL_RE.test(email)) {
      await Promise.all([
        sendContactNotification({ ...record, marketing: record.marketingConsent }),
        sendContactAck({ ...record, marketing: record.marketingConsent }),
      ]);
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("Contact form falló:", (e as Error).message);
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje. Inténtalo de nuevo o escríbenos a hola@soylegal360.es." },
      { status: 500, headers: cors },
    );
  }
}
