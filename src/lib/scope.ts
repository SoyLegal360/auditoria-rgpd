// Alcance de la auditoría: qué checks son NÚCLEO RGPD/LOPDGDD/LSSI (y parte del
// servicio) frente a los "bonus" de seguridad técnica/correo que revisamos como
// cortesía. Vive en su propio módulo (sin dependencias de Node) para poder
// importarse tanto desde el servidor (audit.ts) como desde el cliente (page.tsx).
export const BONUS_IDS = new Set<string>([
  "ssl-exp",
  "strict-transport-security",
  "x-content-type-options",
  "content-security-policy",
  "referrer-policy",
  "mixed-content",
  "spf",
  "dkim",
  "dmarc",
]);
