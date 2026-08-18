import type { GroupPlatform } from '@/types'
import { platformLabel } from '@/utils/platformColors'

export interface KeyGroupPlatformTab {
  value: GroupPlatform
  label: string
}

export function getKeyGroupPlatformTabs(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): KeyGroupPlatformTab[] {
  return Array.from(new Set(groups.map((group) => group.platform))).map((value) => ({
    value,
    label: value === 'anthropic' ? 'Claude' : platformLabel(value)
  }))
}

export function getDefaultKeyGroupPlatform(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): GroupPlatform | null {
  return groups[0]?.platform ?? null
}

export function filterKeyGroupsByPlatform<T extends { platform: GroupPlatform }>(
  groups: readonly T[],
  platform: GroupPlatform | null
): T[] {
  return groups.filter((group) => group.platform === platform)
}
