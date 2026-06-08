import { NextResponse } from "next/server";
import { analyzeLegal, toPublicTeaser } from "@/lib/legal";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let url: string | undefined;
  try {
    url = (await req.json())?.url;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Falta el parámetro 'url'." }, { status: 400 });
  }

  const analysis = await analyzeLegal(url);
  // Sin análisis (sin clave Claude, web no accesible o error) → 204-like: el front usa el check superficial.
  if (!analysis) return NextResponse.json({ available: false });

  // Solo lo público: nunca _quote/_fix/_notes.
  return NextResponse.json({ available: true, teaser: toPublicTeaser(analysis) });
}
