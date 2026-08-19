<template>
  <AppLayout>
    <div class="playground-page">
      <section class="playground-panel">
        <div ref="conversationRef" class="playground-conversation" aria-live="polite">
          <div v-if="loadingKeys" class="playground-loading">
            <span class="playground-spinner"></span>
          </div>

          <div v-else-if="apiKeys.length === 0" class="playground-empty">
            <div class="playground-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 1 1-5.83 1M12 12.75a3 3 0 1 1-5.83 1m9.58-1.5a3 3 0 1 1 2.08 4.5M8.25 18.75a3 3 0 1 1-2.08-4.5m10.08-9a3 3 0 1 1 2.08 4.5M6.75 5.25a3 3 0 1 1 2.08 4.5M9 8.25l6 3.5m0-3.5-6 3.5m0 1 6 3.5" />
              </svg>
            </div>
            <h2>{{ t('playground.noAPIKeysTitle') }}</h2>
            <p>{{ t('playground.noAPIKeysDescription') }}</p>
            <RouterLink to="/keys" class="btn btn-primary mt-5">{{ t('playground.createAPIKey') }}</RouterLink>
          </div>

          <div v-else-if="messages.length === 0" class="playground-empty playground-welcome">
            <div class="playground-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.142-4.03 7.5-9 7.5a10.22 10.22 0 0 1-4.555-.99L3 19.5l1.19-3.173A6.88 6.88 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z" />
              </svg>
            </div>
            <h2>{{ t('playground.startTitle') }}</h2>
            <p>{{ t('playground.startDescription') }}</p>
            <div class="playground-starters">
              <button v-for="starter in starters" :key="starter.label" type="button" @click="useStarter(starter.prompt)">
                <span>{{ starter.label }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>

          <div v-else class="playground-messages">
            <article v-for="message in messages" :key="message.id" class="playground-message" :class="`is-${message.role}`">
              <div class="playground-message-body">
                <details v-if="message.reasoning" class="playground-reasoning" :open="message.status === 'streaming'">
                  <summary>{{ t('playground.reasoning') }}</summary>
                  <div>{{ message.reasoning }}</div>
                </details>
                <pre v-if="message.role === 'assistant' && sourceMessageID === message.id" class="playground-raw-response">{{ message.content }}</pre>
                <div
                  v-else-if="message.role === 'assistant'"
                  class="playground-markdown"
                  :class="{ 'is-typing': message.status === 'streaming' && Boolean(message.content) }"
                  v-html="renderMarkdown(message.content)"
                ></div>
                <p v-else class="whitespace-pre-wrap">{{ message.content }}</p>
                <div v-if="message.status === 'streaming' && !message.content && !message.reasoning" class="playground-thinking" role="status">
                  <span class="playground-thinking-spinner" aria-hidden="true"></span>
                  <span class="playground-thinking-copy">
                    <span>{{ t('playground.responding') }}</span>
                    <span class="playground-thinking-time">{{ t('playground.respondingElapsed', { value: waitingElapsedMs }) }}</span>
                  </span>
                </div>
                <p v-if="message.error" class="playground-error">{{ message.error }}</p>
                <div v-if="message.role === 'assistant' && message.status !== 'streaming'" class="playground-message-meta">
                  <time>{{ formatMessageTime(message.created_at) }}</time>
                  <template v-if="message.response_time_ms !== undefined">
                    <span aria-hidden="true">·</span>
                    <span>{{ t('playground.responseTime', { duration: formatResponseDuration(message.response_time_ms) }) }}</span>
                  </template>
                </div>
                <div v-if="message.role === 'assistant' && message.status !== 'streaming'" class="playground-message-actions">
                  <button type="button" :title="t('playground.copy')" :aria-label="t('playground.copy')" @click="copyMessage(message.content)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V10.875c0-.621.504-1.125 1.125-1.125H8.25m7.5 7.5h3.375c.621 0 1.125-.504 1.125-1.125V6.108c0-.298-.119-.585-.33-.796l-4.232-4.232a1.125 1.125 0 0 0-.796-.33H10.875c-.621 0-1.125.504-1.125 1.125v14.25c0 .621.504 1.125 1.125 1.125h4.875Z" /></svg>
                  </button>
                  <button
                    type="button"
                    :class="{ active: sourceMessageID === message.id }"
                    :title="sourceMessageID === message.id ? t('playground.hideSource') : t('playground.showSource')"
                    :aria-label="sourceMessageID === message.id ? t('playground.hideSource') : t('playground.showSource')"
                    :aria-pressed="sourceMessageID === message.id"
                    @click="toggleMessageSource(message.id)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 9-3 3 3 3m7.5-6 3 3-3 3M14.25 6l-4.5 12" /></svg>
                  </button>
                  <button type="button" :title="t('playground.regenerate')" :aria-label="t('playground.regenerate')" @click="regenerateMessage(message)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12a7.5 7.5 0 0 1 12.75-5.356M19.5 3.75V7.5h-3.75M19.5 12A7.5 7.5 0 0 1 6.75 17.356M4.5 20.25V16.5h3.75" /></svg>
                  </button>
                  <button type="button" class="is-danger" :title="t('playground.deleteResponse')" :aria-label="t('playground.deleteResponse')" @click="deleteMessage(message)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0V4.477c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div v-if="apiKeys.length > 0" class="playground-composer-wrap">
          <div v-if="loadError" class="playground-banner">{{ loadError }}</div>
          <div class="playground-composer" :class="{ 'is-generating': isGenerating, 'is-input-active': isInputFocused }">
            <textarea
              ref="inputRef"
              v-model="draft"
              rows="3"
              :placeholder="t('playground.inputPlaceholder')"
              :disabled="!settings.model"
              @focus="isInputFocused = true"
              @blur="isInputFocused = false"
              @keydown="handleInputKeydown"
            ></textarea>

            <div class="playground-composer-footer">
              <div class="playground-selectors">
                <div>
                  <span>{{ t('playground.route') }}</span>
                  <Select
                    :model-value="settings.api_key_id"
                    :options="apiKeySelectOptions"
                    :placeholder="t('playground.chooseRoute')"
                    @update:model-value="selectAPIKey"
                  />
                </div>
                <div>
                  <span>{{ t('playground.model') }}</span>
                  <Select
                    :model-value="settings.model"
                    :options="modelSelectOptions"
                    :disabled="loadingModels || !settings.api_key_id"
                    :placeholder="loadingModels ? t('playground.loadingModels') : t('playground.chooseModel')"
                    @update:model-value="selectModel"
                  />
                </div>
              </div>
              <div class="playground-composer-actions">
                <button
                  type="button"
                  class="playground-utility-button"
                  :disabled="messages.length === 0 || isGenerating"
                  :title="t('playground.clear')"
                  :aria-label="t('playground.clear')"
                  @click="clearConversation"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0V4.477c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
                <button
                  ref="parameterButtonRef"
                  type="button"
                  class="playground-parameter-button"
                  :class="{ active: showParameters }"
                  :title="showParameters ? t('playground.closeParameters') : t('playground.parameters')"
                  :aria-expanded="showParameters"
                  @pointerdown.stop
                  @click="toggleParameterPanel"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>
                  <span v-if="enabledParameterCount" class="playground-parameter-count">{{ enabledParameterCount }}</span>
                </button>
                <button v-if="isGenerating" type="button" class="playground-send is-stop" :title="t('playground.stop')" @click="stopGeneration">
                  <span></span>
                </button>
                <button v-else type="button" class="playground-send" :disabled="!canSend" :title="t('playground.send')" @click="sendMessage">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m3.75 3.75 16.5 8.25-16.5 8.25 3-8.25-3-8.25Zm3 8.25h7.5" /></svg>
                  <span>{{ t('playground.send') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <div v-if="showParameters" class="playground-parameter-layer">
          <section
            ref="parameterPanelRef"
            class="playground-parameter-panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'playground-parameter-title'"
            tabindex="-1"
            @keydown.esc="closeParameterPanel"
          >
            <header class="playground-parameter-header">
              <div>
                <h2 id="playground-parameter-title">{{ t('playground.parameterSettings') }}</h2>
                <p>{{ t('playground.onlyEnabledSent') }}</p>
              </div>
              <div class="playground-parameter-header-actions">
                <button type="button" class="playground-parameter-reset" @click="resetParameters">
                  {{ t('playground.resetDefaults') }}
                </button>
                <button type="button" class="playground-parameter-close" :aria-label="t('playground.closeParameterPanel')" @click="closeParameterPanel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </div>
            </header>

            <div class="playground-parameter-summary">
              <span>{{ t('playground.enabledParameters', { count: enabledParameterCount }) }}</span>
              <i :style="{ width: `${enabledParameterCount / 3 * 100}%` }"></i>
            </div>

            <label class="playground-system-prompt">
              <span>{{ t('playground.systemPrompt') }}</span>
              <small>{{ t('playground.systemPromptDescription') }}</small>
              <textarea v-model="settings.system_prompt" rows="2" :placeholder="t('playground.systemPromptPlaceholder')"></textarea>
            </label>

            <div class="playground-parameter-list">
              <article class="playground-parameter-item" :class="{ disabled: !settings.parameters_enabled.temperature }">
                <div class="playground-parameter-item-head">
                  <div>
                    <span>{{ t('playground.temperature') }}</span>
                    <small>{{ t('playground.temperatureDescription') }}</small>
                  </div>
                  <div class="playground-parameter-switch-wrap">
                    <b>{{ settings.parameters_enabled.temperature ? settings.temperature : t('playground.modelDefault') }}</b>
                    <Toggle v-model="settings.parameters_enabled.temperature" :aria-label="t('playground.enableParameter', { parameter: t('playground.temperature') })" />
                  </div>
                </div>
                <div v-if="settings.parameters_enabled.temperature" class="playground-parameter-control">
                  <input v-model.number="settings.temperature" type="range" min="0" max="2" step="0.1" />
                  <input v-model.number="settings.temperature" type="number" min="0" max="2" step="0.1" />
                </div>
              </article>

              <article class="playground-parameter-item" :class="{ disabled: !settings.parameters_enabled.top_p }">
                <div class="playground-parameter-item-head">
                  <div>
                    <span>{{ t('playground.topP') }}</span>
                    <small>{{ t('playground.topPDescription') }}</small>
                  </div>
                  <div class="playground-parameter-switch-wrap">
                    <b>{{ settings.parameters_enabled.top_p ? settings.top_p : t('playground.modelDefault') }}</b>
                    <Toggle v-model="settings.parameters_enabled.top_p" :aria-label="t('playground.enableParameter', { parameter: t('playground.topP') })" />
                  </div>
                </div>
                <div v-if="settings.parameters_enabled.top_p" class="playground-parameter-control">
                  <input v-model.number="settings.top_p" type="range" min="0" max="1" step="0.05" />
                  <input v-model.number="settings.top_p" type="number" min="0" max="1" step="0.05" />
                </div>
              </article>

              <article class="playground-parameter-item" :class="{ disabled: !settings.parameters_enabled.max_tokens }">
                <div class="playground-parameter-item-head">
                  <div>
                    <span>{{ t('playground.maxTokens') }}</span>
                    <small>{{ t('playground.maxTokensDescription') }}</small>
                  </div>
                  <div class="playground-parameter-switch-wrap">
                    <b>{{ settings.parameters_enabled.max_tokens ? settings.max_tokens : t('playground.modelDefault') }}</b>
                    <Toggle v-model="settings.parameters_enabled.max_tokens" :aria-label="t('playground.enableParameter', { parameter: t('playground.maxTokens') })" />
                  </div>
                </div>
                <div v-if="settings.parameters_enabled.max_tokens" class="playground-parameter-control is-number-only">
                  <input
                    v-model.number="settings.max_tokens"
                    type="number"
                    :min="PLAYGROUND_MIN_MAX_TOKENS"
                    :max="PLAYGROUND_MAX_MAX_TOKENS"
                    step="128"
                    @change="normalizeMaxTokens"
                  />
                </div>
              </article>
            </div>
          </section>
        </div>
      </Teleport>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import { useAuthStore } from '@/stores/auth'
import {
  listPlaygroundAPIKeys,
  listPlaygroundModels,
  readPlaygroundError,
  sendPlaygroundResponse,
  type PlaygroundAPIKeyOption,
  type PlaygroundResponseInputMessage,
  type PlaygroundResponseRequest
} from '@/api/playground'
import {
  clearPlaygroundSnapshot,
  defaultPlaygroundSettings,
  loadPlaygroundSnapshot,
  normalizePlaygroundMaxTokens,
  PLAYGROUND_MAX_MAX_TOKENS,
  PLAYGROUND_MIN_MAX_TOKENS,
  savePlaygroundSnapshot,
  type PlaygroundMessage,
  type PlaygroundSettings
} from '@/features/playground/storage'
import { consumePlaygroundStream, extractPlaygroundResponse } from '@/features/playground/stream'
import { buildPlaygroundParameterPayload } from '@/features/playground/parameters'
import { createPlaygroundTypewriter, type PlaygroundTypewriter } from '@/features/playground/typewriter'

const { t } = useI18n()
const authStore = useAuthStore()
const userID = computed(() => Number(authStore.user?.id || 0))
const messages = ref<PlaygroundMessage[]>([])
const settings = reactive<PlaygroundSettings>(defaultPlaygroundSettings())
const apiKeys = ref<PlaygroundAPIKeyOption[]>([])
const models = ref<string[]>([])
const draft = ref('')
const loadingKeys = ref(true)
const loadingModels = ref(false)
const loadError = ref('')
const showParameters = ref(false)
const sourceMessageID = ref<string | null>(null)
const isGenerating = ref(false)
const isInputFocused = ref(false)
const waitingElapsedMs = ref(0)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const conversationRef = ref<HTMLElement | null>(null)
const parameterPanelRef = ref<HTMLElement | null>(null)
const parameterButtonRef = ref<HTMLButtonElement | null>(null)
let activeController: AbortController | null = null
let activeTypewriter: PlaygroundTypewriter | null = null
let modelRequestGeneration = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let waitingTimer: ReturnType<typeof setInterval> | null = null

const apiKeySelectOptions = computed(() => apiKeys.value.map((key) => ({
  value: key.id,
  label: `${key.group_name} · ${key.name}`,
  description: key.group_platform
})))
const modelSelectOptions = computed(() => models.value.map((model) => ({ value: model, label: model })))
const canSend = computed(() => Boolean(draft.value.trim() && settings.api_key_id && settings.model && !isGenerating.value))
const enabledParameterCount = computed(() => Object.values(settings.parameters_enabled).filter(Boolean).length)
const starters = computed(() => [
  { label: t('playground.starterAnalyze'), prompt: t('playground.starterAnalyzePrompt') },
  { label: t('playground.starterSummarize'), prompt: t('playground.starterSummarizePrompt') },
  { label: t('playground.starterCode'), prompt: t('playground.starterCodePrompt') },
  { label: t('playground.starterAdvice'), prompt: t('playground.starterAdvicePrompt') }
])

function newMessageID(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content || '') as string)
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp))
}

function formatResponseDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return t('playground.durationMilliseconds', { value: Math.max(1, Math.round(durationMs)) })
  }
  return t('playground.durationSeconds', { value: (durationMs / 1000).toFixed(2) })
}

function scheduleSave() {
  if (!userID.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    savePlaygroundSnapshot(userID.value, { messages: messages.value, settings: { ...settings } })
  }, 250)
}

function scrollToBottom() {
  void nextTick(() => {
    if (conversationRef.value) conversationRef.value.scrollTop = conversationRef.value.scrollHeight
  })
}

async function loadModels(apiKeyID: number, preferredModel = '') {
  const generation = ++modelRequestGeneration
  loadingModels.value = true
  loadError.value = ''
  try {
    const nextModels = await listPlaygroundModels(apiKeyID)
    if (generation !== modelRequestGeneration) return
    models.value = nextModels
    settings.model = nextModels.includes(preferredModel) ? preferredModel : (nextModels[0] ?? '')
  } catch (error) {
    if (generation !== modelRequestGeneration) return
    models.value = []
    settings.model = ''
    loadError.value = String((error as { message?: unknown })?.message || t('playground.modelLoadFailed'))
  } finally {
    if (generation === modelRequestGeneration) loadingModels.value = false
  }
}

async function loadOptions() {
  loadingKeys.value = true
  loadError.value = ''
  try {
    apiKeys.value = await listPlaygroundAPIKeys()
    const savedKey = apiKeys.value.find((key) => key.id === settings.api_key_id)
    settings.api_key_id = savedKey?.id ?? apiKeys.value[0]?.id ?? null
    if (settings.api_key_id) await loadModels(settings.api_key_id, settings.model)
  } catch (error) {
    loadError.value = String((error as { message?: unknown })?.message || t('playground.loadFailed'))
  } finally {
    loadingKeys.value = false
  }
}

function selectAPIKey(value: string | number | boolean | null) {
  const keyID = Number(value)
  if (!Number.isFinite(keyID) || keyID <= 0 || keyID === settings.api_key_id) return
  settings.api_key_id = keyID
  void loadModels(keyID)
}

function selectModel(value: string | number | boolean | null) {
  settings.model = typeof value === 'string' ? value : ''
}

function useStarter(prompt: string) {
  draft.value = prompt
  void nextTick(() => {
    resizeComposerInput()
    inputRef.value?.focus()
  })
}

function resizeComposerInput() {
  const input = inputRef.value
  if (!input) return
  input.style.height = 'auto'
  const styles = window.getComputedStyle(input)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24
  const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  const maxHeight = lineHeight * 8 + verticalPadding
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    if (canSend.value) void sendMessage()
  }
}

function buildRequestInput(): PlaygroundResponseInputMessage[] {
  const payload: PlaygroundResponseInputMessage[] = []
  for (const message of messages.value) {
    if (!message.content.trim() || message.status === 'error') continue
    payload.push({ role: message.role, content: message.content })
  }
  return payload
}

function stopWaitingTimer() {
  if (waitingTimer) clearInterval(waitingTimer)
  waitingTimer = null
}

function toggleParameterPanel() {
  showParameters.value = !showParameters.value
  if (showParameters.value) void nextTick(() => parameterPanelRef.value?.focus())
}

function closeParameterPanel() {
  showParameters.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!showParameters.value || !(event.target instanceof Node)) return
  if (parameterPanelRef.value?.contains(event.target) || parameterButtonRef.value?.contains(event.target)) return
  closeParameterPanel()
}

function resetParameters() {
  const defaults = defaultPlaygroundSettings()
  settings.temperature = defaults.temperature
  settings.top_p = defaults.top_p
  settings.max_tokens = defaults.max_tokens
  Object.assign(settings.parameters_enabled, defaults.parameters_enabled)
}

function normalizeMaxTokens() {
  settings.max_tokens = normalizePlaygroundMaxTokens(settings.max_tokens)
}

async function sendMessage() {
  if (!canSend.value || !settings.api_key_id) return
  const userMessage: PlaygroundMessage = {
    id: newMessageID(), role: 'user', content: draft.value.trim(), status: 'complete', created_at: Date.now()
  }
  messages.value.push(userMessage)
  draft.value = ''
  await requestAssistantResponse()
}

async function requestAssistantResponse() {
  if (!settings.api_key_id || !settings.model || isGenerating.value) return
  const assistantMessage = reactive<PlaygroundMessage>({
    id: newMessageID(), role: 'assistant', content: '', reasoning: '', status: 'streaming', created_at: Date.now()
  })
  messages.value.push(assistantMessage)
  isGenerating.value = true
  loadError.value = ''
  activeController = new AbortController()
  const requestStartedAt = Date.now()
  waitingElapsedMs.value = 0
  stopWaitingTimer()
  waitingTimer = setInterval(() => {
    waitingElapsedMs.value = Date.now() - requestStartedAt
  }, 50)
  let receivedResponseDelta = false
  const markResponseStarted = () => {
    if (receivedResponseDelta) return
    receivedResponseDelta = true
    waitingElapsedMs.value = Date.now() - requestStartedAt
    stopWaitingTimer()
  }
  const typewriter = createPlaygroundTypewriter((chunk) => {
    markResponseStarted()
    assistantMessage.content += chunk
    scrollToBottom()
  })
  activeTypewriter = typewriter
  scrollToBottom()

  const payload: PlaygroundResponseRequest = {
    model: settings.model,
    input: buildRequestInput(),
    stream: true,
    ...buildPlaygroundParameterPayload(settings)
  }
  if (settings.system_prompt.trim()) payload.instructions = settings.system_prompt.trim()

  try {
    const response = await sendPlaygroundResponse(settings.api_key_id, payload, activeController.signal)
    if (!response.ok) throw new Error(await readPlaygroundError(response))

    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json() as Record<string, any>
      const extracted = extractPlaygroundResponse(result)
      typewriter.push(extracted.content)
      assistantMessage.reasoning = extracted.reasoning
      if (extracted.reasoning) markResponseStarted()
    } else if (response.body) {
      await consumePlaygroundStream(response.body, {
        onContent: (chunk) => { typewriter.push(chunk) },
        onReasoning: (chunk) => { markResponseStarted(); assistantMessage.reasoning = (assistantMessage.reasoning ?? '') + chunk; scrollToBottom() }
      })
    } else {
      throw new Error(t('playground.responseError'))
    }
    assistantMessage.response_time_ms = Date.now() - requestStartedAt
    await typewriter.finish()
    assistantMessage.status = 'complete'
  } catch (error) {
    typewriter.flush()
    assistantMessage.response_time_ms = Date.now() - requestStartedAt
    if (activeController?.signal.aborted) {
      assistantMessage.status = 'complete'
      if (!assistantMessage.content) assistantMessage.content = t('playground.stopped')
    } else {
      assistantMessage.status = 'error'
      assistantMessage.error = String((error as Error)?.message || t('playground.responseError'))
    }
  } finally {
    stopWaitingTimer()
    if (activeTypewriter === typewriter) activeTypewriter = null
    activeController = null
    isGenerating.value = false
    scheduleSave()
    scrollToBottom()
  }
}

function stopGeneration() {
  activeTypewriter?.flush()
  activeController?.abort()
}

function clearConversation() {
  if (!window.confirm(t('playground.clearConfirm'))) return
  messages.value = []
  sourceMessageID.value = null
  clearPlaygroundSnapshot(userID.value)
  scheduleSave()
}

function toggleMessageSource(messageID: string) {
  sourceMessageID.value = sourceMessageID.value === messageID ? null : messageID
}

function regenerateMessage(message: PlaygroundMessage) {
  if (isGenerating.value) return
  const messageIndex = messages.value.findIndex((item) => item.id === message.id)
  if (messageIndex < 1) return
  if (messageIndex < messages.value.length - 1 && !window.confirm(t('playground.regenerateConfirm'))) return

  messages.value = messages.value.slice(0, messageIndex)
  if (sourceMessageID.value === message.id) sourceMessageID.value = null
  void requestAssistantResponse()
}

function deleteMessage(message: PlaygroundMessage) {
  if (!window.confirm(t('playground.deleteResponseConfirm'))) return
  messages.value = messages.value.filter((item) => item.id !== message.id)
  if (sourceMessageID.value === message.id) sourceMessageID.value = null
}

async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    // Clipboard permission can be denied; keep the conversation unchanged.
  }
}

watch([messages, settings], scheduleSave, { deep: true })
watch(messages, scrollToBottom, { deep: true })
watch(draft, () => { void nextTick(resizeComposerInput) })

onMounted(() => {
  const snapshot = loadPlaygroundSnapshot(userID.value)
  messages.value = snapshot.messages
  Object.assign(settings, snapshot.settings)
  void loadOptions()
  scrollToBottom()
  void nextTick(resizeComposerInput)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  stopWaitingTimer()
  activeTypewriter?.flush()
  activeController?.abort()
  if (saveTimer) clearTimeout(saveTimer)
  if (userID.value) savePlaygroundSnapshot(userID.value, { messages: messages.value, settings: { ...settings } })
})
</script>

<style scoped>
.playground-page { @apply -m-1 flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col md:-m-2 md:h-[calc(100dvh-6rem)] lg:-m-3 lg:h-[calc(100dvh-6.5rem)]; }
.playground-panel { @apply flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-dark-700 dark:bg-dark-900/80; }
.playground-conversation { @apply min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8; }
.playground-loading { @apply flex h-full min-h-72 items-center justify-center; }
.playground-spinner { @apply h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500 dark:border-dark-700 dark:border-t-primary-400; }
.playground-empty { @apply mx-auto flex min-h-[42vh] max-w-2xl flex-col items-center justify-center text-center; }
.playground-empty-icon { @apply mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 shadow-sm dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300; }
.playground-empty-icon svg { @apply h-6 w-6; }
.playground-empty h2 { @apply text-xl font-semibold tracking-tight text-gray-900 dark:text-white md:text-2xl; }
.playground-empty > p { @apply mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-dark-300; }
.playground-starters { @apply mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2; }
.playground-starters button { @apply flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-200 dark:hover:border-primary-700; }
.playground-starters svg { @apply h-4 w-4 text-gray-400; }
.playground-messages { @apply mx-auto w-full max-w-4xl space-y-8 pb-4; }
.playground-message { @apply flex items-start; }
.playground-message.is-user { @apply justify-end; }
.playground-message-body { @apply min-w-0 max-w-full text-sm leading-7 text-gray-800 dark:text-gray-100; }
.is-user .playground-message-body { @apply max-w-[85%] md:max-w-[78%]; }
.is-user .playground-message-body { @apply rounded-2xl rounded-tr-md bg-gray-100 px-4 py-2.5 dark:bg-dark-700; }
.playground-reasoning { @apply mb-3 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-500 dark:border-dark-700 dark:bg-dark-800/80 dark:text-dark-300; }
.playground-reasoning summary { @apply cursor-pointer select-none font-medium text-gray-600 dark:text-gray-300; }
.playground-reasoning div { @apply mt-2 whitespace-pre-wrap border-t border-gray-200 pt-2 leading-6 dark:border-dark-700; }
.playground-error { @apply mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300; }
.playground-message-meta { @apply mt-1 flex min-h-4 items-center gap-1.5 text-[11px] leading-none text-gray-400 dark:text-dark-400; }
.playground-message-actions { @apply mt-2 flex h-8 items-center gap-1; }
.playground-message-actions button { @apply flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:hover:bg-dark-700 dark:hover:text-gray-200; }
.playground-message-actions button.active { @apply bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300; }
.playground-message-actions button.is-danger { @apply hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-300; }
.playground-message-actions svg { @apply h-4 w-4; }
.playground-raw-response { @apply m-0 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-6 text-gray-700 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-200; }
.playground-thinking { @apply flex min-h-10 items-start gap-2 text-sm text-gray-500 dark:text-dark-300; }
.playground-thinking-spinner { @apply mt-1.5 h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-dark-600 dark:border-t-dark-200; }
.playground-thinking-copy { @apply flex flex-col leading-6; }
.playground-thinking-time { @apply text-xs tabular-nums text-gray-400 dark:text-dark-400; }
.playground-composer-wrap { @apply z-10 mx-auto w-full max-w-5xl flex-none px-3 pt-3 md:px-6 md:pt-5; padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
.playground-banner { @apply mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300; }
.playground-composer { @apply overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)] transition dark:border-dark-600 dark:bg-dark-800 dark:shadow-black/30; }
.playground-composer.is-generating { @apply border-primary-300 dark:border-primary-800; }
.playground-composer.is-input-active { @apply border-blue-500 ring-2 ring-blue-500/30; }
.playground-composer > textarea { @apply block min-h-12 max-h-[13.5rem] w-full resize-none overflow-y-hidden border-0 bg-transparent px-4 py-3 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:placeholder:text-dark-400 md:px-5; }
.playground-composer-footer { @apply flex flex-col gap-3 border-t border-gray-100 px-3 py-3 dark:border-dark-700 md:flex-row md:items-end md:justify-between; }
.playground-selectors { @apply grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 md:max-w-2xl; }
.playground-selectors > div > span { @apply mb-1 block px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-dark-400; }
.playground-selectors :deep(.select-trigger) { @apply min-h-10 py-2; }
.playground-composer-actions { @apply flex items-center justify-end gap-2; }
.playground-utility-button, .playground-parameter-button { @apply relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-dark-700 dark:hover:text-gray-200; }
.playground-parameter-button.active { @apply bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300; }
.playground-utility-button svg, .playground-parameter-button svg { @apply h-5 w-5; }
.playground-parameter-count { @apply absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-dark-800; }
.playground-send { @apply flex h-10 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-dark-700 dark:disabled:text-dark-400; }
.playground-send svg { @apply h-5 w-5; }
.playground-send.is-stop { @apply w-10 px-0 bg-gray-800 hover:bg-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white; }
.playground-send.is-stop span { @apply h-3 w-3 rounded-[3px] bg-current; }
.playground-markdown :deep(p) { @apply mb-3 last:mb-0; }
.playground-markdown :deep(ul), .playground-markdown :deep(ol) { @apply mb-3 ml-5; }
.playground-markdown :deep(ul) { @apply list-disc; }
.playground-markdown :deep(ol) { @apply list-decimal; }
.playground-markdown :deep(pre) { @apply my-3 overflow-x-auto rounded-xl bg-gray-950 p-4 text-[13px] leading-6 text-gray-100; }
.playground-markdown :deep(code:not(pre code)) { @apply rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-primary-700 dark:bg-dark-700 dark:text-primary-300; }
.playground-markdown :deep(a) { @apply text-primary-600 underline decoration-primary-300 underline-offset-2 dark:text-primary-300; }
.playground-markdown :deep(blockquote) { @apply my-3 border-l-2 border-gray-300 pl-4 text-gray-500 dark:border-dark-500 dark:text-dark-300; }
.playground-markdown.is-typing :deep(> :last-child)::after { content: ''; display: inline-block; width: 0.42rem; height: 0.92rem; margin-left: 0.22rem; border-radius: 0.1rem; background: currentColor; opacity: 0.48; vertical-align: -0.08rem; animation: playground-caret-blink 0.9s steps(1, end) infinite; }
@keyframes playground-caret-blink { 50% { opacity: 0; } }
.playground-parameter-layer { @apply fixed inset-0 z-[80] flex items-end justify-center bg-gray-950/45 backdrop-blur-[2px] md:pointer-events-none md:items-end md:justify-end md:bg-transparent md:p-6 md:backdrop-blur-none; }
.playground-parameter-panel { @apply pointer-events-auto max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl outline-none dark:border-dark-600 dark:bg-dark-800 dark:text-white md:mb-20 md:mr-10 md:w-[23rem] md:rounded-2xl; }
.playground-parameter-header { @apply flex items-start justify-between gap-4 border-b border-gray-100 pb-3 dark:border-dark-700; }
.playground-parameter-header h2 { @apply text-sm font-semibold; }
.playground-parameter-header p { @apply mt-1 text-xs leading-5 text-gray-500 dark:text-dark-300; }
.playground-parameter-header-actions { @apply flex shrink-0 items-center gap-1; }
.playground-parameter-reset { @apply rounded-lg px-2 py-1.5 text-xs font-medium text-primary-600 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-primary-300 dark:hover:bg-primary-950/40; }
.playground-parameter-close { @apply flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:hover:bg-dark-700 dark:hover:text-gray-200; }
.playground-parameter-close svg { @apply h-4 w-4; }
.playground-parameter-summary { @apply relative mt-3 flex h-8 items-center overflow-hidden rounded-lg bg-gray-50 px-3 text-[11px] font-medium text-gray-500 dark:bg-dark-900/60 dark:text-dark-300; }
.playground-parameter-summary i { @apply absolute bottom-0 left-0 h-0.5 bg-primary-500 transition-[width] duration-200; }
.playground-system-prompt { @apply mt-3 block rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-dark-700 dark:bg-dark-900/40; }
.playground-system-prompt > span, .playground-parameter-item-head span { @apply block text-sm font-semibold; }
.playground-system-prompt small, .playground-parameter-item-head small { @apply mt-0.5 block text-xs font-normal leading-5 text-gray-500 dark:text-dark-300; }
.playground-system-prompt textarea { @apply mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 text-gray-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 dark:border-dark-600 dark:bg-dark-800 dark:text-white; }
.playground-parameter-list { @apply mt-3 space-y-2; }
.playground-parameter-item { @apply rounded-xl border border-gray-200 bg-white p-3 transition dark:border-dark-700 dark:bg-dark-800; }
.playground-parameter-item.disabled { @apply bg-gray-50/60 dark:bg-dark-900/30; }
.playground-parameter-item-head { @apply flex items-start justify-between gap-3; }
.playground-parameter-item.disabled .playground-parameter-item-head > div:first-child { @apply opacity-60; }
.playground-parameter-switch-wrap { @apply flex shrink-0 items-center gap-2; }
.playground-parameter-switch-wrap b { @apply max-w-20 truncate rounded-md border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:border-dark-600 dark:text-dark-300; }
.playground-parameter-control { @apply mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-dark-700; }
.playground-parameter-control input[type='range'] { @apply h-1.5 min-w-0 flex-1 cursor-pointer accent-primary-600; }
.playground-parameter-control input[type='number'] { @apply w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right font-mono text-xs text-gray-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 dark:border-dark-600 dark:bg-dark-900 dark:text-white; }
.playground-parameter-control.is-number-only input { @apply w-full text-left; }
@media (prefers-reduced-motion: reduce) { .playground-starters button, .playground-composer, .playground-parameter-summary i { transition: none; } .playground-markdown.is-typing :deep(> :last-child)::after, .playground-thinking-spinner { animation: none; } }
</style>
