import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import MonitorSortDialog from '../MonitorSortDialog.vue'

const { listAllForSort, updateSortOrder, showSuccess, showError } = vi.hoisted(() => ({
  listAllForSort: vi.fn(),
  updateSortOrder: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channelMonitor: { listAllForSort, updateSortOrder },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess, showError }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

function monitor(id: number, enabled: boolean): ChannelMonitor {
  return {
    id,
    name: `monitor-${id}`,
    provider: 'openai',
    primary_model: 'gpt-test',
    group_name: '',
    enabled,
    sort_order: id * 10,
  } as ChannelMonitor
}

const BaseDialogStub = {
  props: ['show'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
}

const MonitorSortSectionStub = {
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template:
    '<button class="reverse-section" :data-title="title" @click="$emit(\'update:modelValue\', [...modelValue].reverse())">{{ title }}</button>',
}

describe('MonitorSortDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllForSort.mockResolvedValue([
      monitor(2, true),
      monitor(1, true),
      monitor(4, false),
      monitor(3, false),
    ])
    updateSortOrder.mockResolvedValue(undefined)
  })

  it('keeps enabled and disabled channels in separate sortable sections and persists their order', async () => {
    const wrapper = mount(MonitorSortDialog, {
      props: { show: true },
      global: {
        stubs: {
          BaseDialog: BaseDialogStub,
          MonitorSortSection: MonitorSortSectionStub,
          Icon: true,
        },
      },
    })
    await flushPromises()

    const sections = wrapper.findAll('.reverse-section')
    expect(sections).toHaveLength(2)
    await sections[0].trigger('click')
    await sections[1].trigger('click')
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()

    expect(updateSortOrder).toHaveBeenCalledWith([
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: 10 },
      { id: 3, sort_order: 20 },
      { id: 4, sort_order: 30 },
    ])
    expect(showSuccess).toHaveBeenCalledWith('admin.channelMonitor.sortOrderUpdated')
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
})
