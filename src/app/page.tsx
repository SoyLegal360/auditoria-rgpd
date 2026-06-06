"use client";

import { useEffect, useState } from "react";
import type { AuditResult, Finding, Severity } from "@/lib/audit";

const SEV_STYLE: Record<Severity, { dot: string; accent: string; label: string }> = {
  ok: { dot: "bg-emerald-500", accent: "finding-ok", label: "Correcto" },
  warn: { dot: "bg-amber-500", accent: "finding-warn", label: "Mejorable" },
  fail: { dot: "bg-red-500", accent: "finding-fail", label: "Fallo" },
  info: { dot: "bg-zinc-400", accent: "finding-info", label: "Info" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600",
  B: "text-lime-600",
  C: "text-amber-600",
  D: "text-orange-600",
  E: "text-red-600",
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
    <div className="flex min-h-screen flex-col bg-white text-ink">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center justify-between gap-4 px-6">
          <a href="https://soylegal360.es" aria-label="SoyLegal360 inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/soylegal360_logo_color_header.svg" alt="SoyLegal360" className="block h-9 w-auto" />
          </a>
          <nav className="flex items-center gap-5">
            <a
              href="https://soylegal360.es"
              className="hidden font-sans text-sm font-bold text-navy transition-colors hover:text-copper sm:inline"
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
              className="h-[46px] flex-1 rounded-lg border border-white/20 bg-white px-4 font-mono text-base text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40"
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
    <section className="fade-up rounded-2xl border border-line bg-white p-6 shadow-[0_20px_60px_rgba(6,21,44,0.12)] sm:p-8">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
        Auditando
      </p>
      <p className="mt-1 break-all font-mono text-lg text-navy">{url || "tu web"}</p>
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
        <span className="font-mono text-3xl font-bold text-navy">{shown}</span>
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

  return (
    <section className="fade-up rounded-2xl border border-line bg-white p-6 shadow-[0_20px_60px_rgba(6,21,44,0.12)] sm:p-8">
      <div className="flex flex-col items-center gap-6 border-b border-line pb-6 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Informe RGPD de
          </p>
          <p className="mt-1 break-all font-mono text-xl font-medium text-navy">{result.domain}</p>
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
                    className={`finding ${SEV_STYLE[f.severity].accent} fade-up flex gap-3 rounded-lg bg-soft p-3`}
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

      <LeadCapture url={result.finalUrl || result.url} />
    </section>
  );
}

interface LeadResponse {
  summary: string;
  recommendations: string[];
}

function LeadCapture({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<LeadResponse | null>(null);

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
        body: JSON.stringify({ email, name, phone, url, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar.");
      setDone(data as LeadResponse);
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
          <p className="font-serif text-xl font-semibold">¡Gracias! Aquí tienes tu plan de acción</p>
          <p className="mt-2 font-sans text-sm text-white/80">{done.summary}</p>
          <ul className="mt-4 space-y-2">
            {done.recommendations.map((r, i) => (
              <li
                key={i}
                className="fade-up flex gap-3 rounded-lg bg-white/10 p-3 font-sans text-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="font-bold text-gold">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-sans text-xs text-white/60">
            Un experto de SoyLegal360 revisará tu caso y se pondrá en contacto contigo.
          </p>
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
          Déjanos tu email y un experto en RGPD te enviará las correcciones priorizadas para tu web.
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
              Acepto la{" "}
              <a
                href="https://soylegal360.es/politica-de-privacidad/"
                target="_blank"
                rel="noopener"
                className="text-gold underline"
              >
                política de privacidad
              </a>{" "}
              y que SoyLegal360 me contacte sobre esta auditoría.
            </span>
          </label>
          {error && <p className="text-sm font-medium text-red-300">{error}</p>}
          <button type="submit" disabled={sending} className="btn-gold w-full">
            {sending ? "Enviando…" : "Recibir mi plan de acción"}
          </button>
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
