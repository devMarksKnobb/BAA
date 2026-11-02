/** Retry transient asynchronous operations with bounded exponential backoff. */
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Random source is injectable to make retry timing deterministic in tests. */
  random?: () => number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void | Promise<void>;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("Operation aborted");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function cleanup() { signal?.removeEventListener("abort", onAbort); }
    function done() { cleanup(); resolve(); }
    function onAbort() {
      clearTimeout(timer);
      cleanup();
      reject(abortReason(signal!));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 5));
  const base = Math.max(0, options.baseDelayMs ?? 200);
  const max = Math.max(base, options.maxDelayMs ?? 10_000);
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.signal?.aborted) throw abortReason(options.signal);
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === attempts || options.shouldRetry?.(error, attempt) === false) throw error;
      // Full jitter reduces synchronized retry storms across workers.
      const ceiling = Math.min(max, base * 2 ** Math.min(attempt - 1, 30));
      const delay = Math.floor(Math.max(0, Math.min(1, random())) * ceiling);
      await options.onRetry?.(error, attempt, delay);
      await sleep(delay, options.signal);
    }
  }
  throw new Error("Retry loop exited unexpectedly");
}
