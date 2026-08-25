import type { GroupPlatform } from '@/types'
import { platformLabel } from '@/utils/platformColors'

export interface KeyGroupPlatformTab {
  value: GroupPlatform
  label: string
}

export function getKeyGroupPlatformTabs(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): KeyGroupPlatformTab[] {
  const platforms = Array.from(new Set(groups.map((group) => group.platform)))
  const openAIIndex = platforms.indexOf('openai')
  if (openAIIndex > 0) {
    platforms.splice(openAIIndex, 1)
    platforms.unshift('openai')
  }

  return platforms.map((value) => ({
    value,
    label: value === 'anthropic' ? 'Claude' : platformLabel(value)
  }))
}

export function getDefaultKeyGroupPlatform(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): GroupPlatform | null {
  return getKeyGroupPlatformTabs(groups)[0]?.value ?? null
}

export function filterKeyGroupsByPlatform<T extends { platform: GroupPlatform }>(
  groups: readonly T[],
  platform: GroupPlatform | null
): T[] {
  return groups.filter((group) => group.platform === platform)
}
