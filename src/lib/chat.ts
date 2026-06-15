import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, SERVICIOS } from "@/lib/chat-kb";

// Haiku: barato y de sobra para un concierge/FAQ. Override por env si hace falta.
const MODEL = process.env.ANTHROPIC_MODEL_CHAT || "claude-haiku-4-5";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PageContext {
  path?: string;
  title?: string;
}

export interface LeadPrefill {
  nombre?: string;
  email?: string;
  motivo?: string;
  servicio?: string; // servicio de interés (una de las opciones del catálogo Notion)
}

export interface ChatResult {
  reply: string;
  cta?: "handoff" | "lead_form";
  prefill?: LeadPrefill; // datos que el modelo ya tiene, para prerrellenar el formulario
  source: "claude" | "fallback";
}

// System prompt estable (persona + guardrails + KB) → cacheado para abaratar cada turno.
const SYSTEM_PROMPT = buildSystemPrompt();

// Única herramienta: pedir al widget que MUESTRE el formulario de contacto con casilla de
// consentimiento. El modelo NO guarda nada; el lead solo se registra cuando el visitante
// marca la casilla y envía el formulario (acto afirmativo, trazable — POST /api/contact).
const LEAD_TOOL: Anthropic.Tool = {
  name: "solicitar_datos_contacto",
  description:
    "Cuando el visitante quiere que el equipo le contacte, llama a esta herramienta para mostrarle un formulario breve con casilla de consentimiento. Pasa los datos que ya tengas de la conversación (nombre, email, motivo) para prerrellenarlo. NO registras nada tú: el visitante completará y aceptará la política en el formulario.",
  input_schema: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre del visitante, si lo ha dicho" },
      email: { type: "string", description: "Email, si lo ha dicho" },
      motivo: { type: "string", description: "Resumen en una frase de lo que necesita" },
      servicio: {
        type: "string",
        enum: SERVICIOS,
        description: "Servicio de interés, SOLO si está claro por la conversación. Omitir si no lo está.",
      },
    },
    required: [],
  },
};

const HANDOFF_REPLY =
  "Ahora mismo tengo mucha demanda. Para no hacerte esperar, escríbenos por WhatsApp (wa.me/34645668235) o desde el formulario de /contacto/ y el equipo te responde en menos de 48 horas hábiles.";

function pageContextBlock(ctx?: PageContext): string {
  if (!ctx || (!ctx.path && !ctx.title)) return "";
  const parts = [ctx.title && `título: ${ctx.title}`, ctx.path && `ruta: ${ctx.path}`]
    .filter(Boolean)
    .join(" · ");
  return `El visitante está navegando esta página de la web (${parts}). Tenlo en cuenta para dar contexto, pero no lo menciones salvo que ayude.`;
}


export async function runChat(
  messages: ChatMessage[],
  pageContext?: PageContext,
): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { reply: HANDOFF_REPLY, cta: "handoff", source: "fallback" };
  }

  const client = new Anthropic({ apiKey });
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const ctxBlock = pageContextBlock(pageContext);
  if (ctxBlock) system.push({ type: "text", text: ctxBlock });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.3,
      system,
      tools: [LEAD_TOOL],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    let reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const toolUse = msg.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === "solicitar_datos_contacto",
    );

    let cta: ChatResult["cta"];
    let prefill: LeadPrefill | undefined;
    if (toolUse) {
      // El modelo solo pide mostrar el formulario; la captación real (con consentimiento
      // marcado) la hace el widget contra /api/contact. Aquí no se guarda nada.
      cta = "lead_form";
      const args = toolUse.input as LeadPrefill;
      prefill = {
        nombre: (args.nombre || "").toString().slice(0, 200) || undefined,
        email: (args.email || "").toString().slice(0, 200) || undefined,
        motivo: (args.motivo || "").toString().slice(0, 400) || undefined,
        servicio: SERVICIOS.indexOf((args.servicio || "").toString()) >= 0 ? args.servicio : undefined,
      };
      if (!reply) {
        reply =
          "Genial. Déjame tus datos aquí abajo y el equipo te escribirá en menos de 48 horas hábiles.";
      }
    }

    if (!reply) {
      reply =
        "Cuéntame en qué te puedo ayudar sobre protección de datos o cumplimiento de IA, o escríbenos por WhatsApp (wa.me/34645668235).";
    }

    return { reply, cta, prefill, source: "claude" };
  } catch (e) {
    console.error("Chat: Claude falló:", (e as Error).message);
    return { reply: HANDOFF_REPLY, cta: "handoff", source: "fallback" };
  }
}
