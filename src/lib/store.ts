import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { AuditResult } from "@/lib/audit";
import type { LeadContact, LeadQualification } from "@/lib/lead";

export interface LeadRecord {
  id: string;
  receivedAt: string;
  contact: LeadContact;
  audit: {
    finalUrl: string;
    domain: string;
    score: number;
    grade: AuditResult["grade"];
  };
  qualification: LeadQualification;
  legalSummary?: string; // análisis profundo de textos legales (interno, para la abogada)
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_LEADS_DB = process.env.NOTION_LEADS_DB;

// Notion permite máx. 2000 caracteres por bloque de texto.
function rt(text: string) {
  return { rich_text: [{ text: { content: (text || "").slice(0, 1990) } }] };
}

// Guarda el lead como una fila en la base de datos de Notion (= persistencia + CRM).
async function saveToNotion(r: LeadRecord): Promise<void> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_LEADS_DB },
      properties: {
        Email: { title: [{ text: { content: r.contact.email } }] },
        Nombre: rt(r.contact.name || ""),
        "Teléfono": { phone_number: r.contact.phone || null },
        Dominio: rt(r.audit.domain),
        URL: { url: r.audit.finalUrl || null },
        "Puntuación": { number: r.audit.score },
        Nota: { select: { name: r.audit.grade } },
        Prioridad: { select: { name: r.qualification.tier } },
        "Motivo comercial": rt(r.qualification.tierReason),
        Recomendaciones: rt(r.qualification.recommendations.join("\n")),
        Origen: { select: { name: r.qualification.source } },
        Recibido: { date: { start: r.receivedAt } },
        "Análisis textos legales": rt(r.legalSummary || ""),
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// Respaldo a fichero (uso local). En Vercel el FS del proyecto es de solo lectura
// (EROFS) → cae a /tmp (escribible pero EFÍMERO).
const DATA_DIR = process.env.LEADS_DIR || path.join(process.cwd(), "data");

async function appendTo(dir: string, record: LeadRecord): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "leads.jsonl"), JSON.stringify(record) + "\n", "utf8");
}

async function saveToFile(record: LeadRecord): Promise<void> {
  try {
    await appendTo(DATA_DIR, record);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES") {
      await appendTo(path.join(os.tmpdir(), "auditoria-rgpd-leads"), record);
      return;
    }
    throw e;
  }
}

export async function saveLead(record: LeadRecord): Promise<void> {
  // Producción: Notion (persistencia + CRM). Si falla, no perdemos el lead → fichero.
  if (NOTION_TOKEN && NOTION_LEADS_DB) {
    try {
      await saveToNotion(record);
      return;
    } catch (e) {
      console.error("Notion falló, guardo en fichero como respaldo:", (e as Error).message);
    }
  }
  await saveToFile(record);
}
