import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SupportedModelChip from '../SupportedModelChip.vue'
import { setMoneyDisplaySymbol } from '@/composables/useMoneyDisplay'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

describe('SupportedModelChip', () => {
  beforeEach(() => setMoneyDisplaySymbol('$'))

  it('keeps channel model prices in USD when the site symbol is different', () => {
    setMoneyDisplaySymbol('¥')
    const wrapper = mount(SupportedModelChip, {
      props: {
        model: {
          name: 'test-model',
          platform: 'openai',
          pricing: {
            billing_mode: 'token',
            input_price: 3e-6,
            output_price: 15e-6,
            cache_write_price: null,
            cache_read_price: null,
            image_input_price: null,
            image_output_price: null,
            per_request_price: null,
            intervals: [{
              min_tokens: 0,
              max_tokens: null,
              input_price: 4e-6,
              output_price: 20e-6,
              cache_write_price: null,
              cache_read_price: null,
              per_request_price: null,
            }],
          },
        },
      },
      global: {
        stubs: {
          Teleport: true,
          PlatformIcon: true,
        },
      },
    })

    expect(wrapper.text()).toContain('$3')
    expect(wrapper.text()).toContain('$15')
    expect(wrapper.text()).toContain('$4 / $20')
    expect(wrapper.text()).not.toContain('¥')
  })
})
