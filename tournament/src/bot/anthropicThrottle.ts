/**
 * Serialize Anthropic calls for the tournament so parallel bots and regime polling
 * cannot burst the API. Default: 5s minimum spacing after each call completes.
 *
 * Override with TOURNAMENT_ANTHROPIC_GAP_MS (0 disables).
 */

let queue: Promise<unknown> = Promise.resolve()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getAnthropicGapMs(): number {
  const raw = process.env.TOURNAMENT_ANTHROPIC_GAP_MS
  if (raw === undefined || raw === '') return 5000
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 5000
}

/**
 * Runs `fn` after all prior tournament Anthropic traffic has finished its gap;
 * after `fn` completes, waits `TOURNAMENT_ANTHROPIC_GAP_MS` before the next caller proceeds.
 */
export function runWithAnthropicSpacing<T>(fn: () => Promise<T>): Promise<T> {
  const gap = getAnthropicGapMs()
  const task = queue.then(async () => {
    try {
      return await fn()
    } finally {
      if (gap > 0) await sleep(gap)
    }
  })
  queue = task.then(
    () => {},
    () => {},
  )
  return task as Promise<T>
}
