import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlaygroundTypewriter } from '../typewriter'

describe('playground typewriter', () => {
  afterEach(() => vi.useRealTimers())

  it('reveals streamed content progressively and drains on finish', async () => {
    vi.useFakeTimers()
    let content = ''
    const typewriter = createPlaygroundTypewriter(
      (chunk) => { content += chunk },
      { intervalMs: 10, disabled: false }
    )

    typewriter.push('hello')
    expect(content).toBe('')

    await vi.advanceTimersByTimeAsync(10)
    expect(content).toBe('h')

    const finished = typewriter.finish()
    await vi.runAllTimersAsync()
    await finished
    expect(content).toBe('hello')
  })

  it('flushes pending content immediately', () => {
    vi.useFakeTimers()
    let content = ''
    const typewriter = createPlaygroundTypewriter((chunk) => { content += chunk }, { disabled: false })

    typewriter.push('complete response')
    typewriter.flush()

    expect(content).toBe('complete response')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps draining progressively after the response completes', async () => {
    vi.useFakeTimers()
    let content = ''
    const typewriter = createPlaygroundTypewriter(
      (chunk) => { content += chunk },
      { intervalMs: 10, disabled: false }
    )

    typewriter.push('x'.repeat(200))
    const finished = typewriter.finish()
    await vi.advanceTimersByTimeAsync(10)

    expect(content.length).toBe(4)
    await vi.runAllTimersAsync()
    await finished
    expect(content.length).toBe(200)
  })

  it('writes immediately when reduced motion disables the effect', () => {
    let content = ''
    const typewriter = createPlaygroundTypewriter(
      (chunk) => { content += chunk },
      { disabled: true }
    )

    typewriter.push('accessible response')

    expect(content).toBe('accessible response')
  })
})
