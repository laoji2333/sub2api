import { describe, expect, it } from 'vitest'

import type { GroupPlatform } from '@/types'
import {
  filterKeyGroupsByPlatform,
  getDefaultKeyGroupPlatform,
  getKeyGroupPlatformTabs
} from '../keyGroupPlatformTabs'

const group = (id: number, platform: GroupPlatform) => ({ id, platform })

describe('API key group platform tabs', () => {
  it('always exposes the requested OpenAI, Claude, and Gemini categories', () => {
    expect(getKeyGroupPlatformTabs([])).toEqual([
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' }
    ])
  })

  it('keeps additional existing platforms selectable', () => {
    expect(getKeyGroupPlatformTabs([group(1, 'grok'), group(2, 'composite')])).toEqual([
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'grok', label: 'Grok' },
      { value: 'composite', label: 'Composite' }
    ])
  })

  it('defaults to the first requested category that has groups', () => {
    expect(getDefaultKeyGroupPlatform([group(1, 'anthropic'), group(2, 'gemini')])).toBe('anthropic')
  })

  it('filters the selectable groups by the active category', () => {
    const groups = [group(1, 'openai'), group(2, 'anthropic'), group(3, 'openai')]
    expect(filterKeyGroupsByPlatform(groups, 'openai').map((item) => item.id)).toEqual([1, 3])
  })
})
