import { NextRequest, NextResponse, after } from "next/server";
import { auditSite } from "@/lib/audit";
import { logUsoExpress } from "@/lib/uso-express";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// El motor usa los módulos `tls` y `dns` de Node, así que necesita runtime Node (no Edge).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Anti-abuso: la auditoría es costosa (TLS/DNS, hasta 30s). La IP se usa de forma
  // EFÍMERA para limitar (en memoria), no se almacena en ningún sitio.
  const rl = rateLimit(`audit:${clientIp(req)}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas auditorías seguidas. Espera un momento e inténtalo de nuevo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let url: string | undefined;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Falta el parámetro 'url'." }, { status: 400 });
  }

  try {
    const result = await auditSite(url);
    // Registro anónimo tras responder (after garantiza la ejecución en serverless).
    after(() => logUsoExpress(result.grade, result.score, result.domain));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
