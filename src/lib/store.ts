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
  marketingConsent?: boolean; // consentimiento SEPARADO para comunicaciones comerciales
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_LEADS_DB = process.env.NOTION_LEADS_DB;

// Notion permite máx. 2000 caracteres por bloque de texto.
function rt(text: string) {
  return { rich_text: [{ text: { content: (text || "").slice(0, 1990) } }] };
}

// Guarda el lead como una fila en la base de datos de Notion y devuelve el page ID.
async function saveToNotion(r: LeadRecord): Promise<string> {
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
        Comercial: { checkbox: !!r.marketingConsent },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json() as { id: string };
  return data.id;
}

// Actualiza un registro de Notion ya creado con el análisis completo de Claude.
// Llamada en background (fase 2), por eso no lanza si falla — solo loguea.
export async function updateLeadAnalysis(
  pageId: string,
  updates: {
    qualification?: LeadQualification;
    legalSummary?: string;
  },
): Promise<void> {
  if (!NOTION_TOKEN) return;
  const properties: Record<string, unknown> = {};

  if (updates.qualification) {
    properties["Prioridad"] = { select: { name: updates.qualification.tier } };
    properties["Motivo comercial"] = rt(updates.qualification.tierReason);
    properties["Recomendaciones"] = rt(updates.qualification.recommendations.join("\n"));
    properties["Origen"] = { select: { name: updates.qualification.source } };
  }
  if (updates.legalSummary !== undefined) {
    properties["Análisis textos legales"] = rt(updates.legalSummary);
  }

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Notion PATCH ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// Enciende un checkbox de tracking de envío ("Email enviado" / "Seguimiento enviado").
// Best-effort en background: lanza si Notion responde error (el caller decide si loguear).
export async function markLeadFlag(
  pageId: string,
  prop: "Email enviado" | "Seguimiento enviado",
): Promise<void> {
  if (!NOTION_TOKEN) return;
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { [prop]: { checkbox: true } } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Notion flag ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export interface FollowupCandidate {
  pageId: string;
  email: string;
  name?: string;
  domain: string;
  score: number;
  grade: string;
  tier: string;
  recommendations: string[];
  emailSent: boolean; // ¿llegó a enviarse el informe inicial?
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Dominios de las filas de prueba históricas: jamás deben recibir emails.
const TEST_EMAIL_RE = /@(ejemplo\.com|test\.com)$/i;

type NotionProp = {
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  select?: { name: string } | null;
  checkbox?: boolean;
};
const plain = (p?: NotionProp) =>
  (p?.title || p?.rich_text || []).map((t) => t.plain_text).join("");

// Leads con ≥`days` días de antigüedad y sin seguimiento enviado (para el cron diario).
export async function queryFollowupCandidates(days = 3, cap = 20): Promise<FollowupCandidate[]> {
  if (!NOTION_TOKEN || !NOTION_LEADS_DB) return [];
  const before = new Date(Date.now() - days * 86_400_000).toISOString();
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_LEADS_DB}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: cap,
      filter: {
        and: [
          { property: "Recibido", date: { on_or_before: before } },
          { property: "Seguimiento enviado", checkbox: { equals: false } },
        ],
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Notion query ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    results: { id: string; properties: Record<string, NotionProp> }[];
  };
  return data.results
    .map((row) => {
      const p = row.properties;
      return {
        pageId: row.id,
        email: plain(p["Email"]),
        name: plain(p["Nombre"]) || undefined,
        domain: plain(p["Dominio"]),
        score: p["Puntuación"]?.number ?? 0,
        grade: p["Nota"]?.select?.name || "C",
        tier: p["Prioridad"]?.select?.name || "warm",
        recommendations: plain(p["Recomendaciones"]).split("\n").filter(Boolean),
        emailSent: !!p["Email enviado"]?.checkbox,
      };
    })
    .filter((c) => EMAIL_RE.test(c.email) && !TEST_EMAIL_RE.test(c.email) && c.domain);
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
    if (code === "EROFS" || code === "EACCES" || code === "ENOENT") {
      await appendTo(path.join(os.tmpdir(), "auditoria-rgpd-leads"), record);
      return;
    }
    throw e;
  }
}

// Devuelve el Notion page ID (para el update posterior) o null si cayó a fichero.
export async function saveLead(record: LeadRecord): Promise<string | null> {
  // Producción: Notion (persistencia + CRM). Si falla, no perdemos el lead → fichero.
  if (NOTION_TOKEN && NOTION_LEADS_DB) {
    try {
      const pageId = await saveToNotion(record);
      return pageId;
    } catch (e) {
      console.error("Notion falló, guardo en fichero como respaldo:", (e as Error).message);
    }
  }
  await saveToFile(record);
  return null;
}
