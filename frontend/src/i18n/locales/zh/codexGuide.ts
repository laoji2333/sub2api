export default {
  codexGuide: {
    title: '初始化启动',
    heading: '初始化启动',
    description: '依次下载 CC Switch、你的编程助手和 配置API 密钥。',
    steps: {
      ccSwitch: {
        title: '安装 CC Switch',
        description: '下载 CC Switch，用于管理编程助手的服务商配置。',
        action: '下载 CC Switch',
      },
      apiKey: {
        title: '创建 API 密钥',
        description: '前往 API 密钥页面，创建或选择一个“Codex 分组”的密钥。创建完成后，在密钥列表点击“导入CCS”完成配置；若该入口不可用，可点击“使用密钥”按提示手动配置。',
        action: '创建 API 密钥',
      },
      codingAssistant: {
        title: '安装编程助手',
        description: '根据需求下载并安装 Codex 或 Claude Code，安装完成后继续创建 API 密钥。',
        codexAction: '下载 Codex',
        claudeCodeAction: '下载 Claude Code',
      },
    },
  },
}
