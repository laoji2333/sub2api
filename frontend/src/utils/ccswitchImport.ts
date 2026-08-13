import type { GroupPlatform } from '@/types'

export const OPENAI_CC_SWITCH_CODEX_MODEL = 'gpt-5.6-sol'
export const GROK_CC_SWITCH_MODEL = 'grok-4.5'
const CC_SWITCH_MODELS_REQUEST_TIMEOUT_MS = 1500

export type CcSwitchClientType = 'claude' | 'gemini'

export interface CcSwitchImportConfig {
  app: string
  endpoint: string
  model?: string
}

export interface CcSwitchImportDeeplinkInput {
  baseUrl: string
  platform?: GroupPlatform | null
  clientType: CcSwitchClientType
  providerName: string
  apiKey: string
  usageScript: string
  /** Default model for the imported provider; falls back to platform defaults. */
  model?: string
}

export interface CcSwitchModelsListResponse {
  data?: Array<{ id?: string }>
}

function withV1Endpoint(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  return normalizedBaseUrl.endsWith('/v1') ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`
}

export function resolveCcSwitchImportConfig(
  platform: GroupPlatform | undefined | null,
  clientType: CcSwitchClientType,
  baseUrl: string
): CcSwitchImportConfig {
  switch (platform || 'anthropic') {
    case 'antigravity':
      return {
        app: clientType === 'gemini' ? 'gemini' : 'claude',
        endpoint: `${baseUrl}/antigravity`
      }
    case 'openai':
      return {
        app: 'codex',
        endpoint: baseUrl,
        model: OPENAI_CC_SWITCH_CODEX_MODEL
      }
    case 'gemini':
      return {
        app: 'gemini',
        endpoint: baseUrl
      }
    case 'grok':
      return {
        app: 'grokbuild',
        endpoint: withV1Endpoint(baseUrl),
        model: GROK_CC_SWITCH_MODEL
      }
    default:
      return {
        app: 'claude',
        endpoint: baseUrl
      }
  }
}

export function buildCcSwitchImportDeeplink(input: CcSwitchImportDeeplinkInput): string {
  const config = resolveCcSwitchImportConfig(input.platform, input.clientType, input.baseUrl)
  const model = input.model ?? config.model
  const entries: [string, string][] = [
    ['resource', 'provider'],
    ['app', config.app],
    ['name', input.providerName],
    ['homepage', input.baseUrl],
    ['endpoint', config.endpoint],
    ['apiKey', input.apiKey],
    ['configFormat', 'json'],
    ['usageEnabled', 'true'],
    ['usageScript', btoa(input.usageScript)],
    ['usageAutoInterval', '30']
  ]

  if (model) {
    entries.splice(2, 0, ['model', model])
  }

  return `ccswitch://v1/import?${new URLSearchParams(entries).toString()}`
}

/**
 * Fetches the group's available models from the gateway /v1/models endpoint
 * for explicit selection before importing to CC Switch.
 * Returns null when the request fails.
 */
export async function fetchCcSwitchModels(baseUrl: string, apiKey: string): Promise<string[] | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CC_SWITCH_MODELS_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${withV1Endpoint(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    })
    if (!response.ok) return null
    const payload = (await response.json()) as CcSwitchModelsListResponse
    return payload.data?.flatMap((item) => (item?.id ? [item.id] : [])) ?? []
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
