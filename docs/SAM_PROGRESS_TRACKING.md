# Sam Progress Tracking 使用指南

本文档说明如何使用 Kiro for Claude Code 扩展的 Sam 进度追踪功能。

## 📋 更新说明

**日期**: 2025-01-18  
**版本**: 0.2.9+

系统提示词 `.claude/system-prompts/spec-workflow-starter.md` 已更新，现在 Sam 会自动创建和管理 PROGRESS.md 文件。

## ✨ 新功能

### 1. 自动创建 PROGRESS.md

当你使用 "Ask Sam" 创建新 spec 时，Sam 会自动创建进度文件：

```
.claude/specs/{feature-name}/
├── requirements.md     # 需求文档
└── PROGRESS.md        # 进度追踪 (自动创建!)
```

### 2. 进度图标显示

在 Specs 视图中，每个 spec 旁边会显示实时进度图标：

- 🔄 **蓝色旋转** - 工作进行中
- ✅ **绿色勾** - 阶段已完成
- ⚠️ **黄色警告** - 存在阻塞问题

### 3. 悬停查看详情

鼠标悬停在 spec 上，会显示详细信息：
- 当前阶段
- 已完成的阶段
- 当前任务列表
- 阻塞问题
- 关键决策

### 4. 智能继续工作

右键点击 spec → "Continue Sam Work"：
- Sam 自动读取 PROGRESS.md
- 了解当前进度和阻塞
- 从上次停止的地方继续

## 📝 PROGRESS.md 文件格式

```markdown
# Progress Tracking - Feature Name

## Current Phase
- **Phase**: Requirements
- **Status**: In Progress

## Completed Phases
- [ ] Requirements
- [ ] Design
- [ ] Tasks

## Current Tasks
- Writing requirements document
- Analyzing user needs

## Blockers
None

## Key Decisions
- Using EARS format for requirements
```

## 🎯 使用场景

### 场景 1: 创建新功能

```bash
1. 点击 "Ask Sam" 按钮
2. 输入: "用户认证系统"
3. Sam 创建:
   - .claude/specs/user-authentication/
   - requirements.md
   - PROGRESS.md (自动!)
4. Specs 视图显示 🔄 图标
```

### 场景 2: 跨会话继续

```bash
# Day 1
插件: Ask Sam → "用户认证系统"
(需求编写中...)

# Day 2 (新的 Claude 会话)
右键 "user-authentication" → "Continue Sam Work"
Sam 读取 PROGRESS.md，知道需求已完成，自动开始设计阶段
```

### 场景 3: 混合使用 CLI

```bash
# 在插件中启动
插件: Ask Sam → "支付系统"

# 在 CLI 中继续
claude "Sam继续 payment-system 的工作"

# 回到插件查看进度
Specs 视图自动更新图标和状态
```

### 场景 4: 处理阻塞

```markdown
# PROGRESS.md 显示:
## Blockers
- Need API documentation for payment gateway
- Waiting for database schema approval

# 继续工作时:
右键 → "Continue Sam Work"
Sam 询问: "有阻塞问题待解决，是否已解决?"
```

## 🔄 工作流程

```
1. Ask Sam
   ↓
2. 创建 spec 目录 + PROGRESS.md
   ↓
3. Requirements 阶段 (🔄)
   ↓
4. 用户批准
   ↓
5. 更新 PROGRESS.md → Design 阶段
   ↓
6. Design 阶段 (🔄)
   ↓
7. 用户批准
   ↓
8. 更新 PROGRESS.md → Tasks 阶段
   ↓
9. Tasks 阶段 (🔄)
   ↓
10. 用户批准
    ↓
11. 更新 PROGRESS.md → Completed (✅)
```

## 📊 进度追踪示例

### Requirements 阶段

```markdown
## Current Phase
- **Phase**: Requirements
- **Status**: In Progress

## Completed Phases
- [ ] Requirements
- [ ] Design
- [ ] Tasks

## Current Tasks
- Gathering requirements
- Writing EARS format requirements
- Iterating with user feedback
```

### Design 阶段

```markdown
## Current Phase
- **Phase**: Design
- **Status**: In Progress

## Completed Phases
- [x] Requirements
- [ ] Design
- [ ] Tasks

## Current Tasks
- Researching authentication libraries
- Designing database schema
- Creating API endpoints design

## Key Decisions
- Use JWT for authentication tokens
- Store passwords with bcrypt hashing
```

### Completed

```markdown
## Current Phase
- **Phase**: Completed
- **Status**: Completed

## Completed Phases
- [x] Requirements
- [x] Design
- [x] Tasks

## Current Tasks
All planning complete - ready for implementation

## Key Decisions
- JWT authentication
- bcrypt password hashing
- RESTful API design
- PostgreSQL for user database
```

## 🛠️ 故障排查

### 进度图标不显示

**问题**: Spec 旁边没有进度图标

**解决方案**:
1. 检查是否存在 PROGRESS.md 文件
2. 刷新 Specs 视图（点击刷新按钮）
3. 查看文件格式是否正确
4. 查看 Output 面板 → "Kiro for Claude Code"

### Sam 不创建 PROGRESS.md

**问题**: Ask Sam 只创建了 requirements.md，没有 PROGRESS.md

**原因**: 系统提示词是旧版本

**解决方案**:
1. 确认文件存在：`.claude/system-prompts/spec-workflow-starter.md`
2. 检查文件中是否包含 "PROGRESS.md" 相关内容
3. 如果没有，从本项目复制最新版本

### 进度不更新

**问题**: 继续工作后 PROGRESS.md 没有更新

**原因**: Sam 可能遗漏了更新步骤

**解决方案**:
1. 手动更新 PROGRESS.md
2. 提醒 Sam 更新进度文件
3. 刷新 Specs 视图

## 🔗 与原 Sam 的兼容性

| 功能 | 插件 Sam | CLI Sam | 兼容性 |
|------|---------|---------|--------|
| 工作目录 | `.claude/specs/` | `.claude/specs/` | ✅ 完全共享 |
| 系统提示词 | spec-workflow-starter.md | spec-workflow-starter.md | ✅ 完全共享 |
| PROGRESS.md | 自动创建和读取 | 手动或自动 | ✅ 格式兼容 |
| 进度追踪 | 可视化图标 | 文件内容 | ✅ 数据共享 |

**结论**: 可以在插件和 CLI 之间自由切换，数据完全共享。

## 📚 相关文档

- [SAM_INTEGRATION.md](SAM_INTEGRATION.md) - Sam 功能完整说明
- [LOCAL_INSTALL.md](LOCAL_INSTALL.md) - 本地安装指南
- [SLASH_COMMANDS.md](SLASH_COMMANDS.md) - Slash 命令使用
- [../README.md](../README.md) - 项目主文档
- [../QUICK_START.md](../QUICK_START.md) - 快速开始

---

**注意**: 如果你在其他项目中使用 Sam，确保该项目的 `.claude/system-prompts/spec-workflow-starter.md` 也包含 PROGRESS.md 相关指令。
