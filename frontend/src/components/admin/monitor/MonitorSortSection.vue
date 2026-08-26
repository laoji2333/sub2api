<template>
  <section v-if="modelValue.length > 0" class="space-y-2">
    <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      <span class="h-2 w-2 rounded-full" :class="statusClass"></span>
      <span>{{ title }}</span>
      <span class="font-normal tabular-nums">{{ modelValue.length }}</span>
    </div>

    <VueDraggable
      :model-value="modelValue"
      :animation="200"
      class="space-y-2"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <div
        v-for="monitor in modelValue"
        :key="monitor.id"
        class="flex cursor-grab items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md active:cursor-grabbing dark:border-dark-600 dark:bg-dark-700"
      >
        <Icon name="menu" size="md" class="shrink-0 text-gray-400" />
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-gray-900 dark:text-white">
            {{ monitor.name }}
          </div>
          <div class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ monitor.group_name || monitor.provider }} · {{ monitor.primary_model }}
          </div>
        </div>
        <div class="shrink-0 text-xs tabular-nums text-gray-400">#{{ monitor.id }}</div>
      </div>
    </VueDraggable>
  </section>
</template>

<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  modelValue: ChannelMonitor[]
  title: string
  statusClass: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ChannelMonitor[]): void
}>()
</script>
