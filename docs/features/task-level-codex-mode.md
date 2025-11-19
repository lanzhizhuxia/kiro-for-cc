# Task-Level Codex Mode Support (T55)

## 概述

任务级别Codex模式支持允许用户在 `tasks.md` 文档中为单个任务启用Codex深度分析执行模式，无需为整个spec启用Codex模式。

## 功能特性

### 1. CodeLens集成

在 `tasks.md` 文档中，每个任务旁边会显示两个CodeLens按钮：

- **$(sparkle) 使用Codex执行**: 使用Codex深度分析执行此任务
- **$(info) 详情**: 查看任务详细信息

### 2. 任务识别

系统自动识别以下格式的任务：

```markdown
- [ ] 1. 任务标题
  - 任务详细描述1
  - 任务详细描述2

- [ ] 2.1. 子任务标题
  - 子任务详细描述

- [x] 3. 已完成任务
```

支持：
- 单级任务编号（如 `1`, `2`, `3`）
- 多级任务编号（如 `1.1`, `2.1`, `3.2.1`）
- 已完成任务（`- [x]`）和未完成任务（`- [ ]`）

### 3. 强制Codex模式

当用户通过CodeLens执行任务时，系统强制使用Codex模式，覆盖全局配置：

```typescript
await codexOrchestrator.executeTask(taskDescriptor, {
  forceMode: 'codex',  // 强制使用Codex
  enableDeepThinking: true,
  enableCodebaseScan: true
});
```

### 4. 任务执行隔离

每个任务执行在独立的会话中进行，确保：
- 任务间互不干扰
- 独立的会话ID
- 独立的执行上下文
- 独立的深度推理结果

### 5. 上下文自动加载

系统自动加载相关文档作为执行上下文：

- `requirements.md`: 需求文档
- `design.md`: 设计文档
- `tasks.md`: 任务详细描述

## 实现架构

### 核心组件

1. **TaskCodeLensProvider** (`src/features/codex/taskCodeLensProvider.ts`)
   - 扫描tasks.md文档
   - 识别任务项
   - 提供CodeLens

2. **taskExecutionHandler** (`src/features/codex/taskExecutionHandler.ts`)
   - 处理任务执行请求
   - 提取任务详细信息
   - 构建任务描述符
   - 调用CodexOrchestrator执行

3. **CodexOrchestrator** (`src/features/codex/codexOrchestrator.ts`)
   - 管理任务执行流程
   - 支持强制模式覆盖
   - 提供深度推理能力

### 执行流程

```
用户点击"使用Codex执行"
         ↓
    确认用户意图
         ↓
  读取任务详细描述
         ↓
   提取spec名称
         ↓
  加载相关文档上下文
    (requirements, design)
         ↓
   构建TaskDescriptor
         ↓
 调用CodexOrchestrator
   (forceMode: 'codex')
         ↓
   执行深度推理分析
         ↓
  显示分析结果WebView
         ↓
      完成
```

## 使用方法

### 1. 在tasks.md中查看CodeLens

打开任何spec的 `tasks.md` 文档，未完成的任务旁边会自动显示CodeLens。

### 2. 执行任务

点击 **$(sparkle) 使用Codex执行** 按钮：
1. 系统弹出确认对话框
2. 点击"执行"开始任务
3. 显示进度通知
4. 任务完成后显示分析结果

### 3. 查看任务详情

点击 **$(info) 详情** 按钮：
- 在新的WebView面板中显示任务详细信息
- 包含任务标题、描述、所属spec等信息

### 4. 配置选项

在VSCode设置中配置：

```json
{
  "kfc.codex.enableTaskCodeLens": true  // 启用/禁用Task CodeLens
}
```

## 实现细节

### 任务详细信息提取

`extractTaskDetails()` 函数从tasks.md中提取任务详细信息：

```typescript
export function extractTaskDetails(
  document: vscode.TextDocument,
  taskNumber: string
): string | null {
  // 1. 查找任务标题行
  // 2. 提取任务标题
  // 3. 收集缩进的子项（详细描述）
  // 4. 返回完整的任务描述
}
```

支持：
- 多级编号（如 `1.2.3`）
- 已完成和未完成任务
- 缩进的详细描述

### Spec名称提取

`extractSpecNameFromPath()` 函数从文档路径提取spec名称：

```typescript
// 支持的路径格式：
// - /workspace/docs/specs/{spec-name}/tasks.md
// - /workspace/.claude/specs/{spec-name}/tasks.md
// - Windows路径: C:\workspace\specs\{spec-name}\tasks.md
```

### 任务描述符构建

```typescript
const taskDescriptor: TaskDescriptor = {
  id: `task-${specName}-${taskNumber}-${Date.now()}`,
  type: 'implementation',
  description: taskTitle,
  specName: specName,
  context: {
    requirements,  // 从requirements.md加载
    design,        // 从design.md加载
    tasks: taskDetails,
    additionalContext: {
      taskNumber,
      taskTitle,
      specName,
      tasksFilePath: docUri.fsPath
    }
  }
};
```

### 执行选项

```typescript
{
  forceMode: 'codex',        // 强制使用Codex模式
  enableDeepThinking: true,   // 启用深度推理
  enableCodebaseScan: true    // 启用代码库扫描
}
```

## 测试覆盖

### 单元测试

测试文件: `src/test/integration/taskCodeLens.test.ts`

覆盖：
- ✅ TaskCodeLensProvider提供CodeLens
- ✅ 任务识别（单级/多级编号）
- ✅ 已完成任务处理
- ✅ 配置禁用功能
- ✅ CodeLens刷新
- ✅ 任务详细信息提取
- ✅ Spec名称提取
- ✅ 任务执行流程
- ✅ 用户取消处理
- ✅ 错误处理
- ✅ WebView显示

### 测试结果

```
Test Suites: 1 passed
Tests:       18 passed
```

## 配置示例

### VSCode Settings

```json
{
  // 启用Task CodeLens
  "kfc.codex.enableTaskCodeLens": true,

  // Codex全局默认模式（不影响任务级别强制模式）
  "kfc.codex.defaultMode": "auto"
}
```

### Workspace Settings (.vscode/settings.json)

```json
{
  "kfc.codex.enableTaskCodeLens": true
}
```

## 常见问题

### Q1: CodeLens没有显示？

检查：
1. 是否在 `tasks.md` 文档中
2. 配置 `kfc.codex.enableTaskCodeLens` 是否为 `true`
3. Codex Orchestrator是否成功初始化
4. 任务格式是否正确（`- [ ] 1. 任务标题`）

### Q2: 执行任务时提示"未找到任务"？

检查：
1. 任务编号是否正确
2. 任务格式是否符合要求
3. 是否有缩进的详细描述

### Q3: 如何禁用Task CodeLens？

在VSCode设置中：
```json
{
  "kfc.codex.enableTaskCodeLens": false
}
```

### Q4: 任务执行会影响全局Codex配置吗？

不会。任务级别的Codex模式是强制模式，仅在该任务执行时生效，不会修改全局配置。

## 性能考虑

1. **按需加载**: CodexOrchestrator仅在首次使用时初始化
2. **文档缓存**: VSCode自动缓存已打开的文档
3. **CodeLens刷新**: 使用防抖机制避免频繁刷新
4. **会话隔离**: 每个任务独立会话，避免相互影响

## 未来增强

潜在的功能增强：

1. **批量执行**: 支持一次执行多个任务
2. **执行历史**: 记录任务执行历史和结果
3. **任务依赖**: 识别任务间的依赖关系
4. **智能推荐**: 基于任务类型推荐执行模式
5. **结果比较**: 对比Local和Codex模式的执行结果

## 相关文件

- `src/features/codex/taskCodeLensProvider.ts` - CodeLens提供器
- `src/features/codex/taskExecutionHandler.ts` - 任务执行处理器
- `src/features/codex/codexOrchestrator.ts` - Codex编排器
- `src/features/codex/types.ts` - 类型定义
- `src/test/integration/taskCodeLens.test.ts` - 测试文件
- `src/extension.ts` - 扩展入口（注册CodeLens和命令）
- `package.json` - 扩展配置（commands, configuration）

## 参考文档

- [Codex Orchestrator文档](./codex-orchestrator.md)
- [VSCode CodeLens API](https://code.visualstudio.com/api/references/vscode-api#CodeLensProvider)
- [任务描述符规范](../specs/task-descriptor-spec.md)
