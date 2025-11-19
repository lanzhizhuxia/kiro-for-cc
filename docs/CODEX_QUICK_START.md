# Codex 功能快速上手

## 🎯 一分钟了解

你的 Kiro for Claude Code 插件已经集成了 Codex 深度分析功能！

**Codex 能做什么？**
- 📊 设计文档深度分析（架构、性能、安全）
- 📋 需求文档完整性检查
- 🧠 多轮推理分析

**需要什么？**
- ✅ 你本地的 `codex-mcp-server` 项目（位于 `/Users/xuqian/workspace/codex-mcp-server`）
- ✅ OpenAI Codex CLI 和 API Key

## 🚀 三步启用

### 方案 A：自动配置脚本（推荐）

```bash
# 在 kiro-for-cc 项目根目录运行
npm run setup:codex
```

或者使用 slash command（在 Claude Code CLI 中）：

```
/setup-codex
```

### 方案 B：手动配置

#### 1. 准备 Codex CLI

```bash
# 安装 Codex CLI
npm install -g @openai/codex

# 认证（需要 OpenAI API Key）
codex login --api-key "sk-..."

# 验证
codex "Hello, please introduce yourself"
```

#### 2. 构建 codex-mcp-server

```bash
cd /Users/xuqian/workspace/codex-mcp-server
npm install
npm run build
```

#### 3. 配置 Claude Code MCP

```bash
claude mcp add codex-cli -- node /Users/xuqian/workspace/codex-mcp-server/dist/index.js
```

#### 4. 重启 Cursor

重启后，在左侧栏 "MCP SERVERS" 应该能看到 `codex-cli`。

## ✅ 验证配置

### 1. 检查 MCP 服务器

在 Kiro for CC 左侧栏：
- 展开 "MCP SERVERS"
- 应该看到 `codex-cli` 服务器

### 2. 测试深度分析

1. 创建一个测试 Spec：
   - 右键 "SPECS" → "Create New Spec"
   - 输入 "test-codex"

2. 编辑 design.md：
   ```markdown
   # Test Design

   ## Architecture
   - Use microservices architecture
   - API Gateway pattern
   - Event-driven communication

   ## Performance
   - Target: 1000 req/s
   - Latency: < 100ms
   ```

3. 右键 `design.md` → "Review Design"

4. 查看结果（应该显示 Codex 分析，而不是错误）

## 🎓 使用示例

### 设计文档深度分析

1. 在 Specs 树中展开任意 spec
2. 右键点击 `design.md` → "Review Design"
3. Codex 会分析：
   - 架构合理性
   - 潜在性能问题
   - 安全风险
   - 改进建议

### 需求文档完整性检查

1. 右键点击 `requirements.md` → "Review Requirements"
2. Codex 会检查：
   - 需求完整性
   - 可行性评估
   - 潜在风险
   - 缺失的用例

## 🔧 配置选项

### MCP 服务器配置

编辑 `~/.claude/config.json`：

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "node",
      "args": ["/Users/xuqian/workspace/codex-mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Codex 推理深度

在 `src/features/spec/specManager.ts` 中可以调整：

```typescript
const options: ExecutionOptions = {
  enableDeepThinking: true,
  enableCodebaseScan: true,
  forceMode: 'codex',
  reasoningEffort: 'high'  // 'low' | 'medium' | 'high'
};
```

## 🐛 常见问题

### Q1: MCP 服务器未显示

**检查**：
```bash
# 查看 MCP 配置
cat ~/.claude/config.json

# 列出 MCP 服务器
claude mcp list
```

**解决**：
```bash
# 重新配置
npm run setup:codex
```

### Q2: "codex command not found"

**解决**：
```bash
# 安装 Codex CLI
npm install -g @openai/codex

# 验证安装
which codex
codex --version
```

### Q3: 认证失败

**解决**：
```bash
# 重新登录（需要 OpenAI API Key）
codex login --api-key "sk-..."

# 检查认证
cat ~/.codex/auth.json
```

### Q4: 分析一直在加载

**可能原因**：
- API 调用超时
- 网络问题
- API Key 额度不足

**解决**：
1. 检查网络连接
2. 查看日志：VSCode → Output → "Kiro for CC"
3. 验证 API Key：`codex "test"`

## 📊 查看日志

### Kiro for CC 日志

VSCode/Cursor:
1. View → Output
2. 选择 "Kiro for CC"

### Codex MCP Server 日志

```bash
# Claude Code 日志
tail -f ~/.claude/logs/mcp-*.log
```

### Codex CLI 日志

调试模式：
```bash
# 设置环境变量
export CODEX_DEBUG=1

# 重启 Cursor
```

## 🎨 自定义分析

### 修改分析提示词

编辑 `src/features/codex/deepThinkingEngine.ts`，自定义分析维度：

```typescript
const analysisPrompt = `
Please analyze this ${context.documentType} document:

${context.design || context.requirements}

Focus on:
1. Architecture quality
2. Performance implications
3. Security risks
4. Scalability concerns
5. Cost estimation (NEW!)

Provide detailed analysis with actionable recommendations.
`;
```

### 调整推理深度

根据任务复杂度选择：

```typescript
// 快速检查
reasoningEffort: 'low'

// 标准分析
reasoningEffort: 'medium'

// 深度分析
reasoningEffort: 'high'
```

## 🔗 相关文档

- **[详细集成指南](./CODEX_MCP_INTEGRATION.md)** - 完整的技术细节和工作流程
- **[配置指南](./CODEX_SETUP.md)** - 所有配置选项说明
- **[禁用指南](./DISABLE_CODEX.md)** - 如何暂时禁用 Codex
- **[架构文档](./codex-architecture.md)** - Codex 系统架构

## 💡 最佳实践

1. **使用会话 ID** - 保持上下文连贯性
2. **选择合适的推理深度** - 平衡速度和质量
3. **定期清理会话** - 避免上下文混乱
4. **检查日志** - 及时发现问题

## 🆘 获取帮助

- **GitHub Issues**: https://github.com/notdp/kiro-for-cc/issues
- **codex-mcp-server Issues**: https://github.com/tuannvm/codex-mcp-server/issues
- **文档**: 查看 `docs/` 目录下的详细文档

---

**提示**：Codex 是可选功能，基本的 Spec 管理（创建、查看、导航）不依赖它，可以正常使用。
