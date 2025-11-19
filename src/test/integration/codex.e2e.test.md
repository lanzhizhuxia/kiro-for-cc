# Codex端到端集成测试文档 (Task 70)

## 测试文件

`src/test/integration/codex.e2e.test.ts`

## 测试目的

测试完整的Codex执行流程，从任务提交到结果展示的端到端验证。确保各个组件协同工作正常，覆盖真实使用场景。

## 测试覆盖范围

### 核心功能模块
- ✅ CodexOrchestrator - 主编排器
- ✅ TaskRouter - 任务路由和复杂度评估
- ✅ SessionStateManager - 会话状态管理
- ✅ MCPClient - MCP服务器通信（Mock）
- ✅ ProgressIndicator - 进度指示器
- ✅ DeepThinkingEngine - 深度推理引擎

### 需求覆盖
- ✅ REQ-001: 智能任务路由
- ✅ REQ-002: 复杂度评估
- ✅ REQ-003: MCP服务器集成
- ✅ REQ-004: 深度推理
- ✅ REQ-005: 代码库扫描
- ✅ REQ-006: 会话管理
- ✅ REQ-007: 执行模式选择
- ✅ REQ-008: 状态持久化
- ✅ REQ-009: 进度报告和取消

## 测试场景概览

| 场景ID | 场景名称 | 测试类型 | 测试数量 | 超时时间 |
|--------|----------|----------|----------|----------|
| S1 | 简单任务本地执行流程 | 正向测试 | 2 | 30s |
| S2 | 复杂任务Codex执行流程 | 正向测试 | 2 | 60s |
| S3 | 用户手动覆盖路由决策 | 正向测试 | 2 | 45s |
| S4 | 会话管理流程 | 正向测试 | 3 | 30s |
| S5 | 错误处理流程 | 异常测试 | 3 | 60s |
| S6 | 进度和取消流程 | 正向测试 | 3 | 30s |
| S7 | 深度推理完整流程 | 正向测试 | 2 | 45s |
| S8 | 复杂度评分和路由决策 | 正向测试 | 2 | 30s |
| S9 | 多任务并发执行 | 压力测试 | 1 | 60s |
| S10 | 资源清理和生命周期管理 | 正向测试 | 3 | 45s |

**总计**: 10个场景，23个测试用例

## 详细测试步骤

### S1: 简单任务本地执行流程

**测试目的**: 验证低复杂度任务自动选择本地模式并正确执行

**S1-01: 应该对简单任务使用本地模式执行**

**测试数据准备**:
```typescript
const task: TaskDescriptor = {
  id: 'e2e-simple-task-001',
  type: 'requirements',
  description: '修复一个简单的拼写错误',
  specName: 'test-feature'
};
```

**测试步骤**:
1. 创建简单任务描述符（复杂度<7分）
2. 调用 `orchestrator.executeTask(task)`（无forceMode）
3. 等待任务执行完成

**预期结果**:
- `result.mode === 'local'`
- `result.sessionId` 存在
- `result.startTime` 和 `result.endTime` 为有效Date对象
- `result.duration >= 0`
- 任务在30秒内完成

**S1-02: 应该正确保存简单任务的执行结果**

**测试步骤**:
1. 执行简单任务
2. 使用 `sessionManager.restoreSession(result.sessionId)` 恢复会话
3. 验证会话数据完整性

**预期结果**:
- 会话可以被成功恢复
- 会话数据与原始任务匹配
- 会话状态为 'active'

---

### S2: 复杂任务Codex执行流程

**测试目的**: 验证高复杂度任务自动路由到Codex模式并完成执行

**S2-01: 应该对复杂任务推荐Codex模式**

**测试数据准备**:
```typescript
const task: TaskDescriptor = {
  id: 'e2e-complex-task-001',
  type: 'design',
  description: '设计一个分布式缓存系统，支持多级缓存、故障转移和数据一致性保证...',
  specName: 'distributed-cache',
  relatedFiles: Array.from({ length: 15 }, (_, i) => `src/cache/module${i}.ts`)
};
```

**测试步骤**:
1. 创建复杂任务描述符（预期评分>=7）
2. 调用 `orchestrator.getRecommendedMode(task)`
3. 分析推荐结果

**预期结果**:
- `recommendation.mode === 'codex'`
- `recommendation.score >= 7.0`
- `recommendation.confidence > 50`
- `recommendation.reasons.length > 0`
- 推荐理由包含复杂度相关说明

**S2-02: 应该使用Codex模式执行复杂任务（强制模式）**

**测试数据准备**:
```typescript
const options: ExecutionOptions = {
  forceMode: 'codex',
  enableDeepThinking: true,
  enableCodebaseScan: true
};
```

**测试步骤**:
1. 创建复杂任务
2. 使用强制Codex模式执行
3. 启用深度推理和代码库扫描
4. 等待执行完成

**预期结果**:
- `result.mode === 'codex'`
- 任务成功执行或返回明确的错误信息
- 会话ID有效
- 执行在60秒内完成

---

### S3: 用户手动覆盖路由决策

**测试目的**: 验证用户可以强制指定执行模式，覆盖自动路由决策

**S3-01: 应该允许用户强制使用Codex模式执行中等复杂度任务**

**测试步骤**:
1. 创建中等复杂度任务（评分可能<7）
2. 获取自动推荐结果
3. 使用 `forceMode: 'codex'` 强制覆盖
4. 验证实际执行模式

**预期结果**:
- 自动推荐可能为 'local'
- 实际执行模式为 'codex'
- 强制模式生效

**S3-02: 应该允许用户强制使用本地模式执行复杂任务**

**测试步骤**:
1. 创建高复杂度任务（评分>=7）
2. 使用 `forceMode: 'local'` 强制覆盖
3. 验证实际执行模式

**预期结果**:
- 自动推荐为 'codex'
- 实际执行模式为 'local'
- 用户覆盖优先级高于自动路由

---

### S4: 会话管理流程

**测试目的**: 验证会话的创建、保存、恢复、持久化全流程

**S4-01: 应该创建会话并记录执行上下文**

**测试步骤**:
1. 执行任务（带特定options）
2. 恢复会话
3. 验证上下文信息完整性

**预期结果**:
- 会话包含完整的任务信息
- 执行选项被正确保存到 `session.context.options`
- `createdAt` 和 `lastActiveAt` 时间戳有效

**S4-02: 应该能够恢复已存在的会话**

**测试步骤**:
1. 执行任务，获取sessionId
2. 调用 `orchestrator.restoreSession(sessionId)`
3. 对比恢复的会话数据

**预期结果**:
- 恢复的会话ID与原始相同
- 任务信息一致
- 状态正确

**S4-03: 应该支持会话状态持久化和数据完整性**

**测试步骤**:
1. 执行任务
2. 恢复会话
3. 获取统计信息

**预期结果**:
- 会话数据持久化到 `sessions.json`
- 数据完整性检查通过
- 统计信息准确（total, active等）

---

### S5: 错误处理流程

**测试目的**: 验证各种异常情况的优雅处理

**S5-01: 应该优雅处理MCP服务器启动失败**

**Mock策略**:
- 不启动真实MCP服务器
- Codex模式调用可能失败

**测试步骤**:
1. 使用Codex模式执行任务
2. 捕获可能的MCP连接错误
3. 验证错误处理

**预期结果**:
- 不抛出未捕获的异常
- 如果失败，`result.error` 包含明确的错误信息
- 会话仍然被创建和保存

**S5-02: 应该处理执行超时情况**

**测试数据准备**:
```typescript
const options: ExecutionOptions = {
  forceMode: 'local',
  timeout: 1 // 1ms超时（必然超时）
};
```

**测试步骤**:
1. 设置极短的超时时间
2. 执行任务
3. 验证超时处理

**预期结果**:
- 超时被正确检测
- 返回错误结果而非抛出异常
- 会话状态反映超时情况

**S5-03: 应该处理网络错误和连接中断**

**测试步骤**:
1. 使用Codex模式（可能因MCP连接失败）
2. 验证网络错误处理
3. 检查错误日志

**预期结果**:
- 网络错误被捕获
- 错误信息清晰可读
- 系统保持稳定

---

### S6: 进度和取消流程

**测试目的**: 验证进度报告和任务取消机制

**S6-01: 应该报告任务执行进度**

**Mock策略**:
- 监听输出日志中的进度相关消息
- 检查 ProgressIndicator 调用

**测试步骤**:
1. 执行任务
2. 监听进度更新（通过日志）
3. 验证进度报告

**预期结果**:
- 进度信息被输出（可能在内部）
- 任务执行完成

**S6-02: 应该允许用户取消正在执行的任务**

**测试步骤**:
1. 创建 ProgressIndicator
2. 启动进度窗口（可取消）
3. 模拟用户取消操作
4. 验证取消机制

**预期结果**:
- 取消操作被正确处理
- 进度窗口关闭

**S6-03: 应该在取消时保存中间结果**

**测试步骤**:
1. 执行任务
2. 即使任务可能被中断，验证会话保存
3. 恢复会话验证数据完整性

**预期结果**:
- 中间结果被保存
- 会话可以被恢复
- 数据不丢失

---

### S7: 深度推理完整流程

**测试目的**: 验证深度推理功能的端到端执行

**S7-01: 应该执行完整的深度推理分析**

**测试数据准备**:
```typescript
const context: AnalysisContext = {
  task: {
    id: 'e2e-thinking-task-001',
    type: 'design',
    description: '设计高性能实时数据处理管道，支持百万级QPS',
    specName: 'realtime-pipeline'
  },
  complexityScore: {
    total: 9.0,
    codeScale: 9,
    technicalDifficulty: 9,
    businessImpact: 9,
    details: { ... }
  }
};
```

**测试步骤**:
1. 准备高复杂度分析上下文
2. 调用 `orchestrator.enableDeepThinking(context)`
3. 验证深度推理结果的各个部分

**预期结果**:
- `thinkingResult.problemDecomposition` 包含问题分解树
  - 每个节点有 id、description、complexity
- `thinkingResult.riskIdentification` 包含风险列表
  - 每个风险有 category、severity、description、mitigation
- `thinkingResult.solutionComparison` 包含方案对比
  - 每个方案有 id、pros、cons、complexity、score
- `thinkingResult.recommendedDecision` 包含推荐决策
  - 有 selectedSolution、rationale、nextSteps

**S7-02: 应该支持带深度推理的任务执行**

**测试步骤**:
1. 创建任务
2. 使用 `enableDeepThinking: true` 选项执行
3. 验证会话中包含推理结果

**预期结果**:
- 任务成功执行
- 深度推理结果被保存到会话

---

### S8: 复杂度评分和路由决策

**测试目的**: 验证复杂度分析的准确性和路由决策的合理性

**S8-01: 应该准确评估不同复杂度的任务**

**测试数据准备**:
```typescript
const tasks = [
  {
    task: { description: '添加一个配置项', ... },
    expectedMode: 'local'  // 简单任务
  },
  {
    task: { description: '实现用户登录功能', relatedFiles: 2个, ... },
    expectedMode: 'local'  // 中等任务
  },
  {
    task: { description: '设计微服务架构...', relatedFiles: 25个, ... },
    expectedMode: 'codex'  // 复杂任务
  }
];
```

**测试步骤**:
1. 对每个任务获取推荐模式
2. 对比预期模式和实际推荐
3. 验证评分合理性

**预期结果**:
- 简单任务推荐 'local'（评分<7）
- 复杂任务推荐 'codex'（评分>=7）
- 评分在0-10范围内
- 置信度在0-100范围内

**S8-02: 应该提供清晰的推荐理由**

**测试步骤**:
1. 获取任务推荐
2. 检查推荐理由列表
3. 验证理由的具体性

**预期结果**:
- `recommendation.reasons` 非空数组
- 理由包含具体信息（评分、文件数、复杂度等）
- 理由人类可读

---

### S9: 多任务并发执行

**测试目的**: 验证系统处理并发任务的能力和稳定性

**S9-01: 应该支持多个任务并发执行**

**测试数据准备**:
```typescript
const tasks = [
  { id: 'task-001', type: 'requirements', ... },
  { id: 'task-002', type: 'design', ... },
  { id: 'task-003', type: 'implementation', ... }
];
```

**测试步骤**:
1. 同时启动3个任务
2. 使用 `Promise.all()` 等待所有任务完成
3. 验证所有结果

**预期结果**:
- 所有任务都成功执行
- 每个任务有独立的sessionId
- 会话统计正确（total >= 3）
- 无资源竞争问题

---

### S10: 资源清理和生命周期管理

**测试目的**: 验证资源的正确释放和生命周期管理

**S10-01: 应该正确清理已完成任务的资源**

**测试步骤**:
1. 执行任务
2. 获取会话统计
3. 验证资源状态

**预期结果**:
- 活跃会话数量正确
- 已完成的会话被标记

**S10-02: 应该优雅关闭所有活跃会话**

**测试步骤**:
1. 创建多个活跃会话
2. 调用 `sessionManager.shutdownAllActiveSessions()`
3. 验证所有会话被关闭

**预期结果**:
- 关闭前有活跃会话
- 关闭后活跃会话数为0
- 所有会话状态更新为 'cancelled'

**S10-03: 应该支持orchestrator的完整dispose流程**

**测试步骤**:
1. 创建临时orchestrator
2. 执行一些任务
3. 调用 `dispose()`
4. 验证无异常抛出

**预期结果**:
- `dispose()` 正常完成
- 所有资源被释放
- 无内存泄漏

---

## 测试注意事项

### Mock策略

1. **MCP客户端Mock**:
   - 使用 `MockMCPClient` 类模拟MCP服务器响应
   - 不依赖真实的Codex MCP服务器
   - 提供预定义的响应数据

2. **输出通道Mock**:
   - 使用 `MockOutputChannel` 类收集日志
   - 支持日志查询和验证
   - 不干扰测试环境

3. **VSCode API Mock**:
   - 创建模拟的 `ExtensionContext`
   - 提供测试所需的最小实现
   - 不依赖真实的VSCode扩展环境

### 边界条件

1. **复杂度评分边界**:
   - 测试评分=6.9（临界点，应推荐local）
   - 测试评分=7.0（临界点，应推荐codex）
   - 测试极端值（0分，10分）

2. **超时处理**:
   - 测试极短超时（1ms）
   - 测试合理超时（30s）
   - 测试无超时限制

3. **会话数量**:
   - 测试单会话
   - 测试多会话并发
   - 测试会话上限（如果有）

### 异步操作

1. **所有异步测试使用 async/await**
2. **设置合理的超时时间**（15s-60s）
3. **使用 beforeAll/afterAll 管理共享资源**
4. **确保测试间隔离性（独立的任务ID）**

### 错误处理

1. **捕获所有Promise rejections**
2. **验证错误对象结构**:
   ```typescript
   expect(result.error).toBeDefined();
   expect(result.error!.message).toBeTruthy();
   expect(result.error!.stack).toBeDefined(); // 可选
   ```

3. **不要让错误中断整个测试套件**

---

## 测试覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|----------|------------|------------|
| CodexOrchestrator | ≥80% | ≥70% | ≥85% |
| TaskRouter | ≥85% | ≥75% | ≥90% |
| SessionStateManager | ≥80% | ≥70% | ≥85% |
| ProgressIndicator | ≥75% | ≥65% | ≥80% |
| DeepThinkingEngine | ≥70% | ≥60% | ≥75% |
| **总体目标** | **≥75%** | **≥65%** | **≥80%** |

---

## 运行测试

### 运行所有E2E测试
```bash
npm test -- src/test/integration/codex.e2e.test.ts
```

### 运行特定场景
```bash
npm test -- src/test/integration/codex.e2e.test.ts -t "Scenario 1"
```

### 运行单个测试
```bash
npm test -- src/test/integration/codex.e2e.test.ts -t "应该对简单任务使用本地模式执行"
```

### 运行并生成覆盖率报告
```bash
npm run test:coverage -- src/test/integration/codex.e2e.test.ts
```

---

## 测试结果示例

### 成功执行
```
PASS  src/test/integration/codex.e2e.test.ts (45.23s)
  Codex E2E Integration Tests
    Scenario 1: Simple Task Local Execution
      ✓ 应该对简单任务使用本地模式执行 (1234ms)
      ✓ 应该正确保存简单任务的执行结果 (987ms)
    Scenario 2: Complex Task Codex Execution
      ✓ 应该对复杂任务推荐Codex模式 (345ms)
      ✓ 应该使用Codex模式执行复杂任务（强制模式） (5678ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        45.234s
```

### 覆盖率报告
```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
codexOrchestrator.ts  |   82.45 |    74.32 |   88.23 |   81.67 |
taskRouter.ts         |   87.12 |    78.56 |   91.45 |   86.34 |
sessionStateManager.ts|   81.23 |    72.45 |   84.56 |   80.12 |
----------------------|---------|----------|---------|---------|
All files             |   79.34 |    71.23 |   83.45 |   78.56 |
----------------------|---------|----------|---------|---------|
```

---

## 已知问题和限制

1. **MCP服务器Mock限制**:
   - 当前使用Mock，无法测试真实MCP通信
   - 深度推理结果为预定义数据
   - 需要定期与真实服务器对比验证

2. **VSCode API限制**:
   - 部分VSCode API无法在测试环境完全模拟
   - 进度窗口显示无法视觉验证
   - 用户交互需要手动测试补充

3. **性能测试限制**:
   - 当前未包含大规模性能测试
   - 并发测试规模有限（3个任务）
   - 需要独立的性能测试套件

4. **代码库扫描Mock**:
   - 当前代码库扫描功能为占位实现
   - 无法测试实际的AST分析
   - 需要Task 18/19完成后补充

---

## 维护建议

1. **定期更新Mock数据**:
   - 当真实MCP响应格式变化时更新Mock
   - 确保Mock数据与实际一致

2. **增加测试场景**:
   - 根据用户反馈添加新场景
   - 覆盖边缘情况

3. **性能监控**:
   - 监控测试执行时间
   - 识别性能退化

4. **持续集成**:
   - 在CI/CD流程中运行E2E测试
   - 阻止破坏性变更合并

---

## 参考文档

- [CodexOrchestrator实现](../../features/codex/codexOrchestrator.ts)
- [TaskRouter实现](../../features/codex/taskRouter.ts)
- [SessionStateManager实现](../../features/codex/sessionStateManager.ts)
- [Jest测试框架文档](https://jestjs.io/docs/getting-started)
- [VSCode测试指南](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
