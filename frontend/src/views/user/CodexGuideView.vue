<template>
  <AppLayout>
    <div class="mx-auto w-full max-w-5xl">
      <header class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('codexGuide.heading') }}
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-dark-300">
          {{ t('codexGuide.description') }}
        </p>
      </header>

      <ol class="space-y-3">
        <li class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:p-6">
          <div class="flex items-start gap-3 sm:gap-4">
            <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-dark-700 dark:text-gray-200">
              1
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('codexGuide.steps.ccSwitch.title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-dark-300">
                {{ t('codexGuide.steps.ccSwitch.description') }}
              </p>
              <a
                :href="CC_SWITCH_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-primary mt-4 w-full justify-center sm:w-auto"
                data-testid="cc-switch-download"
              >
                <Icon name="download" size="sm" />
                {{ t('codexGuide.steps.ccSwitch.action') }}
              </a>
            </div>
          </div>
        </li>

        <li class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:p-6">
          <div class="flex items-start gap-3 sm:gap-4">
            <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-dark-700 dark:text-gray-200">
              2
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('codexGuide.steps.codex.title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-dark-300">
                {{ t('codexGuide.steps.codex.description') }}
              </p>

              <a
                :href="CODEX_DOWNLOAD_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-primary mt-4 w-full justify-center sm:w-auto"
                data-testid="codex-download"
              >
                <Icon name="download" size="sm" />
                {{ t('codexGuide.steps.codex.downloadAction') }}
              </a>
            </div>
          </div>
        </li>

        <li class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:p-6">
          <div class="flex items-start gap-3 sm:gap-4">
            <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-dark-700 dark:text-gray-200">
              3
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('codexGuide.steps.apiKey.title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-dark-300">
                {{ t('codexGuide.steps.apiKey.description') }}
              </p>
              <RouterLink
                to="/keys"
                class="btn btn-primary mt-4 w-full justify-center sm:w-auto"
                data-testid="create-api-key"
              >
                <Icon name="key" size="sm" />
                {{ t('codexGuide.steps.apiKey.action') }}
              </RouterLink>
            </div>
          </div>
        </li>
      </ol>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'

const CC_SWITCH_URL = 'https://github.com/farion1231/cc-switch/releases'
const CODEX_DOWNLOAD_URL = 'https://learn.chatgpt.com/docs/app'

const { t } = useI18n()
</script>
