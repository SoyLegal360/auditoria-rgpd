// Analítica de demanda ANÓNIMA de ClaudIA: registra SOLO {Tema, Fecha} de cada pregunta del
// usuario, para saber qué se demanda (incluida la gente que no deja datos). Sin mensaje, sin
// email, sin id de sesión → no es dato personal, no requiere consentimiento. Best-effort: si
// falla o no hay token, no pasa nada (no rompe el chat).

const NOTION_TOKEN = process.env.NOTION_TOKEN;
// ID de la base "Demanda · ClaudIA". No es un secreto (sin el token de Notion es inservible);
// por eso va en código y no en env, para que funcione sin configurar nada más en Vercel.
const DEMANDA_DB = process.env.NOTION_DEMANDA_DB || "9db25cc0b28241db995a69db502d4312";

export type Tema =
  | "Brecha o robo de datos"
  | "Auditoría (web/RGPD/IA)"
  | "Adaptación al RGPD"
  | "Cumplimiento de IA (AI Act)"
  | "DPO / Responsable de IA"
  | "Revisión de contratos"
  | "Ejercicio de derechos"
  | "Otro"
  | "Saludo / sin tema";

// Reglas en ORDEN de prioridad (lo más específico/urgente primero). El texto se normaliza
// (minúsculas, sin tildes) antes de comparar, así que los patrones van sin tildes.
const REGLAS: Array<[Tema, RegExp]> = [
  ["Brecha o robo de datos", /\b(brecha|fuga de datos|filtracion|hacke|ransomware|ciberataque|me han robado|nos han robado|robado el|incidente de seguridad|breach|data leak|hacked|stolen)\b/],
  ["Ejercicio de derechos", /\b(moros|asnef|derecho al olvido|me borren|borrar mis datos|suprimir mis|supresion|que me saquen|spam|publicidad no deseada|llamadas no deseadas|ejercer mis derechos|salir de un fichero|aparezco en internet|right to be forgotten)\b/],
  ["DPO / Responsable de IA", /\b(dpo|dpd|delegado de proteccion|delegado de datos|data protection officer|responsable de ia|delegado de ia)\b/],
  ["Revisión de contratos", /\b(contrato|contratos|encargado de tratamiento|clausula|clausulas|revisar un acuerdo|contract review)\b/],
  ["Cumplimiento de IA (AI Act)", /(\binteligencia artificial\b|\bai act\b|\bia act\b|reglamento de ia|reglamento ia|\bchatbot\b|sistema de ia|uso de ia|cumplimiento de ia)/],
  ["Adaptación al RGPD", /\b(adaptar|adaptacion|cumplir el rgpd|cumplir rgpd|textos legales|politica de privacidad|aviso legal|cookies|cookiebot|consentimiento|lopd|lssi|poner en regla|estar en regla)\b/],
  ["Auditoría (web/RGPD/IA)", /\b(auditor|auditoria|diagnostico|revisar mi web|revisar la web|cumple mi web|analizar mi web|analiza mi web|audit)\b/],
];

const SALUDOS = /^(hola|buenas|buenos dias|buenas tardes|hey|hi|hello|bon dia|bones|gracias|gracies|thanks|thank you|adios|ok|vale)\b/;

// Normaliza: minúsculas, vocales sin tilde, espacios colapsados. Reemplazo explícito de
// caracteres precompuestos (evita depender del rango de marcas de combinación Unicode).
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function clasificarTema(text: string): Tema {
  const t = norm(text);
  if (!t || t.length < 3) return "Saludo / sin tema";
  for (const [tema, re] of REGLAS) {
    if (re.test(t)) return tema;
  }
  // Mensajes muy cortos o saludos → sin tema; el resto, demanda sin categorizar.
  if (SALUDOS.test(t) || t.length < 12) return "Saludo / sin tema";
  return "Otro";
}

// Registra una fila anónima en "Demanda · ClaudIA". No lanza: best-effort.
export async function logDemanda(userText: string): Promise<void> {
  if (!NOTION_TOKEN) return;
  const tema = clasificarTema(userText);
  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, sin hora
  try {
    await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: DEMANDA_DB },
        properties: {
          Evento: { title: [{ text: { content: tema } }] },
          Tema: { select: { name: tema } },
          Fecha: { date: { start: hoy } },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // analítica best-effort: si Notion falla, no afecta al chat.
  }
}
