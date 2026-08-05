export default {
  codexGuide: {
    title: 'Initial Setup',
    heading: 'Initial Setup',
    description: 'Download CC Switch and your coding assistant in order, then configure an API key.',
    steps: {
      ccSwitch: {
        title: 'Install CC Switch',
        description: 'Download CC Switch to manage your coding assistant provider configuration.',
        action: 'Download CC Switch',
      },
      apiKey: {
        title: 'Create an API Key',
        description: 'Open API Keys and create or select a key in the Codex group. After creating it, click Import to CCS in the key list. If that action is unavailable, click Use Key for manual setup.',
        action: 'Create API Key',
      },
      codingAssistant: {
        title: 'Install a Coding Assistant',
        description: 'Download and install Codex or Claude Code based on your needs, then continue to create an API key.',
        codexAction: 'Download Codex',
        claudeCodeAction: 'Download Claude Code',
      },
    },
  },
}
