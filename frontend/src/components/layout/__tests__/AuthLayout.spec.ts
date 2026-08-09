import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthLayout from '../AuthLayout.vue'

const fetchPublicSettings = vi.fn()

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    siteName: 'Sub2API',
    siteLogo: '',
    cachedPublicSettings: {
      site_subtitle: 'Unified API Platform'
    },
    publicSettingsLoaded: true,
    fetchPublicSettings
  })
}))

describe('AuthLayout', () => {
  beforeEach(() => {
    fetchPublicSettings.mockClear()
  })

  it('renders the provider hero only in split mode', () => {
    const wrapper = mount(AuthLayout, {
      props: { split: true },
      slots: { default: '<form data-test="login-form" />' }
    })

    expect(wrapper.find('[data-test="auth-layout-hero"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="login-form"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Claude')
    expect(wrapper.text()).toContain('Gemini')
    expect(fetchPublicSettings).toHaveBeenCalledOnce()
  })

  it('keeps the compact layout as the default', () => {
    const wrapper = mount(AuthLayout, {
      slots: { default: '<div data-test="auth-content">Content</div>' }
    })

    expect(wrapper.find('[data-test="auth-layout-hero"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="auth-content"]').exists()).toBe(true)
  })
})
