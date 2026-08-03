export interface TraceEvent {
  name: string;
  at: number;
}

const MAX_TRACE = 100;
const recentTrace: TraceEvent[] = [];

export function traceEvent(name: string): void {
  const at = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  recentTrace.push({ name, at });
  if (recentTrace.length > MAX_TRACE) recentTrace.shift();
  if (typeof performance !== "undefined" && typeof performance.mark === "function") {
    try {
      performance.mark(`site-abnt:${name}`);
    } catch {
      // marcas não suportadas são ignoradas
    }
  }
}

export function recentTraces(): readonly TraceEvent[] {
  return recentTrace;
}

export function clearTraces(): void {
  recentTrace.length = 0;
}