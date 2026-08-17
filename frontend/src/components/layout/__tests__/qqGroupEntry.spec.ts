import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue')
const componentSource = readFileSync(componentPath, 'utf8')

describe('QQ group entry', () => {
  it('only renders after both a group number and a safe join URL are available', () => {
    expect(componentSource).toContain('v-if="user && hasQQGroup"')
    expect(componentSource).toContain("sanitizeUrl(appStore.cachedPublicSettings?.qq_group_join_url || '')")
    expect(componentSource).toContain('Boolean(qqGroupNumber.value && qqGroupJoinUrl.value)')
  })

  it('lets users copy the configured group number and opens the join link safely', () => {
    expect(componentSource).toContain('@click="copyQQGroupNumber"')
    expect(componentSource).toContain('void copyToClipboard(qqGroupNumber.value)')
    expect(componentSource).toContain('target="_blank"')
    expect(componentSource).toContain('rel="noopener noreferrer"')
  })
})
