# CodexExecutor 集成测试示例

## 概述

本文档提供了 CodexExecutor 与 MCPLifecycleManager 集成的测试示例和使用场景。

## 测试场景

### 场景 1：成功执行任务

```typescript
import { CodexExecutor } from '../codexExecutor';
import * as vscode from 'vscode';

// 创建输出通道
const outputChannel = vscode.window.createOutputChannel('Test');

// 创建执行器
const executor = new CodexExecutor(outputChannel);

// 定义任务
const task = {
  id: 'test-task-1',
  type: 'design' as const,
  description: 'Review design document',
  specName: 'my-feature',
  context: {
    requirements: 'Feature requirements...',
    design: 'Design document content...'
  }
};

// 定义会话
const session = {
  id: 'session-1',
  task,
  status: 'active' as const,
  createdAt: new Date(),
  lastActiveAt: new Date(),
  context: {
    options: {
      timeout: 300000
    }
  }
};

// 执行任务
const result = await executor.execute(task, session);

console.log('执行结果:', result);
// 输出:
// {
//   success: true,
//   mode: 'codex',
//   sessionId: 'session-1',
//   startTime: Date,
//   endTime: Date,
//   duration: 1234,
//   output: 'Successfully executed task...',
//   generatedFiles: []
// }
```

### 场景 2：MCP 服务器未启动

```typescript
// CodexExecutor 会自动通过 MCPLifecycleManager 启动服务器
const result = await executor.execute(task, session);

// 日志输出示例:
// [CodexExecutor] Starting execution for task: test-task-1
// [CodexExecutor] Ensuring MCP server is running...
// [MCPLifecycleManager] Starting MCP server...
// [MCPLifecycleManager] Codex CLI version: 1.0.0
// [MCPLifecycleManager] MCP server started (PID: 12345, Port: 8765)
// [CodexExecutor] MCP server is ready (PID: 12345, Port: 8765)
// [CodexExecutor] Preparing execution context...
// [CodexExecutor] Sending MCP request...
// [CodexExecutor] Processing response...
// [CodexExecutor] Execution completed successfully in 2345ms
```

### 场景 3：任务超时

```typescript
const session = {
  // ...
  context: {
    options: {
      timeout: 1000  // 1秒超时（用于测试）
    }
  }
};

const result = await executor.execute(task, session);

if (!result.success && result.error?.code === 'timeout') {
  console.error('任务超时');
  // 处理超时情况
}
```

### 场景 4：请求取消

```typescript
// 启动长时间运行的任务
const promise = executor.execute(task, session);

// 5秒后取消
setTimeout(() => {
  // 取消请求需要知道请求ID
  // 实际使用时，可以通过监听执行状态获取请求ID
  executor.cancelRequest('req-id');
}, 5000);

try {
  const result = await promise;
  if (!result.success && result.error?.code === 'CANCELLED') {
    console.log('任务已取消');
  }
} catch (error) {
  console.error('执行异常:', error);
}
```

### 场景 5：准备执行上下文

```typescript
// 仅准备上下文，不执行
const context = await executor.prepareContext(task);

console.log('执行上下文:', {
  taskId: context.task.id,
  taskType: context.task.type,
  hasCustomContext: !!context.customContext,
  customContextKeys: Object.keys(context.customContext || {})
});

// 输出:
// {
//   taskId: 'test-task-1',
//   taskType: 'design',
//   hasCustomContext: true,
//   customContextKeys: ['requirements', 'design', 'taskMetadata']
// }
```

### 场景 6：检查 MCP 服务器状态

```typescript
const status = await executor.checkServerStatus();

console.log('MCP 服务器状态:', {
  status: status.status,
  pid: status.pid,
  port: status.port,
  isHealthy: status.isHealthy,
  uptime: status.uptime ? `${status.uptime}ms` : 'N/A'
});

// 输出示例:
// {
//   status: 'running',
//   pid: 12345,
//   port: 8765,
//   isHealthy: true,
//   uptime: '5000ms'
// }
```

### 场景 7：错误处理

```typescript
try {
  const result = await executor.execute(task, session);

  if (!result.success) {
    // 根据错误类型处理
    switch (result.error?.code) {
      case 'timeout':
        console.error('任务超时，请增加超时时间');
        break;
      case 'CANCELLED':
        console.log('任务已取消');
        break;
      default:
        console.error('执行失败:', result.error?.message);
    }
  }
} catch (error) {
  // 处理异常
  if (error.message.includes('MCP server is not running')) {
    console.error('MCP 服务器未运行');
    vscode.window.showErrorMessage(
      'Codex MCP服务器未运行，请检查Codex CLI是否已安装'
    );
  } else {
    console.error('未知错误:', error);
  }
}
```

### 场景 8：资源清理

```typescript
// 在扩展停用时
export async function deactivate() {
  // 清理 CodexExecutor 资源
  await executor.dispose();

  // 日志输出:
  // [CodexExecutor] Disposing executor...
  // [CodexExecutor] Stopping MCP server...
  // [MCPLifecycleManager] Stopping MCP server...
  // [MCPLifecycleManager] MCP server stopped
  // [CodexExecutor] Executor disposed
}
```

## 测试数据

### 标准任务描述符

```typescript
const testTask: TaskDescriptor = {
  id: 'task-001',
  type: 'design',
  description: 'Review design document for authentication system',
  specName: 'auth-system',
  relatedFiles: [
    'src/auth/authManager.ts',
    'src/auth/tokenService.ts'
  ],
  context: {
    requirements: `
      # Authentication System Requirements
      - Support JWT tokens
      - Implement refresh token mechanism
      - Rate limiting for login attempts
    `,
    design: `
      # Authentication System Design
      ## Architecture
      - Token-based authentication
      - Redis for token storage
      - Express middleware for validation
    `
  },
  metadata: {
    priority: 'high',
    estimatedDuration: 300000  // 5 minutes
  }
};
```

### 标准会话

```typescript
const testSession: Session = {
  id: `session-${Date.now()}`,
  task: testTask,
  status: 'active',
  createdAt: new Date(),
  lastActiveAt: new Date(),
  context: {
    options: {
      timeout: 300000,           // 5分钟
      enableDeepThinking: true,  // 启用深度推理
      enableCodebaseScan: true   // 启用代码库扫描
    }
  }
};
```

## Mock 数据

### Mock MCP 响应（成功）

```typescript
const mockSuccessResponse: MCPResponse = {
  requestId: 'req-123',
  status: 'success',
  data: {
    output: `
      # Design Review Report

      ## Summary
      The authentication system design is well-structured and follows best practices.

      ## Findings
      - ✅ JWT implementation is secure
      - ✅ Refresh token mechanism is properly designed
      - ⚠️  Consider adding rate limiting at API Gateway level

      ## Recommendations
      1. Add monitoring for failed login attempts
      2. Implement token rotation policy
      3. Consider using Redis cluster for high availability
    `,
    generatedFiles: [
      '.claude/codex/reports/design-review-auth-system.md'
    ],
    metadata: {
      reviewDuration: 45000,
      deepThinkingEnabled: true,
      riskLevel: 'low'
    }
  },
  timestamp: new Date()
};
```

### Mock MCP 响应（失败）

```typescript
const mockErrorResponse: MCPResponse = {
  requestId: 'req-123',
  status: 'error',
  error: {
    message: 'Failed to analyze design document',
    code: 'ANALYSIS_ERROR',
    stack: 'Error: Failed to parse design document\n    at ...'
  },
  timestamp: new Date()
};
```

## 性能指标

基于单元测试的性能指标：

| 操作 | 预期时长 | 实际时长（测试） |
|------|---------|----------------|
| 准备上下文 | < 10ms | ~1ms |
| MCP请求（模拟） | ~1000ms | 1001-1002ms |
| 处理响应 | < 5ms | ~1ms |
| 完整执行流程 | ~1000ms | ~1002ms |

## 注意事项

1. **当前实现使用模拟 MCP 通信**
   - `_mockMCPRequest` 方法用于测试
   - 实际使用时需要实现真实的 HTTP/WebSocket 通信

2. **MCP 服务器启动**
   - 首次执行任务时会自动启动 MCP 服务器
   - 启动时间约 5 秒
   - 服务器会在后台持续运行

3. **资源管理**
   - 使用 `dispose()` 清理资源
   - 取消所有活跃请求
   - 停止 MCP 服务器

4. **错误处理**
   - 所有错误都被捕获并返回在 `ExecutionResult` 中
   - 不会抛出未捕获的异常
   - 提供详细的错误信息和堆栈

## 相关文档

- [codexExecutor.ts](../codexExecutor.ts) - 源代码
- [codexExecutor.test.ts](./codexExecutor.test.ts) - 单元测试
- [codexExecutor.README.md](../codexExecutor.README.md) - 详细文档
- [mcpLifecycleManager.ts](../mcpLifecycleManager.ts) - MCP 生命周期管理器
