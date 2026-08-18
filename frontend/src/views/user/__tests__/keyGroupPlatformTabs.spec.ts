import { describe, expect, it } from 'vitest'

import type { GroupPlatform } from '@/types'
import {
  filterKeyGroupsByPlatform,
  getDefaultKeyGroupPlatform,
  getKeyGroupPlatformTabs
} from '../keyGroupPlatformTabs'

const group = (id: number, platform: GroupPlatform) => ({ id, platform })

describe('API key group platform tabs', () => {
  it('does not expose categories without available groups', () => {
    expect(getKeyGroupPlatformTabs([])).toEqual([])
    expect(getDefaultKeyGroupPlatform([])).toBeNull()
  })

  it('derives unique categories from the available groups', () => {
    expect(getKeyGroupPlatformTabs([
      group(1, 'deepseek'),
      group(2, 'openai'),
      group(3, 'deepseek'),
      group(4, 'kimi'),
      group(5, 'zhipu'),
      group(6, 'anthropic')
    ])).toEqual([
      { value: 'deepseek', label: 'DeepSeek' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'kimi', label: 'Kimi' },
      { value: 'zhipu', label: 'Zhipu GLM' },
      { value: 'anthropic', label: 'Claude' }
    ])
  })

  it('defaults to the first available group category', () => {
    expect(getDefaultKeyGroupPlatform([group(1, 'deepseek'), group(2, 'gemini')])).toBe('deepseek')
  })

  it('filters the selectable groups by the active category', () => {
    const groups = [group(1, 'openai'), group(2, 'anthropic'), group(3, 'openai')]
    expect(filterKeyGroupsByPlatform(groups, 'openai').map((item) => item.id)).toEqual([1, 3])
  })
})
