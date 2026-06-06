import { promises as fs } from "fs";
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
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

export async function saveLead(record: LeadRecord): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(LEADS_FILE, JSON.stringify(record) + "\n", "utf8");
}
