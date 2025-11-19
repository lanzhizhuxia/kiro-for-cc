# Sam + Codex 集成测试指南

## 概述

本文档介绍如何测试 Sam（Spec Automation Manager）调用 Codex 执行编程任务的功能。

## 当前架构

### Sam 工作流程

```
用户 → Ask Sam → Sam Manager → Claude Code CLI
                      ↓
                 System Prompt
              (spec-workflow-starter)
```

### Codex 集成架构

```
用户 → Codex Task → Codex Orchestrator → Codex Executor → Codex MCP Server
```

## 测试方案

### 方案 1：通过现有 UI 测试（推荐）

#### 步骤 1: 准备测试环境

1. **确保 Codex MCP Server 运行正常**
   ```bash
   claude mcp list
   ```
   应该看到：
   ```
   codex-cli: node /Users/xuqian/workspace/codex-mcp-server/dist/index.js - ✓ Connected
   ```

2. **准备一个测试 Spec**
   - 在 SPECS 视图中创建一个新的 spec（例如 `test-codex-integration`）
   - 创建简单的 requirements.md 和 design.md

#### 步骤 2: 使用 Review Design 测试 Codex（已验证 ✅）

这是目前唯一实现的 Codex UI 功能：

1. 右键点击 `design.md` → **Review Design**
2. 观察输出面板（View → Output → Kiro for CC）
3. 等待 Codex 分析完成
4. 查看生成的 `design-codex-analysis.md` 文件

**预期结果**：
- ✅ 中文分析报告
- ✅ 包含设计方案评估、风险分析、改进建议

#### 步骤 3: 测试 Sam 工作流（当前使用 Claude Code）

1. **启动 Sam**
   - 在命令面板（Cmd+Shift+P）输入 "Ask Sam"
   - 或点击 SPECS 视图的 "➕ Ask Sam" 按钮

2. **输入任务描述**
   ```
   实现一个简单的冒泡排序函数，支持升序和降序
   ```

3. **观察执行过程**
   - Sam 会调用 Claude Code CLI
   - 查看输出面板中的日志
   - Sam 会创建 requirements → design → tasks → implementation

**当前行为**：
- ❌ Sam 使用 Claude Code CLI（不是 Codex）
- ✅ 可以生成 spec 文档
- ✅ 可以跨会话追踪进度（PROGRESS.md）

### 方案 2：让 Sam 支持 Codex 执行模式（需要开发）

#### 架构设计

```typescript
// SamManager 需要集成 CodexOrchestrator
class SamManager {
  constructor(
    private claudeProvider: ClaudeCodeProvider,
    private codexOrchestrator?: CodexOrchestrator,  // 新增
    private outputChannel: vscode.OutputChannel
  ) {}

  async askSam(featureDescription?: string, useCodex?: boolean): Promise<void> {
    // 1. 获取用户输入
    // 2. 构建任务上下文

    if (useCodex && this.codexOrchestrator) {
      // 使用 Codex 执行
      const task: TaskDescriptor = {
        id: `sam-${Date.now()}`,
        type: 'implementation',
        description: featureDescription,
        context: { /* ... */ }
      };

      const result = await this.codexOrchestrator.executeTask(task, {
        forceMode: 'codex',
        enableDeepThinking: true
      });
    } else {
      // 使用 Claude Code CLI（现有逻辑）
      await this.claudeProvider.executeWithSystemPrompt(/* ... */);
    }
  }
}
```

#### 需要修改的文件

1. **src/features/sam/samManager.ts**
   - 添加 `codexOrchestrator` 依赖
   - 添加执行模式选择逻辑
   - 添加 Codex 任务构建方法

2. **src/extension.ts**
   - 在创建 `SamManager` 时传入 `codexOrchestrator`
   - 修改 `kfc.sam.ask` 命令，添加模式选择

3. **package.json**
   - 可选：添加新命令 `kfc.sam.askWithCodex`

### 方案 3：快速测试（命令行方式）

如果想快速验证 Codex 执行编程任务的能力，可以直接测试 Codex Orchestrator：

#### 创建测试命令

在 `package.json` 中添加：
```json
{
  "command": "kfc.codex.testImplementation",
  "title": "Test Codex Implementation"
}
```

在 `extension.ts` 中注册：
```typescript
vscode.commands.registerCommand('kfc.codex.testImplementation', async () => {
  const task: TaskDescriptor = {
    id: `test-impl-${Date.now()}`,
    type: 'implementation',
    description: '请用 TypeScript 实现一个冒泡排序函数，支持升序和降序排序',
    context: {
      additionalContext: {
        outputLanguage: 'zh-CN'
      }
    }
  };

  const result = await codexOrchestrator.executeTask(task, {
    forceMode: 'codex',
    enableCodebaseScan: true
  });

  if (result.success && result.output) {
    // 显示结果
    const doc = await vscode.workspace.openTextDocument({
      content: result.output,
      language: 'typescript'
    });
    await vscode.window.showTextDocument(doc);
  }
});
```

## 当前可用的 Codex 功能

### ✅ 已实现
1. **Review Design** - 设计文档深度分析（中文输出）
2. **Review Requirements** - 需求文档深度分析（中文输出）
3. **Codex MCP 集成** - 直接连接到本地 codex-mcp-server
4. **Session Management** - 会话持久化和状态管理

### 🚧 待实现
1. **Sam + Codex 编程任务执行** - Sam 使用 Codex 生成代码
2. **Task Implementation UI** - 从 tasks.md 右键执行单个任务
3. **Codex Analysis WebView** - 可视化展示分析结果
4. **Diff View** - 对比 Codex 生成的代码和现有代码

## 推荐的测试流程

### Phase 1: 验证 Codex 基础功能（当前阶段）
1. ✅ 测试 Review Design（已完成）
2. ✅ 测试 Review Requirements（待验证）
3. ✅ 验证中文输出（已完成）

### Phase 2: 添加编程任务支持
1. 创建 `kfc.codex.implementTask` 命令
2. 测试简单的编程任务（如冒泡排序）
3. 验证代码生成质量和中文注释

### Phase 3: 集成 Sam
1. 修改 SamManager 添加 Codex 支持
2. 添加执行模式选择 UI
3. 测试完整的 Spec → Design → Implementation 流程

## 调试技巧

### 查看 Codex 执行日志
```
View → Output → Kiro for CC
```

关键日志：
```
[CodexExecutor] Starting execution for task: xxx
[MCPClient] Calling codex tool...
[MCPClient] Tool response: {...}
```

### 查看 MCP 服务器状态
```bash
# 检查连接状态
claude mcp list

# 查看 MCP 服务器日志（如果配置了）
tail -f ~/.codex/logs/mcp-server.log
```

### 常见问题

**Q: Codex 分析很慢？**
A: 这是正常的，gpt-5-codex 会进行深度推理。可以在 codex-mcp-server 中配置 `reasoningEffort: 'low'` 加速。

**Q: 如何查看 Codex 生成的中间结果？**
A: 检查 `.claude/codex/sessions.json` 文件，包含所有会话历史。

**Q: Sam 什么时候会使用 Codex？**
A: 当前 Sam 还不支持 Codex，需要按照方案 2 进行开发。

## 下一步建议

1. **立即可测试**：
   - 使用 Review Design 验证 Codex 中文输出
   - 测试 Review Requirements 功能

2. **快速验证编程能力**（15分钟）：
   - 创建 `kfc.codex.testImplementation` 命令
   - 测试简单的编程任务

3. **完整集成**（1-2小时）：
   - 修改 SamManager 集成 CodexOrchestrator
   - 添加模式选择 UI
   - 测试端到端流程

---

**需要我帮您实现哪个方案？**

- 方案 1: 继续测试现有功能（Review Requirements）
- 方案 2: 开发 Sam + Codex 完整集成（推荐）
- 方案 3: 创建快速测试命令验证 Codex 编程能力
