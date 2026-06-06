"use client";

import { useState } from "react";
import type { AuditResult, Finding, Severity } from "@/lib/audit";

const SEV_STYLE: Record<Severity, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Correcto" },
  warn: { dot: "bg-amber-500", text: "text-amber-700", label: "Mejorable" },
  fail: { dot: "bg-red-500", text: "text-red-700", label: "Fallo" },
  info: { dot: "bg-zinc-400", text: "text-zinc-600", label: "Info" },
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-zinc-900">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">
          SoyLegal<span className="text-indigo-600">360</span>
        </span>
        <a href="https://soylegal360.es" className="text-sm font-medium text-indigo-600 hover:underline">
          soylegal360.es
        </a>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <section className="pt-10 pb-12 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            ¿Tu web cumple el <span className="text-indigo-600">RGPD</span>?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600">
            Analiza gratis tu sitio web en segundos: cookies, textos legales, seguridad y
            protección del correo. Recibe un informe con lo que debes corregir.
          </p>

          <form onSubmit={runAudit} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="tudominio.com"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Analizando…" : "Auditar gratis"}
            </button>
          </form>
          {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
        </section>

        {result && <Report result={result} />}
      </main>
    </div>
  );
}

function Report({ result }: { result: AuditResult }) {
  const fails = result.findings.filter((f) => f.severity === "fail").length;
  const warns = result.findings.filter((f) => f.severity === "warn").length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center gap-6 border-b border-zinc-100 pb-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Informe RGPD de</p>
          <p className="text-xl font-semibold">{result.domain}</p>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-medium text-red-600">{fails} fallos</span> ·{" "}
            <span className="font-medium text-amber-600">{warns} mejorables</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-zinc-500">Puntuación</div>
            <div className="text-3xl font-bold">{result.score}/100</div>
          </div>
          <div className={`text-6xl font-black ${GRADE_COLOR[result.grade]}`}>{result.grade}</div>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {CATEGORIES.map((cat) => {
          const items = result.findings.filter((f) => f.category === cat.key);
          if (!items.length) return null;
          return (
            <div key={cat.key}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
                {cat.icon} {cat.label}
              </h3>
              <ul className="space-y-2">
                {items.map((f) => (
                  <li key={f.id} className="flex gap-3 rounded-lg bg-zinc-50 p-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_STYLE[f.severity].dot}`} />
                    <div>
                      <p className="font-medium">{f.label}</p>
                      <p className="text-sm text-zinc-600">{f.detail}</p>
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
      <div className="mt-8 rounded-xl bg-indigo-600 p-6 text-white sm:p-8">
        <p className="text-lg font-semibold">¡Gracias! Aquí tienes tu plan de acción 👇</p>
        <p className="mt-2 text-sm text-indigo-100">{done.summary}</p>
        <ul className="mt-4 space-y-2">
          {done.recommendations.map((r, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-white/10 p-3 text-sm">
              <span className="font-bold text-indigo-200">{i + 1}.</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-indigo-200">
          Un experto de SoyLegal360 revisará tu caso y se pondrá en contacto contigo.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl bg-indigo-600 p-6 text-white sm:p-8">
      <p className="text-lg font-semibold">¿Quieres el informe completo con plan de acción?</p>
      <p className="mt-1 text-sm text-indigo-100">
        Déjanos tu email y un experto en RGPD te enviará las correcciones priorizadas para tu web.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (opcional)"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-200 outline-none focus:border-white/50"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono (opcional)"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-200 outline-none focus:border-white/50"
          />
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-200 outline-none focus:border-white/50"
        />
        <label className="flex items-start gap-2 text-xs text-indigo-100">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Acepto la{" "}
            <a href="https://soylegal360.es/politica-de-privacidad/" target="_blank" rel="noopener" className="underline">
              política de privacidad
            </a>{" "}
            y que SoyLegal360 me contacte sobre esta auditoría.
          </span>
        </label>
        {error && <p className="text-sm font-medium text-red-200">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-lg bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Recibir mi plan de acción"}
        </button>
      </form>
    </div>
  );
}
