import { NextRequest, NextResponse } from "next/server";
import { auditSite } from "@/lib/audit";
import { logUsoExpress } from "@/lib/uso-express";

// El motor usa los módulos `tls` y `dns` de Node, así que necesita runtime Node (no Edge).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
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
    void logUsoExpress(result.grade, result.score); // analítica anónima best-effort (sin await)
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
