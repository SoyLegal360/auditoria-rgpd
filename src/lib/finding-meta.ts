// Metadata por hallazgo (artículo, riesgo y "qué hacer"): FUENTE ÚNICA compartida
// por la web (page.tsx) y el PDF (report-pdf.tsx). Sin dependencias de Node para
// poder importarse desde cliente y servidor.
export type FindingRisk = "critico" | "alto" | "medio" | "bajo";
export interface FindingMeta {
  article: string;
  fix: string;
  risk: FindingRisk;
}

export const FINDING_META: Partial<Record<string, FindingMeta>> = {
  "https":                     { article: "Art. 32 RGPD",               risk: "critico", fix: "Activa HTTPS en tu hosting (certificado SSL gratuito con Let's Encrypt). Es imprescindible." },
  "ssl-exp":                   { article: "Art. 32 RGPD",               risk: "alto",    fix: "Renueva el certificado SSL desde el panel de tu hosting antes de que caduque." },
  "strict-transport-security": { article: "Art. 32 RGPD",               risk: "medio",   fix: "Añade la cabecera HTTP: Strict-Transport-Security: max-age=31536000; includeSubDomains" },
  "x-content-type-options":    { article: "Art. 32 RGPD",               risk: "bajo",    fix: "Añade la cabecera HTTP: X-Content-Type-Options: nosniff" },
  "content-security-policy":   { article: "Art. 32 RGPD",               risk: "medio",   fix: "Configura una Content-Security-Policy básica para restringir scripts no autorizados." },
  "referrer-policy":           { article: "Art. 32 RGPD",               risk: "bajo",    fix: "Añade la cabecera HTTP: Referrer-Policy: strict-origin-when-cross-origin" },
  "mixed-content":             { article: "Art. 32 RGPD",               risk: "medio",   fix: "Cambia todas las URLs de recursos (imágenes, scripts, CSS) de http:// a https://." },
  "cookies-load":              { article: "Art. 22 LSSI / RGPD",        risk: "alto",    fix: "Bloquea las cookies no técnicas hasta que el usuario las acepte en el banner." },
  "trackers":                  { article: "Art. 6 RGPD / Art. 22 LSSI", risk: "critico", fix: "Verifica que tu gestor de consentimiento (Cookiebot, CookieYes, OneTrust…) bloquea GA/GTM y demás rastreadores hasta el consentimiento; si no usas ninguno, configúralo para ello." },
  "banner":                    { article: "Art. 22 LSSI / Guía AEPD",   risk: "alto",    fix: "Implementa un banner con opciones Aceptar, Rechazar y Configurar de igual visibilidad (Guía AEPD sobre cookies)." },
  "form-embed":                { article: "Art. 13 RGPD",               risk: "medio",   fix: "Comprueba que el formulario externo muestre cláusula informativa y casilla de consentimiento no premarcada." },
  "embeds":                    { article: "Arts. 6 y 49 RGPD",          risk: "medio",   fix: "Usa versiones sin cookies (p.ej. youtube-nocookie.com) o bloquea el embed hasta el consentimiento." },
  "privacidad":                { article: "Art. 13 RGPD",               risk: "critico", fix: "Redacta y publica una Política de Privacidad conforme al art. 13 RGPD (responsable, base jurídica, derechos…)." },
  "aviso-legal":               { article: "Art. 10 LSSI-CE",            risk: "alto",    fix: "Añade el Aviso Legal con denominación, NIF, domicilio y email de contacto (y datos del Registro Mercantil si eres sociedad)." },
  "cookies-pol":               { article: "Art. 22 LSSI-CE",            risk: "alto",    fix: "Publica una Política de Cookies con el inventario completo (nombre, tipo, finalidad, duración de cada cookie)." },
  "form-consent":              { article: "Art. 7 RGPD",                risk: "alto",    fix: "Añade una casilla no premarcada con enlace a la política de privacidad en cada formulario de recogida de datos." },
  "spf":                       { article: "RFC 7208 / Seg. correo",     risk: "medio",   fix: 'Añade un registro TXT SPF en tu DNS: v=spf1 include:[tu-proveedor].com ~all' },
  "dkim":                      { article: "RFC 6376 / Seg. correo",     risk: "medio",   fix: "Activa DKIM en el panel de tu proveedor de correo (Hostinger → Email → Configuración DKIM)." },
  "dmarc":                     { article: "RFC 7489 / Seg. correo",     risk: "bajo",    fix: 'Crea el registro DNS: _dmarc.tudominio.com TXT "v=DMARC1; p=quarantine; rua=mailto:admin@tudominio.com"' },
};
