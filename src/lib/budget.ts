// Tope de coste "best effort" para el asistente de chat (patrón de ratelimit.ts).
// Cuenta peticiones al modelo por día (UTC) para no disparar el gasto de la clave Anthropic.
//
// LIMITACIÓN: el contador vive en memoria por instancia serverless (no distribuido),
// igual que ratelimit.ts. Con el tráfico del sitio + Haiku + caché de prompt el gasto es
// despreciable; para un techo GLOBAL garantizado habría que migrar a Upstash/KV.

interface DayCount {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

const counters = new Map<string, DayCount>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface BudgetResult {
  ok: boolean;
  used: number;
  limit: number;
}

/**
 * Incrementa y comprueba el cupo diario de una clave (p. ej. "chat:global").
 * @param key    identificador del cupo
 * @param limit  nº máx. de peticiones permitidas hoy
 */
export function dailyBudget(key: string, limit: number): BudgetResult {
  const day = today();
  const cur = counters.get(key);

  if (!cur || cur.day !== day) {
    counters.set(key, { day, count: 1 });
    return { ok: true, used: 1, limit };
  }

  if (cur.count >= limit) {
    return { ok: false, used: cur.count, limit };
  }

  cur.count += 1;
  return { ok: true, used: cur.count, limit };
}
