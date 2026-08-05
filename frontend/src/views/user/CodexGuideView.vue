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
                {{ t('codexGuide.steps.codingAssistant.title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-dark-300">
                {{ t('codexGuide.steps.codingAssistant.description') }}
              </p>

              <div class="mt-5 divide-y divide-gray-200 border-t border-gray-200 dark:divide-dark-700 dark:border-dark-700">
                <div class="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex min-w-0 items-start gap-3">
                    <Icon name="terminal" size="sm" class="mt-0.5 flex-none text-gray-500 dark:text-dark-300" />
                    <div class="min-w-0">
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Codex</h4>
                      <p class="mt-1 text-sm leading-5 text-gray-600 dark:text-dark-300">
                        {{ t('codexGuide.steps.codingAssistant.codexDescription') }}
                      </p>
                    </div>
                  </div>
                  <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-none">
                    <a
                      :href="CODEX_CLI_DOWNLOAD_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-secondary px-3"
                      data-testid="codex-cli-download"
                    >
                      <Icon name="terminal" size="sm" />
                      {{ t('codexGuide.steps.codingAssistant.cliAction') }}
                    </a>
                    <a
                      :href="CODEX_DOWNLOAD_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-secondary px-3"
                      data-testid="codex-download"
                    >
                      <Icon name="download" size="sm" />
                      {{ t('codexGuide.steps.codingAssistant.clientAction') }}
                    </a>
                  </div>
                </div>

                <div class="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex min-w-0 items-start gap-3">
                    <Icon name="terminal" size="sm" class="mt-0.5 flex-none text-gray-500 dark:text-dark-300" />
                    <div class="min-w-0">
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Claude Code</h4>
                      <p class="mt-1 text-sm leading-5 text-gray-600 dark:text-dark-300">
                        {{ t('codexGuide.steps.codingAssistant.claudeCodeDescription') }}
                      </p>
                    </div>
                  </div>
                  <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-none">
                    <a
                      :href="CLAUDE_CODE_CLI_DOWNLOAD_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-secondary px-3"
                      data-testid="claude-code-cli-download"
                    >
                      <Icon name="terminal" size="sm" />
                      {{ t('codexGuide.steps.codingAssistant.cliAction') }}
                    </a>
                    <a
                      :href="CLAUDE_CODE_DOWNLOAD_URL"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-secondary px-3"
                      data-testid="claude-code-download"
                    >
                      <Icon name="download" size="sm" />
                      {{ t('codexGuide.steps.codingAssistant.clientAction') }}
                    </a>
                  </div>
                </div>
              </div>
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

const CC_SWITCH_URL = 'https://ccswitch.io/zh/download'
const CODEX_CLI_DOWNLOAD_URL = 'https://learn.chatgpt.com/docs/codex/cli'
const CODEX_DOWNLOAD_URL = 'https://learn.chatgpt.com/docs/app'
const CLAUDE_CODE_DOWNLOAD_URL = 'https://claude.com/download'
const CLAUDE_CODE_CLI_DOWNLOAD_URL = 'https://code.claude.com/docs/zh-CN/setup'

const { t } = useI18n()
</script>
