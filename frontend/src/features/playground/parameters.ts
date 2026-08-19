import type { PlaygroundResponseRequest } from '@/api/playground'
import { normalizePlaygroundMaxTokens, type PlaygroundSettings } from './storage'

type PlaygroundOptionalParameters = Pick<
  PlaygroundResponseRequest,
  'temperature' | 'top_p' | 'max_output_tokens'
>

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function buildPlaygroundParameterPayload(
  settings: PlaygroundSettings
): Partial<PlaygroundOptionalParameters> {
  const payload: Partial<PlaygroundOptionalParameters> = {}

  if (settings.parameters_enabled.temperature) {
    payload.temperature = clamp(settings.temperature, 0, 2, 1)
  }
  if (settings.parameters_enabled.top_p) {
    payload.top_p = clamp(settings.top_p, 0, 1, 1)
  }
  if (settings.parameters_enabled.max_tokens) {
    payload.max_output_tokens = normalizePlaygroundMaxTokens(settings.max_tokens)
  }

  return payload
}
