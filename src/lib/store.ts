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
}

// Directorio de almacenamiento. En local: ./data/leads.jsonl
// NOTA: en Vercel el filesystem es efímero (no persiste entre invocaciones).
// Para producción habrá que migrar a Vercel KV / Postgres / Notion. Ver HANDOFF.
const DATA_DIR = process.env.LEADS_DIR || path.join(process.cwd(), "data");

async function appendTo(dir: string, record: LeadRecord): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "leads.jsonl"), JSON.stringify(record) + "\n", "utf8");
}

export async function saveLead(record: LeadRecord): Promise<void> {
  try {
    await appendTo(DATA_DIR, record);
  } catch (e) {
    // En Vercel el filesystem del proyecto es de solo lectura (EROFS). Caemos a
    // /tmp (escribible pero EFÍMERO) para no romper la UX en la preview.
    // PENDIENTE: migrar a Vercel KV/Postgres para persistencia real en producción.
    if ((e as NodeJS.ErrnoException).code === "EROFS" || (e as NodeJS.ErrnoException).code === "EACCES") {
      await appendTo(path.join(os.tmpdir(), "auditoria-rgpd-leads"), record);
      return;
    }
    throw e;
  }
}
