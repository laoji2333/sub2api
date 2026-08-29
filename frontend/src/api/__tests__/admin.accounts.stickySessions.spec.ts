import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/api/client', () => ({
  apiClient: { get, post }
}))

import { clearStickySession, clearStickySessions, listStickySessions } from '@/api/admin/accounts'

describe('admin accounts sticky sessions API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('lists sticky sessions for exactly one account', async () => {
    const response = { sessions: [{ id: 'opaque-1' }], total: 1 }
    get.mockResolvedValue({ data: response })

    await expect(listStickySessions(42)).resolves.toEqual(response)
    expect(get).toHaveBeenCalledWith('/admin/accounts/42/sticky-sessions', { signal: undefined })
  })

  it('clears one opaque session binding', async () => {
    post.mockResolvedValue({ data: { cleared: true } })

    await expect(clearStickySession(42, 'opaque-1')).resolves.toEqual({ cleared: true })
    expect(post).toHaveBeenCalledWith('/admin/accounts/42/clear-sticky-session', {
      session_id: 'opaque-1'
    })
  })

  it('clears every sticky session for exactly one account', async () => {
    post.mockResolvedValue({ data: { cleared_count: 4 } })

    await expect(clearStickySessions(42)).resolves.toEqual({ cleared_count: 4 })
    expect(post).toHaveBeenCalledWith('/admin/accounts/42/clear-sticky-sessions')
  })
})
