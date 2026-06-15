import { runChatStream, type ChatMessage, type PageContext } from "@/lib/chat";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { dailyBudget } from "@/lib/budget";

export const runtime = "nodejs";
export const maxDuration = 30;

// El widget vive en la web estática (otro origen) y postea cross-origin.
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

// Topes de coste/abuso.
const MAX_MESSAGES = 24; // turnos en la conversación (12 idas y venidas)
const MAX_MSG_CHARS = 1500; // longitud por mensaje
const GLOBAL_DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT || 800); // presupuesto global/día

const HANDOFF_REPLY =
  "Ahora mismo no puedo seguir la conversación. Escríbenos por WhatsApp (wa.me/34645668235) o desde el formulario de /contacto/ y el equipo te responde en menos de 48 horas hábiles.";

// Respuesta NDJSON de una sola línea (mismo formato que el stream) para los cortes tempranos.
function ndLine(req: Request, obj: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj) + "\n", {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/x-ndjson; charset=utf-8", ...extra },
  });
}
const handoff = { type: "done" as const, reply: HANDOFF_REPLY, cta: "handoff" as const };

export async function POST(req: Request) {
  // 1) Rate-limit por IP (multi-turno → algo más alto que el formulario).
  const rl = rateLimit(`chat:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return ndLine(req, handoff, 429, { "Retry-After": String(rl.retryAfter) });

  let body: {
    messages?: { role?: string; content?: string }[];
    pageContext?: PageContext;
    website?: string; // honeypot
  };
  try {
    body = await req.json();
  } catch {
    return ndLine(req, handoff, 400);
  }

  // 2) Honeypot relleno = bot → respuesta neutra, sin llamar al modelo.
  if (body.website && body.website.trim()) return ndLine(req, handoff);

  // 3) Validación del historial.
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: (m.content as string).slice(0, MAX_MSG_CHARS),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return ndLine(req, handoff, 400);
  }

  // 4) Presupuesto global diario (best-effort por instancia). Si se supera → handoff limpio.
  const budget = dailyBudget("chat:global", GLOBAL_DAILY_LIMIT);
  if (!budget.ok) return ndLine(req, handoff);

  const pageContext: PageContext | undefined = body.pageContext
    ? {
        path: typeof body.pageContext.path === "string" ? body.pageContext.path.slice(0, 120) : undefined,
        title: typeof body.pageContext.title === "string" ? body.pageContext.title.slice(0, 160) : undefined,
      }
    : undefined;

  // 5) Stream NDJSON: una línea JSON por evento ({type:"delta"|"done"}).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of runChatStream(messages, pageContext)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        console.error("Chat route stream error:", (e as Error).message);
        controller.enqueue(encoder.encode(JSON.stringify(handoff) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
