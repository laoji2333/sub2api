import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MonitorCardGrid from '../MonitorCardGrid.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const baseProps = {
  window: '7d' as const,
  countdownSeconds: 30,
  detailCache: {},
}

describe('MonitorCardGrid responsive columns', () => {
  it.each([
    { name: 'loading grid', loading: true, items: [] },
    {
      name: 'monitor grid',
      loading: false,
      items: [{
        id: 1,
        name: 'OpenAI',
        provider: 'openai',
        group_name: '',
        primary_model: 'gpt-5.6',
        primary_status: 'operational',
        primary_latency_ms: 100,
        primary_ping_latency_ms: 50,
        availability_7d: 100,
        extra_models: [],
        timeline: [],
      }],
    },
  ])('switches the $name to two columns at tablet width', ({ loading, items }) => {
    const wrapper = mount(MonitorCardGrid, {
      props: { ...baseProps, loading, items },
      global: {
        stubs: {
          EmptyState: true,
          MonitorCard: true,
        },
      },
    })

    const grid = wrapper.get('.grid')
    expect(grid.classes()).toContain('grid-cols-1')
    expect(grid.classes()).toContain('min-[560px]:grid-cols-2')
    expect(grid.classes()).not.toContain('md:grid-cols-2')
  })
})
