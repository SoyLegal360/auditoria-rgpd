import { promises as dns } from "dns";
import net from "net";

// ── Protección anti-SSRF ──────────────────────────────────────────────────────
// La herramienta hace fetch del lado servidor de URLs que mete el usuario. Sin
// validar, un atacante podría apuntar a IPs internas, loopback o el endpoint de
// metadata cloud (169.254.169.254). Aquí validamos esquema, resolvemos el host y
// rechazamos cualquier IP no pública, revalidando en cada redirección.

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + (parseInt(o, 10) & 255), 0) >>> 0;
}

function inCidr(ipInt: number, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return (
    inCidr(n, "0.0.0.0", 8) ||
    inCidr(n, "10.0.0.0", 8) ||
    inCidr(n, "100.64.0.0", 10) ||   // CGNAT
    inCidr(n, "127.0.0.0", 8) ||     // loopback
    inCidr(n, "169.254.0.0", 16) ||  // link-local + metadata cloud
    inCidr(n, "172.16.0.0", 12) ||
    inCidr(n, "192.0.0.0", 24) ||
    inCidr(n, "192.168.0.0", 16) ||
    inCidr(n, "198.18.0.0", 15) ||   // benchmarking
    inCidr(n, "224.0.0.0", 4) ||     // multicast
    inCidr(n, "240.0.0.0", 4)        // reservado
  );
}

function isPrivateIPv6(ip: string): boolean {
  const low = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (low === "::1" || low === "::") return true;
  const mapped = low.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // fc00::/7 (ULA)
  if (/^fe[89ab]/.test(low)) return true;                        // fe80::/10 (link-local)
  return false;
}

function isBlockedIp(ip: string): boolean {
  return net.isIPv4(ip) ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

// Valida una URL: solo http(s) y host que resuelve a IP(s) públicas.
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http o https.");
  }
  const host = u.hostname;
  let addrs: string[];
  if (net.isIP(host)) {
    addrs = [host];
  } else {
    try {
      addrs = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new Error("No se pudo resolver el dominio.");
    }
  }
  if (addrs.length === 0 || addrs.some(isBlockedIp)) {
    throw new Error("URL no permitida (host interno o no público).");
  }
  return u;
}

export interface SafeFetchResult {
  res: Response;
  finalUrl: string;
}

// fetch con guard anti-SSRF + redirecciones manuales revalidadas en cada salto.
export async function safeFetch(
  raw: string,
  opts: RequestInit = {},
  maxRedirects = 5,
): Promise<SafeFetchResult> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...opts, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        current = new URL(loc, current).toString();
        continue;
      }
    }
    return { res, finalUrl: current };
  }
  throw new Error("Demasiadas redirecciones.");
}

// Lee el body como texto con TOPE de tamaño (anti-DoS por respuesta gigante).
// Corta la lectura al superar maxBytes (por defecto 3 MB) y descarta el resto.
export async function readBodyCapped(res: Response, maxBytes = 3_000_000): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let html = "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > maxBytes) {
        const keep = value.length - (total - maxBytes);
        html += decoder.decode(value.subarray(0, keep), { stream: true });
        try { await reader.cancel(); } catch {}
        break;
      }
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    html += decoder.decode(); // flush
  }
  return html;
}
