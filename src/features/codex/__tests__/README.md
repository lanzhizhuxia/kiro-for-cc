# Codex Feature Tests

本目录包含Codex工作流编排系统的所有测试文件。

## 测试文件清单

### mcpLifecycleManager.test.ts
测试MCP生命周期管理器的所有功能。

**测试覆盖**：
- 状态机转换（STOPPED → STARTING → RUNNING → ERROR）
- 启动和停止流程
- 健康检查机制
- 错误处理
- 自动重启
- 配置加载

**运行测试**：
```bash
npm test -- mcpLifecycleManager.test.ts
```

## 运行所有测试

```bash
# 运行所有Codex相关测试
npm test -- src/features/codex/__tests__

# 运行测试并生成覆盖率报告
npm test -- --coverage src/features/codex/__tests__

# 监听模式（开发时使用）
npm test -- --watch src/features/codex/__tests__
```

## 测试最佳实践

1. **Mock外部依赖**: 所有外部依赖（VSCode API、child_process、ConfigManager）都应该被mock
2. **使用假定时器**: 对于涉及setTimeout/setInterval的测试，使用`jest.useFakeTimers()`
3. **测试边界情况**: 不仅测试正常流程，还要测试错误情况和边界条件
4. **清理资源**: 在`afterEach`中清理所有mock和定时器
5. **测试隔离**: 每个测试应该独立，不依赖其他测试的状态

## 测试工具

- **Jest**: 测试框架
- **@types/jest**: TypeScript类型定义
- **ts-jest**: TypeScript支持

## 添加新测试

创建新测试文件时，请遵循以下模板：

```typescript
import { YourClass } from '../yourFile';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  // Mock VSCode API
}));

describe('YourClass', () => {
  let instance: YourClass;

  beforeEach(() => {
    instance = new YourClass();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('methodName', () => {
    it('should do something', () => {
      // Test implementation
    });
  });
});
```
