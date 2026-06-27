import Anthropic from "@anthropic-ai/sdk";
import { BONUS_IDS } from "@/lib/scope";
import type { AuditResult } from "@/lib/audit";

export interface LeadContact {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
}

export type LeadTier = "hot" | "warm" | "cold";

export interface LeadQualification {
  // Interno (para José): prioridad comercial del lead.
  tier: LeadTier;
  tierReason: string;
  // Público (para el visitante): valor que ve tras dejar el email.
  summary: string;
  recommendations: string[];
  // Origen de la cualificación.
  source: "claude" | "fallback";
  model?: string;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Prompt de sistema estable → se cachea para abaratar llamadas repetidas.
const SYSTEM_PROMPT = `Eres el asistente comercial de SoyLegal360, una consultora española especializada en RGPD y cumplimiento legal de webs (S.L. B-88653225).

Recibes el resultado de una auditoría RGPD automática de la web de un visitante que acaba de dejar sus datos de contacto. Tu trabajo tiene dos partes:

1. CUALIFICAR el lead para el equipo comercial (campo interno), con un nivel:
   - "hot": muchos fallos graves (sin textos legales, rastreadores sin consentimiento, sin HTTPS) → riesgo legal alto y venta probable.
   - "warm": fallos moderados o solo mejorables → interés real pero menos urgente.
   - "cold": web casi conforme (nota A/B) → poco que vender ahora.

2. Redactar para el VISITANTE un resumen claro y 3-4 recomendaciones, SOLO a partir de los hallazgos marcados [NÚCLEO] (RGPD/LOPDGDD/LSSI-CE). IGNORA los marcados [CORTESÍA] (cabeceras de seguridad, SPF/DKIM/DMARC): esos van en otro bloque del informe, no aquí. Cada recomendación: qué incumple, el artículo aplicable y por qué importa (riesgo de sanción o reclamación ante la AEPD), en una o dos frases. NO des la solución terminada ni el texto legal ya redactado: el visitante debe entender QUÉ está mal y por qué, pero la corrección (redacción y adaptación de los textos legales a medida) es nuestro servicio. Español de España, tono profesional y cercano, sin alarmismo falso. No inventes hallazgos que no estén en la auditoría. No des asesoramiento jurídico vinculante.

Responde SIEMPRE en JSON válido, sin texto fuera del JSON, con esta forma exacta:
{"tier":"hot|warm|cold","tierReason":"una frase para el equipo comercial","summary":"2-3 frases para el visitante","recommendations":["...","..."]}`;

function auditToText(audit: AuditResult, contact: LeadContact): string {
  const lines = audit.findings.map(
    (f) =>
      `- [${f.severity.toUpperCase()}] [${BONUS_IDS.has(f.id) ? "CORTESÍA" : "NÚCLEO"}] (${f.category}) ${f.label}: ${f.detail}`,
  );
  return [
    `Web auditada: ${audit.finalUrl} (dominio ${audit.domain})`,
    `Puntuación: ${audit.score}/100 (nota ${audit.grade})`,
    `Contacto: ${contact.name || "—"}${contact.company ? " · " + contact.company : ""} · ${contact.email}`,
    "",
    "Hallazgos:",
    ...lines,
  ].join("\n");
}

// Cualificación de respaldo basada en reglas, por si no hay API key o falla la llamada.
// Exportada para que /api/lead pueda usarla en la fase rápida (antes de responder).
export function fallbackQualify(audit: AuditResult): LeadQualification {
  // Recomendaciones (públicas) solo del NÚCLEO: las de cortesía van en su propio bloque.
  const core = audit.findings.filter((f) => !BONUS_IDS.has(f.id));
  const fails = core.filter((f) => f.severity === "fail");
  const warns = core.filter((f) => f.severity === "warn");
  const tier: LeadTier = audit.score < 55 ? "hot" : audit.score < 85 ? "warm" : "cold";
  const recommendations = [...fails, ...warns]
    .slice(0, 4)
    .map((f) => `${f.label}: ${f.detail}`);
  return {
    tier,
    tierReason: `Cualificación automática por puntuación (${audit.score}/100, ${fails.length} fallos).`,
    summary: `Tu web obtiene ${audit.score}/100 (nota ${audit.grade}). Hemos detectado ${fails.length} fallo(s) y ${warns.length} punto(s) mejorable(s) en materia de RGPD.`,
    recommendations: recommendations.length ? recommendations : ["Tu web parte de una buena base. Revisa periódicamente cookies y textos legales para mantener el cumplimiento."],
    source: "fallback",
  };
}

export async function qualifyLead(
  audit: AuditResult,
  contact: LeadContact,
): Promise<LeadQualification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackQualify(audit);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: auditToText(audit, contact) }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(json) as Partial<LeadQualification>;

    const tier: LeadTier = parsed.tier === "hot" || parsed.tier === "cold" ? parsed.tier : "warm";
    return {
      tier,
      tierReason: parsed.tierReason || "Sin motivo proporcionado.",
      summary: parsed.summary || fallbackQualify(audit).summary,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length
        ? parsed.recommendations.slice(0, 5)
        : fallbackQualify(audit).recommendations,
      source: "claude",
      model: MODEL,
    };
  } catch (e) {
    // Cualquier fallo (clave inválida, JSON mal formado, red) → respaldo por reglas.
    console.error("Claude falló, uso fallback por reglas:", (e as Error).message);
    return fallbackQualify(audit);
  }
}
