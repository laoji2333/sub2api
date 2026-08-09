<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden"
    :class="split ? 'px-4 py-6 sm:px-6 lg:px-8' : 'p-4'"
  >
    <!-- Background -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950"
    ></div>

    <!-- Decorative Elements -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-400/20 blur-3xl"
      ></div>
      <div
        class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary-500/15 blur-3xl"
      ></div>
      <div
        class="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-300/10 blur-3xl"
      ></div>
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(20,184,166,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.035)_1px,transparent_1px)] bg-[size:64px_64px]"
      ></div>
    </div>

    <!-- Split login layout -->
    <div
      v-if="split"
      class="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-2xl shadow-gray-900/10 backdrop-blur-2xl dark:border-dark-700/70 dark:bg-dark-900/70 dark:shadow-black/30 lg:min-h-[660px] lg:grid-cols-[1.08fr_0.92fr]"
    >
      <section
        data-test="auth-layout-hero"
        class="relative hidden overflow-hidden bg-gradient-to-br from-dark-950 via-dark-900 to-primary-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12"
      >
        <div class="pointer-events-none absolute inset-0">
          <div
            class="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl"
          ></div>
          <div
            class="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl"
          ></div>
          <div
            class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]"
          ></div>
        </div>

        <div v-if="settingsLoaded" class="relative z-10 flex items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 shadow-lg shadow-primary-500/20 ring-1 ring-white/15 backdrop-blur"
          >
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
          </div>
          <div class="min-w-0">
            <h1 class="truncate text-xl font-semibold tracking-tight">{{ siteName }}</h1>
            <p class="mt-0.5 truncate text-xs text-white/55">{{ siteSubtitle }}</p>
          </div>
        </div>

        <div class="relative z-10 mx-auto w-full max-w-md">
          <div class="mb-7 text-center">
            <div
              class="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.6rem] bg-white/10 p-2.5 shadow-2xl shadow-primary-500/20 ring-1 ring-white/15 backdrop-blur-xl"
            >
              <img :src="siteLogo || '/logo.svg'" alt="" class="h-full w-full object-contain" />
            </div>
            <div class="mx-auto mt-5 h-10 w-px bg-gradient-to-b from-primary-400/80 to-white/10"></div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="provider in providers"
              :key="provider.platform"
              class="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-4 text-center shadow-lg backdrop-blur-md"
            >
              <div
                class="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-primary-200 ring-1 ring-white/10"
              >
                <PlatformIcon :platform="provider.platform" size="lg" />
              </div>
              <span class="text-xs font-medium text-white/80">{{ provider.label }}</span>
            </div>
          </div>

          <div class="mx-auto flex h-12 w-2/3 items-end justify-around">
            <span class="h-full w-px rotate-[24deg] bg-gradient-to-b from-white/15 to-primary-400/70"></span>
            <span class="h-full w-px bg-gradient-to-b from-white/15 to-primary-400/70"></span>
            <span class="h-full w-px -rotate-[24deg] bg-gradient-to-b from-white/15 to-primary-400/70"></span>
          </div>

          <div
            class="flex items-center justify-between rounded-2xl border border-primary-300/20 bg-primary-400/10 px-5 py-4 shadow-xl shadow-black/10 backdrop-blur-md"
          >
            <div>
              <p class="text-[10px] uppercase tracking-[0.24em] text-primary-200/60">Unified API</p>
              <p class="mt-1 font-mono text-sm text-white/85">POST /v1/responses</p>
            </div>
            <span
              class="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-300/20"
            >
              200 OK
            </span>
          </div>
        </div>

        <div class="relative z-10 flex items-center gap-3 text-xs text-white/40">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_12px_rgba(45,212,191,0.9)]"></span>
          OpenAI · Claude · Gemini
        </div>
      </section>

      <section class="flex min-w-0 flex-col justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-14">
        <div v-if="settingsLoaded" class="mb-7 text-center lg:hidden">
          <div
            class="mb-3 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-primary-500/25"
          >
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
          </div>
          <h1 class="text-gradient text-2xl font-bold">{{ siteName }}</h1>
          <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ siteSubtitle }}</p>
        </div>

        <div
          data-test="auth-layout-card"
          class="rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-xl shadow-gray-900/[0.06] backdrop-blur-xl dark:border-dark-700/80 dark:bg-dark-900/85 dark:shadow-black/20 sm:p-8"
        >
          <slot />
        </div>

        <div class="mt-6 text-center text-sm">
          <slot name="footer" />
        </div>
        <div class="mt-6 text-center text-xs text-gray-400 dark:text-dark-500">
          &copy; {{ currentYear }} {{ siteName }}. All rights reserved.
        </div>
      </section>
    </div>

    <!-- Default auth layout -->
    <div v-else class="relative z-10 w-full max-w-md">
      <div class="mb-8 text-center">
        <template v-if="settingsLoaded">
          <div
            class="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-primary-500/30"
          >
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
          </div>
          <h1 class="text-gradient mb-2 text-3xl font-bold">{{ siteName }}</h1>
          <p class="text-sm text-gray-500 dark:text-dark-400">{{ siteSubtitle }}</p>
        </template>
      </div>

      <div data-test="auth-layout-card" class="card-glass rounded-2xl p-8 shadow-glass">
        <slot />
      </div>

      <div class="mt-6 text-center text-sm">
        <slot name="footer" />
      </div>
      <div class="mt-8 text-center text-xs text-gray-400 dark:text-dark-500">
        &copy; {{ currentYear }} {{ siteName }}. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { useAppStore } from '@/stores'
import type { GroupPlatform } from '@/types'
import { sanitizeUrl } from '@/utils/url'

interface Props {
  split?: boolean
}

withDefaults(defineProps<Props>(), {
  split: false
})

const appStore = useAppStore()

const providers: Array<{ platform: GroupPlatform; label: string }> = [
  { platform: 'openai', label: 'OpenAI' },
  { platform: 'anthropic', label: 'Claude' },
  { platform: 'gemini', label: 'Gemini' }
]

const siteName = computed(() => appStore.siteName || 'Sub2API')
const siteLogo = computed(() =>
  sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true })
)
const siteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle || 'Subscription to API Conversion Platform'
)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)
const currentYear = computed(() => new Date().getFullYear())

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>

<style scoped>
.text-gradient {
  @apply bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent;
}
</style>
