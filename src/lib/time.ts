// Clock reads live here so components call them only from handlers/effects or per-request server code.

/** ISO timestamp `ms` milliseconds before now (negative for the future). */
export function isoAgo(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

export function wallNow() {
  return Date.now();
}

/** Monotonic clock for measuring durations (immune to system clock changes). */
export function monotonicNow() {
  return performance.now();
}
