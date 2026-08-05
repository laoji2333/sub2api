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
  'codexGuide.steps.codingAssistant.title': 'Install Codex and Claude Code',
  'codexGuide.steps.codingAssistant.description': 'Choose a version.',
  'codexGuide.steps.codingAssistant.codexDescription': 'Codex versions.',
  'codexGuide.steps.codingAssistant.claudeCodeDescription': 'Claude Code versions.',
  'codexGuide.steps.codingAssistant.cliAction': 'CLI Version',
  'codexGuide.steps.codingAssistant.clientAction': 'Desktop App',
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
    expect(steps[1].text()).toContain('Install Codex and Claude Code')
    expect(steps[1].text()).toContain('Codex versions.')
    expect(steps[1].text()).toContain('Claude Code versions.')
    expect(steps[1].findAll('a')).toHaveLength(4)
    expect(steps[2].text()).toContain('Create an API Key')
  })

  it('uses the supplied download links safely', () => {
    const wrapper = mountView()
    const ccSwitchLink = wrapper.get('[data-testid="cc-switch-download"]')
    const codexCliLink = wrapper.get('[data-testid="codex-cli-download"]')
    const codexLink = wrapper.get('[data-testid="codex-download"]')
    const claudeCodeLink = wrapper.get('[data-testid="claude-code-download"]')
    const claudeCodeCliLink = wrapper.get('[data-testid="claude-code-cli-download"]')

    expect(ccSwitchLink.attributes('href')).toBe('https://ccswitch.io/zh/download')
    expect(codexCliLink.attributes('href')).toBe('https://learn.chatgpt.com/docs/codex/cli')
    expect(codexLink.attributes('href')).toBe('https://learn.chatgpt.com/docs/app')
    expect(claudeCodeLink.attributes('href')).toBe('https://claude.com/download')
    expect(claudeCodeCliLink.attributes('href')).toBe('https://code.claude.com/docs/zh-CN/setup')
    for (const link of [ccSwitchLink, codexCliLink, codexLink, claudeCodeCliLink, claudeCodeLink]) {
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
