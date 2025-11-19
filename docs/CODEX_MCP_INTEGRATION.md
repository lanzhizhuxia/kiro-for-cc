# Codex MCP Server 集成指南

## 概述

你本地的 `codex-mcp-server` 项目可以完美集成到 Kiro for Claude Code 中，提供真正的 Codex 深度分析功能！

**项目位置**: `/Users/xuqian/workspace/codex-mcp-server`

## 🎯 集成方案

### 方案 A：使用本地开发版本（推荐用于测试）

#### 步骤 1：构建 codex-mcp-server

```bash
cd /Users/xuqian/workspace/codex-mcp-server
npm install
npm run build
```

#### 步骤 2：配置 Claude Code MCP

```bash
# 添加本地 MCP 服务器
claude mcp add codex-cli -- node /Users/xuqian/workspace/codex-mcp-server/dist/index.js
```

或者手动编辑 `~/.claude/config.json`：

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "node",
      "args": ["/Users/xuqian/workspace/codex-mcp-server/dist/index.js"]
    }
  }
}
```

#### 步骤 3：验证配置

```bash
# 列出 MCP 服务器
claude mcp list

# 应该看到 codex-cli
```

#### 步骤 4：重启 Cursor

重启 Cursor 后，在左侧 "MCP SERVERS" 部分应该能看到 `codex-cli` 服务器。

#### 步骤 5：测试功能

1. 在 Specs 树中展开任意 spec
2. 右键点击 `design.md` → "Review Design"
3. 应该能看到 Codex 分析结果（而不是错误）

### 方案 B：使用 NPM 包（推荐用于生产）

如果 `codex-mcp-server` 已发布到 NPM：

```bash
# 安装
claude mcp add codex-cli -- npx -y codex-mcp-server

# 或者全局安装
npm install -g codex-mcp-server
claude mcp add codex-cli -- codex-mcp-server
```

## 🔧 前置条件

### 1. 安装 OpenAI Codex CLI

```bash
# 通过 NPM
npm install -g @openai/codex

# 或通过 Homebrew (macOS)
brew install codex
```

### 2. 配置 Codex CLI 认证

```bash
# 使用你的 OpenAI API Key
codex login --api-key "sk-..."
```

⚠️ **注意**: codex-mcp-server v1.1.1 要求 Codex CLI v0.50.0+

### 3. 验证 Codex CLI

```bash
# 测试 codex 是否工作
codex "Hello, please introduce yourself"
```

## 📋 Codex MCP Server 提供的工具

根据源码分析，该 MCP 服务器提供以下工具：

### 1. `codex` - AI 编程助手

**参数**：
- `prompt` (必需): 你的编程问题或请求
- `sessionId` (可选): 会话 ID，用于保持上下文
- `resetSession` (可选): 重置会话历史
- `model` (可选): 指定模型 (默认 'gpt-5-codex')
- `reasoningEffort` (可选): 推理深度 ('low', 'medium', 'high')

**示例**：
```typescript
// Kiro for CC 会调用类似这样的工具
{
  name: 'codex',
  arguments: {
    prompt: 'Please analyze this design document...',
    sessionId: 'design-review-123',
    reasoningEffort: 'high'
  }
}
```

### 2. `listSessions` - 会话管理

列出所有活跃的会话。

### 3. `ping` - 连接测试

测试 MCP 服务器是否正常工作。

### 4. `help` - 帮助信息

获取 Codex CLI 能力和命令信息。

## 🔄 Kiro for CC 如何使用

当你点击 "Review Design" 按钮时，Kiro for CC 会：

1. **调用 DeepThinkingEngine** ([src/features/codex/deepThinkingEngine.ts](../src/features/codex/deepThinkingEngine.ts))
2. **通过 MCP Client 调用 `codex` 工具**，传递设计文档内容
3. **接收 Codex 分析结果**
4. **在 Webview 中展示结果** ([src/features/codex/codexAnalysisWebview.ts](../src/features/codex/codexAnalysisWebview.ts))

### 当前实现

查看 `src/features/codex/mcpClient.ts` 可以看到具体的工具调用逻辑。

## 🐛 故障排查

### 问题 1: MCP 服务器未显示

**检查**：
```bash
# 查看 MCP 配置
cat ~/.claude/config.json

# 测试服务器是否能运行
node /Users/xuqian/workspace/codex-mcp-server/dist/index.js
```

**解决**：
- 确保 `dist/index.js` 存在（运行 `npm run build`）
- 检查文件权限：`chmod +x /Users/xuqian/workspace/codex-mcp-server/dist/index.js`

### 问题 2: "codex command not found"

**解决**：
```bash
# 安装 Codex CLI
npm install -g @openai/codex

# 验证安装
which codex
codex --version
```

### 问题 3: 认证失败

**解决**：
```bash
# 重新登录
codex login --api-key "your-openai-api-key"

# 检查认证文件
cat ~/.codex/auth.json
```

### 问题 4: 版本不兼容

codex-mcp-server 需要 Codex CLI v0.50.0+

**检查版本**：
```bash
codex --version
```

**升级**：
```bash
npm update -g @openai/codex
```

## 📊 测试集成

### 1. 在终端测试 MCP 服务器

```bash
cd /Users/xuqian/workspace/codex-mcp-server
npm run dev
```

然后在另一个终端：

```bash
# 使用 Claude Code CLI 测试
echo '{"method":"tools/call","params":{"name":"ping"}}' | claude mcp call codex-cli
```

### 2. 在 Kiro for CC 中测试

1. 创建一个简单的 spec：
```bash
# 在 Kiro for CC 中
右键 SPECS → Create New Spec → 输入 "test-codex"
```

2. 编辑 `design.md`，添加一些设计内容

3. 右键 `design.md` → "Review Design"

4. 查看结果（应该显示 Codex 分析，而不是错误）

## 🔍 查看日志

### Kiro for CC 日志

在 VSCode/Cursor 中：
1. View → Output
2. 选择 "Kiro for CC"

### Codex MCP Server 日志

该服务器会输出到 stdout/stderr，可以在 Claude Code 日志中查看：

```bash
# 查看 Claude Code 日志
tail -f ~/.claude/logs/mcp-*.log
```

## 🎓 深度分析工作流程

### 设计文档分析

```
用户操作: 右键 design.md → Review Design
    ↓
Kiro Extension: handleReviewDesignCommand()
    ↓
SpecManager: reviewDesignWithCodex()
    ↓
CodexOrchestrator: executeTask()
    ↓
DeepThinkingEngine: analyze()
    ↓
MCPClient: callTool('codex', { prompt: '...', reasoningEffort: 'high' })
    ↓
Codex MCP Server: 调用 codex CLI
    ↓
OpenAI Codex API: 生成分析
    ↓
返回结果链
    ↓
CodexAnalysisWebview: 展示结果
```

## 📝 下一步

### 1. 优化 Kiro for CC 的 Codex 集成

可以改进 `src/features/codex/deepThinkingEngine.ts`，更好地利用 codex-mcp-server 的特性：

- ✅ 使用 `sessionId` 进行多轮对话
- ✅ 根据任务复杂度调整 `reasoningEffort`
- ✅ 支持不同的 `model` 选择

### 2. 添加 Session 管理 UI

在 Kiro for CC 中添加一个 Session 管理视图：
- 显示所有活跃的 Codex 会话
- 支持查看/删除会话
- 调用 `listSessions` 工具

### 3. 发布 codex-mcp-server

如果你想分享给其他人：
```bash
cd /Users/xuqian/workspace/codex-mcp-server
npm publish
```

## 🔗 相关文档

- [Codex MCP Server README](../../codex-mcp-server/README.md)
- [Session Management](../../codex-mcp-server/docs/session-management.md)
- [API Reference](../../codex-mcp-server/docs/api-reference.md)
- [Kiro Codex Architecture](./codex-architecture.md)

---

**总结**：你的本地 `codex-mcp-server` 项目提供了完整的 MCP 服务器实现，可以直接集成到 Kiro for Claude Code 中使用！
