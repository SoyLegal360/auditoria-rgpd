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
  section: { marginBottom: 18 },
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
  ctaLink: { fontSize: 9.5, color: GOLD, marginTop: 8, textDecoration: "underline" },
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
  seguridad: "Seguridad (HTTPS/SSL)",
  cookies: "Cookies y rastreadores",
  legal: "Textos legales",
  formularios: "Formularios",
  correo: "Correo electrónico",
};

export interface ReportData {
  domain: string;
  finalUrl: string;
  score: number;
  grade: string;
  summary: string;
  recommendations: string[];
  categories: { key: string; worst: string }[];
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
  const cats = ["seguridad", "cookies", "legal", "formularios", "correo"];
  const categories = cats.map((key) => {
    const findings = audit.findings.filter((f) => f.category === key);
    const worst = findings.reduce((acc, f) => (order[f.severity] > order[acc] ? f.severity : acc), "info");
    return { key, worst };
  });
  return {
    domain: audit.domain,
    finalUrl: audit.finalUrl,
    score: audit.score,
    grade: audit.grade,
    summary,
    recommendations,
    categories,
    legal,
    generatedAt: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
  };
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
          <Text style={styles.domain}>
            {data.domain} · {data.generatedAt}
          </Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNum}>{data.score}</Text>
              <Text style={styles.scoreOf}>/ 100</Text>
            </View>
            <View style={styles.scoreMeta}>
              <Text style={styles.scoreLabel}>Calificación</Text>
              <Text style={[styles.gradeBig, { color: GRADE_COLOR[data.grade] || INK }]}>{data.grade}</Text>
              <Text style={styles.scoreSummary}>{data.summary}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumen por áreas</Text>
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

          {data.legal && data.legal.docs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Análisis de tus textos legales</Text>
              {data.legal.docs.map((d) => (
                <View style={styles.docBlock} key={d.type}>
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
                        <Text style={styles.missing} key={i}>• {m}</Text>
                      ))}
                    </>
                  )}
                </View>
              ))}
              {data.legal.forms.issue && (
                <Text style={styles.missing}>• Formularios: {data.legal.forms.issue}</Text>
              )}
            </View>
          )}

          {data.recommendations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recomendaciones prioritarias</Text>
              {data.recommendations.map((r, i) => (
                <Text style={styles.reco} key={i}>{i + 1}. {r}</Text>
              ))}
            </View>
          )}

          <View style={styles.ctaBox}>
            <Text style={styles.ctaTitle}>¿Quieres dejar tu web 100% conforme?</Text>
            <Text style={styles.ctaText}>
              Con la Adaptación Web RGPD (desde 390€) nuestro equipo legal redacta y certifica
              tus textos legales a medida: Aviso Legal, Política de Privacidad, Política de Cookies y
              consentimiento de formularios. Escríbenos a hola@soylegal360.es o responde a este correo.
            </Text>
            <Link style={styles.ctaLink} src="https://www.soylegal360.es/servicios-proteccion-de-datos/">
              → Ver nuestros servicios de protección de datos en soylegal360.es
            </Link>
          </View>

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
