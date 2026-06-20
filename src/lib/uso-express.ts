// Registro ANÓNIMO del uso de la Auditoría Web Express (app.soylegal360.es).
// Sin cookies, sin URL auditada, sin datos personales: solo {Fecha, Hora, Nota, Puntuación}.
// Es un agregado anónimo → no es dato personal, no requiere consentimiento. Best-effort:
// si falla o no hay token, no afecta a la auditoría. Mismo patrón que demanda.ts.

const NOTION_TOKEN = process.env.NOTION_TOKEN;
// ID de la base "⚡ Uso · Auditoría Express". No es un secreto (sin el token es inservible).
const USO_DB = process.env.NOTION_USO_EXPRESS_DB || "21f8c5fa0899493e86cb915f664cc532";

export async function logUsoExpress(grade: string, score: number, domain?: string): Promise<void> {
  if (!NOTION_TOKEN) return;
  const ahora = new Date();
  const hoy = ahora.toISOString().slice(0, 10); // YYYY-MM-DD
  const hora = parseInt(
    new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", hourCycle: "h23" }).format(ahora),
    10,
  );
  try {
    await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: USO_DB },
        properties: {
          "Auditoría": { title: [{ text: { content: `Express (${grade})` } }] },
          Fecha: { date: { start: hoy } },
          Hora: { number: hora },
          Nota: { select: { name: grade } },
          "Puntuación": { number: score },
          // Dominio auditado (sobre el sitio, no sobre el usuario; sin IP ni datos personales).
          ...(domain ? { Dominio: { rich_text: [{ text: { content: domain.slice(0, 120) } }] } } : {}),
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // analítica best-effort: si Notion falla, no afecta a la auditoría.
  }
}
