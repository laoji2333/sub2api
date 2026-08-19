export interface PlaygroundTypewriter {
  push: (chunk: string) => void
  finish: () => Promise<void>
  flush: () => void
  cancel: () => void
}

interface PlaygroundTypewriterOptions {
  intervalMs?: number
  disabled?: boolean
}

export function createPlaygroundTypewriter(
  onWrite: (chunk: string) => void,
  options: PlaygroundTypewriterOptions = {}
): PlaygroundTypewriter {
  const intervalMs = options.intervalMs ?? 18
  const disabled = options.disabled ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  let pending = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let finishResolvers: Array<() => void> = []

  function resolveFinished() {
    if (pending || timer) return
    const resolvers = finishResolvers
    finishResolvers = []
    for (const resolve of resolvers) resolve()
  }

  function schedule() {
    if (timer || !pending) return
    timer = setTimeout(tick, intervalMs)
  }

  function tick() {
    timer = null
    if (!pending) {
      resolveFinished()
      return
    }

    const chunkSize = pending.length > 600
      ? Math.min(12, Math.ceil(pending.length / 30))
      : pending.length > 120
        ? 4
        : 1
    const chunk = pending.slice(0, chunkSize)
    pending = pending.slice(chunkSize)
    onWrite(chunk)

    if (pending) schedule()
    else resolveFinished()
  }

  return {
    push(chunk) {
      if (!chunk) return
      if (disabled) {
        onWrite(chunk)
        return
      }
      pending += chunk
      schedule()
    },
    finish() {
      if (!pending && !timer) return Promise.resolve()
      schedule()
      return new Promise<void>((resolve) => finishResolvers.push(resolve))
    },
    flush() {
      if (timer) clearTimeout(timer)
      timer = null
      if (pending) onWrite(pending)
      pending = ''
      resolveFinished()
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = ''
      resolveFinished()
    }
  }
}
