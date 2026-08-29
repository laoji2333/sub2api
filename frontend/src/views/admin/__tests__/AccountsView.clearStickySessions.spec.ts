import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'

const { listAccounts } = vi.hoisted(() => ({ listAccounts: vi.fn() }))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag: vi.fn(),
      getBatchTodayStats: vi.fn().mockResolvedValue({ stats: {} }),
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: true, interval_minutes: 30 })
    },
    proxies: { getAll: vi.fn().mockResolvedValue([]) },
    groups: { getAll: vi.fn().mockResolvedValue([]) }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', isSimpleMode: false })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params?.count == null ? key : `${key}:${params.count}`
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

const DataTableStub = {
  props: ['data'],
  template: '<div><slot v-if="data?.[0]" name="cell-actions" :row="data[0]" /></div>'
}

const AccountActionMenuStub = {
  props: ['account'],
  emits: ['clear-sticky-sessions'],
  template: '<button v-if="account" data-test="clear-sticky" @click="$emit(\'clear-sticky-sessions\', account)">clear</button>'
}

const AccountStickySessionsModalStub = {
  props: ['show', 'account'],
  emits: ['close'],
  template: '<div v-if="show" data-test="sticky-modal">{{ account.id }}:{{ account.name }}</div>'
}

function mountView() {
  return mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: { template: '<div><slot name="table" /></div>' },
        DataTable: DataTableStub,
        AccountActionMenu: AccountActionMenuStub,
        ConfirmDialog: true,
        AccountTableActions: true,
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        Pagination: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        AccountStickySessionsModal: AccountStickySessionsModalStub,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        HelpTooltip: true,
        Icon: true,
        Teleport: true
      }
    }
  })
}

describe('AccountsView sticky sessions', () => {
  beforeEach(() => {
    localStorage.clear()
    listAccounts.mockReset().mockResolvedValue({
      items: [account],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
  })

  it('opens the account-scoped sticky session list instead of clearing immediately', async () => {
    const wrapper = mountView()
    await flushPromises()

    const moreButton = wrapper.findAll('button').find(button => button.text().includes('common.more'))
    expect(moreButton).toBeDefined()
    await moreButton!.trigger('click')
    await wrapper.get('[data-test="clear-sticky"]').trigger('click')

    expect(wrapper.get('[data-test="sticky-modal"]').text()).toContain('42:Sticky account')
  })
})
