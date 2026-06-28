import Anthropic from "@anthropic-ai/sdk";
import { safeFetch } from "@/lib/safe-fetch";
import { TRACKERS, FORM_EMBEDS } from "@/lib/audit";

// ---------- Tipos ----------
export type LegalDocType = "privacidad" | "cookies" | "aviso-legal" | "condiciones";
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
  missing: { label: string; severity: "fail" | "warn" }[];
}
export interface LegalTeaser {
  businessType: string;
  docs: LegalTeaserDoc[];
  forms: { issue: string | null };
  note: string;
  disclaimer: string;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Caché en memoria por (modo, dominio): evita repetir llamadas a Claude en
// re-auditorías del mismo dominio (ahorro de coste + anti-abuso). Best-effort,
// por instancia serverless (no distribuido). TTL 6h.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const analysisCache = new Map<string, { at: number; data: LegalAnalysis }>();

const DISCLAIMER =
  "Diagnóstico orientativo automático. No sustituye la revisión de un abogado.";

const DOC_LABEL: Record<LegalDocType, string> = {
  privacidad: "Política de Privacidad",
  cookies: "Política de Cookies",
  "aviso-legal": "Aviso Legal",
  condiciones: "Condiciones de Contratación",
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
    const { res, finalUrl } = await safeFetch(url, {
      headers: { "User-Agent": "SoyLegal360-Auditor/1.0 (+https://soylegal360.es)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return { finalUrl, html: await res.text() };
  } catch {
    return null;
  }
}

// Descubre enlaces a los documentos legales a partir del HTML de la home.
export function discoverLegalLinks(homeHtml: string, baseUrl: string): Partial<Record<LegalDocType, string>> {
  const types: LegalDocType[] = ["cookies", "privacidad", "aviso-legal", "condiciones"];
  // El href (la ruta) es la señal fuerte; el texto del enlace, la débil.
  const hrefPat: Record<LegalDocType, RegExp> = {
    cookies: /cookie/i,
    privacidad: /privac/i, // privacidad / privacy (NO "protección de datos", que suele ser página de servicios)
    "aviso-legal": /aviso[-_ ]?legal|legal[-_ ]?notice/i,
    condiciones: /condiciones|t[eé]rminos|terminos|\bterms\b|contrataci/i,
  };
  const textPat: Record<LegalDocType, RegExp> = {
    cookies: /cookie/i,
    privacidad: /pol[íi]tica de privacidad|privacy policy/i,
    "aviso-legal": /aviso\s*legal|legal\s*notice/i,
    condiciones: /condiciones\s*(generales|de\s*(contrataci[óo]n|venta|uso))|t[eé]rminos\s*y\s*condiciones|terms\s*(and|&)\s*conditions/i,
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

// Señales reales de la home (título, descripción, encabezados) para que Claude
// clasifique negocio y SECTOR con evidencia, no solo con el regex anterior.
export function extractHomeSignals(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ||
    "";
  const heads = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter(Boolean);
  return [stripHtml(title), stripHtml(desc), ...heads].filter(Boolean).join(" · ").slice(0, 600);
}

// Enlace a la página de contacto (donde suele vivir el formulario real).
export function discoverContactLink(homeHtml: string, baseUrl: string): string | null {
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let best: { url: string; score: number } | null = null;
  while ((m = re.exec(homeHtml)) !== null) {
    let abs: string;
    try {
      abs = new URL(m[1], baseUrl).href;
    } catch {
      continue;
    }
    const score = /cont[aá]ct/i.test(abs.toLowerCase())
      ? 2
      : /cont[aá]ct/i.test(stripHtml(m[2]))
        ? 1
        : 0;
    if (score && (!best || score > best.score)) best = { url: abs, score };
  }
  return best?.url || null;
}

// Bloques <form>…</form> reales (home + contacto) con sus señales POR FORMULARIO,
// para que Claude evalúe la cláusula de primera capa sobre el texto del formulario
// y no sobre la página entera (una casilla del banner de cookies no cuenta).
interface FormBlock {
  page: "home" | "contacto";
  checkboxes: number;
  preChecked: boolean;
  linksPrivacy: boolean;
  text: string;
}

function extractFormBlocks(html: string, page: FormBlock["page"], max = 3): FormBlock[] {
  const blocks = html.match(/<form\b[\s\S]*?<\/form>/gi) || [];
  return blocks.slice(0, max).map((b) => {
    const checkboxes = b.match(/<input\b[^>]*type=["']?checkbox["']?[^>]*>/gi) || [];
    return {
      page,
      checkboxes: checkboxes.length,
      preChecked: checkboxes.some((c) => /\bchecked\b/i.test(c)),
      linksPrivacy: /privac/i.test(b),
      text: stripHtml(b).slice(0, 1200),
    };
  });
}

// ---------- Prompt de análisis ----------
const SYSTEM_PROMPT = `Eres un abogado español experto en RGPD, LOPDGDD y LSSI-CE. Analizas los textos legales de una web para detectar deficiencias de cumplimiento, según el tipo de negocio.

Checklist por documento:
- POLÍTICA DE PRIVACIDAD (RGPD arts. 13-14, LOPDGDD): identidad y contacto del responsable; delegado de protección de datos (SOLO según las reglas de abajo); finalidades del tratamiento; base jurídica de cada finalidad; categorías de datos; destinatarios/encargados (hosting, analítica, email mkt, pasarela); transferencias internacionales (SOLO según las reglas de abajo); plazos de conservación; derechos del interesado y cómo ejercerlos; derecho a reclamar ante la AEPD; origen de los datos si no se obtienen del interesado.
- POLÍTICA DE COOKIES: clasificación y finalidad de las cookies; cookies de terceros; duración; cómo configurar/retirar el consentimiento; coherencia con el banner.
- AVISO LEGAL (LSSI-CE art. 10): denominación y NIF del titular; domicilio; email de contacto; datos registrales si procede; condiciones de uso y propiedad intelectual.
- CONDICIONES DE CONTRATACIÓN / T&C (SOLO ecommerce; LSSI arts. 27-28 y RDL 1/2007 de consumidores): proceso de compra paso a paso; precio con IVA y gastos de envío; medios de pago; plazos de entrega; derecho de desistimiento de 14 días y modelo de formulario; garantías legales; resolución de conflictos con enlace a la plataforma ODR de la UE; política de devoluciones/reembolsos.

REGLAS DE EXIGENCIA CONDICIONADA (para NO exigir de más):
- DPD (art. 37 RGPD y art. 34.1 LOPDGDD): exige el delegado de protección de datos SOLO si el negocio encaja en los obligados del art. 34.1 LOPDGDD (colegios profesionales, centros docentes, centros sanitarios, aseguradoras, entidades financieras o de inversión, distribuidoras/comercializadoras de energía, operadores de telecomunicaciones/ISP, prestadores que elaboren perfiles o publicidad a gran escala, empresas de seguridad privada…) o si trata categorías especiales del art. 9 a gran escala. Si no hay indicios de eso, la ausencia de mención al DPD NO es una deficiencia: NO la incluyas. Si hay indicios razonables pero no concluyentes, inclúyelo con status "debil", severity "baja" y label "Delegado de Protección de Datos (verificar si aplica)".
- TRANSFERENCIAS INTERNACIONALES (arts. 44-49 RGPD): exígelas SOLO si hay indicios en los datos aportados (rastreadores detectados en la web, o encargados/proveedores extracomunitarios mencionados en los propios textos: Google, Meta, Mailchimp, AWS…). Sin indicios, su ausencia NO es deficiencia.
- DATOS REGISTRALES (art. 10.1.b LSSI, aviso legal): exígelos SOLO si el titular es una persona jurídica inscribible en el Registro Mercantil (denominación social tipo S.L., S.A., S.L.U., S. Coop., o CIF de letra A/B…). Si el titular es persona física o autónomo (nombre y apellidos, sin denominación social ni CIF), su ausencia NO es deficiencia: NO la incluyas. El NIF/DNI sí es obligatorio siempre (art. 10.1.e), también para autónomos.
- DATO PRESENTE EN OTRO DOCUMENTO: si un dato obligatorio (p. ej. email de contacto o NIF) falta en el documento analizado pero aparece en OTRO de los documentos legales aportados del mismo sitio, no lo trates como inexistente: márcalo con status "debil" y severity "baja", e indica en "_fix" en qué documento sí aparece y la norma que lo exige SEGÚN el documento: el email y el NIF se exigen en el AVISO LEGAL por la LSSI-CE (art. 10.1.a y 10.1.e); en la POLÍTICA DE PRIVACIDAD el RGPD (art. 13.1.a) solo pide "datos de contacto" e "identidad" del responsable (no el email ni el NIF de forma literal).
- ESTRUCTURA POR FINALIDAD (no marcar de más): las CATEGORÍAS DE DATOS y los PLAZOS DE CONSERVACIÓN pueden estar descritos por finalidad dentro del apartado de finalidades (p. ej. "se tratan datos identificativos y de contacto… que se conservarán durante la vigencia de la relación y los plazos de prescripción"). Si están así, considéralos CUMPLIDOS: NO los marques como ausentes por no tener un apartado o tabla propios. La remisión a "los plazos de prescripción legal" es una forma VÁLIDA de indicar la conservación; NO exijas plazos en años concretos.
- COOKIES (no marcar de más): NO exijas mencionar Google Tag Manager: es un contenedor de etiquetas que normalmente no instala cookies propias; márcalo solo si hay evidencia de que las instala. Si la política remite a una declaración o listado automático de cookies (p. ej. el generado por Cookiebot u otro CMP, que el HTML estático no muestra) con titular, finalidad y duración, considera CUMPLIDO el inventario de cookies aunque no veas la tabla.
- GESTOR DE CONSENTIMIENTO / CONSENT MODE como mitigante: si los textos o los RASTREADORES DETECTADOS indican un gestor de consentimiento (Cookiebot, CookieYes, OneTrust, Complianz, Iubenda, Didomi… o Google Consent Mode) o que los rastreadores solo cargan tras el consentimiento, NO marques "rastreadores sin consentimiento previo" como deficiencia grave: como mucho una nota de "verificar" (no es confirmable sin cargar la web).

Para FORMULARIOS, evalúa los bloques de formulario reales aportados contra la cláusula informativa de primera capa (criterio AEPD): identidad del responsable; finalidad; base jurídica; derechos; enlace a la política de privacidad (segunda capa); consentimiento afirmativo con casilla NO premarcada; consentimiento de marketing en casilla SEPARADA de la de contacto. Si el formulario es un embed externo cargado por JavaScript (Tally, HubSpot…), NO lo evalúes como deficiencia: indícalo en "publicIssue"/"_notes" como pendiente de revisión manual (no es evaluable sin navegador).

Transversales a revisar cuando apliquen: tratamiento de datos de menores (art. 7 LOPDGDD: consentimiento ≥14 años y control de edad); categorías especiales de datos (art. 9 RGPD: salud, ideología, etc. → consentimiento explícito y cláusula reforzada); uso de píxeles/SDK de redes sociales o publicidad (Meta, TikTok, Google Ads…) que deben informarse en privacidad/cookies y requieren consentimiento previo.

Usa las SEÑALES DE LA HOME para confirmar o corregir el tipo de negocio y deducir el SECTOR (sanitario, educación, finanzas, infancia…); aplica los transversales y la regla del DPD según ese sector.

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
  ctx: { homeSignals: string; trackers: string[]; formBlocks: FormBlock[]; formEmbeds: string[] },
): string {
  const parts: string[] = [`Tipo de negocio (inferido por regex, corrígelo si las señales dicen otra cosa): ${businessType}`, ""];
  if (mode === "public") {
    parts.push(
      'MODO RÁPIDO (teaser público): por cada elemento "ausente"/"debil" devuelve SOLO {id,label,status,severity}. OMITE por completo "_quote" y "_fix" y en forms omite "_notes". Sé conciso.',
      "",
    );
  }
  parts.push(`SEÑALES DE LA HOME: ${ctx.homeSignals || "(sin señales)"}`);
  parts.push(`RASTREADORES DETECTADOS EN LA WEB: ${ctx.trackers.length ? ctx.trackers.join(", ") : "ninguno"}`);
  parts.push("");
  parts.push("FORMULARIOS (heurística del HTML):");
  parts.push(`- ¿Hay formulario?: ${forms.hasForm}`);
  parts.push(`- ¿Casilla marcada por defecto (premarcada)?: ${forms.preCheckedConsent}`);
  parts.push(`- ¿Formulario sin casilla de consentimiento?: ${forms.noConsentCheckbox}`);
  parts.push(`- Texto de consentimiento detectado: "${forms.consentText || "(ninguno)"}"`);
  if (ctx.formEmbeds.length) {
    parts.push(
      `- Formulario externo embebido por JavaScript: ${ctx.formEmbeds.join(", ")} (NO evaluable sin navegador → pendiente de revisión manual, no deficiencia).`,
    );
  }
  for (const [i, fb] of ctx.formBlocks.entries()) {
    parts.push("");
    parts.push(
      `--- FORMULARIO ${i + 1} (página: ${fb.page} · casillas: ${fb.checkboxes} · premarcada: ${fb.preChecked} · enlaza privacidad: ${fb.linksPrivacy}) ---`,
    );
    parts.push(fb.text || "(formulario sin texto visible)");
  }
  parts.push("");
  for (const d of docs) {
    parts.push(`=== DOCUMENTO: ${DOC_LABEL[d.type]} (${d.url || "no encontrado"}) ===`);
    if (!d.url) parts.push("(No se encontró enlace a este documento en la home.)");
    else if (!d.readable) parts.push("(No se pudo leer el contenido — posible carga por JavaScript.)");
    // La privacidad es el documento largo: cap mayor para no cortar conservación/derechos/AEPD.
    else parts.push(d.text.slice(0, d.type === "privacidad" ? 20000 : 12000));
    parts.push("");
  }
  return parts.join("\n");
}

// ---------- Refinado por reglas (cruce entre documentos del propio sitio) ----------
// Email y NIF se exigen en varios documentos (aviso legal Y, de hecho, privacidad).
// Si faltan en uno pero el visitante los tiene en otro, es un dato MAL COLOCADO,
// no inexistente → bajamos el tono y lo explicamos (evita el "pero si está en mi web").
const EMAIL_DETECT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// DNI (8 díg+letra), NIE (X/Y/Z+7 díg+letra) o CIF (letra+7 díg+control).
const NIF_DETECT = /\b(?:[XYZ]?\d{7,8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J])\b/i;
// Indicios de persona jurídica inscribible en el Registro Mercantil.
const SOCIEDAD_DETECT = /\bS\.?\s?L\.?(?:\s?U\.?)?\b|\bS\.?\s?A\.?\b|sociedad\s+(?:limitada|an[óo]nima)|\bS\.?\s?Coop\.?\b|\b[AB]\d{8}\b/i;

interface CrossRefs {
  ownEmail: Set<LegalDocType>; // documentos que SÍ contienen un email
  ownNif: Set<LegalDocType>; // documentos que SÍ contienen un NIF/DNI/CIF
  isSociedad: boolean; // ¿el titular es persona jurídica inscribible en el RM?
}

function detectCrossRefs(docsRaw: { type: LegalDocType; text: string }[]): CrossRefs {
  const ownEmail = new Set<LegalDocType>();
  const ownNif = new Set<LegalDocType>();
  let isSociedad = false;
  for (const d of docsRaw) {
    if (EMAIL_DETECT.test(d.text)) ownEmail.add(d.type);
    if (NIF_DETECT.test(d.text)) ownNif.add(d.type);
    if (SOCIEDAD_DETECT.test(d.text)) isSociedad = true;
  }
  return { ownEmail, ownNif, isSociedad };
}

function otherDocsLabel(set: Set<LegalDocType>, exclude: LegalDocType): string {
  const names = [...set].filter((t) => t !== exclude).map((t) => DOC_LABEL[t]);
  return names.length ? names.join(" y ") : "";
}

// Cita y severidad del cruce SEGÚN el documento: el email/NIF son exigencia de la
// LSSI-CE (art. 10) en el AVISO LEGAL; en la POLÍTICA DE PRIVACIDAD lo que pide el
// RGPD (art. 13.1.a) son "datos de contacto" del responsable (no el email literal).
function crossRefNote(
  kind: "email" | "nif",
  type: LegalDocType,
  where: string,
): { label: string; severity: LegalElement["severity"] } {
  if (kind === "email") {
    if (type === "aviso-legal")
      return { label: `Email de contacto: consta en tu ${where}, pero la LSSI-CE (art. 10.1.a) exige que figure también en el aviso legal.`, severity: "baja" };
    if (type === "privacidad")
      return { label: `Datos de contacto del responsable: tu email consta en tu ${where}; el RGPD (art. 13.1.a) pide datos de contacto en la política de privacidad (vale email u otro canal efectivo).`, severity: "baja" };
    return { label: `Email de contacto: consta en tu ${where}.`, severity: "baja" };
  }
  if (type === "aviso-legal")
    return { label: `NIF/DNI del titular: consta en tu ${where}, pero la LSSI-CE (art. 10.1.e) exige que figure también en el aviso legal.`, severity: "baja" };
  if (type === "privacidad")
    return { label: `Identidad del responsable: el RGPD (art. 13.1.a) pide la identidad, no el NIF; tu NIF consta en tu ${where}.`, severity: "baja" };
  return { label: `NIF/DNI del titular: consta en tu ${where}.`, severity: "baja" };
}

// Aplica las reglas de cruce/encaje a los elementos que devolvió Claude para un documento.
function refineElements(type: LegalDocType, elements: LegalElement[], cross: CrossRefs): LegalElement[] {
  const out: LegalElement[] = [];
  for (const e of elements) {
    const hay = `${e.label || ""} ${e.id || ""}`.toLowerCase();
    const isEmail = /e-?mail|correo/.test(hay);
    const isNif = /\bnif\b|\bdni\b|identificaci[óo]n fiscal/.test(hay);
    const isRegistral = /registr/.test(hay);

    // Datos registrales (art. 10.1.b LSSI): solo para sociedades inscribibles en el RM.
    if (isRegistral && !cross.isSociedad) continue;

    // Email presente en OTRO documento del sitio → mal colocado, no ausente.
    // La cita depende del documento: LSSI-CE (aviso legal) vs RGPD (privacidad).
    if (isEmail && !cross.ownEmail.has(type)) {
      const where = otherDocsLabel(cross.ownEmail, type);
      if (where) {
        const note = crossRefNote("email", type, where);
        out.push({ ...e, status: "debil", severity: note.severity, label: note.label });
        continue;
      }
    }
    // NIF/DNI presente en OTRO documento del sitio → mal colocado, no ausente.
    if (isNif && !cross.ownNif.has(type)) {
      const where = otherDocsLabel(cross.ownNif, type);
      if (where) {
        const note = crossRefNote("nif", type, where);
        out.push({ ...e, status: "debil", severity: note.severity, label: note.label });
        continue;
      }
    }
    out.push(e);
  }
  return out;
}

// ---------- Orquestador principal ----------
export async function analyzeLegal(
  rawUrl: string,
  opts: { mode?: AnalyzeMode } = {},
): Promise<LegalAnalysis | null> {
  const mode: AnalyzeMode = opts.mode || "full";
  const url = normalizeUrl(rawUrl);

  // Caché por dominio (normalizado sin www) → no repetimos la llamada a Claude.
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    /* dominio inválido → seguimos sin caché */
  }
  const key = `${mode}:${domain}`;
  if (domain) {
    const hit = analysisCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  }

  const home = await fetchPage(url, 12000);
  if (!home) return null;

  const businessType = inferBusinessType(home.html);
  const links = discoverLegalLinks(home.html, home.finalUrl);
  const formsHeur = analyzeForms(home.html);
  const homeSignals = extractHomeSignals(home.html);
  const trackers = TRACKERS.filter((t) => t.re.test(home.html)).map((t) => t.name);

  // T&C/condiciones solo aplican (y se exigen) a tiendas online.
  const types: LegalDocType[] =
    businessType === "ecommerce"
      ? ["privacidad", "cookies", "aviso-legal", "condiciones"]
      : ["privacidad", "cookies", "aviso-legal"];

  // La página de contacto (formulario real) se descarga en paralelo con los documentos.
  const contactPromise = (async () => {
    const link = discoverContactLink(home.html, home.finalUrl);
    if (!link || link.replace(/\/+$/, "") === home.finalUrl.replace(/\/+$/, "")) return null;
    return fetchPage(link, 8000);
  })();

  const [docsRaw, contact] = await Promise.all([
    Promise.all(
      types.map(async (type) => {
        const link = links[type];
        if (!link) return { type, url: null as string | null, text: "", readable: false };
        const page = await fetchPage(link, 8000);
        // La privacidad es el documento largo → cap de descarga mayor.
        const cap = type === "privacidad" ? 22000 : 15000;
        const text = page ? stripHtml(page.html).slice(0, cap) : "";
        return { type, url: link, text, readable: !!page && text.length > 200 };
      }),
    ),
    contactPromise,
  ]);

  const formBlocks = [
    ...extractFormBlocks(home.html, "home"),
    ...(contact ? extractFormBlocks(contact.html, "contacto") : []),
  ].slice(0, 3);
  const formEmbeds = FORM_EMBEDS.filter(
    (f) => f.re.test(home.html) || (contact ? f.re.test(contact.html) : false),
  ).map((f) => f.name);

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
      messages: [
        {
          role: "user",
          content: buildUserContent(docsRaw, formsHeur, businessType, mode, {
            homeSignals,
            trackers,
            formBlocks,
            formEmbeds,
          }),
        },
      ],
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

    const cross = detectCrossRefs(docsRaw);
    const docs: LegalDocAnalysis[] = types.map((type) => {
      const raw = docsRaw.find((d) => d.type === type)!;
      const ana = parsed.docs?.find((d) => d.type === type);
      const elements = refineElements(type, Array.isArray(ana?.elements) ? ana!.elements : [], cross);
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

    const analysis: LegalAnalysis = {
      businessType: parsed.businessType || businessType,
      docs,
      forms,
      source: "claude",
    };
    if (domain) analysisCache.set(key, { at: Date.now(), data: analysis });
    return analysis;
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
      missing: d.elements
        .filter((e) => e.status === "ausente" || e.status === "debil")
        .map((e) => ({ label: e.label, severity: e.status === "ausente" ? ("fail" as const) : ("warn" as const) })),
    })),
    forms: { issue: a.forms.publicIssue },
    note: "Analizamos cada documento por separado: un dato puede existir en tu web pero faltar en el documento concreto donde la ley exige que aparezca.",
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
