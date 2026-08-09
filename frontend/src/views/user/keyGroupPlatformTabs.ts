import type { GroupPlatform } from '@/types'

export interface KeyGroupPlatformTab {
  value: GroupPlatform
  label: string
}

const PRIMARY_PLATFORM_TABS: KeyGroupPlatformTab[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' }
]

const OPTIONAL_PLATFORM_TABS: KeyGroupPlatformTab[] = [
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'grok', label: 'Grok' },
  { value: 'composite', label: 'Composite' }
]

export function getKeyGroupPlatformTabs(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): KeyGroupPlatformTab[] {
  const availablePlatforms = new Set(groups.map((group) => group.platform))
  return [
    ...PRIMARY_PLATFORM_TABS,
    ...OPTIONAL_PLATFORM_TABS.filter((tab) => availablePlatforms.has(tab.value))
  ]
}

export function getDefaultKeyGroupPlatform(
  groups: ReadonlyArray<{ platform: GroupPlatform }>
): GroupPlatform {
  const availablePlatforms = new Set(groups.map((group) => group.platform))
  return (
    PRIMARY_PLATFORM_TABS.find((tab) => availablePlatforms.has(tab.value))?.value ??
    OPTIONAL_PLATFORM_TABS.find((tab) => availablePlatforms.has(tab.value))?.value ??
    'openai'
  )
}

export function filterKeyGroupsByPlatform<T extends { platform: GroupPlatform }>(
  groups: readonly T[],
  platform: GroupPlatform
): T[] {
  return groups.filter((group) => group.platform === platform)
}
