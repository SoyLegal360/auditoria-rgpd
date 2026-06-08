import Anthropic from "@anthropic-ai/sdk";

// ---------- Tipos ----------
export type LegalDocType = "privacidad" | "cookies" | "aviso-legal";
export type ElementStatus = "presente" | "ausente" | "debil";
export type AnalyzeMode = "public" | "full";

export interface LegalElement {
  id: string;
  label: string;
  status: ElementStatus;
  severity: "alta" | "media" | "baja";
  _quote?: string; // interno (abogada)
  _fix?: string; // interno (abogada)
}

export interface LegalDocAnalysis {
  type: LegalDocType;
  label: string;
  found: boolean;
  readable: boolean;
  url: string | null;
  elements: LegalElement[];
  missingCount: number;
}

export interface FormAnalysis {
  hasForm: boolean;
  preCheckedConsent: boolean; // heurística sobre el HTML
  noConsentCheckbox: boolean;
  linksPrivacy: boolean;
  consentTextQuality: "buena" | "mejorable" | "ausente";
  publicIssue: string | null;
  _notes?: string; // interno
}

export interface LegalAnalysis {
  businessType: "ecommerce" | "servicios" | "informativa";
  docs: LegalDocAnalysis[];
  forms: FormAnalysis;
  source: "claude" | "none";
}

// Proyección PÚBLICA (teaser): sin citas ni correcciones.
export interface LegalTeaserDoc {
  type: LegalDocType;
  label: string;
  found: boolean;
  readable: boolean;
  missingCount: number;
  missing: string[];
}
export interface LegalTeaser {
  businessType: string;
  docs: LegalTeaserDoc[];
  forms: { issue: string | null };
  disclaimer: string;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const DISCLAIMER =
  "Diagnóstico orientativo automático. No sustituye la revisión de un abogado.";

const DOC_LABEL: Record<LegalDocType, string> = {
  privacidad: "Política de Privacidad",
  cookies: "Política de Cookies",
  "aviso-legal": "Aviso Legal",
};

// ---------- Utilidades ----------
function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string, timeoutMs = 10000): Promise<{ finalUrl: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "SoyLegal360-Auditor/1.0 (+https://soylegal360.es)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return { finalUrl: res.url || url, html: await res.text() };
  } catch {
    return null;
  }
}

// Descubre enlaces a los documentos legales a partir del HTML de la home.
export function discoverLegalLinks(homeHtml: string, baseUrl: string): Partial<Record<LegalDocType, string>> {
  const types: LegalDocType[] = ["cookies", "privacidad", "aviso-legal"];
  // El href (la ruta) es la señal fuerte; el texto del enlace, la débil.
  const hrefPat: Record<LegalDocType, RegExp> = {
    cookies: /cookie/i,
    privacidad: /privac/i, // privacidad / privacy (NO "protección de datos", que suele ser página de servicios)
    "aviso-legal": /aviso[-_ ]?legal|legal[-_ ]?notice/i,
  };
  const textPat: Record<LegalDocType, RegExp> = {
    cookies: /cookie/i,
    privacidad: /pol[íi]tica de privacidad|privacy policy/i,
    "aviso-legal": /aviso\s*legal|legal\s*notice/i,
  };

  const candidates: { type: LegalDocType; url: string; score: number }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(homeHtml)) !== null) {
    let abs: string;
    try {
      abs = new URL(m[1], baseUrl).href;
    } catch {
      continue;
    }
    const path = abs.toLowerCase();
    const text = stripHtml(m[2]).toLowerCase();
    for (const type of types) {
      if (hrefPat[type].test(path)) candidates.push({ type, url: abs, score: 2 });
      else if (textPat[type].test(text)) candidates.push({ type, url: abs, score: 1 });
    }
  }

  const out: Partial<Record<LegalDocType, string>> = {};
  for (const type of types) {
    const best = candidates.filter((c) => c.type === type).sort((a, b) => b.score - a.score)[0];
    if (best) out[type] = best.url;
  }
  return out;
}

// Heurística (sin Claude) sobre los formularios del HTML estático.
export function analyzeForms(homeHtml: string): Omit<FormAnalysis, "consentTextQuality" | "_notes" | "publicIssue"> & { consentText: string } {
  const hasForm = /<form\b/i.test(homeHtml);
  const checkboxes = homeHtml.match(/<input\b[^>]*type=["']?checkbox["']?[^>]*>/gi) || [];
  const preChecked = checkboxes.some((c) => /\bchecked\b/i.test(c));
  const lower = stripHtml(homeHtml).toLowerCase();
  const hasConsentText = /(acepto|consiento|he le[íi]do|pol[íi]tica de privacidad|protecci[óo]n de datos)/i.test(lower);
  const linksPrivacy = /pol[íi]tica de privacidad|privacy policy/i.test(homeHtml);
  // contexto de consentimiento (para que Claude valore la calidad del texto)
  const idx = lower.indexOf("política de privacidad");
  const consentText = idx >= 0 ? lower.slice(Math.max(0, idx - 200), idx + 200) : "";
  return {
    hasForm,
    preCheckedConsent: hasForm && preChecked,
    noConsentCheckbox: hasForm && checkboxes.length === 0,
    linksPrivacy,
    consentText,
  };
}

export function inferBusinessType(homeHtml: string): LegalAnalysis["businessType"] {
  if (/carrito|\bcart\b|checkout|tienda|\bshop\b|a[ñn]adir al carrito|comprar ahora/i.test(homeHtml)) return "ecommerce";
  if (/<form\b/i.test(homeHtml)) return "servicios";
  return "informativa";
}

// ---------- Prompt de análisis ----------
const SYSTEM_PROMPT = `Eres un abogado español experto en RGPD, LOPDGDD y LSSI-CE. Analizas los textos legales de una web para detectar deficiencias de cumplimiento, según el tipo de negocio.

Checklist por documento:
- POLÍTICA DE PRIVACIDAD (RGPD arts. 13-14, LOPDGDD): identidad y contacto del responsable; delegado de protección de datos (si aplica); finalidades del tratamiento; base jurídica de cada finalidad; categorías de datos; destinatarios/encargados (hosting, analítica, email mkt, pasarela); transferencias internacionales; plazos de conservación; derechos del interesado y cómo ejercerlos; derecho a reclamar ante la AEPD; origen de los datos si no se obtienen del interesado.
- POLÍTICA DE COOKIES: clasificación y finalidad de las cookies; cookies de terceros; duración; cómo configurar/retirar el consentimiento; coherencia con el banner.
- AVISO LEGAL (LSSI-CE art. 10): denominación y NIF del titular; domicilio; email de contacto; datos registrales si procede; condiciones de uso y propiedad intelectual.

Para FORMULARIOS valora la calidad del texto de consentimiento: que sea afirmativo e inequívoco, que el consentimiento de marketing esté separado del de contacto, y que enlace la política de privacidad.

Reglas: evalúa SOLO lo que aparezca en los textos aportados; si un documento no se aportó o no es legible, márcalo. No inventes. Sé estricto pero justo. Español de España.
IMPORTANTE para acotar la respuesta: en "elements" incluye ÚNICAMENTE los elementos con status "ausente" o "debil" (NO listes los "presente"). Mantén "_quote" y "_fix" en una sola frase breve.

Devuelve SIEMPRE solo JSON válido con esta forma exacta:
{"businessType":"ecommerce|servicios|informativa",
 "docs":[{"type":"privacidad|cookies|aviso-legal","found":true,"readable":true,
   "elements":[{"id":"responsable","label":"Identificación del responsable","status":"presente|ausente|debil","severity":"alta|media|baja","_quote":"cita textual breve o vacío","_fix":"qué añadir/corregir"}]}],
 "forms":{"consentTextQuality":"buena|mejorable|ausente","_notes":"detalle interno","publicIssue":"frase breve para el visitante o null"}}`;

function buildUserContent(
  docs: { type: LegalDocType; url: string | null; text: string; readable: boolean }[],
  forms: ReturnType<typeof analyzeForms>,
  businessType: string,
  mode: AnalyzeMode = "full",
): string {
  const parts: string[] = [`Tipo de negocio (inferido): ${businessType}`, ""];
  if (mode === "public") {
    parts.push(
      'MODO RÁPIDO (teaser público): por cada elemento "ausente"/"debil" devuelve SOLO {id,label,status,severity}. OMITE por completo "_quote" y "_fix" y en forms omite "_notes". Sé conciso.',
      "",
    );
  }
  parts.push("FORMULARIOS (heurística del HTML):");
  parts.push(`- ¿Hay formulario?: ${forms.hasForm}`);
  parts.push(`- ¿Casilla marcada por defecto (premarcada)?: ${forms.preCheckedConsent}`);
  parts.push(`- ¿Formulario sin casilla de consentimiento?: ${forms.noConsentCheckbox}`);
  parts.push(`- Texto de consentimiento detectado: "${forms.consentText || "(ninguno)"}"`);
  parts.push("");
  for (const d of docs) {
    parts.push(`=== DOCUMENTO: ${DOC_LABEL[d.type]} (${d.url || "no encontrado"}) ===`);
    if (!d.url) parts.push("(No se encontró enlace a este documento en la home.)");
    else if (!d.readable) parts.push("(No se pudo leer el contenido — posible carga por JavaScript.)");
    else parts.push(d.text.slice(0, 12000));
    parts.push("");
  }
  return parts.join("\n");
}

// ---------- Orquestador principal ----------
export async function analyzeLegal(
  rawUrl: string,
  opts: { mode?: AnalyzeMode } = {},
): Promise<LegalAnalysis | null> {
  const mode: AnalyzeMode = opts.mode || "full";
  const url = normalizeUrl(rawUrl);
  const home = await fetchPage(url, 12000);
  if (!home) return null;

  const businessType = inferBusinessType(home.html);
  const links = discoverLegalLinks(home.html, home.finalUrl);
  const formsHeur = analyzeForms(home.html);

  const types: LegalDocType[] = ["privacidad", "cookies", "aviso-legal"];
  const docsRaw = await Promise.all(
    types.map(async (type) => {
      const link = links[type];
      if (!link) return { type, url: null as string | null, text: "", readable: false };
      const page = await fetchPage(link, 8000);
      const text = page ? stripHtml(page.html).slice(0, 8000) : "";
      return { type, url: link, text, readable: !!page && text.length > 200 };
    }),
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // sin Claude no hay análisis profundo (la UI usa el check superficial)

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      // El modo público omite citas/correcciones → mucha menos salida → mucha menos latencia.
      max_tokens: mode === "public" ? 1500 : 4000,
      temperature: 0.2,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(docsRaw, formsHeur, businessType, mode) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(text) as {
      businessType?: LegalAnalysis["businessType"];
      docs?: Array<{ type: LegalDocType; found?: boolean; readable?: boolean; elements?: LegalElement[] }>;
      forms?: { consentTextQuality?: FormAnalysis["consentTextQuality"]; _notes?: string; publicIssue?: string | null };
    };

    const docs: LegalDocAnalysis[] = types.map((type) => {
      const raw = docsRaw.find((d) => d.type === type)!;
      const ana = parsed.docs?.find((d) => d.type === type);
      const elements = Array.isArray(ana?.elements) ? ana!.elements : [];
      const missingCount = elements.filter((e) => e.status === "ausente" || e.status === "debil").length;
      return {
        type,
        label: DOC_LABEL[type],
        found: !!raw.url,
        readable: raw.readable,
        url: raw.url,
        elements,
        missingCount,
      };
    });

    const forms: FormAnalysis = {
      hasForm: formsHeur.hasForm,
      preCheckedConsent: formsHeur.preCheckedConsent,
      noConsentCheckbox: formsHeur.noConsentCheckbox,
      linksPrivacy: formsHeur.linksPrivacy,
      consentTextQuality: parsed.forms?.consentTextQuality || (formsHeur.hasForm ? "mejorable" : "ausente"),
      publicIssue: formsHeur.preCheckedConsent
        ? "Detectamos una casilla de consentimiento marcada por defecto: el RGPD exige consentimiento afirmativo (no premarcado)."
        : parsed.forms?.publicIssue ?? null,
      _notes: parsed.forms?._notes,
    };

    return { businessType: parsed.businessType || businessType, docs, forms, source: "claude" };
  } catch (e) {
    console.error("analyzeLegal falló:", (e as Error).message);
    return null;
  }
}

// ---------- Proyección pública (teaser) ----------
export function toPublicTeaser(a: LegalAnalysis): LegalTeaser {
  return {
    businessType: a.businessType,
    docs: a.docs.map((d) => ({
      type: d.type,
      label: d.label,
      found: d.found,
      readable: d.readable,
      missingCount: d.missingCount,
      missing: d.elements.filter((e) => e.status === "ausente" || e.status === "debil").map((e) => e.label),
    })),
    forms: { issue: a.forms.publicIssue },
    disclaimer: DISCLAIMER,
  };
}

// ---------- Resumen interno (para Notion/abogada) ----------
export function toInternalSummary(a: LegalAnalysis): string {
  const lines: string[] = [`Tipo de negocio: ${a.businessType}`, ""];
  for (const d of a.docs) {
    lines.push(`# ${d.label} ${d.found ? (d.readable ? "" : "(no legible)") : "(NO ENCONTRADA)"}`);
    for (const e of d.elements) {
      if (e.status === "presente") continue;
      lines.push(`- [${e.status.toUpperCase()}/${e.severity}] ${e.label}: ${e._fix || ""}`.trim());
    }
    lines.push("");
  }
  lines.push(`# Formularios: consentimiento ${a.forms.consentTextQuality}${a.forms.preCheckedConsent ? " · CASILLA PREMARCADA" : ""}`);
  if (a.forms._notes) lines.push(a.forms._notes);
  return lines.join("\n").slice(0, 1900);
}
