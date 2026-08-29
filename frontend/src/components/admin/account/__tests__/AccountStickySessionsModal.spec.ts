import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountStickySessionsModal from '../AccountStickySessionsModal.vue'

const { clearStickySession, clearStickySessions, listStickySessions, showInfo, showSuccess } = vi.hoisted(() => ({
  clearStickySession: vi.fn(),
  clearStickySessions: vi.fn(),
  listStickySessions: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: { clearStickySession, clearStickySessions, listStickySessions }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showInfo, showSuccess })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (params?.count != null) return `${key}:${params.count}`
        if (params?.fingerprint != null) return `${key}:${params.fingerprint}`
        return key
      }
    })
  }
})

const account = {
  id: 42,
  name: 'Sticky account',
  platform: 'openai',
  type: 'oauth',
  proxy_id: null,
  concurrency: 3,
  priority: 1,
  status: 'active',
  error_message: null,
  last_used_at: null,
  expires_at: null,
  auto_pause_on_expired: false,
  created_at: '2026-08-29T00:00:00Z',
  updated_at: '2026-08-29T00:00:00Z',
  schedulable: true,
  rate_limited_at: null,
  rate_limit_reset_at: null,
  overload_until: null,
  temp_unschedulable_until: null
}

const sessions = [{
  id: 'opaque-session-1',
  fingerprint: 'openai:abcd…123456',
  group_id: 3,
  group_name: 'OpenAI 项目',
  expires_in_seconds: 1800,
  user_id: 9,
  username: 'alice',
  user_email: 'alice@example.com',
  api_key_id: 11,
  api_key_name: '开发项目',
  model: 'gpt-5.6',
  request_id: 'req-1',
  last_seen_at: '2026-08-30T00:00:00Z'
}]

const BaseDialogStub = {
  props: ['show', 'title'],
  emits: ['close'],
  template: '<div v-if="show"><div data-test="title">{{ title }}</div><slot /><div data-test="footer"><slot name="footer" /></div></div>'
}

const ConfirmDialogStub = {
  props: ['show', 'title', 'message'],
  emits: ['confirm', 'cancel'],
  template: '<div v-if="show" data-test="confirm-dialog"><span>{{ message }}</span><button data-test="confirm-clear" @click="$emit(\'confirm\')">confirm</button></div>'
}

function mountModal() {
  return mount(AccountStickySessionsModal, {
    props: { show: true, account: account as any },
    global: {
      stubs: {
        BaseDialog: BaseDialogStub,
        ConfirmDialog: ConfirmDialogStub,
        LoadingSpinner: true,
        Icon: true
      }
    }
  })
}

describe('AccountStickySessionsModal', () => {
  beforeEach(() => {
    listStickySessions.mockReset().mockResolvedValue({ sessions, total: 1 })
    clearStickySession.mockReset().mockResolvedValue({ cleared: true })
    clearStickySessions.mockReset().mockResolvedValue({ cleared_count: 1 })
    showInfo.mockReset()
    showSuccess.mockReset()
  })

  it('shows reliable project and user metadata before clearing one session', async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(listStickySessions).toHaveBeenCalledWith(42, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.text()).toContain('OpenAI 项目')
    expect(wrapper.text()).toContain('alice@example.com')
    expect(wrapper.text()).toContain('开发项目')
    expect(wrapper.text()).toContain('gpt-5.6')

    const clearOneButton = wrapper.findAll('button').find(button => button.text().includes('admin.accounts.clearStickySession'))
    expect(clearOneButton).toBeDefined()
    await clearOneButton!.trigger('click')
    expect(clearStickySession).not.toHaveBeenCalled()

    await wrapper.get('[data-test="confirm-clear"]').trigger('click')
    await flushPromises()

    expect(clearStickySession).toHaveBeenCalledWith(42, 'opaque-session-1')
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.clearStickySessionSuccess')
    expect(wrapper.text()).not.toContain('alice@example.com')
  })

  it('keeps clear-all inside the modal and reports the exact count', async () => {
    const wrapper = mountModal()
    await flushPromises()

    const clearAllButton = wrapper.findAll('button').find(button => button.text().includes('admin.accounts.clearAllStickySessions'))
    expect(clearAllButton).toBeDefined()
    await clearAllButton!.trigger('click')
    await wrapper.get('[data-test="confirm-clear"]').trigger('click')
    await flushPromises()

    expect(clearStickySessions).toHaveBeenCalledWith(42)
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.clearStickySessionsSuccess:1')
  })
})
