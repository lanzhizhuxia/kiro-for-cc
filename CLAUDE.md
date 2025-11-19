# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "Kiro for Claude Code" that enhances Claude Code with structured spec-driven development features. The extension provides visual management of specs (requirements, design, tasks) and steering documents.

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript (one-time)
npm run compile

# Watch mode for development (auto-compile on changes)
npm run watch

# Package the extension into .vsix file
npm run package

# Run in VSCode
# Press F5 in VSCode to launch Extension Development Host
```

## Architecture

### Project Structure

```plain
src/
├── extension.ts           # Extension entry point, command registration
├── constants.ts          # Centralized configuration constants
├── features/            # Business logic for features
│   ├── spec/
│   │   └── specManager.ts      # Spec lifecycle management
│   └── steering/
│       └── steeringManager.ts  # Steering document management
├── providers/           # VSCode TreeDataProviders
│   ├── claudeCodeProvider.ts   # Claude CLI integration
│   ├── specExplorerProvider.ts # Spec tree view
│   ├── steeringExplorerProvider.ts # Steering tree view
│   ├── hooksExplorerProvider.ts    # Hooks tree view
│   ├── mcpExplorerProvider.ts      # MCP servers tree view
│   └── overviewProvider.ts         # Settings overview
├── prompts/            # AI prompt templates
│   ├── specPrompts.ts          # Spec generation prompts
│   └── steeringPrompts.ts      # Steering doc prompts
└── utils/              # Utility functions
    └── configManager.ts        # Configuration management
```

### Core Components

1. **Extension Entry** (`src/extension.ts`): Registers all commands and initializes providers
2. **Feature Managers** (`src/features/`): Business logic for specs and steering documents
3. **Providers** (`src/providers/`): VSCode TreeDataProviders for UI views
4. **Prompts** (`src/prompts/`): AI prompt templates for spec generation

### Key Patterns

- **Manager Pattern**: Each feature has a Manager class that handles file operations and business logic
- **Provider Pattern**: Each tree view has a Provider class extending `vscode.TreeDataProvider`
- **Command Registration**: All commands are registered in `activate()` with pattern `kfc.{feature}.{action}`

### Data Structure

User data is stored in workspace `.claude/` directory:

```plain
.claude/
├── specs/{spec-name}/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── steering/*.md
└── settings/kfc-settings.json
```

## Spec Workflow Implementation

The spec workflow follows these states:

1. Requirements → Review → Design
2. Design → Review → Tasks
3. Tasks → Review → Complete

Each transition requires explicit user approval. The workflow is implemented in `specPrompts.ts` and enforced by the spec agent system prompt.

## Claude Code Integration

The extension integrates with Claude CLI through the `ClaudeCodeProvider`:

- Sends commands via VS Code terminal
- Uses temporary files for long prompts
- Supports system prompts for context injection
- Terminal commands are built with format: `claude [options] < promptFile`

## Testing & Debugging

Currently, the claudeCodeProvider has a test echo command at line 62:

```typescript
let command = `echo "HELLO WORLD"`;
```

This should be replaced with actual Claude CLI integration when testing is complete.

## Important Implementation Notes

1. **File Operations**: Always use `vscode.Uri` and workspace-relative paths
2. **Tree Updates**: Call `refresh()` on providers after any data changes
3. **Error Handling**: All file operations should have try-catch blocks
4. **User Prompts**: Use `vscode.window.showInputBox()` for user input
5. **Context Menus**: Defined in `package.json` under `contributes.menus`

## Extension Points

- **New Managers**: Add to `src/features/` following existing patterns
- **New Providers**: Add to `src/providers/` extending `TreeDataProvider`
- **New Commands**: Register in `extension.ts` and add to `package.json`
- **New Prompts**: Add to `src/prompts/` for AI-assisted features

---

## Codex工作流编排系统

### 系统简介

Codex工作流编排系统是一个智能任务执行框架，提供以下核心能力：

- **智能路由**: 基于任务复杂度自动推荐使用Codex或本地agent
- **深度推理**: 集成Sequential Thinking API进行问题分解和方案分析
- **会话管理**: 持久化任务状态，支持恢复和检查点
- **安全防护**: 多层安全机制保护敏感数据和危险操作
- **用户偏好学习**: 追踪用户决策，优化路由推荐

### 关键文件位置

**核心组件** (`src/features/codex/`):
```
src/features/codex/
├── codexOrchestrator.ts       # 主编排器（统一入口）
├── taskRouter.ts              # 任务路由器（智能推荐）
├── complexityAnalyzer.ts      # 复杂度分析器
├── deepThinkingEngine.ts      # 深度推理引擎
├── mcpLifecycleManager.ts     # MCP服务器管理
├── securityGuard.ts           # 安全守卫
├── sessionStateManager.ts     # 会话状态管理
├── executionLogger.ts         # 执行日志记录
├── progressIndicator.ts       # 进度指示器
├── preferenceTracker.ts       # 用户偏好追踪
└── types.ts                   # 类型定义
```

**配置和数据**:
```
.claude/codex/
├── sessions.json              # 会话持久化数据
├── execution.log              # 执行日志
├── security-log.json          # 安全审计日志
└── preferences.json           # 用户偏好数据
```

**文档**:
- **架构文档**: `/Users/xuqian/workspace/kiro-for-cc/docs/codex-architecture.md`
- **设计文档**: `.claude/specs/codex-workflow-orchestration/design.md`

### 开发指南

#### 添加新的复杂度检测规则

1. 在 `complexityAnalyzer.ts` 中添加检测方法
2. 在评分方法中调用新规则
3. 更新 `types.ts` 中的 `ComplexityScore` 接口
4. 在 `taskRouter.ts` 中添加推荐理由
5. 添加单元测试

详见: `docs/codex-architecture.md` - 5.1节

#### 添加新的安全检查规则

1. 在 `securityGuard.ts` 中添加危险命令模式
2. 添加敏感文件模式
3. 更新脱敏逻辑
4. 添加单元测试

详见: `docs/codex-architecture.md` - 5.2节

#### 集成新的MCP工具

1. 在 `mcpClient.ts` 中添加新工具调用方法
2. 在 `codexExecutor.ts` 中使用新工具
3. 在 `extension.ts` 中注册VSCode命令
4. 在 `package.json` 中声明命令
5. 添加集成测试

详见: `docs/codex-architecture.md` - 5.3节

### 架构图

```
CodexOrchestrator (主编排器)
├── TaskRouter (任务路由)
│   └── ComplexityAnalyzer (复杂度分析)
│       └── PreferenceTracker (偏好追踪)
├── SessionStateManager (会话管理)
├── DeepThinkingEngine (深度推理)
│   ├── MCPClient (MCP客户端)
│   └── CodexAnalysisWebview (结果展示)
├── SecurityGuard (安全守卫)
├── ExecutionLogger (日志记录)
├── ProgressIndicator (进度指示)
├── CodexExecutor (Codex执行器)
└── LocalAgentExecutor (本地执行器)
```

完整架构说明见: `/Users/xuqian/workspace/kiro-for-cc/docs/codex-architecture.md`

### 测试策略

- **单元测试**: `src/features/codex/__tests__/*.test.ts`
- **集成测试**: 需要真实MCP服务器
- **E2E测试**: 使用VSCode Extension Tester

运行测试:
```bash
# 单元测试
npm test

# 带覆盖率
npm run test:coverage

# E2E测试
npm run test:e2e
```

### 调试技巧

**启用详细日志**:
```json
// .vscode/settings.json
{
  "kfc.codex.logLevel": "debug",
  "kfc.codex.logToFile": true
}
```

**查看MCP服务器日志**:
```bash
tail -f .claude/codex/mcp-server.log
```

**使用VSCode调试器**: 按F5启动扩展调试

详见: `docs/codex-architecture.md` - 第7节

### 贡献指南

1. Fork本仓库
2. 创建功能分支: `git checkout -b feature/my-new-feature`
3. 遵循代码规范（ESLint + Prettier）
4. 编写测试并确保通过
5. 提交PR并描述变更内容

---

## Spec开发流程（Sam管理）

### 📁 Sam配置文件位置

**用户级共享配置**（所有项目共享）:
- **位置**: `~/.claude/sam-config/`
- **方式**: 本项目通过符号链接指向共享配置
- **优势**: 一处更新，所有项目生效

### 👤 认识Sam

**Sam = Spec Automation Manager**

Sam是本项目的Spec PM，负责需求开发全流程：
- 🎯 自主决策: Agent数量、并行策略、技术选择
- 🚀 高效执行: 并行优先，最大化效率
- 🔒 安全把控: 监控危险操作，保护敏感凭证
- 📋 跨会话: 通过PROGRESS.md实现任务连续性
- 🔄 自我复盘: 完成后主动分析改进

### 🚀 如何使用Sam

启动Sam：
```
"让Sam跟进这个需求: 实现XX功能"
"Sam继续上次的工作"
"Sam总结下这次的工作"
```

Sam会自动：
- ✅ 决定使用几个agent（无需询问你）
- ✅ 决定并行或串行（无需询问你）
- ✅ 选择技术方案（现有技术栈内）
- ⚠️ 仅在架构变更、新增依赖、成本影响时询问你

### 📋 Spec目录结构

```
docs/specs/
├── REQUIREMENTS_INDEX.md    # 需求编号索引（必须）
├── in-progress/             # 进行中的需求
├── completed/               # 已完成（归档）
└── pending/                 # 待处理（backlog）

.claude/specs/               # Sam临时工作目录（.gitignore）
└── {feature_name}/
    ├── PROGRESS.md          # 跨会话进度追踪
    └── CONTEXT.md           # 上下文共享文件
```

### 📝 命名规范

- **需求编号**: `REQ-XXX` (从001开始)
- **文件名**: `REQ-XXX-需求名称-文档类型.md`
- **目录名**: `REQ-XXX-需求名称/`

详细能力说明: `docs/specs/PM_ENHANCEMENT_SUMMARY.md`
