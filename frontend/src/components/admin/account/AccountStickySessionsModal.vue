<template>
  <BaseDialog
    :show="show"
    :title="t('admin.accounts.stickySessionsTitle')"
    width="extra-wide"
    @close="handleClose"
  >
    <div class="space-y-4">
      <div
        class="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
            <Icon name="link" size="md" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-gray-100">{{ account?.name || '-' }}</div>
            <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ t('admin.accounts.stickySessionsSummary', { count: sessions.length }) }}
            </div>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-secondary self-start sm:self-auto"
          :disabled="loading"
          @click="loadSessions"
        >
          <Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" />
          {{ t('common.refresh') }}
        </button>
      </div>

      <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">
        {{ t('admin.accounts.stickySessionsMetadataHint') }}
      </p>

      <div v-if="loading" class="flex min-h-48 items-center justify-center">
        <LoadingSpinner />
      </div>

      <div
        v-else-if="loadError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/50 dark:bg-red-950/20"
      >
        <p class="text-sm text-red-700 dark:text-red-300">{{ loadError }}</p>
        <button type="button" class="btn btn-secondary mt-3" @click="loadSessions">
          {{ t('admin.accounts.stickySessionsRetry') }}
        </button>
      </div>

      <div
        v-else-if="sessions.length === 0"
        class="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-dark-600"
      >
        <Icon name="link" size="lg" class="mx-auto text-gray-300 dark:text-dark-500" />
        <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('admin.accounts.stickySessionsEmpty') }}
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('admin.accounts.stickySessionsEmptyHint') }}
        </p>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-gray-200 dark:border-dark-600">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
            <thead class="bg-gray-50 dark:bg-dark-800">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('admin.accounts.stickySession') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('admin.accounts.stickySessionProject') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('admin.accounts.stickySessionUser') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('admin.accounts.stickySessionRecentRequest') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('admin.accounts.stickySessionTTL') }}
                </th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('common.actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white dark:divide-dark-700 dark:bg-dark-900">
              <tr v-for="session in sessions" :key="session.id" class="align-top">
                <td class="whitespace-nowrap px-4 py-3">
                  <code class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-dark-700 dark:text-gray-300">
                    {{ session.fingerprint }}
                  </code>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ session.group_name || t('admin.accounts.stickySessionDefaultProject') }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">ID {{ session.group_id }}</div>
                </td>
                <td class="px-4 py-3 text-sm">
                  <template v-if="session.user_id">
                    <div class="font-medium text-gray-900 dark:text-gray-100">
                      {{ session.username || session.user_email || `#${session.user_id}` }}
                      <span v-if="session.username || session.user_email" class="ml-1 text-xs font-normal text-gray-400">#{{ session.user_id }}</span>
                    </div>
                    <div v-if="session.user_email" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ session.user_email }}
                    </div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ session.api_key_name || 'API Key' }} · #{{ session.api_key_id }}
                    </div>
                  </template>
                  <span v-else class="text-xs text-gray-400 dark:text-dark-400">
                    {{ t('admin.accounts.stickySessionUnmatched') }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <template v-if="session.last_seen_at">
                    <div class="font-medium text-gray-900 dark:text-gray-100">{{ session.model || '-' }}</div>
                    <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ formatDateTime(session.last_seen_at) }}
                    </div>
                    <div v-if="session.request_id" class="mt-1 max-w-44 truncate text-xs text-gray-400" :title="session.request_id">
                      {{ session.request_id }}
                    </div>
                  </template>
                  <span v-else class="text-xs text-gray-400 dark:text-dark-400">-</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  <span class="badge badge-warning">{{ formatTTL(session.expires_in_seconds) }}</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:text-red-400 dark:hover:bg-red-950/30"
                    @click="requestClearOne(session)"
                  >
                    {{ t('admin.accounts.clearStickySession') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <button
          type="button"
          class="btn btn-danger"
          :disabled="sessions.length === 0 || loading || clearing"
          @click="requestClearAll"
        >
          <Icon name="trash" size="sm" />
          {{ t('admin.accounts.clearAllStickySessions') }}
        </button>
        <button type="button" class="btn btn-secondary" @click="handleClose">{{ t('common.close') }}</button>
      </div>
    </template>
  </BaseDialog>

  <ConfirmDialog
    :show="showClearConfirm"
    :title="clearTarget ? t('admin.accounts.clearStickySession') : t('admin.accounts.clearAllStickySessions')"
    :message="clearConfirmMessage"
    :confirm-text="t('admin.accounts.clearStickySessionsConfirmAction')"
    :cancel-text="t('common.cancel')"
    :danger="true"
    @confirm="confirmClear"
    @cancel="closeClearConfirm"
  />
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AccountStickySession } from '@/api/admin/accounts'
import type { Account } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import BaseDialog from '@/components/common/BaseDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{
  show: boolean
  account: Account | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()
const sessions = ref<AccountStickySession[]>([])
const loading = ref(false)
const clearing = ref(false)
const loadError = ref('')
const showClearConfirm = ref(false)
const clearTarget = ref<AccountStickySession | null>(null)
let loadController: AbortController | null = null
let loadGeneration = 0

const clearConfirmMessage = computed(() => {
  if (clearTarget.value) {
    return t('admin.accounts.clearStickySessionConfirm', {
      fingerprint: clearTarget.value.fingerprint
    })
  }
  return t('admin.accounts.clearStickySessionsConfirm', {
    name: props.account?.name,
    count: sessions.value.length
  })
})

async function loadSessions() {
  if (!props.show || !props.account) return
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  const generation = ++loadGeneration
  loading.value = true
  loadError.value = ''
  try {
    const result = await adminAPI.accounts.listStickySessions(props.account.id, {
      signal: controller.signal
    })
    if (controller.signal.aborted || generation !== loadGeneration) return
    sessions.value = result.sessions
  } catch (error: any) {
    if (controller.signal.aborted || generation !== loadGeneration || error?.code === 'ERR_CANCELED') return
    console.error('Failed to load account sticky sessions:', error)
    loadError.value = extractApiErrorMessage(error, t('admin.accounts.stickySessionsLoadFailed'))
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
      loadController = null
    }
  }
}

function formatTTL(seconds: number): string {
  if (seconds < 0) return t('admin.accounts.stickySessionTTLNoExpiry')
  if (seconds < 60) return t('admin.accounts.stickySessionTTLSeconds', { count: Math.max(0, seconds) })
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return t('admin.accounts.stickySessionTTLMinutes', { count: minutes })
  return t('admin.accounts.stickySessionTTLHours', { count: Math.ceil(minutes / 60) })
}

function requestClearOne(session: AccountStickySession) {
  clearTarget.value = session
  showClearConfirm.value = true
}

function requestClearAll() {
  clearTarget.value = null
  showClearConfirm.value = true
}

function closeClearConfirm() {
  if (clearing.value) return
  showClearConfirm.value = false
  clearTarget.value = null
}

async function confirmClear() {
  const account = props.account
  if (!account || clearing.value) return
  clearing.value = true
  try {
    if (clearTarget.value) {
      const target = clearTarget.value
      const result = await adminAPI.accounts.clearStickySession(account.id, target.id)
      if (result.cleared) {
        sessions.value = sessions.value.filter(session => session.id !== target.id)
        appStore.showSuccess(t('admin.accounts.clearStickySessionSuccess'))
      } else {
        appStore.showInfo(t('admin.accounts.clearStickySessionChanged'))
        await loadSessions()
      }
    } else {
      const result = await adminAPI.accounts.clearStickySessions(account.id)
      sessions.value = []
      appStore.showSuccess(t('admin.accounts.clearStickySessionsSuccess', { count: result.cleared_count }))
    }
    showClearConfirm.value = false
    clearTarget.value = null
  } catch (error: any) {
    console.error('Failed to clear account sticky sessions:', error)
    appStore.showError(extractApiErrorMessage(error, t('admin.accounts.clearStickySessionsFailed')))
  } finally {
    clearing.value = false
  }
}

function resetState() {
  loadController?.abort()
  loadController = null
  loadGeneration += 1
  sessions.value = []
  loading.value = false
  clearing.value = false
  loadError.value = ''
  showClearConfirm.value = false
  clearTarget.value = null
}

function handleClose() {
  if (clearing.value) return
  resetState()
  emit('close')
}

watch(
  () => [props.show, props.account?.id] as const,
  ([show]) => {
    if (show) loadSessions()
    else resetState()
  },
  { immediate: true }
)

onUnmounted(resetState)
</script>
