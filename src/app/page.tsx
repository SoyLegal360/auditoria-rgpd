"use client";

import { useEffect, useState } from "react";
import type { AuditResult, Finding, Severity } from "@/lib/audit";
import type { LegalTeaser } from "@/lib/legal";

const SEV_STYLE: Record<Severity, { dot: string; accent: string; label: string }> = {
  ok: { dot: "bg-emerald-500", accent: "finding-ok", label: "Correcto" },
  warn: { dot: "bg-amber-500", accent: "finding-warn", label: "Mejorable" },
  fail: { dot: "bg-red-500", accent: "finding-fail", label: "Fallo" },
  info: { dot: "bg-zinc-400", accent: "finding-info", label: "Info" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-lime-400",
  C: "text-amber-400",
  D: "text-orange-400",
  E: "text-red-400",
};

const CATEGORIES: { key: Finding["category"]; label: string; icon: string }[] = [
  { key: "seguridad", label: "Seguridad", icon: "🔒" },
  { key: "cookies", label: "Cookies y rastreadores", icon: "🍪" },
  { key: "legal", label: "Textos legales", icon: "📄" },
  { key: "formularios", label: "Formularios", icon: "📝" },
  { key: "correo", label: "Correo electrónico", icon: "✉️" },
];

const TECH_CHIPS = ["HTTPS · SSL", "Cookies", "Rastreadores", "Textos legales", "SPF · DMARC"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la auditoría.");
      setResult(data as AuditResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-ink">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(201,169,110,0.18)] bg-[#06152c]/70 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center justify-between gap-4 px-6">
          <a href="https://soylegal360.es" aria-label="SoyLegal360 inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/soylegal360_logo_blanco_footer.svg" alt="SoyLegal360" className="block h-9 w-auto" />
          </a>
          <nav className="flex items-center gap-5">
            <a
              href="https://soylegal360.es"
              className="hidden font-sans text-sm font-bold text-white/80 transition-colors hover:text-gold sm:inline"
            >
              Volver a soylegal360.es
            </a>
            <a href="#auditar" className="btn-gold">
              Auditar mi web
            </a>
          </nav>
        </div>
      </header>

      {/* Hero + formulario */}
      <section className="hero-pinstripe relative overflow-hidden px-6 py-16 text-center text-white sm:py-20">
        <div className="tech-grid" aria-hidden="true" />
        <div className="gold-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <p className="eyebrow">RGPD · LOPDGDD · LSSICE · AI Act</p>
          <h1 className="mx-auto mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            ¿Tu web cumple el <span className="italic text-gold">RGPD</span>?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
            Analiza gratis tu sitio web en segundos: cookies, textos legales, seguridad y
            protección del correo. Recibe un informe con lo que debes corregir.
          </p>

          {/* Chips técnicos */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {TECH_CHIPS.map((c) => (
              <span key={c} className="tech-chip">
                <span className="text-gold">▹</span>
                {c}
              </span>
            ))}
          </div>

          <form
            id="auditar"
            onSubmit={runAudit}
            className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="tudominio.com"
              className="h-[46px] flex-1 rounded-lg border border-white/20 bg-white/10 px-4 font-mono text-base text-white placeholder-white/40 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
            <button type="submit" disabled={loading} className="btn-gold">
              {loading ? "Analizando…" : "Auditar gratis"}
            </button>
          </form>
          {error && <p className="mt-4 font-sans text-sm font-medium text-red-300">{error}</p>}
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        {loading && <Scanner url={url} />}
        {result && <Report result={result} />}
      </main>

      <Footer />
    </div>
  );
}

function Scanner({ url }: { url: string }) {
  const steps = [
    "Conectando con el servidor…",
    "Comprobando HTTPS y certificado SSL…",
    "Detectando cookies y rastreadores…",
    "Buscando textos legales…",
    "Verificando SPF y DMARC…",
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), 1200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="fade-up glass-card rounded-2xl p-6 sm:p-8">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
        Auditando
      </p>
      <p className="mt-1 break-all font-mono text-lg text-white">{url || "tu web"}</p>
      <div className="scanbar mt-5" />
      <p className="mt-4 font-mono text-sm text-muted">{steps[step]}</p>
    </section>
  );
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(Math.round(p * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (shown / 100) * C;
  const stroke =
    score >= 75 ? "#10b981" : score >= 55 ? "#c9a96e" : score >= 35 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="score-ring h-full w-full -rotate-90">
        <circle className="track" cx="60" cy="60" r={R} fill="none" strokeWidth="9" />
        <circle
          className="value"
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="9"
          stroke={stroke}
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold text-white">{shown}</span>
        <span className={`font-serif text-lg font-black leading-none ${GRADE_COLOR[grade]}`}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function Report({ result }: { result: AuditResult }) {
  const fails = result.findings.filter((f) => f.severity === "fail").length;
  const warns = result.findings.filter((f) => f.severity === "warn").length;

  const [legal, setLegal] = useState<{ loading: boolean; teaser: LegalTeaser | null }>({
    loading: true,
    teaser: null,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/legal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.finalUrl || result.url }),
        });
        const data = await res.json();
        if (!cancelled) setLegal({ loading: false, teaser: data.available ? data.teaser : null });
      } catch {
        if (!cancelled) setLegal({ loading: false, teaser: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  return (
    <section className="fade-up glass-card rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 border-b border-line pb-6 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Informe RGPD de
          </p>
          <p className="mt-1 break-all font-mono text-xl font-medium text-white">{result.domain}</p>
          <p className="mt-2 font-sans text-sm text-muted">
            <span className="font-semibold text-red-600">{fails} fallos</span> ·{" "}
            <span className="font-semibold text-amber-600">{warns} mejorables</span>
          </p>
        </div>
        <ScoreRing score={result.score} grade={result.grade} />
      </div>

      <div className="mt-6 space-y-8">
        {CATEGORIES.map((cat) => {
          const items = result.findings.filter((f) => f.category === cat.key);
          if (!items.length) return null;
          return (
            <div key={cat.key}>
              <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
                {cat.icon} {cat.label}
              </h3>
              <ul className="space-y-2">
                {items.map((f, i) => (
                  <li
                    key={f.id}
                    className={`finding ${SEV_STYLE[f.severity].accent} fade-up flex gap-3 rounded-lg glass-soft p-3`}
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <span
                      title={SEV_STYLE[f.severity].label}
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_STYLE[f.severity].dot}`}
                    />
                    <div>
                      <p className="font-serif font-medium text-ink">{f.label}</p>
                      <p className="font-sans text-sm text-muted">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <LegalTeaserSection loading={legal.loading} teaser={legal.teaser} />

      <LeadCapture url={result.finalUrl || result.url} />
    </section>
  );
}

const LEGAL_STEPS = [
  "Localizando tus textos legales…",
  "Leyendo la política de privacidad…",
  "Revisando la política de cookies…",
  "Comprobando el aviso legal…",
  "Analizando formularios y consentimiento…",
  "Contrastando con la checklist RGPD…",
];

function LegalTeaserSection({ loading, teaser }: { loading: boolean; teaser: LegalTeaser | null }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, LEGAL_STEPS.length - 1)), 1900);
    return () => clearInterval(id);
  }, [loading]);

  if (loading) {
    return (
      <div className="mt-8 rounded-xl border border-line glass-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Análisis profundo de textos legales
          </p>
          <span className="font-mono text-[11px] text-muted">
            {step + 1}/{LEGAL_STEPS.length}
          </span>
        </div>
        <p className="mt-1 font-mono text-sm text-white">{LEGAL_STEPS[step]}</p>
        <div className="scanbar mt-4" />
        <p className="mt-3 font-sans text-xs text-muted">
          Nuestra IA está leyendo tus documentos legales reales. Mientras tanto, deja tu email abajo
          y te enviamos el informe completo en PDF.
        </p>
      </div>
    );
  }
  if (!teaser) return null;

  return (
    <div className="fade-up mt-8 glass-card rounded-xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-white">
          Análisis profundo de tus textos legales
        </h3>
        <span className="font-sans text-[11px] uppercase tracking-wide text-muted">IA · orientativo</span>
      </div>

      <ul className="mt-4 space-y-3">
        {teaser.docs.map((d) => {
          const ok = d.found && d.readable && d.missingCount === 0;
          return (
            <li
              key={d.type}
              className={`finding ${ok ? "finding-ok" : d.found ? "finding-warn" : "finding-fail"} rounded-lg glass-soft p-3`}
            >
              <p className="font-serif font-medium text-ink">
                {d.label}:{" "}
                {!d.found ? (
                  <span className="text-red-600">no encontrada en la web</span>
                ) : !d.readable ? (
                  <span className="text-amber-600">no se pudo leer (posible carga por JavaScript)</span>
                ) : d.missingCount === 0 ? (
                  <span className="text-emerald-600">sin deficiencias relevantes</span>
                ) : (
                  <span className="text-amber-700">
                    le faltan {d.missingCount} elemento(s) obligatorio(s)
                  </span>
                )}
              </p>
              {d.missing.length > 0 && (
                <p className="mt-1 font-sans text-sm text-muted">{d.missing.join(" · ")}</p>
              )}
            </li>
          );
        })}
        {teaser.forms.issue && (
          <li className="finding finding-fail rounded-lg glass-soft p-3">
            <p className="font-serif font-medium text-ink">Formularios</p>
            <p className="mt-1 font-sans text-sm text-muted">{teaser.forms.issue}</p>
          </li>
        )}
      </ul>

      <p className="mt-4 font-sans text-xs text-muted">{teaser.disclaimer}</p>
    </div>
  );
}

const SUBMIT_STEPS = [
  "Verificando tu dominio…",
  "Registrando tu solicitud…",
  "Preparando tu informe…",
];

function LeadCapture({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitStep, setSubmitStep] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Animación de pasos durante el envío
  useEffect(() => {
    if (!sending) { setSubmitStep(0); return; }
    const id = setInterval(
      () => setSubmitStep((s) => Math.min(s + 1, SUBMIT_STEPS.length - 1)),
      1500,
    );
    return () => clearInterval(id);
  }, [sending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Debes aceptar la política de privacidad.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, phone, url, consent, marketing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar.");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="hero-pinstripe relative mt-8 overflow-hidden rounded-xl p-6 text-white sm:p-8">
        <div className="tech-grid" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold">✓</span>
            <p className="font-serif text-xl font-semibold">¡Solicitud recibida!</p>
          </div>
          <p className="mt-3 font-sans text-sm text-white/80">
            Estamos preparando tu informe RGPD personalizado. Lo recibirás en tu email{" "}
            <span className="font-semibold text-gold">{email}</span> en los próximos minutos.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "📄 Informe PDF de marca con tu puntuación y análisis de textos legales",
              "⚠️ Lista priorizada de fallos y cómo corregirlos",
              "🎯 Plan de acción adaptado a tu tipo de negocio",
            ].map((item, i) => (
              <li
                key={i}
                className="fade-up flex gap-2 rounded-lg bg-white/10 px-3 py-2 font-sans text-sm"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/20 pt-4">
            <p className="font-sans text-xs text-white/60">
              ¿No ves el email? Revisa tu carpeta de spam o escríbenos a{" "}
              <a href="mailto:hola@soylegal360.es" className="text-gold underline">
                hola@soylegal360.es
              </a>
            </p>
            <a
              href="https://soylegal360.es/servicios-proteccion-de-datos/"
              target="_blank"
              rel="noopener"
              className="mt-3 inline-block rounded-lg bg-gold px-4 py-2 font-sans text-sm font-bold text-white transition hover:brightness-110"
            >
              Ver servicios de cumplimiento RGPD →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-pinstripe relative mt-8 overflow-hidden rounded-xl p-6 text-white sm:p-8">
      <div className="tech-grid" aria-hidden="true" />
      <div className="relative">
        <p className="font-serif text-xl font-semibold">
          ¿Quieres el informe completo con plan de acción?
        </p>
        <p className="mt-1 font-sans text-sm text-white/80">
          Déjanos tu email y te enviamos el informe PDF con las correcciones priorizadas para tu web.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3 font-sans">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/50 outline-none transition focus:border-gold"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/50 outline-none transition focus:border-gold"
            />
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/50 outline-none transition focus:border-gold"
          />
          <label className="flex items-start gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-gold"
            />
            <span>
              He leído y acepto la{" "}
              <a
                href="https://soylegal360.es/politica-de-privacidad/"
                target="_blank"
                rel="noopener"
                className="text-gold underline"
              >
                política de privacidad
              </a>
              . <span className="text-white/60">(obligatorio para enviarte el informe)</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 accent-gold"
            />
            <span>
              Quiero recibir comunicaciones comerciales de SoyLegal360 (novedades, ofertas y
              consejos de cumplimiento). <span className="text-white/60">(opcional)</span>
            </span>
          </label>
          <p className="text-[11px] leading-relaxed text-white/50">
            Responsable: SoyLegal360. Finalidad: elaborar y enviarte el diagnóstico solicitado y, si
            lo autorizas, enviarte comunicaciones comerciales. Base jurídica: tu consentimiento.
            Puedes ejercer tus derechos de acceso, rectificación y supresión escribiendo a
            hola@soylegal360.es. Más información en la{" "}
            <a
              href="https://soylegal360.es/politica-de-privacidad/"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              política de privacidad
            </a>
            .
          </p>
          {error && <p className="text-sm font-medium text-red-300">{error}</p>}
          <button type="submit" disabled={sending} className="btn-gold w-full">
            {sending ? SUBMIT_STEPS[submitStep] : "Recibir mi informe PDF"}
          </button>
          {sending && (
            <div className="scanbar" />
          )}
        </form>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-footer text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/soylegal360_logo_blanco_footer.svg"
            alt="SoyLegal360"
            className="w-48 max-w-full"
            style={{
              filter:
                "brightness(1.3) contrast(1.5) drop-shadow(0 0 3px rgba(255,255,255,.95)) drop-shadow(0 0 18px rgba(255,255,255,.3))",
            }}
          />
          <p className="mt-4 font-sans text-sm text-[#dbe6f4]">
            Cumplimiento real para negocios reales.
          </p>
          <p className="mt-2 font-sans text-xs font-black uppercase tracking-[0.14em] text-gold">
            Digitalización Blindada™
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xs font-black uppercase tracking-[0.14em] text-gold">
            Servicios
          </h2>
          <ul className="space-y-2 font-sans text-sm text-[#dbe6f4]">
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/auditoria-web-gratuita/">
                Auditoría web gratuita
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/servicios-proteccion-de-datos/">
                Servicios de protección de datos
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/como-funciona/">
                Cómo funciona
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/contacto/">
                Contacto
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xs font-black uppercase tracking-[0.14em] text-gold">
            Legal
          </h2>
          <ul className="space-y-2 font-sans text-sm text-[#dbe6f4]">
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/politica-de-privacidad/">
                Política de privacidad
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/aviso-legal/">
                Aviso legal
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="https://soylegal360.es/politica-de-cookies/">
                Política de cookies
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-5 text-center font-sans text-xs text-[#b8c7d9]">
        © {new Date().getFullYear()} SoyLegal360 · Herramienta de auditoría RGPD
      </div>
    </footer>
  );
}
