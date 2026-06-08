import { NextResponse } from "next/server";
import { analyzeLegal, toPublicTeaser } from "@/lib/legal";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Anti-abuso: el análisis profundo cuesta una llamada a Claude → limitamos por IP.
  const rl = rateLimit(`legal:${clientIp(req)}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let url: string | undefined;
  try {
    url = (await req.json())?.url;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Falta el parámetro 'url'." }, { status: 400 });
  }

  // Modo público: salida ligera (sin citas/correcciones) → respuesta más rápida.
  const analysis = await analyzeLegal(url, { mode: "public" });
  // Sin análisis (sin clave Claude, web no accesible o error) → 204-like: el front usa el check superficial.
  if (!analysis) return NextResponse.json({ available: false });

  // Solo lo público: nunca _quote/_fix/_notes.
  return NextResponse.json({ available: true, teaser: toPublicTeaser(analysis) });
}
