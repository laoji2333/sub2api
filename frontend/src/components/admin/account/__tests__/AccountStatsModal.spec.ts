import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AccountStatsModal from '../AccountStatsModal.vue'
import { setMoneyDisplaySymbol } from '@/composables/useMoneyDisplay'

const { getStats } = vi.hoisted(() => ({ getStats: vi.fn() }))

vi.mock('@/api/admin', () => ({
  adminAPI: { accounts: { getStats } },
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('vue-chartjs', () => ({
  Line: { template: '<div class="line-chart" />' },
}))

const stats = {
  summary: {
    days: 30,
    actual_days_used: 27,
    total_cost: 542.01,
    total_user_cost: 122.05,
    total_standard_cost: 560.86,
    total_requests: 24_280,
    total_tokens: 1_170_000_000,
    avg_daily_cost: 20.07,
    avg_daily_user_cost: 4.52,
    avg_daily_requests: 899,
    avg_daily_tokens: 43_310_000,
    avg_duration_ms: 8610,
    today: { label: '08/09', cost: 67.83, user_cost: 19.88, requests: 1290, tokens: 74_760_000 },
    highest_cost_day: { label: '08/09', cost: 87.66, user_cost: 17.4, requests: 2650, tokens: 80_000_000 },
    highest_request_day: { label: '08/09', cost: 87.65, user_cost: 17.39, requests: 2651, tokens: 80_001_000 },
  },
  history: [
    { label: '08/09', actual_cost: 67.83, user_cost: 19.88, requests: 1290 },
  ],
  models: [],
  endpoints: [],
  upstream_endpoints: [],
}

describe('admin AccountStatsModal currency symbols', () => {
  beforeEach(() => {
    setMoneyDisplaySymbol('$')
    getStats.mockReset()
    getStats.mockResolvedValue(stats)
  })

  it('uses USD for account and standard costs while user-billed values use the site symbol', async () => {
    setMoneyDisplaySymbol('¥')
    const wrapper = mount(AccountStatsModal, {
      props: {
        show: false,
        account: { id: 1, name: 'Account 1', status: 'active' } as any,
      },
      global: {
        stubs: {
          BaseDialog: {
            props: ['show'],
            template: '<div v-if="show"><slot /><slot name="footer" /></div>',
          },
          LoadingSpinner: true,
          ModelDistributionChart: true,
          EndpointDistributionChart: true,
          Icon: true,
        },
      },
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    const text = wrapper.text()
    expect(getStats).toHaveBeenCalledWith(1, 30)
    expect(text).toContain('$542.01')
    expect(text).toContain('$560.86')
    expect(text).toContain('$20.07')
    expect(text).toContain('$67.83')
    expect(text).toContain('$87.66')
    expect(text).toContain('¥122.05')
    expect(text).toContain('¥4.52')
    expect(text).toContain('¥19.88')
    expect(text).not.toContain('¥542.01')
    expect(text).not.toContain('¥560.86')

    const options = (wrapper.vm as any).$?.setupState.lineChartOptions
    expect(options.plugins.tooltip.callbacks.label({
      dataset: { label: 'usage.accountBilled (USD)' },
      datasetIndex: 0,
      raw: 12.34,
    })).toBe('usage.accountBilled (USD): $12.34')
    expect(options.plugins.tooltip.callbacks.label({
      dataset: { label: 'usage.userBilled (USD)' },
      datasetIndex: 1,
      raw: 5.67,
    })).toBe('usage.userBilled (USD): ¥5.67')
    expect(options.scales.y.ticks.callback(12.34)).toBe('$12.34')
  })
})
