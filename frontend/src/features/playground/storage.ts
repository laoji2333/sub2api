export type PlaygroundMessageRole = 'user' | 'assistant'
export type PlaygroundMessageStatus = 'complete' | 'streaming' | 'error'

export interface PlaygroundMessage {
  id: string
  role: PlaygroundMessageRole
  content: string
  reasoning?: string
  status: PlaygroundMessageStatus
  error?: string
  created_at: number
  response_time_ms?: number
}

export interface PlaygroundSettings {
  api_key_id: number | null
  model: string
  system_prompt: string
  temperature: number
  top_p: number
  max_tokens: number
  parameters_enabled: PlaygroundParametersEnabled
}

export interface PlaygroundParametersEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
}

export interface PlaygroundSnapshot {
  messages: PlaygroundMessage[]
  settings: PlaygroundSettings
}

export const PLAYGROUND_MIN_MAX_TOKENS = 128
export const PLAYGROUND_MAX_MAX_TOKENS = 128000

export function normalizePlaygroundMaxTokens(value: number): number {
  if (!Number.isFinite(value)) return 4096
  return Math.round(Math.min(PLAYGROUND_MAX_MAX_TOKENS, Math.max(PLAYGROUND_MIN_MAX_TOKENS, value)))
}

export const defaultPlaygroundSettings = (): PlaygroundSettings => ({
  api_key_id: null,
  model: '',
  system_prompt: '',
  temperature: 1,
  top_p: 1,
  max_tokens: 4096,
  parameters_enabled: {
    temperature: false,
    top_p: false,
    max_tokens: false
  }
})

export function playgroundStorageKey(userID: number): string {
  return `sub2api:playground:v1:user:${userID}`
}

function isStoredMessage(value: unknown): value is PlaygroundMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<PlaygroundMessage>
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    typeof message.created_at === 'number'
  )
}

export function loadPlaygroundSnapshot(userID: number): PlaygroundSnapshot {
  const fallback = { messages: [], settings: defaultPlaygroundSettings() }
  if (!Number.isFinite(userID) || userID <= 0) return fallback

  try {
    const raw = localStorage.getItem(playgroundStorageKey(userID))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PlaygroundSnapshot>
    const defaults = defaultPlaygroundSettings()
    const storedSettings = (parsed.settings ?? {}) as Partial<PlaygroundSettings>
    const settings = {
      ...defaults,
      ...storedSettings,
      max_tokens: normalizePlaygroundMaxTokens(Number(storedSettings.max_tokens ?? defaults.max_tokens)),
      parameters_enabled: {
        ...defaults.parameters_enabled,
        ...(storedSettings.parameters_enabled ?? {})
      }
    }
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(isStoredMessage).map((message) => ({
          ...message,
          status: message.status === 'error' ? 'error' as const : 'complete' as const
        }))
      : []
    return { messages, settings }
  } catch {
    return fallback
  }
}

export function savePlaygroundSnapshot(userID: number, snapshot: PlaygroundSnapshot): void {
  if (!Number.isFinite(userID) || userID <= 0) return
  try {
    localStorage.setItem(playgroundStorageKey(userID), JSON.stringify({
      settings: snapshot.settings,
      messages: snapshot.messages.slice(-100).map((message) => ({
        ...message,
        status: message.status === 'error' ? 'error' : 'complete'
      }))
    }))
  } catch {
    // Browsers may deny storage or exceed quota. The active conversation still remains in memory.
  }
}

export function clearPlaygroundSnapshot(userID: number): void {
  if (!Number.isFinite(userID) || userID <= 0) return
  localStorage.removeItem(playgroundStorageKey(userID))
}
