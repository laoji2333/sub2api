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
        title: 'Install Codex and Claude Code',
        description: 'Choose the CLI or desktop app for each coding assistant.',
        codexDescription: 'Available as both a CLI and a desktop app.',
        claudeCodeDescription: 'Available as both a CLI and a desktop app.',
        cliAction: 'CLI Version',
        clientAction: 'Desktop App',
      },
    },
  },
}
