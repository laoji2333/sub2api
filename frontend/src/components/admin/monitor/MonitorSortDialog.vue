<template>
  <BaseDialog
    :show="show"
    :title="t('admin.channelMonitor.sortOrder')"
    width="normal"
    @close="emit('close')"
  >
    <div class="space-y-5">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('admin.channelMonitor.sortOrderHint') }}
      </p>

      <div v-if="loading" class="flex justify-center py-10 text-gray-400">
        <Icon name="refresh" size="lg" class="animate-spin" />
      </div>

      <div
        v-else-if="enabledMonitors.length === 0 && disabledMonitors.length === 0"
        class="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-dark-600 dark:text-gray-400"
      >
        {{ t('admin.channelMonitor.noSortableMonitors') }}
      </div>

      <template v-else>
        <MonitorSortSection
          v-model="enabledMonitors"
          :title="t('admin.channelMonitor.enabledMonitors')"
          status-class="bg-emerald-500"
        />
        <MonitorSortSection
          v-model="disabledMonitors"
          :title="t('admin.channelMonitor.disabledMonitors')"
          status-class="bg-gray-400 dark:bg-gray-500"
        />
      </template>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || submitting || (enabledMonitors.length === 0 && disabledMonitors.length === 0)"
          @click="save"
        >
          <Icon v-if="submitting" name="refresh" size="sm" class="mr-2 animate-spin" />
          {{ t('common.save') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import MonitorSortSection from './MonitorSortSection.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()
const enabledMonitors = ref<ChannelMonitor[]>([])
const disabledMonitors = ref<ChannelMonitor[]>([])
const loading = ref(false)
const submitting = ref(false)
let loadVersion = 0

async function loadMonitors() {
  const version = ++loadVersion
  loading.value = true
  try {
    const monitors = await adminAPI.channelMonitor.listAllForSort()
    if (version !== loadVersion || !props.show) return
    enabledMonitors.value = monitors.filter((monitor) => monitor.enabled)
    disabledMonitors.value = monitors.filter((monitor) => !monitor.enabled)
  } catch (error: unknown) {
    if (version !== loadVersion || !props.show) return
    appStore.showError(
      extractApiErrorMessage(error, t('admin.channelMonitor.sortOrderLoadFailed'))
    )
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function save() {
  if (submitting.value) return
  submitting.value = true
  try {
    const updates = [...enabledMonitors.value, ...disabledMonitors.value].map((monitor, index) => ({
      id: monitor.id,
      sort_order: index * 10,
    }))
    await adminAPI.channelMonitor.updateSortOrder(updates)
    appStore.showSuccess(t('admin.channelMonitor.sortOrderUpdated'))
    emit('saved')
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t('admin.channelMonitor.sortOrderUpdateFailed'))
    )
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) void loadMonitors()
    else {
      loadVersion += 1
      enabledMonitors.value = []
      disabledMonitors.value = []
    }
  },
  { immediate: true }
)
</script>
