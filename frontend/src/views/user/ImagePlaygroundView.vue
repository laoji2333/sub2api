<template>
  <AppLayout>
    <div class="mx-auto w-full max-w-[1600px] space-y-4">
      <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="min-w-0">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('imagePlayground.heading') }}
            </h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-dark-300">
              {{ t('imagePlayground.description') }}
            </p>
          </div>

          <div class="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-end">
            <label class="block min-w-0 flex-1 lg:w-80 lg:flex-none">
              <span class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-200">
                {{ t('imagePlayground.keyLabel') }}
              </span>
              <Select
                v-model="selectedKeyID"
                :options="keyOptions"
                :disabled="loadingKeys || apiKeys.length === 0"
                :placeholder="loadingKeys ? t('imagePlayground.loadingKeys') : t('imagePlayground.selectKey')"
                :aria-label="t('imagePlayground.keyLabel')"
                class="w-full"
              />
            </label>
            <button
              type="button"
              class="btn btn-secondary min-h-11 w-full justify-center sm:w-auto"
              :disabled="!playgroundUrl"
              @click="openInNewWindow"
            >
              <Icon name="externalLink" size="sm" />
              {{ t('imagePlayground.openNewWindow') }}
            </button>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-900">
        <div v-if="loadingKeys" class="flex min-h-[560px] items-center justify-center" role="status">
          <LoadingSpinner size="lg" />
          <span class="sr-only">{{ t('imagePlayground.loadingKeys') }}</span>
        </div>

        <div v-else-if="loadError" class="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
          <Icon name="exclamationCircle" size="xl" class="text-red-500" />
          <h3 class="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('imagePlayground.loadFailed') }}
          </h3>
          <p class="mt-2 max-w-lg text-sm text-gray-600 dark:text-dark-300">{{ loadError }}</p>
          <button type="button" class="btn btn-secondary mt-5" @click="loadAPIKeys">
            <Icon name="refresh" size="sm" />
            {{ t('imagePlayground.retry') }}
          </button>
        </div>

        <div v-else-if="apiKeys.length === 0" class="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
          <Icon name="sparkles" size="xl" class="text-gray-400 dark:text-dark-400" />
          <h3 class="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('imagePlayground.noKeysTitle') }}
          </h3>
          <p class="mt-2 max-w-lg text-sm text-gray-600 dark:text-dark-300">
            {{ t('imagePlayground.noKeysDescription') }}
          </p>
          <RouterLink to="/keys" class="btn btn-primary mt-5">
            <Icon name="key" size="sm" />
            {{ t('imagePlayground.createAPIKey') }}
          </RouterLink>
        </div>

        <iframe
          v-else-if="playgroundUrl"
          :key="playgroundUrl"
          :src="playgroundUrl"
          :title="t('imagePlayground.frameTitle')"
          class="block h-[calc(100vh-17rem)] min-h-[680px] w-full border-0 bg-white dark:bg-dark-950"
          allow="clipboard-read; clipboard-write"
        ></iframe>

        <div v-else class="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
          <Icon name="sparkles" size="xl" class="text-gray-400 dark:text-dark-400" />
          <h3 class="mt-4 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('imagePlayground.chooseKeyTitle') }}
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-dark-300">
            {{ t('imagePlayground.chooseKeyDescription') }}
          </p>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImagePlaygroundAPIKeyOption } from '@/api/playground'
import { listImagePlaygroundAPIKeys } from '@/api/playground'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const { t } = useI18n()
const SELECTED_KEY_STORAGE_KEY = 'image-playground-selected-key-id'
const apiKeys = ref<ImagePlaygroundAPIKeyOption[]>([])
const selectedKeyID = ref<number | null>(null)
const loadingKeys = ref(true)
const loadError = ref('')

const keyOptions = computed(() => apiKeys.value.map((key) => ({
  value: key.id,
  label: `${key.name} · ${key.group_name}`
})))

const playgroundUrl = computed(() => {
  const key = apiKeys.value.find((item) => item.id === selectedKeyID.value)
  if (!key) return ''

  const url = new URL('/image-playground-app/', window.location.origin)
  url.searchParams.set('apiUrl', `${window.location.origin}/v1`)
  url.searchParams.set('apiKey', key.key)
  url.searchParams.set('apiMode', 'images')
  url.searchParams.set('model', 'gpt-image-2')
  url.searchParams.set('profileName', `${key.name} · ${key.group_name}`)
  url.searchParams.set('transparentBackgroundMethod', 'prompt')
  return url.toString()
})

watch(selectedKeyID, (value) => {
  try {
    if (value === null) {
      localStorage.removeItem(SELECTED_KEY_STORAGE_KEY)
      return
    }
    localStorage.setItem(SELECTED_KEY_STORAGE_KEY, String(value))
  } catch {
    // 浏览器禁用存储时保持当前会话可用
  }
})

async function loadAPIKeys() {
  loadingKeys.value = true
  loadError.value = ''
  try {
    apiKeys.value = await listImagePlaygroundAPIKeys()
    try {
      const savedKeyID = selectedKeyID.value ?? Number(localStorage.getItem(SELECTED_KEY_STORAGE_KEY))
      const savedKey = apiKeys.value.find((key) => key.id === savedKeyID)
      selectedKeyID.value = savedKey?.id ?? null
      if (!savedKey) {
        localStorage.removeItem(SELECTED_KEY_STORAGE_KEY)
      }
    } catch {
      selectedKeyID.value = null
    }
  } catch (err) {
    apiKeys.value = []
    selectedKeyID.value = null
    loadError.value = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err)
  } finally {
    loadingKeys.value = false
  }
}

function openInNewWindow() {
  if (!playgroundUrl.value) return
  window.open(playgroundUrl.value, '_blank', 'noopener,noreferrer')
}

onMounted(loadAPIKeys)
</script>
