// Límite anti-abuso "best effort" en memoria (por instancia serverless).
// No es un control distribuido perfecto (cada lambda caliente tiene su propio mapa),
// pero frena el abuso básico sin depender de un KV externo (que requeriría Vercel Pro/Upstash).
// Para protección fuerte → migrar a Upstash Ratelimit / Vercel KV.

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // segundos hasta el reset
}

/**
 * Ventana fija por clave (p. ej. IP). Limpia entradas caducadas de forma perezosa.
 * @param key   identificador (IP)
 * @param limit nº máx. de peticiones por ventana
 * @param windowMs duración de la ventana en ms
 */
export function rateLimit(key: string, limit = 8, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Limpieza perezosa para que el mapa no crezca sin límite.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (hit.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  return { ok: true, remaining: limit - hit.count, retryAfter: 0 };
}

// Extrae la IP del cliente de las cabeceras (Vercel pone x-forwarded-for / x-real-ip).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
