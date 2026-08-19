import { describe, expect, it } from 'vitest'
import { applyPlaygroundStreamData, consumePlaygroundStream, extractPlaygroundResponse } from '../stream'
import { createPlaygroundTypewriter } from '../typewriter'

describe('playground stream parser', () => {
  it('parses content and reasoning across network chunk boundaries', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.reasoning_summary_text.delta","delta":"think"}\n\ndata: {"type":"response.out'))
        controller.enqueue(encoder.encode('put_text.delta","delta":"hello"}\r\n\r\ndata: {"type":"response.completed"}\n\n'))
        controller.close()
      }
    })
    let content = ''
    let reasoning = ''

    await consumePlaygroundStream(stream, {
      onContent: (chunk) => { content += chunk },
      onReasoning: (chunk) => { reasoning += chunk }
    })

    expect(content).toBe('hello')
    expect(reasoning).toBe('think')
  })

  it('surfaces Responses API stream errors', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.failed","response":{"error":{"message":"quota exhausted"}}}\n\n'))
        controller.close()
      }
    })

    await expect(consumePlaygroundStream(stream, {
      onContent: () => undefined,
      onReasoning: () => undefined
    })).rejects.toThrow('quota exhausted')
  })

  it('handles terminal events and non-stream response output', () => {
    const callbacks = { onContent: () => undefined, onReasoning: () => undefined }
    expect(applyPlaygroundStreamData('{"type":"response.completed"}', callbacks)).toBe(true)
    expect(extractPlaygroundResponse({
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'analysis' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'answer' }] }
      ]
    })).toEqual({ content: 'answer', reasoning: 'analysis' })
  })

  it('lets the typewriter render while queued stream chunks are still being consumed', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const character of 'streaming') {
          controller.enqueue(encoder.encode(`data: {"type":"response.output_text.delta","delta":"${character}"}\n\n`))
        }
        controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'))
        controller.close()
      }
    })
    let content = ''
    const typewriter = createPlaygroundTypewriter(
      (chunk) => { content += chunk },
      { intervalMs: 0, disabled: false }
    )

    await consumePlaygroundStream(stream, {
      onContent: typewriter.push,
      onReasoning: () => undefined
    })

    expect(content.length).toBeGreaterThan(0)
    const finished = typewriter.finish()
    await finished
    expect(content).toBe('streaming')
  })
})
