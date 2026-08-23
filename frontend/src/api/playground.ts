import { apiClient } from './client'
import { buildGatewayUrl } from './url'
import { refreshAuthTokens } from './tokenRefresh'
import { getLocale } from '@/i18n'

export const PLAYGROUND_API_KEY_HEADER = 'X-Playground-API-Key-ID'

export interface PlaygroundAPIKeyOption {
  id: number
  name: string
  group_id: number
  group_name: string
  group_platform: string
}

export interface ImagePlaygroundAPIKeyOption {
  id: number
  name: string
  key: string
  group_id: number
  group_name: string
}

export interface PlaygroundModel {
  id: string
}

export interface PlaygroundResponseInputMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PlaygroundResponseRequest {
  model: string
  input: PlaygroundResponseInputMessage[]
  stream: true
  instructions?: string
  temperature?: number
  top_p?: number
  max_output_tokens?: number
}

export async function listPlaygroundAPIKeys(): Promise<PlaygroundAPIKeyOption[]> {
  const { data } = await apiClient.get<PlaygroundAPIKeyOption[]>('/user/playground/api-keys')
  return Array.isArray(data) ? data : []
}

export async function listImagePlaygroundAPIKeys(): Promise<ImagePlaygroundAPIKeyOption[]> {
  const { data } = await apiClient.get<ImagePlaygroundAPIKeyOption[]>('/user/playground/image-api-keys')
  return Array.isArray(data) ? data : []
}

export async function listPlaygroundModels(apiKeyID: number): Promise<string[]> {
  const { data } = await apiClient.get<{ data?: Array<Record<string, unknown>> }>('/user/playground/models', {
    headers: { [PLAYGROUND_API_KEY_HEADER]: String(apiKeyID) }
  })
  const seen = new Set<string>()
  for (const item of data?.data ?? []) {
    const value = String(item.id ?? item.model ?? '').trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

async function fetchWithSession(
  input: string,
  init: RequestInit,
  retry = true
): Promise<Response> {
  const token = localStorage.getItem('auth_token')
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(input, { ...init, headers })
  if (response.status !== 401 || !retry || !localStorage.getItem('refresh_token')) {
    return response
  }

  const refreshed = await refreshAuthTokens({ failedAccessToken: token })
  headers.set('Authorization', `Bearer ${refreshed.access_token}`)
  return fetch(input, { ...init, headers })
}

export function sendPlaygroundResponse(
  apiKeyID: number,
  payload: PlaygroundResponseRequest,
  signal: AbortSignal
): Promise<Response> {
  return fetchWithSession(buildGatewayUrl('/v1/playground/responses'), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': getLocale(),
      [PLAYGROUND_API_KEY_HEADER]: String(apiKeyID)
    },
    body: JSON.stringify(payload)
  })
}

export async function readPlaygroundError(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim()
  try {
    const payload = await response.json() as Record<string, any>
    return String(payload?.error?.message || payload?.message || payload?.detail || fallback)
  } catch {
    return fallback
  }
}
