import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BONUS_IDS } from "@/lib/scope";
import { FINDING_META } from "@/lib/finding-meta";
import type { AuditResult } from "@/lib/audit";
import type { LegalTeaser } from "@/lib/legal";
import { LOGO_COLOR_DATA_URI } from "@/lib/logo-data";

// Paleta de marca SoyLegal360.
const NAVY = "#06152c";
const GOLD = "#c9a96e";
const INK = "#1c2733";
const MUTED = "#5b6b7b";
const LINE = "#e4e8ee";

const GRADE_COLOR: Record<string, string> = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#d97706",
  D: "#ea580c",
  E: "#dc2626",
};

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 64, fontFamily: "Helvetica", fontSize: 10, color: INK },
  header: {
    backgroundColor: "#ffffff", paddingTop: 26, paddingBottom: 16, paddingHorizontal: 40,
    marginBottom: 24, borderBottomWidth: 2, borderBottomColor: GOLD,
  },
  logo: { width: 112, height: 63, marginLeft: -6 },
  headerSub: { color: MUTED, fontSize: 8.5, marginTop: 8, letterSpacing: 1.5, textTransform: "uppercase" },
  body: { paddingHorizontal: 40 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 },
  domain: { fontSize: 11, color: MUTED, marginBottom: 18 },
  scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: 22, gap: 18 },
  scoreBox: {
    width: 92, height: 92, borderRadius: 8, borderWidth: 2, borderColor: GOLD,
    alignItems: "center", justifyContent: "center",
  },
  scoreNum: { fontSize: 30, fontFamily: "Helvetica-Bold", color: NAVY },
  scoreOf: { fontSize: 8, color: MUTED },
  gradeBig: { fontSize: 26, fontFamily: "Helvetica-Bold" },
  scoreMeta: { flex: 1 },
  scoreLabel: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  scoreSummary: { fontSize: 10.5, color: INK, marginTop: 4, lineHeight: 1.4 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 8,
    borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 4,
  },
  catRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
  catName: { fontSize: 10 },
  catBadge: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  docBlock: { marginBottom: 10 },
  docTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 3 },
  docStatus: { fontSize: 9, color: MUTED, marginBottom: 4 },
  missing: { fontSize: 9.5, color: INK, marginBottom: 2, paddingLeft: 8, lineHeight: 1.35 },
  reco: { fontSize: 9.5, color: INK, marginBottom: 4, paddingLeft: 8, lineHeight: 1.35 },
  ctaBox: { backgroundColor: "#f6f1e7", borderLeftWidth: 3, borderLeftColor: GOLD, padding: 12, marginTop: 6, borderRadius: 4 },
  ctaTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 3 },
  ctaText: { fontSize: 9.5, color: INK, lineHeight: 1.4 },
  ctaHighlight: { fontFamily: "Helvetica-Bold", color: GOLD },
  ctaLink: { fontSize: 9.5, color: GOLD, marginTop: 8, textDecoration: "underline" },
  intro: { fontSize: 9.5, color: MUTED, lineHeight: 1.5, marginBottom: 12 },
  semRow: { flexDirection: "row", gap: 3, marginTop: 5, marginBottom: 6 },
  semCell: { flex: 1, paddingVertical: 3, borderRadius: 3, alignItems: "center" },
  semText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  bulletRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3.5, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.35 },
  noteBox: { backgroundColor: "#fbf6ef", borderLeftWidth: 2, borderLeftColor: GOLD, padding: 8, marginTop: 4 },
  noteText: { fontSize: 8.5, color: INK, lineHeight: 1.45 },
  bold: { fontFamily: "Helvetica-Bold" },
  about: { fontSize: 8, color: MUTED, lineHeight: 1.45, marginTop: 10 },
  disclaimer: { fontSize: 8, color: MUTED, marginTop: 14, lineHeight: 1.4, fontStyle: "italic" },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: NAVY,
    paddingVertical: 12, paddingHorizontal: 40, flexDirection: "row", justifyContent: "space-between",
  },
  footerText: { color: "#9fb0c4", fontSize: 8 },
});

const SEV_LABEL: Record<string, { t: string; c: string }> = {
  ok: { t: "Correcto", c: "#16a34a" },
  warn: { t: "Mejorable", c: "#d97706" },
  fail: { t: "Atención", c: "#dc2626" },
  info: { t: "Info", c: MUTED },
};

const CAT_LABEL: Record<string, string> = {
  seguridad: "Seguridad (HTTPS)",
  cookies: "Cookies y rastreadores",
  legal: "Textos legales",
  formularios: "Formularios",
  correo: "Correo electrónico",
};

// Etiquetas del bloque "Seguridad adicional" (checks fuera del núcleo RGPD).
const EXTRA_LABEL: Record<string, string> = {
  seguridad: "Cifrado y cabeceras de seguridad",
  correo: "Protección del correo (SPF/DKIM/DMARC)",
};

export interface ReportData {
  domain: string;
  finalUrl: string;
  score: number;
  grade: string;
  summary: string;
  recommendations: string[];
  categories: { key: string; worst: string }[];
  extra: { key: string; worst: string }[];
  technical: { label: string; fix: string; severity: "fail" | "warn" }[];
  legal?: LegalTeaser | null;
  generatedAt: string;
}

// Construye los datos del informe a partir de la auditoría + teaser legal.
export function buildReportData(
  audit: AuditResult,
  summary: string,
  recommendations: string[],
  legal: LegalTeaser | null,
): ReportData {
  // Para cada categoría, el peor hallazgo (fail > warn > ok/info).
  const order: Record<string, number> = { fail: 3, warn: 2, ok: 1, info: 0 };
  const worstOf = (fs: AuditResult["findings"]) =>
    fs.reduce((acc, f) => (order[f.severity] > order[acc] ? f.severity : acc), "info");

  // Núcleo RGPD: solo los checks que SÍ forman parte del cumplimiento/servicio.
  const cats = ["seguridad", "cookies", "legal", "formularios", "correo"];
  const categories = cats
    .map((key) => {
      const findings = audit.findings.filter((f) => f.category === key && !BONUS_IDS.has(f.id));
      return { key, worst: worstOf(findings), n: findings.length };
    })
    .filter((c) => c.n > 0)
    .map(({ key, worst }) => ({ key, worst }));

  // Seguridad adicional: checks "bonus" agrupados (cabeceras/cifrado y correo).
  const extraKeys = ["seguridad", "correo"];
  const extra = extraKeys
    .map((key) => {
      const findings = audit.findings.filter((f) => f.category === key && BONUS_IDS.has(f.id));
      return { key, worst: worstOf(findings), n: findings.length };
    })
    .filter((c) => c.n > 0)
    .map(({ key, worst }) => ({ key, worst }));

  // Mejoras técnicas (cortesía): los hallazgos "bonus" con fallo/mejora, con su
  // arreglo concreto. NO es lo que vendemos → aquí sí damos la solución hecha.
  const technical = audit.findings
    .filter((f) => BONUS_IDS.has(f.id) && (f.severity === "fail" || f.severity === "warn"))
    .map((f) => ({ label: f.label, fix: FINDING_META[f.id]?.fix || f.detail, severity: f.severity as "fail" | "warn" }));

  return {
    domain: audit.domain,
    finalUrl: audit.finalUrl,
    score: audit.score,
    grade: audit.grade,
    summary,
    recommendations,
    categories,
    extra,
    technical,
    legal,
    generatedAt: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

// Helvetica (WinAnsi) del PDF no incluye la flecha "→": la cambiamos por ">" para
// que no salga como carácter roto en los textos dinámicos (recomendaciones, arreglos).
// Además, @react-pdf/renderer NO interpreta Markdown: si la IA devuelve **negrita**,
// `código` o # encabezados, saldrían los caracteres literales. Los limpiamos aquí.
const pdfSafe = (s: string) =>
  (s || "")
    .replace(/[→⟶➝➔]/g, ">")
    .replace(/\*\*(.+?)\*\*/g, "$1") // **negrita** -> texto (no soportado en el PDF)
    .replace(/\*\*/g, "") // asteriscos dobles sueltos
    .replace(/`([^`]+)`/g, "$1") // `código` -> texto
    .replace(/^\s{0,3}#{1,6}\s+/gm, ""); // # encabezados Markdown

const SEV_DOT: Record<string, string> = { fail: "#dc2626", warn: "#d97706" };
const GRADES = ["A", "B", "C", "D", "E"];

// Escala A-E con la nota actual resaltada (semáforo de cumplimiento).
function Semaforo({ grade }: { grade: string }) {
  return (
    <View style={styles.semRow}>
      {GRADES.map((g) => {
        const active = g === grade;
        return (
          <View
            key={g}
            style={[
              styles.semCell,
              active
                ? { backgroundColor: GRADE_COLOR[g] || NAVY, borderWidth: 1.5, borderColor: NAVY }
                : { backgroundColor: "#eef1f5" },
            ]}
          >
            <Text style={[styles.semText, { color: active ? "#ffffff" : MUTED }]}>{g}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Viñeta con punto de color según severidad (rojo fallo / ámbar mejorable).
function Bullet({ severity, children }: { severity: "fail" | "warn"; children: string }) {
  return (
    <View style={styles.bulletRow} wrap={false}>
      <View style={[styles.bulletDot, { backgroundColor: SEV_DOT[severity] || MUTED }]} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function ReportDoc({ data }: { data: ReportData }) {
  return (
    <Document
      title={`Diagnóstico RGPD · ${data.domain}`}
      author="SoyLegal360"
      subject="Informe de diagnóstico de cumplimiento RGPD"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.logo} src={LOGO_COLOR_DATA_URI} />
          <Text style={styles.headerSub}>Diagnóstico de cumplimiento RGPD</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.h1}>Informe de diagnóstico RGPD</Text>
          <Text style={[styles.domain, { marginBottom: 10 }]}>
            {data.domain} · {data.generatedAt}
          </Text>

          <Text style={styles.intro}>
            Este informe resume el estado de cumplimiento de {data.domain} en protección de datos
            (RGPD y LOPDGDD) y normativa digital (LSSI-CE), a partir de un análisis automático.
            Señalamos qué revisar, por qué importa y con qué prioridad. Es un diagnóstico orientativo.
          </Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNum}>{data.score}</Text>
              <Text style={styles.scoreOf}>/ 100</Text>
            </View>
            <View style={styles.scoreMeta}>
              <Text style={styles.scoreLabel}>Calificación</Text>
              <Semaforo grade={data.grade} />
              <Text style={styles.scoreSummary}>{pdfSafe(data.summary)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} minPresenceAhead={70}>Resumen por áreas</Text>
            {data.categories.map((c) => {
              const sev = SEV_LABEL[c.worst] || SEV_LABEL.info;
              return (
                <View style={styles.catRow} key={c.key}>
                  <Text style={styles.catName}>{CAT_LABEL[c.key] || c.key}</Text>
                  <Text style={[styles.catBadge, { color: sev.c }]}>{sev.t}</Text>
                </View>
              );
            })}
          </View>

          {data.recommendations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} minPresenceAhead={70}>Prioridades de cumplimiento (RGPD · LOPDGDD · LSSI-CE)</Text>
              {data.recommendations.map((r, i) => (
                <Text style={styles.reco} key={i}>{i + 1}. {pdfSafe(r)}</Text>
              ))}
              <View style={styles.noteBox} wrap={false}>
                <Text style={styles.noteText}>
                  <Text style={styles.bold}>Por qué importa: </Text>
                  el incumplimiento del RGPD, la LOPDGDD y la LSSI-CE puede ser sancionado por la AEPD.
                  El procedimiento puede iniciarse por la reclamación de un afectado (un cliente o un
                  ex-trabajador descontento, incluso un competidor) o de oficio por la propia AEPD.
                </Text>
              </View>
            </View>
          )}

          {data.legal && data.legal.docs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} minPresenceAhead={70}>Análisis de tus textos legales</Text>
              {data.legal.note && (
                <Text style={[styles.docStatus, { marginBottom: 8 }]}>{pdfSafe(data.legal.note)}</Text>
              )}
              {data.legal.docs.map((d) => (
                <View style={styles.docBlock} key={d.type} wrap={false}>
                  <Text style={styles.docTitle}>{d.label}</Text>
                  {!d.found ? (
                    <Text style={styles.docStatus}>No se ha localizado este documento en la web.</Text>
                  ) : !d.readable ? (
                    <Text style={styles.docStatus}>Documento detectado pero no legible (posible carga por JavaScript).</Text>
                  ) : d.missingCount === 0 ? (
                    <Text style={styles.docStatus}>Sin deficiencias destacadas en el diagnóstico orientativo.</Text>
                  ) : (
                    <>
                      <Text style={styles.docStatus}>{d.missingCount} elemento(s) a revisar:</Text>
                      {d.missing.map((m, i) => (
                        <Bullet key={i} severity={m.severity}>{pdfSafe(m.label)}</Bullet>
                      ))}
                    </>
                  )}
                </View>
              ))}
              {data.legal.forms.issue && (
                <Bullet severity="warn">{`Formularios: ${pdfSafe(data.legal.forms.issue)}`}</Bullet>
              )}
            </View>
          )}

          {data.extra.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} minPresenceAhead={70}>Seguridad adicional (cortesía)</Text>
              <Text style={[styles.docStatus, { marginBottom: 6 }]}>
                Comprobaciones técnicas fuera del alcance RGPD que revisamos como valor añadido.
              </Text>
              {data.extra.map((c) => {
                const sev = SEV_LABEL[c.worst] || SEV_LABEL.info;
                return (
                  <View style={styles.catRow} key={c.key}>
                    <Text style={styles.catName}>{EXTRA_LABEL[c.key] || c.key}</Text>
                    <Text style={[styles.catBadge, { color: sev.c }]}>{sev.t}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {data.technical.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} minPresenceAhead={70}>Mejoras técnicas (cortesía)</Text>
              <Text style={[styles.docStatus, { marginBottom: 6 }]}>
                Fuera del núcleo RGPD, pero las dejamos resueltas como valor añadido.
              </Text>
              {data.technical.map((t, i) => (
                <Bullet key={i} severity={t.severity}>{`${pdfSafe(t.label)}: ${pdfSafe(t.fix)}`}</Bullet>
              ))}
            </View>
          )}

          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle} minPresenceAhead={70}>Próximos pasos</Text>
            <Text style={styles.reco}>1. Corrige primero las prioridades de cumplimiento (RGPD, LOPDGDD y LSSI-CE).</Text>
            <Text style={styles.reco}>2. Aplica las mejoras técnicas de cortesía cuando puedas.</Text>
            <Text style={styles.reco}>3. ¿Prefieres que lo hagamos por ti? Escríbenos y lo dejamos conforme.</Text>
          </View>

          <View style={styles.ctaBox} wrap={false}>
            <Text style={styles.ctaTitle}>¿Quieres dejar tu web 100% conforme?</Text>
            <Text style={styles.ctaText}>
              Con la <Text style={styles.ctaHighlight}>Adaptación Web RGPD (desde 390 €)</Text> nuestro
              equipo legal redacta y certifica tus textos legales a medida: Aviso Legal, Política de
              Privacidad, Política de Cookies y consentimiento de formularios. Escríbenos a
              hola@soylegal360.es o responde a este correo.
            </Text>
            <Link style={styles.ctaLink} src="https://www.soylegal360.es/servicios-proteccion-de-datos/">
              Ver nuestros servicios de protección de datos en soylegal360.es
            </Link>
          </View>

          <Text style={styles.about}>
            <Text style={styles.bold}>Sobre SoyLegal360: </Text>
            consultoría española de protección de datos (RGPD, LOPDGDD, LSSI-CE) y AI Act para pymes,
            autónomos y particulares. Cumplimiento real para negocios reales, sin plantillas genéricas.
          </Text>

          <Text style={styles.disclaimer}>
            {data.legal?.disclaimer ||
              "Diagnóstico orientativo automático. No sustituye la revisión de un abogado."}{" "}
            Este informe se ha generado de forma automatizada a partir del análisis de la web indicada
            y no constituye asesoramiento jurídico ni un dictamen vinculante.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>SoyLegal360 · soylegal360.es</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDoc data={data} />);
}
