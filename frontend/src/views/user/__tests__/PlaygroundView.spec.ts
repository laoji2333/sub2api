import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PlaygroundView from '../PlaygroundView.vue'

const { listPlaygroundAPIKeys, listPlaygroundModels, sendPlaygroundResponse } = vi.hoisted(() => ({
  listPlaygroundAPIKeys: vi.fn(),
  listPlaygroundModels: vi.fn(),
  sendPlaygroundResponse: vi.fn()
}))

vi.mock('@/api/playground', async () => {
  const actual = await vi.importActual<typeof import('@/api/playground')>('@/api/playground')
  return { ...actual, listPlaygroundAPIKeys, listPlaygroundModels, sendPlaygroundResponse }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 7 } })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params?.value === undefined ? key : `${key} ${params.value}`
    })
  }
})

function mountPlayground() {
  return mount(PlaygroundView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Select: true,
        Toggle: true,
        RouterLink: true
      }
    }
  })
}

describe('PlaygroundView streaming response', () => {
  beforeEach(() => {
    localStorage.clear()
    listPlaygroundAPIKeys.mockReset()
    listPlaygroundModels.mockReset()
    sendPlaygroundResponse.mockReset()
    listPlaygroundAPIKeys.mockResolvedValue([{
      id: 1,
      name: 'Main',
      group_id: 2,
      group_name: 'Default',
      group_platform: 'openai'
    }])
    listPlaygroundModels.mockResolvedValue(['gpt-test'])
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders streamed text before the terminal response event', async () => {
    const encoder = new TextEncoder()
    let streamController: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      }
    })
    sendPlaygroundResponse.mockResolvedValue(new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    }))
    const wrapper = mountPlayground()
    await flushPromises()

    await wrapper.get('textarea').setValue('Question')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    streamController!.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n'))
    await new Promise((resolve) => setTimeout(resolve, 140))
    await flushPromises()

    expect(wrapper.get('.playground-markdown').text()).toBe('Hello')

    streamController!.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'))
    streamController!.close()
    await flushPromises()
    wrapper.unmount()
  })
})
