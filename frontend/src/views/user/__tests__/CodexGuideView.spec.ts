import { describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

import CodexGuideView from '../CodexGuideView.vue'

const messages: Record<string, string> = {
  'codexGuide.heading': 'Initial Setup',
  'codexGuide.description': 'Follow these steps.',
  'codexGuide.steps.ccSwitch.title': 'Install CC Switch',
  'codexGuide.steps.ccSwitch.description': 'Manage Codex provider configuration.',
  'codexGuide.steps.ccSwitch.action': 'Download CC Switch',
  'codexGuide.steps.apiKey.title': 'Create an API Key',
  'codexGuide.steps.apiKey.description': 'Create an OpenAI-compatible key.',
  'codexGuide.steps.apiKey.action': 'Create API Key',
  'codexGuide.steps.codingAssistant.title': 'Install a Coding Assistant',
  'codexGuide.steps.codingAssistant.description': 'Download and install Codex or Claude Code.',
  'codexGuide.steps.codingAssistant.codexAction': 'Download Codex',
  'codexGuide.steps.codingAssistant.claudeCodeAction': 'Download Claude Code',
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
    }),
  }
})

function mountView() {
  return mount(CodexGuideView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: { template: '<span />' },
        RouterLink: RouterLinkStub,
      },
    },
  })
}

describe('CodexGuideView', () => {
  it('renders all three setup steps', () => {
    const wrapper = mountView()
    const steps = wrapper.findAll('ol > li')

    expect(steps).toHaveLength(3)
    expect(steps[0].text()).toContain('Install CC Switch')
    expect(steps[1].text()).toContain('Install a Coding Assistant')
    expect(steps[1].text()).toContain('Download Codex')
    expect(steps[1].text()).toContain('Download Claude Code')
    expect(steps[2].text()).toContain('Create an API Key')
  })

  it('uses the supplied download links safely', () => {
    const wrapper = mountView()
    const ccSwitchLink = wrapper.get('[data-testid="cc-switch-download"]')
    const codexLink = wrapper.get('[data-testid="codex-download"]')
    const claudeCodeLink = wrapper.get('[data-testid="claude-code-download"]')

    expect(ccSwitchLink.attributes('href')).toBe('https://ccswitch.io/zh/download')
    expect(codexLink.attributes('href')).toBe('https://learn.chatgpt.com/docs/app')
    expect(claudeCodeLink.attributes('href')).toBe('https://claude.com/download')
    for (const link of [ccSwitchLink, codexLink, claudeCodeLink]) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
  })

  it('routes API key creation to the existing keys page', () => {
    const wrapper = mountView()
    const keyLinks = wrapper.findAllComponents(RouterLinkStub)

    expect(keyLinks).toHaveLength(1)
    expect(keyLinks[0].props('to')).toBe('/keys')
  })
})
