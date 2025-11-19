# Codex 深度分析功能配置指南

## 功能说明

Codex 是 Kiro for Claude Code 的**实验性**深度分析功能，提供：
- 📊 设计文档深度分析（架构合理性、性能评估、安全风险）
- 📋 需求文档深度分析（完整性检查、可行性评估）
- 🧠 使用 Sequential Thinking API 进行多轮推理

## ⚠️ 当前状态

**Codex 功能目前处于实验阶段**，需要配置 MCP 服务器才能使用。

### 两种使用方式

#### 方式 1：暂时禁用 Codex 按钮（推荐）

如果你暂时不需要深度分析功能，可以隐藏 Codex 相关按钮：

1. 编辑 `src/features/spec/specManager.ts`
2. 修改 `isCodexAvailable()` 方法：

```typescript
isCodexAvailable(): boolean {
    // 暂时禁用 Codex 功能
    return false;
    // return !!this.codexOrchestrator;
}
```

3. 重新编译安装：
```bash
npm run compile
./scripts/build-and-install.sh cursor
```

4. 重启 Cursor

这样 Spec 树中的设计文档和需求文档就不会显示 "Review Design" 按钮了。

#### 方式 2：使用本地 codex-mcp-server（推荐！）✨

**好消息**：你本地已有 `codex-mcp-server` 项目，可以直接集成使用！

详细步骤请查看：**[Codex MCP Server 集成指南](./CODEX_MCP_INTEGRATION.md)**

**快速开始**：

```bash
# 1. 构建 codex-mcp-server
cd /Users/xuqian/workspace/codex-mcp-server
npm install
npm run build

# 2. 配置 Claude Code MCP
claude mcp add codex-cli -- node /Users/xuqian/workspace/codex-mcp-server/dist/index.js

# 3. 重启 Cursor
# 完成！现在可以使用 Codex 深度分析了
```

#### 方式 3：配置官方 MCP 服务器（备选）

如果你想使用 Codex 功能但没有本地 MCP 服务器，需要配置 MCP 服务器：

##### 步骤 1：安装 Claude Desktop

Codex 通过 MCP (Model Context Protocol) 与 Claude 通信：

- **macOS**: 从 [claude.ai](https://claude.ai) 下载 Claude Desktop
- **配置文件位置**: `~/Library/Application Support/Claude/claude_desktop_config.json`

##### 步骤 2：配置 MCP 服务器

创建或编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "codex": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/claude-codex-mcp-server"
      ],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> **注意**：`@anthropic/claude-codex-mcp-server` 是一个假设的包名，实际的 Codex MCP 服务器可能还未公开发布。

##### 步骤 3：验证配置

1. 重启 Claude Desktop
2. 在 Kiro for CC 的左侧栏查看 "MCP SERVERS" 部分
3. 应该能看到 "codex" 服务器

##### 步骤 4：测试功能

1. 在 Specs 树中展开任意 spec
2. 右键点击 `design.md` → 选择 "Review Design"
3. 查看深度分析结果

## 配置选项

### MCP 服务器配置

在 `.claude/codex/config.json` 中可以配置：

```json
{
  "mcp": {
    "port": 8765,
    "timeout": 30000,
    "logLevel": "debug"
  }
}
```

### VSCode 设置

在 `.vscode/settings.json` 中：

```json
{
  "kfc.codex.logLevel": "debug",
  "kfc.codex.logToFile": true,
  "kfc.codex.enabled": true
}
```

## 故障排查

### 问题 1：MCP SERVERS 显示 "No MCP servers configured"

**原因**：Claude Desktop 未配置 MCP 服务器

**解决**：
1. 检查 `~/Library/Application Support/Claude/claude_desktop_config.json` 是否存在
2. 确认 JSON 格式正确
3. 重启 Claude Desktop

### 问题 2：错误 "Unknown tool 'mcp__codex_...'"

**原因**：MCP 服务器未启动或连接失败

**解决**：
1. 检查 Claude Desktop 是否运行
2. 查看 MCP 服务器日志：`.claude/codex/mcp-server.log`
3. 尝试重启 MCP 服务器（重启 Claude Desktop）

### 问题 3：分析结果一直在加载

**原因**：API 调用超时或失败

**解决**：
1. 检查网络连接
2. 增加超时时间：设置 `mcp.timeout` 为更大的值
3. 查看扩展日志：VSCode → Output → Kiro for CC

## 日志位置

- **扩展日志**: VSCode Output 面板 → "Kiro for CC"
- **MCP 服务器日志**: `.claude/codex/mcp-server.log`
- **执行日志**: `.claude/codex/execution.log`
- **安全审计日志**: `.claude/codex/security-log.json`

## 更多信息

- [Codex 架构文档](./codex-architecture.md)
- [GitHub Issues](https://github.com/notdp/kiro-for-cc/issues)
- [MCP 协议规范](https://modelcontextprotocol.io/)

---

**提示**：Codex 是可选功能，基本的 Spec 管理（创建、查看、导航、编辑）不依赖 MCP 服务器，可以正常使用。
