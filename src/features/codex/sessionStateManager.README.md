# SessionStateManager

## 概述

`SessionStateManager` 是 Codex 工作流编排系统的会话状态管理组件，负责管理 Codex 任务执行的会话生命周期、状态持久化和恢复机制。

## 核心职责

1. **会话创建和管理** - 创建唯一会话ID，管理会话生命周期
2. **状态持久化** - 将会话状态保存到 `.claude/codex/sessions.json`
3. **检查点机制** - 支持会话检查点创建，用于任务中断恢复
4. **会话恢复** - 加载历史会话上下文，继续未完成任务
5. **超时清理** - 自动清理超时会话，释放资源
6. **优雅关闭** - VSCode 关闭时保存所有活跃会话状态

## 需求映射

| 需求编号 | 需求描述 | 实现方法 |
|---------|---------|---------|
| 需求8.1 | 创建会话ID（格式：codex-{timestamp}-{uuid}） | `_generateSessionId()` |
| 需求8.1 | 记录到sessions.json | `_persistSessions()` |
| 需求8.4 | 保存当前工作状态 | `saveState()`, `createCheckpoint()` |
| 需求8.5 | 关闭VSCode时优雅关闭所有活跃会话 | `shutdownAllActiveSessions()` |
| 需求8.6 | 无活动30分钟后自动关闭会话 | `cleanupOldSessions()` |
| 需求8.7 | 恢复会话并加载上下文 | `restoreSession()` |

## 会话数据结构

### Session 接口

```typescript
interface Session {
  id: string;                    // 会话ID (codex-{timestamp}-{uuid})
  task: TaskDescriptor;          // 关联的任务
  status: SessionStatus;         // 会话状态
  createdAt: Date;               // 创建时间
  lastActiveAt: Date;            // 最后活跃时间
  context?: {                    // 会话上下文
    codebaseSnapshot?: CodebaseSnapshot;
    complexityScore?: ComplexityScore;
    options?: ExecutionOptions;
  };
  checkpoints?: SessionCheckpoint[];  // 检查点列表
  metadata?: Record<string, any>;     // 元数据
}
```

### 会话状态

- `active` - 活跃中
- `completed` - 已完成
- `failed` - 失败
- `timeout` - 超时
- `cancelled` - 已取消

## API 文档

### 核心方法

#### createSession(task, options?)

创建新会话。

```typescript
async createSession(
  task: TaskDescriptor,
  options?: ExecutionOptions
): Promise<Session>
```

**参数：**
- `task` - 任务描述符
- `options` - 执行选项（可选）

**返回：** 创建的会话对象

**示例：**
```typescript
const session = await manager.createSession({
  id: 'design-review-1',
  type: 'design',
  description: 'Review design document'
}, {
  enableDeepThinking: true,
  timeout: 300000
});
```

#### saveState(session, result?)

保存会话状态。

```typescript
async saveState(session: Session, result?: any): Promise<void>
```

**参数：**
- `session` - 会话对象
- `result` - 执行结果（可选）

**示例：**
```typescript
await manager.saveState(session, {
  output: 'Analysis complete',
  generatedFiles: ['design_v2.md']
});
```

#### updateContext(sessionId, complexityScore?, codebaseSnapshot?)

更新会话上下文。

```typescript
async updateContext(
  sessionId: string,
  complexityScore?: ComplexityScore,
  codebaseSnapshot?: CodebaseSnapshot
): Promise<void>
```

**示例：**
```typescript
await manager.updateContext(
  session.id,
  { total: 7, codeScale: 6, technicalDifficulty: 8, businessImpact: 7, ... },
  { timestamp: new Date(), files: [...], ... }
);
```

#### createCheckpoint(sessionId, state, description)

创建会话检查点。

```typescript
async createCheckpoint(
  sessionId: string,
  state: Record<string, any>,
  description: string
): Promise<void>
```

**示例：**
```typescript
await manager.createCheckpoint(
  session.id,
  { step: 'analysis', progress: 50, analyzedFiles: 10 },
  'Completed initial codebase analysis'
);
```

#### restoreSession(sessionId)

恢复会话。

```typescript
async restoreSession(sessionId: string): Promise<Session | null>
```

**返回：** 恢复的会话对象，如果不存在则返回 null

**示例：**
```typescript
const session = await manager.restoreSession('codex-1234567890-abc');
if (session) {
  // 继续未完成任务
  console.log(`Restored session with ${session.checkpoints?.length} checkpoints`);
}
```

#### cleanupOldSessions(maxAge?)

清理旧会话。

```typescript
async cleanupOldSessions(maxAge?: number): Promise<number>
```

**参数：**
- `maxAge` - 最大年龄（毫秒），默认30分钟

**返回：** 清理的会话数量

**示例：**
```typescript
// 清理超过30分钟无活动的会话
const count = await manager.cleanupOldSessions(30 * 60 * 1000);
console.log(`Cleaned up ${count} old sessions`);
```

#### shutdownAllActiveSessions()

优雅关闭所有活跃会话。

```typescript
async shutdownAllActiveSessions(): Promise<void>
```

**示例：**
```typescript
// 在 VSCode 关闭时调用
context.subscriptions.push(
  vscode.workspace.onWillShutdown(() => {
    await manager.shutdownAllActiveSessions();
  })
);
```

### 查询方法

#### getSession(sessionId)

获取会话。

```typescript
getSession(sessionId: string): Session | null
```

#### getActiveSessions()

获取所有活跃会话。

```typescript
getActiveSessions(): Session[]
```

#### getStatistics()

获取会话统计信息。

```typescript
getStatistics(): {
  total: number;
  active: number;
  completed: number;
  failed: number;
  timeout: number;
  cancelled: number;
}
```

### 更新方法

#### updateSessionStatus(sessionId, status)

更新会话状态。

```typescript
async updateSessionStatus(
  sessionId: string,
  status: Session['status']
): Promise<void>
```

#### deleteSession(sessionId)

删除会话。

```typescript
async deleteSession(sessionId: string): Promise<void>
```

## 使用示例

### 基本会话管理

```typescript
import { SessionStateManager } from './sessionStateManager';

// 初始化管理器
const manager = new SessionStateManager(context, outputChannel);

// 创建会话
const session = await manager.createSession({
  id: 'task-1',
  type: 'design',
  description: 'Analyze architecture design'
});

// 更新上下文
await manager.updateContext(
  session.id,
  complexityScore,
  codebaseSnapshot
);

// 创建检查点
await manager.createCheckpoint(
  session.id,
  { phase: 'analysis', filesProcessed: 50 },
  'Completed phase 1: analysis'
);

// 保存状态
await manager.saveState(session, result);

// 更新状态
await manager.updateSessionStatus(session.id, 'completed');
```

### 会话恢复

```typescript
// 恢复之前的会话
const session = await manager.restoreSession('codex-1234567890-abc');

if (session) {
  // 检查检查点
  if (session.checkpoints && session.checkpoints.length > 0) {
    const lastCheckpoint = session.checkpoints[session.checkpoints.length - 1];
    console.log(`Last checkpoint: ${lastCheckpoint.description}`);

    // 从检查点恢复状态
    const state = lastCheckpoint.state;
    // 继续执行...
  }

  // 访问上下文
  const complexity = session.context?.complexityScore;
  const codebase = session.context?.codebaseSnapshot;
}
```

### 定期清理

```typescript
// 设置定时清理任务
const cleanupInterval = setInterval(async () => {
  const cleanedCount = await manager.cleanupOldSessions();
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} timed-out sessions`);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 清理时销毁定时器
context.subscriptions.push({
  dispose: () => clearInterval(cleanupInterval)
});
```

### VSCode 关闭时保存状态

```typescript
// 注册关闭事件处理
context.subscriptions.push(
  vscode.workspace.onWillShutdown(async () => {
    // 优雅关闭所有活跃会话
    await manager.shutdownAllActiveSessions();

    // 显示统计信息
    const stats = manager.getStatistics();
    console.log(`Saved ${stats.active} active sessions`);
  })
);
```

## 持久化格式

会话数据保存在 `.claude/codex/sessions.json`：

```json
{
  "sessions": [
    {
      "id": "codex-1731926400000-a1b2c3d4",
      "task": {
        "id": "design-review-1",
        "type": "design",
        "description": "Review architecture design"
      },
      "status": "active",
      "createdAt": "2024-11-18T08:00:00.000Z",
      "lastActiveAt": "2024-11-18T08:15:00.000Z",
      "context": {
        "complexityScore": {
          "total": 7,
          "codeScale": 6,
          "technicalDifficulty": 8,
          "businessImpact": 7,
          "details": { ... }
        },
        "options": {
          "enableDeepThinking": true,
          "timeout": 300000
        }
      },
      "checkpoints": [
        {
          "id": "e5f6g7h8-i9j0-k1l2-m3n4-o5p6q7r8s9t0",
          "timestamp": "2024-11-18T08:10:00.000Z",
          "description": "Completed initial analysis",
          "state": {
            "step": "analysis",
            "progress": 50
          }
        }
      ],
      "metadata": {}
    }
  ],
  "lastUpdated": "2024-11-18T08:15:00.000Z",
  "version": "1.0.0"
}
```

## 最佳实践

### 1. 及时创建检查点

在关键步骤完成后创建检查点，便于故障恢复：

```typescript
// ✅ 好的做法
await manager.createCheckpoint(session.id, state, 'Completed analysis');
await manager.createCheckpoint(session.id, state, 'Generated design');
await manager.createCheckpoint(session.id, state, 'Validated output');

// ❌ 避免
// 不创建检查点，任务中断后无法恢复
```

### 2. 定期保存状态

在长时间运行的任务中定期保存状态：

```typescript
// ✅ 好的做法
for (const file of files) {
  await processFile(file);

  // 每处理10个文件保存一次
  if (processedCount % 10 === 0) {
    await manager.saveState(session, { processedCount });
  }
}
```

### 3. 清理旧会话

避免会话文件无限增长：

```typescript
// ✅ 好的做法
// 定期清理
setInterval(() => manager.cleanupOldSessions(), 5 * 60 * 1000);

// 或在启动时清理
await manager.cleanupOldSessions();
```

### 4. 正确处理会话状态

确保会话状态反映实际执行情况：

```typescript
// ✅ 好的做法
try {
  const result = await executeTask(session);
  await manager.updateSessionStatus(session.id, 'completed');
  await manager.saveState(session, result);
} catch (error) {
  await manager.updateSessionStatus(session.id, 'failed');
  await manager.saveState(session, { error: error.message });
}
```

## 错误处理

### 会话不存在

```typescript
try {
  await manager.updateSessionStatus('invalid-id', 'completed');
} catch (error) {
  console.error('Session not found:', error.message);
}
```

### 持久化失败

```typescript
try {
  await manager.createSession(task);
} catch (error) {
  console.error('Failed to persist session:', error.message);
  // 会话已创建在内存中，但未保存到文件
}
```

## 性能考虑

1. **内存管理** - 会话对象存储在内存中，定期清理可避免内存泄漏
2. **文件I/O** - 每次状态变更都会持久化，频繁更新时考虑批处理
3. **检查点数量** - 单个会话的检查点数量建议不超过50个

## 测试

运行单元测试：

```bash
npm test -- src/features/codex/__tests__/sessionStateManager.test.ts
```

测试覆盖：
- 会话创建和ID生成 ✓
- 状态保存和持久化 ✓
- 会话恢复 ✓
- 检查点创建和恢复 ✓
- 会话超时和清理 ✓
- CRUD操作 ✓
- 统计信息 ✓
- 错误处理 ✓

## 相关组件

- `CodexOrchestrator` - 使用 SessionStateManager 管理任务执行会话
- `CodexExecutor` - 在会话上下文中执行任务
- `MCPLifecycleManager` - 管理 MCP 服务器生命周期

## 版本历史

- **v1.0.0** - 初始实现
  - 会话创建和管理
  - 状态持久化
  - 检查点机制
  - 超时清理
  - 优雅关闭
