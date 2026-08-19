interface StreamCallbacks {
  onContent: (chunk: string) => void
  onReasoning: (chunk: string) => void
}

function streamErrorMessage(payload: Record<string, any>): string | null {
  const error = payload.error ?? payload.response?.error
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error.message === 'string') return error.message
  return 'Generation failed'
}

export function applyPlaygroundStreamData(data: string, callbacks: StreamCallbacks): boolean {
  if (data === '[DONE]') return true

  const payload = JSON.parse(data) as Record<string, any>
  const error = streamErrorMessage(payload)
  if (error) throw new Error(error)

  switch (payload.type) {
    case 'response.output_text.delta':
      if (typeof payload.delta === 'string' && payload.delta) callbacks.onContent(payload.delta)
      return false
    case 'response.reasoning_summary_text.delta':
    case 'response.reasoning_text.delta':
      if (typeof payload.delta === 'string' && payload.delta) callbacks.onReasoning(payload.delta)
      return false
    case 'response.completed':
    case 'response.done':
      return true
    case 'response.failed':
    case 'response.incomplete':
    case 'response.cancelled':
    case 'response.canceled':
      throw new Error(streamErrorMessage(payload) ?? 'Generation failed')
    default:
      return false
  }
}

export function extractPlaygroundResponse(payload: Record<string, any>): { content: string; reasoning: string } {
  const content: string[] = []
  const reasoning: string[] = []

  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (item?.type === 'message') {
      for (const part of Array.isArray(item.content) ? item.content : []) {
        if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string') {
          content.push(part.text)
        }
      }
    }
    if (item?.type === 'reasoning') {
      for (const part of Array.isArray(item.summary) ? item.summary : []) {
        if (typeof part?.text === 'string') reasoning.push(part.text)
      }
    }
  }

  if (content.length === 0 && typeof payload.output_text === 'string' && payload.output_text) {
    content.push(payload.output_text)
  }

  return { content: content.join(''), reasoning: reasoning.join('') }
}

export async function consumePlaygroundStream(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false

  const consumeLine = (rawLine: string): boolean => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.startsWith('data:')) return false
    const data = line.slice(5).trimStart()
    if (!data) return false
    done = applyPlaygroundStreamData(data, callbacks)
    return true
  }

  while (!done) {
    const result = await reader.read()
    buffer += decoder.decode(result.value, { stream: !result.done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    let consumedData = false
    for (const line of lines) {
      consumedData = consumeLine(line) || consumedData
      if (done) break
    }
    if (consumedData) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (result.done) break
  }
  if (!done && buffer && consumeLine(buffer)) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}
