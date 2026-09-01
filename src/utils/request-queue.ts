import { sleep } from "./sleep";

const MIN_INTERVAL_MS = 350;
const MAX_INLINE_WAIT_MS = 8_000;

let chain: Promise<unknown> = Promise.resolve();
let lastStartedAt = 0;
let blockedUntil = 0;

export function blockUntil(timestamp: number): void {
  if (timestamp > blockedUntil) blockedUntil = timestamp;
}

export function remainingBlockMs(): number {
  return Math.max(0, blockedUntil - Date.now());
}

export function exceedsInlineWait(ms: number): boolean {
  return ms > MAX_INLINE_WAIT_MS;
}

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const spacing = MIN_INTERVAL_MS - (Date.now() - lastStartedAt);
    const wait = Math.min(Math.max(spacing, remainingBlockMs()), MAX_INLINE_WAIT_MS);
    if (wait > 0) await sleep(wait);
    lastStartedAt = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}
