import { promises as dns } from "dns";
import tls from "tls";
import { safeFetch } from "@/lib/safe-fetch";
import { BONUS_IDS } from "@/lib/scope";

export { BONUS_IDS };

export type Severity = "ok" | "warn" | "fail" | "info";

export interface Finding {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
  category: "seguridad" | "cookies" | "legal" | "correo" | "formularios";
}

export interface AuditResult {
  url: string;
  finalUrl: string;
  domain: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  findings: Finding[];
  checkedAt: string;
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Comprueba la fecha de caducidad del certificado SSL abriendo una conexión TLS.
async function getCertExpiry(hostname: string): Promise<Date | null> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        { host: hostname, port: 443, servername: hostname, timeout: 8000 },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          resolve(cert && cert.valid_to ? new Date(cert.valid_to) : null);
        },
      );
      socket.on("error", () => resolve(null));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export const TRACKERS: { name: string; re: RegExp }[] = [
  // OJO: los IDs (G-…, UA-…, GTM-…) van SIN flag /i y con \b: con case-insensitive,
  // "G-[A-Z0-9]{6,}" matchea CSS corriente ("padding-bottom" → "g-bottom") y produce
  // falsos positivos de GA en webs que no lo usan (detectado con soylegal360.es).
  { name: "Google Analytics", re: /gtag\(|google-analytics\.com|\bG-[A-Z0-9]{8,14}\b|\bUA-\d{4,10}-\d{1,4}\b/ },
  { name: "Google Tag Manager", re: /googletagmanager\.com|\bGTM-[A-Z0-9]{4,}\b/ },
  { name: "Meta / Facebook Pixel", re: /connect\.facebook\.net|fbq\(/i },
  { name: "Google Ads / DoubleClick", re: /googleadservices|doubleclick\.net/i },
  { name: "Hotjar", re: /static\.hotjar\.com|\bhj\(/i },
  { name: "TikTok Pixel", re: /analytics\.tiktok\.com|ttq\./i },
  { name: "LinkedIn Insight", re: /snap\.licdn\.com/i },
];

// Formularios externos inyectados por JS (no se ven con el check de <form> estático).
export const FORM_EMBEDS: { name: string; re: RegExp }[] = [
  { name: "Tally", re: /tally\.so/i },
  { name: "HubSpot", re: /hsforms\.net|hs-scripts\.com|js\.hubspot/i },
  { name: "Typeform", re: /typeform\.com/i },
  { name: "Calendly", re: /calendly\.com/i },
  { name: "Mailchimp", re: /list-manage\.com|chimpstatic\.com|mailchimp\.com/i },
  { name: "Google Forms", re: /docs\.google\.com\/forms/i },
  { name: "Jotform", re: /jotform\.com/i },
];

// Recursos de terceros que cargan cookies/transferencias al pintar la página.
const THIRD_PARTY_EMBEDS: { name: string; re: RegExp }[] = [
  { name: "YouTube", re: /youtube\.com\/embed|youtube-nocookie\.com/i },
  { name: "Google Maps", re: /google\.com\/maps\/embed|maps\.googleapis\.com/i },
  { name: "Google Fonts", re: /fonts\.googleapis\.com|fonts\.gstatic\.com/i },
  { name: "Vimeo", re: /player\.vimeo\.com/i },
];

async function txtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

// DKIM no tiene selector fijo → comprobación best-effort de los selectores más comunes
// (TXT v=DKIM1 o un CNAME delegado). Si usa un selector personalizado, puede no detectarse.
async function hasDkim(domain: string): Promise<boolean> {
  const selectors = [
    "default", "google", "selector1", "selector2", "k1", "s1", "s2",
    "dkim", "mail", "resend", "hostingermail-a", "mandrill", "zoho",
  ];
  const checks = selectors.map(async (s) => {
    const name = `${s}._domainkey.${domain}`;
    try {
      const txt = await dns.resolveTxt(name);
      if (txt.some((c) => /v=DKIM1|p=[A-Za-z0-9]/i.test(c.join("")))) return true;
    } catch {
      /* sin TXT */
    }
    try {
      const cname = await dns.resolveCname(name);
      if (cname.length) return true;
    } catch {
      /* sin CNAME */
    }
    return false;
  });
  return (await Promise.all(checks)).some(Boolean);
}

const WEIGHT: Record<Severity, number> = { ok: 0, info: 0, warn: 6, fail: 14 };
// Peso reducido (~1/3) para los checks "bonus": restan, pero no hunden la nota RGPD.
const WEIGHT_BONUS: Record<Severity, number> = { ok: 0, info: 0, warn: 2, fail: 5 };

export async function auditSite(rawUrl: string): Promise<AuditResult> {
  const url = normalizeUrl(rawUrl);
  const findings: Finding[] = [];

  let res: Response;
  let html = "";
  let finalUrl = url;
  try {
    const result = await safeFetch(url, {
      headers: { "User-Agent": "SoyLegal360-Auditor/1.0 (+https://soylegal360.es)" },
      signal: AbortSignal.timeout(15000),
    });
    res = result.res;
    finalUrl = result.finalUrl;
    html = await res.text();
  } catch (e) {
    throw new Error("No se pudo acceder a la web. Revisa que la URL sea correcta y esté online. (" + (e as Error).message + ")");
  }

  const u = new URL(finalUrl);
  const hostname = u.hostname;
  const domain = hostname.replace(/^www\./, "");
  const h = res.headers;
  const htmlLower = html.toLowerCase();

  // ---------- SEGURIDAD ----------
  if (finalUrl.startsWith("https://")) {
    findings.push({ id: "https", category: "seguridad", label: "Conexión cifrada (HTTPS)", severity: "ok", detail: "La web se sirve sobre HTTPS." });
  } else {
    findings.push({ id: "https", category: "seguridad", label: "Conexión cifrada (HTTPS)", severity: "fail", detail: "La web NO usa HTTPS. El RGPD (art. 32) exige medidas de seguridad como el cifrado de las comunicaciones." });
  }

  const exp = await getCertExpiry(hostname);
  if (exp) {
    const days = Math.round((exp.getTime() - Date.now()) / 86400000);
    if (days < 0) findings.push({ id: "ssl-exp", category: "seguridad", label: "Certificado SSL", severity: "fail", detail: "El certificado SSL está CADUCADO." });
    else if (days < 15) findings.push({ id: "ssl-exp", category: "seguridad", label: "Certificado SSL", severity: "warn", detail: `El certificado SSL caduca en ${days} días. Conviene renovarlo.` });
    else findings.push({ id: "ssl-exp", category: "seguridad", label: "Certificado SSL", severity: "ok", detail: `Certificado válido (${days} días hasta caducar).` });
  }

  const headerChecks: { key: string; label: string; tip: string }[] = [
    { key: "strict-transport-security", label: "Cabecera HSTS", tip: "Fuerza siempre HTTPS y evita ataques de degradación." },
    { key: "x-content-type-options", label: "Cabecera X-Content-Type-Options", tip: "Evita ataques de tipo MIME-sniffing." },
    { key: "content-security-policy", label: "Cabecera Content-Security-Policy", tip: "Mitiga inyección de scripts (XSS)." },
    { key: "referrer-policy", label: "Cabecera Referrer-Policy", tip: "Controla qué información de referencia se filtra a terceros." },
  ];
  for (const c of headerChecks) {
    if (h.has(c.key)) findings.push({ id: c.key, category: "seguridad", label: c.label, severity: "ok", detail: "Configurada correctamente." });
    else findings.push({ id: c.key, category: "seguridad", label: c.label, severity: "warn", detail: "No está presente. " + c.tip });
  }

  if (finalUrl.startsWith("https://") && /\b(src|href)=["']http:\/\//i.test(html)) {
    findings.push({
      id: "mixed-content",
      category: "seguridad",
      label: "Contenido mixto (recursos por HTTP)",
      severity: "warn",
      detail: "La página va por HTTPS pero carga recursos por HTTP (contenido mixto). Debilita el cifrado y el navegador puede bloquearlos.",
    });
  }

  // ---------- COOKIES / TRACKERS ----------
  const setCookie = h.get("set-cookie");
  if (setCookie) {
    findings.push({ id: "cookies-load", category: "cookies", label: "Cookies en la primera carga", severity: "warn", detail: "El servidor instala cookies ya en la primera visita. Si no son estrictamente necesarias, deben requerir consentimiento previo (art. 22 LSSI / RGPD)." });
  }

  const foundTrackers = TRACKERS.filter((t) => t.re.test(html)).map((t) => t.name);
  if (foundTrackers.length) {
    findings.push({ id: "trackers", category: "cookies", label: "Rastreadores de terceros", severity: "fail", detail: `Detectados: ${foundTrackers.join(", ")}. Estos rastreadores NO deben cargarse antes de obtener el consentimiento del usuario.` });
  } else {
    findings.push({ id: "trackers", category: "cookies", label: "Rastreadores de terceros", severity: "ok", detail: "No se detectaron rastreadores publicitarios/analíticos comunes en el HTML inicial." });
  }

  const hasBanner = /(cookie|consent|gdpr|rgpd)/i.test(html) && /(aceptar|acepto|rechazar|configurar|consent)/i.test(htmlLower);
  if (foundTrackers.length || setCookie) {
    findings.push({
      id: "banner",
      category: "cookies",
      label: "Banner de consentimiento de cookies",
      severity: hasBanner ? "ok" : "warn",
      detail: hasBanner ? "Se detectan indicios de un banner de cookies." : "No se detecta un banner de consentimiento claro, pese a usar cookies/rastreadores.",
    });
  }

  const foundFormEmbeds = FORM_EMBEDS.filter((f) => f.re.test(html)).map((f) => f.name);
  if (foundFormEmbeds.length) {
    findings.push({
      id: "form-embed",
      category: "formularios",
      label: "Formulario externo embebido",
      severity: "warn",
      detail: `Detectado: ${foundFormEmbeds.join(", ")}. Verifica que el formulario muestre la cláusula informativa, enlace a la política de privacidad y casilla de consentimiento NO premarcada (marketing separado).`,
    });
  }

  const foundEmbeds = THIRD_PARTY_EMBEDS.filter((e) => e.re.test(html)).map((e) => e.name);
  if (foundEmbeds.length) {
    findings.push({
      id: "embeds",
      category: "cookies",
      label: "Recursos de terceros que cargan cookies",
      severity: "warn",
      detail: `Detectado: ${foundEmbeds.join(", ")}. Estos recursos cargan contenido de terceros (y posibles cookies/transferencias) que pueden requerir consentimiento previo.`,
    });
  }

  // ---------- TEXTOS LEGALES ----------
  const legalDocs: { id: string; label: string; re: RegExp }[] = [
    { id: "privacidad", label: "Política de Privacidad", re: /pol[íi]tica\s+de\s+privacidad|privacy[- ]?policy/i },
    { id: "aviso-legal", label: "Aviso Legal (LSSI-CE)", re: /aviso\s+legal|legal[- ]?notice/i },
    { id: "cookies-pol", label: "Política de Cookies", re: /pol[íi]tica\s+de\s+cookies|cookie[- ]?policy/i },
  ];
  for (const doc of legalDocs) {
    const present = doc.re.test(html);
    findings.push({
      id: doc.id,
      category: "legal",
      label: doc.label,
      severity: present ? "ok" : "fail",
      detail: present ? "Referencia encontrada en la web." : `No se encontró enlace a la ${doc.label}. Es legalmente obligatoria.`,
    });
  }

  // ---------- FORMULARIOS ----------
  if (/<form/i.test(html)) {
    const hasCheckbox = /type=["']checkbox["']/i.test(html);
    const hasConsentText = /(acepto|consiento|he le[íi]do|pol[íi]tica de privacidad)/i.test(htmlLower);
    const ok = hasCheckbox && hasConsentText;
    findings.push({
      id: "form-consent",
      category: "formularios",
      label: "Consentimiento en formularios",
      severity: ok ? "ok" : "warn",
      detail: ok ? "Los formularios parecen incluir casilla y texto de consentimiento." : "Hay formularios que podrían recoger datos sin una casilla de consentimiento clara.",
    });
  }

  // ---------- CORREO (SPF / DMARC) ----------
  const spf = (await txtRecords(domain)).find((r) => /v=spf1/i.test(r));
  findings.push({
    id: "spf",
    category: "correo",
    label: "SPF (anti-suplantación de correo)",
    severity: spf ? "ok" : "warn",
    detail: spf ? "Registro SPF presente." : "Sin SPF: facilita que suplanten correos de tu dominio.",
  });
  const dkim = await hasDkim(domain);
  findings.push({
    id: "dkim",
    category: "correo",
    label: "DKIM (firma del correo)",
    severity: dkim ? "ok" : "warn",
    detail: dkim
      ? "Se detecta firma DKIM."
      : "No se detecta DKIM con los selectores comunes. La firma DKIM autentica tus correos y mejora la entrega (puede usar un selector personalizado).",
  });

  const dmarc = (await txtRecords("_dmarc." + domain)).find((r) => /v=DMARC1/i.test(r));
  if (dmarc) {
    const pol = (dmarc.match(/p=\s*(none|quarantine|reject)/i)?.[1] || "").toLowerCase();
    findings.push({
      id: "dmarc",
      category: "correo",
      label: "DMARC (anti-suplantación de correo)",
      severity: pol === "quarantine" || pol === "reject" ? "ok" : "warn",
      detail:
        pol === "quarantine" || pol === "reject"
          ? `DMARC activo en modo "${pol}".`
          : 'DMARC presente pero en modo monitorización (p=none): no protege activamente. Conviene subir a "quarantine" o "reject".',
    });
  } else {
    findings.push({
      id: "dmarc",
      category: "correo",
      label: "DMARC (anti-suplantación de correo)",
      severity: "warn",
      detail: "Sin DMARC: protección anti-phishing incompleta.",
    });
  }

  // ---------- PUNTUACIÓN ----------
  const penalty = findings.reduce(
    (acc, f) => acc + (BONUS_IDS.has(f.id) ? WEIGHT_BONUS : WEIGHT)[f.severity],
    0,
  );
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade: AuditResult["grade"] = score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "E";

  return {
    url,
    finalUrl,
    domain,
    score,
    grade,
    findings,
    checkedAt: new Date().toISOString(),
  };
}
