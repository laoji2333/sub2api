import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPlaygroundSnapshot,
  defaultPlaygroundSettings,
  loadPlaygroundSnapshot,
  playgroundStorageKey,
  savePlaygroundSnapshot
} from '../storage'

describe('playground storage', () => {
  beforeEach(() => localStorage.clear())

  it('isolates snapshots by the current user id without storing credentials', () => {
    savePlaygroundSnapshot(7, {
      settings: { ...defaultPlaygroundSettings(), api_key_id: 12, model: 'gpt-test' },
      messages: [{ id: 'm1', role: 'user', content: 'hello', status: 'complete', created_at: 1 }]
    })

    expect(loadPlaygroundSnapshot(7).messages[0].content).toBe('hello')
    expect(loadPlaygroundSnapshot(8).messages).toEqual([])
    expect(localStorage.getItem(playgroundStorageKey(7))).not.toContain('sk-')
    expect(localStorage.getItem(playgroundStorageKey(7))).not.toContain('auth_token')
  })

  it('normalizes interrupted streaming messages and clears only the selected user', () => {
    localStorage.setItem(playgroundStorageKey(7), JSON.stringify({
      settings: defaultPlaygroundSettings(),
      messages: [{ id: 'm1', role: 'assistant', content: 'partial', status: 'streaming', created_at: 1 }]
    }))
    localStorage.setItem(playgroundStorageKey(8), '{}')

    expect(loadPlaygroundSnapshot(7).messages[0].status).toBe('complete')
    clearPlaygroundSnapshot(7)
    expect(localStorage.getItem(playgroundStorageKey(7))).toBeNull()
    expect(localStorage.getItem(playgroundStorageKey(8))).not.toBeNull()
  })

  it('migrates older snapshots with optional parameters disabled', () => {
    localStorage.setItem(playgroundStorageKey(7), JSON.stringify({
      settings: { temperature: 0.7, top_p: 0.8, max_tokens: 2048 },
      messages: []
    }))

    const snapshot = loadPlaygroundSnapshot(7)
    expect(snapshot.settings.temperature).toBe(0.7)
    expect(snapshot.settings.parameters_enabled).toEqual({
      temperature: false,
      top_p: false,
      max_tokens: false
    })
  })

  it('normalizes a stored max token value below the supported minimum', () => {
    localStorage.setItem(playgroundStorageKey(7), JSON.stringify({
      settings: { max_tokens: 20, parameters_enabled: { max_tokens: true } },
      messages: []
    }))

    expect(loadPlaygroundSnapshot(7).settings.max_tokens).toBe(128)
  })
})
