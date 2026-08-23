import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Announcement } from '@/types'
import AnnouncementsView from '../AnnouncementsView.vue'

const {
  listAnnouncements,
  updateAnnouncement,
  getAllGroups,
  showSuccess,
  showError,
} = vi.hoisted(() => ({
  listAnnouncements: vi.fn(),
  updateAnnouncement: vi.fn(),
  getAllGroups: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    announcements: {
      list: listAnnouncements,
      update: updateAnnouncement,
      create: vi.fn(),
      delete: vi.fn(),
    },
    groups: {
      getAll: getAllGroups,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess, showError }),
}))

vi.mock('@/composables/usePersistedPageSize', () => ({
  getPersistedPageSize: () => 20,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const activeAnnouncement: Announcement = {
  id: 1,
  title: 'Active announcement',
  content: 'content',
  status: 'active',
  notify_mode: 'silent',
  targeting: { any_of: [] },
  created_at: '2026-08-23T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
}

const archivedAnnouncement: Announcement = {
  ...activeAnnouncement,
  id: 2,
  title: 'Archived announcement',
  status: 'archived',
}

const DataTableStub = {
  props: ['data'],
  template: `
    <div>
      <div v-for="row in data" :key="row.id" :data-row-id="row.id">
        <slot name="cell-actions" :row="row" />
      </div>
    </div>
  `,
}

function mountView() {
  return mount(AnnouncementsView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        TablePageLayout: {
          template: '<section><slot name="filters" /><slot name="table" /><slot name="pagination" /></section>',
        },
        DataTable: DataTableStub,
        Pagination: true,
        BaseDialog: true,
        ConfirmDialog: true,
        Select: true,
        EmptyState: true,
        Icon: true,
        AnnouncementTargetingEditor: true,
        AnnouncementReadStatusDialog: true,
        AnnouncementPopup: true,
      },
    },
  })
}

describe('AnnouncementsView archive action', () => {
  beforeEach(() => {
    for (const fn of [
      listAnnouncements,
      updateAnnouncement,
      getAllGroups,
      showSuccess,
      showError,
    ]) {
      fn.mockReset()
    }
    listAnnouncements.mockResolvedValue({
      items: [activeAnnouncement, archivedAnnouncement],
      total: 2,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    updateAnnouncement.mockResolvedValue({ ...activeAnnouncement, status: 'archived' })
    getAllGroups.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places archive before delete and archives only non-archived rows', async () => {
    const wrapper = mountView()
    await flushPromises()

    const archiveButton = wrapper.get('[data-testid="announcement-archive"]')
    const activeRow = wrapper.get('[data-row-id="1"]')
    const deleteButton = activeRow.get('[data-testid="announcement-delete"]')
    expect(
      archiveButton.element.compareDocumentPosition(deleteButton.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(wrapper.get('[data-row-id="2"]').find('[data-testid="announcement-archive"]').exists()).toBe(false)

    await archiveButton.trigger('click')
    await flushPromises()

    expect(updateAnnouncement).toHaveBeenCalledWith(1, { status: 'archived' })
    expect(showSuccess).toHaveBeenCalledWith('admin.announcements.archiveSuccess')
    expect(listAnnouncements).toHaveBeenCalledTimes(2)
  })

  it('prevents repeated archive requests while one is in flight', async () => {
    let resolveArchive!: (value: Announcement) => void
    updateAnnouncement.mockImplementationOnce(
      () => new Promise<Announcement>((resolve) => { resolveArchive = resolve }),
    )
    const wrapper = mountView()
    await flushPromises()

    const button = wrapper.get('[data-testid="announcement-archive"]')
    void button.trigger('click')
    void button.trigger('click')
    await wrapper.vm.$nextTick()

    expect(updateAnnouncement).toHaveBeenCalledTimes(1)
    expect(button.attributes('disabled')).toBeDefined()

    resolveArchive({ ...activeAnnouncement, status: 'archived' })
    await flushPromises()
  })

  it('shows an error and restores the action when archiving fails', async () => {
    updateAnnouncement.mockRejectedValueOnce({ response: { data: { detail: 'archive failed' } } })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="announcement-archive"]').trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('archive failed')
    expect(wrapper.get('[data-testid="announcement-archive"]').attributes('disabled')).toBeUndefined()
    expect(listAnnouncements).toHaveBeenCalledTimes(1)
  })
})
