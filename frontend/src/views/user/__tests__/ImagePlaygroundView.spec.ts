import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ImagePlaygroundView from '../ImagePlaygroundView.vue'

const { listImagePlaygroundAPIKeys, listImagePlaygroundModels } = vi.hoisted(() => ({
  listImagePlaygroundAPIKeys: vi.fn(),
  listImagePlaygroundModels: vi.fn()
}))

vi.mock('@/api/playground', async () => {
  const actual = await vi.importActual<typeof import('@/api/playground')>('@/api/playground')
  return { ...actual, listImagePlaygroundAPIKeys, listImagePlaygroundModels }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

function mountView() {
  return mount(ImagePlaygroundView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        LoadingSpinner: true,
        Icon: true,
        RouterLink: true,
        Select: {
          props: ['modelValue', 'options', 'ariaLabel'],
          emits: ['update:modelValue'],
          template: `<button :data-testid="ariaLabel === 'imagePlayground.keyLabel' ? 'select-key' : 'select-model'"
            @click="$emit('update:modelValue', ariaLabel === 'imagePlayground.keyLabel' ? (modelValue === 12 ? 13 : 12) : options[1]?.value)"></button>`
        }
      }
    }
  })
}

describe('ImagePlaygroundView', () => {
  beforeEach(() => {
    localStorage.clear()
    listImagePlaygroundAPIKeys.mockReset()
    listImagePlaygroundModels.mockReset()
    listImagePlaygroundModels.mockResolvedValue(['gpt-image-2', 'gpt-image-2.5-sunburst'])
    listImagePlaygroundAPIKeys.mockResolvedValue([{
      id: 12,
      name: 'Main',
      key: 'TEST_REAL_KEY_VALUE',
      group_id: 4,
      group_name: 'Images'
    }])
  })

  it('builds the import URL from the current origin and selected real key', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()

    const url = new URL(wrapper.get('iframe').attributes('src'))
    expect(url.origin).toBe(window.location.origin)
    expect(url.pathname).toBe('/image-playground-app/')
    expect(url.searchParams.get('apiUrl')).toBe(`${window.location.origin}/v1`)
    expect(url.searchParams.get('apiKey')).toBe('TEST_REAL_KEY_VALUE')
    expect(url.searchParams.get('apiMode')).toBe('images')
    expect(url.searchParams.get('model')).toBe('gpt-image-2')
    expect(url.searchParams.get('profileName')).toBe('Main · Images')
    expect(url.searchParams.get('transparentBackgroundMethod')).toBe('prompt')
    expect(listImagePlaygroundModels).toHaveBeenCalledWith('TEST_REAL_KEY_VALUE')
  })

  it('updates the embedded model and loads the next key’s own model list', async () => {
    listImagePlaygroundAPIKeys.mockResolvedValueOnce([
      { id: 12, name: 'Main', key: 'TEST_REAL_KEY_VALUE', group_id: 4, group_name: 'Images' },
      { id: 13, name: 'Other', key: 'TEST_OTHER_KEY_VALUE', group_id: 5, group_name: 'Other images' }
    ])
    listImagePlaygroundModels.mockResolvedValueOnce(['gpt-image-2', 'gpt-image-2.5-sunburst'])
    listImagePlaygroundModels.mockResolvedValueOnce(['gpt-image-1'])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="select-model"]').trigger('click')
    await flushPromises()
    expect(new URL(wrapper.get('iframe').attributes('src')).searchParams.get('model')).toBe('gpt-image-2.5-sunburst')

    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()
    const url = new URL(wrapper.get('iframe').attributes('src'))
    expect(url.searchParams.get('apiKey')).toBe('TEST_OTHER_KEY_VALUE')
    expect(url.searchParams.get('model')).toBe('gpt-image-1')
  })

  it('ignores an old model response after the selected key changes', async () => {
    listImagePlaygroundAPIKeys.mockResolvedValueOnce([
      { id: 12, name: 'Main', key: 'TEST_REAL_KEY_VALUE', group_id: 4, group_name: 'Images' },
      { id: 13, name: 'Other', key: 'TEST_OTHER_KEY_VALUE', group_id: 5, group_name: 'Other images' }
    ])
    let resolveFirst!: (models: string[]) => void
    listImagePlaygroundModels.mockReturnValueOnce(new Promise<string[]>((resolve) => { resolveFirst = resolve }))
    listImagePlaygroundModels.mockResolvedValueOnce(['gpt-image-1'])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(false)

    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()
    resolveFirst(['gpt-image-2'])
    await flushPromises()

    const url = new URL(wrapper.get('iframe').attributes('src'))
    expect(url.searchParams.get('apiKey')).toBe('TEST_OTHER_KEY_VALUE')
    expect(url.searchParams.get('model')).toBe('gpt-image-1')
  })

  it('restores the selected API key after refresh', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="select-key"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('image-playground-selected-key-id')).toBe('12')
    wrapper.unmount()

    const refreshed = mountView()
    await flushPromises()

    const url = new URL(refreshed.get('iframe').attributes('src'))
    expect(url.searchParams.get('apiKey')).toBe('TEST_REAL_KEY_VALUE')
  })
})
