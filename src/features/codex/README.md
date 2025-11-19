# Codex工作流编排系统

本目录包含Codex工作流编排系统的核心实现,该系统提供智能任务路由,根据任务复杂度在本地agent和Codex深度推理之间进行选择。

## 核心组件

### LocalAgentExecutor (Task 21 - 已完成)

`LocalAgentExecutor` 是本地agent执行器的包装器,提供与 `CodexExecutor` 兼容的统一接口。

#### 主要功能

- **统一接口**: 实现与 `CodexExecutor` 相同的 `execute(task)` 接口
- **Agent选择**: 根据任务类型自动选择合适的agent
- **提示词构建**: 自动构建包含任务上下文的提示词
- **结果标准化**: 返回标准化的 `ExecutionResult` 对象

#### 使用示例

```typescript
import { LocalAgentExecutor } from './features/codex/localAgentExecutor';
import { TaskDescriptor } from './features/codex/types';

// 创建executor实例
const executor = new LocalAgentExecutor(outputChannel);

// 定义任务
const task: TaskDescriptor = {
  id: 'task-001',
  type: 'requirements',
  description: '创建需求文档',
  specName: 'my-feature',
  context: {
    requirements: '需求内容...',
    design: '设计内容...'
  }
};

// 执行任务
const result = await executor.execute(task);

if (result.success) {
  console.log('任务执行成功');
  console.log('输出:', result.output);
  console.log('生成的文件:', result.generatedFiles);
} else {
  console.error('任务执行失败:', result.error?.message);
}
```

#### Agent映射

LocalAgentExecutor根据任务类型自动选择agent:

| 任务类型 | Agent名称 | 说明 |
|---------|----------|------|
| `requirements` | `spec-requirements` | 需求文档创建 |
| `design` | `spec-design` | 设计文档创建 |
| `tasks` | `spec-tasks` | 任务列表创建 |
| `review` | `spec-judge` | 文档评审 |
| `implementation` | `spec-impl` | 代码实现 |
| 其他 | `null` | 不使用特定agent |

#### 辅助方法

```typescript
// 检查agent是否可用
const isAvailable = await executor.isAgentAvailable('spec-requirements');

// 列出所有可用的agent
const agents = await executor.listAvailableAgents();
console.log('可用的agents:', agents);
```

#### 执行结果结构

```typescript
interface ExecutionResult {
  success: boolean;           // 执行是否成功
  mode: 'local' | 'codex';    // 执行模式(LocalAgentExecutor固定为'local')
  sessionId: string;          // 会话ID (格式: local-{timestamp}-{random})
  startTime: Date;            // 执行开始时间
  endTime: Date;              // 执行结束时间
  duration: number;           // 执行耗时(毫秒)
  output?: string;            // 执行输出
  generatedFiles?: string[];  // 生成的文件列表
  error?: {                   // 错误信息(如果失败)
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {                // 元数据
    agentName: string;        // 使用的agent名称
    taskType: string;         // 任务类型
    exitCode?: number;        // 退出码
  };
}
```

## 测试

单元测试: `src/test/unit/codex/localAgentExecutor.test.ts`

集成测试: `src/test/integration/localAgentExecutor.test.ts`

运行测试:

```bash
npm test
```

## 开发状态

当前已完成:
- ✅ Task 1-7: 基础设施与复杂度分析
- ✅ Task 21: 本地Agent执行器包装 (最新完成)

## 许可证

本项目遵循MIT许可证。
