# PreferenceTracker - 用户偏好学习机制

## 概述

PreferenceTracker是Codex工作流编排系统的核心组件,负责学习和分析用户对于执行模式(Codex vs Local)的偏好,从而优化任务路由推荐算法。

## 核心功能

### 1. 决策记录

自动记录用户的每次路由决策:
- 推荐的模式和评分
- 用户实际选择的模式
- 任务类型和描述
- 推荐理由和置信度

```typescript
await tracker.recordDecision(
  task,              // 任务描述符
  'codex',          // 推荐的模式
  8.5,              // 复杂度评分
  'local',          // 用户实际选择
  {
    reasons: ['高复杂度', '多模块影响'],
    confidence: 85
  }
);
```

### 2. 偏好模式分析

分析用户的偏好趋势,包括:
- **整体接受率**: 用户接受推荐的比例
- **按任务类型**: 不同任务类型的模式偏好
- **按复杂度范围**: 低/中/高复杂度的偏好差异
- **偏好模式识别**: local / codex / balanced

```typescript
const pattern = tracker.getPreferencePattern();

console.log(`总决策: ${pattern.totalDecisions}`);
console.log(`接受率: ${pattern.acceptanceRate}%`);
console.log(`偏好模式: ${pattern.preferredMode}`);

// 按任务类型分析
Object.entries(pattern.byTaskType).forEach(([type, stats]) => {
  console.log(`${type}: ${stats.preference} (${stats.count}次)`);
});

// 按复杂度范围分析
console.log('低复杂度:', pattern.byComplexityRange.low);
console.log('中等复杂度:', pattern.byComplexityRange.medium);
console.log('高复杂度:', pattern.byComplexityRange.high);
```

### 3. 阈值调整建议

基于偏好分析,智能建议调整复杂度阈值:

```typescript
const adjustment = tracker.suggestAdjustment();

if (adjustment.shouldApply) {
  console.log(`当前阈值: ${adjustment.currentThreshold}`);
  console.log(`建议阈值: ${adjustment.suggestedThreshold}`);
  console.log(`理由: ${adjustment.reason}`);
  console.log(`置信度: ${adjustment.confidence}%`);
}
```

**调整策略**:
- **提高阈值**: 用户在高复杂度任务中倾向选择local
- **降低阈值**: 用户在中等复杂度任务中倾向选择codex
- **保持不变**: 接受率高(>80%)或数据不足

### 4. 决策历史查询

查看最近的决策记录:

```typescript
const history = tracker.getDecisionHistory(10);  // 最近10条

history.forEach(record => {
  console.log(record.task.description);
  console.log(`  推荐: ${record.recommendedMode}`);
  console.log(`  选择: ${record.chosenMode}`);
  console.log(`  接受: ${record.acceptedRecommendation}`);
});
```

## 数据存储

偏好数据持久化到 `.claude/codex/preferences.json`:

```json
{
  "decisions": [
    {
      "id": "decision-1234567890-abc123",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "taskType": "design",
      "taskDescription": "实现分布式缓存系统",
      "recommendedMode": "codex",
      "recommendedScore": 8.5,
      "chosenMode": "codex",
      "acceptedRecommendation": true,
      "context": {
        "reasons": ["代码规模较大", "技术难度很高"],
        "confidence": 85
      }
    }
  ],
  "lastUpdated": "2025-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## 集成到TaskRouter

PreferenceTracker已集成到TaskRouter中,自动记录所有路由决策:

```typescript
// TaskRouter内部流程
async route(task: TaskDescriptor): Promise<ExecutionMode> {
  // 1. 生成推荐
  const recommendation = await this.recommend(task);

  // 2. 用户确认
  const chosenMode = await this._confirmCodexMode(recommendation);

  // 3. 自动记录偏好(集成的核心)
  if (this.preferenceTracker) {
    await this.preferenceTracker.recordDecision(
      task,
      recommendation.mode,
      recommendation.score,
      chosenMode,
      {
        reasons: recommendation.reasons,
        confidence: recommendation.confidence
      }
    );
  }

  return chosenMode;
}
```

## 使用场景

### 场景1: 新用户初始阶段

- 前10个决策: 使用默认阈值(7分)
- 不提供阈值调整建议(数据不足)
- 仅记录决策,不影响推荐

### 场景2: 倾向本地执行的用户

用户在高复杂度任务中70%选择local:

```
分析结果:
  ✓ 检测到偏好: 高复杂度任务倾向local
  ✓ 建议阈值: 7 -> 8
  ✓ 理由: "在高复杂度任务中,您有70%的情况选择本地模式"
  ✓ 影响: 减少30%的Codex推荐
```

### 场景3: 倾向Codex的用户

用户在中等复杂度任务中75%选择codex:

```
分析结果:
  ✓ 检测到偏好: 中等复杂度任务倾向codex
  ✓ 建议阈值: 7 -> 6
  ✓ 理由: "在中等复杂度任务中,您有75%的情况选择Codex模式"
  ✓ 影响: 增加25%的Codex推荐
```

### 场景4: 不同任务类型的偏好

```typescript
const pattern = tracker.getPreferencePattern();

// 用户对不同任务类型有不同偏好
pattern.byTaskType = {
  design: {
    count: 20,
    codexCount: 18,
    localCount: 2,
    preference: 'codex'   // 设计任务倾向codex
  },
  tasks: {
    count: 15,
    codexCount: 2,
    localCount: 13,
    preference: 'local'   // 任务列表倾向local
  }
};
```

## 性能考虑

- **内存管理**: 仅在内存中保持完整决策列表,查询时才加载
- **文件IO优化**: 每次决策后立即持久化(异步写入)
- **数据清理**: 提供 `clearPreferences()` 方法清理历史数据

## 隐私和安全

- **本地存储**: 所有数据存储在工作空间本地,不上传云端
- **敏感信息**: 仅记录任务类型和描述,不记录完整代码内容
- **用户控制**: 用户可随时清除偏好数据

## API参考

### PreferenceTracker类

```typescript
class PreferenceTracker {
  constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel);

  // 初始化
  initialize(): Promise<void>;

  // 记录决策
  recordDecision(
    task: TaskDescriptor,
    recommendedMode: ExecutionMode,
    recommendedScore: number,
    chosenMode: ExecutionMode,
    context?: { reasons?: string[]; confidence?: number }
  ): Promise<void>;

  // 分析偏好
  getPreferencePattern(): PreferencePattern;

  // 建议阈值调整
  suggestAdjustment(): ComplexityThresholdAdjustment;

  // 查询历史
  getDecisionHistory(limit?: number): UserDecisionRecord[];

  // 清除数据
  clearPreferences(): Promise<void>;
}
```

## 未来增强

可能的未来功能:
- [ ] 按时间段分析偏好变化趋势
- [ ] 支持多工作空间偏好隔离
- [ ] 导出偏好数据为可视化报告
- [ ] 基于机器学习的阈值动态调整
- [ ] 支持用户自定义偏好规则

## 相关文件

- 实现: `src/features/codex/preferenceTracker.ts`
- 类型定义: `src/features/codex/types.ts`
- 单元测试: `src/features/codex/__tests__/preferenceTracker.test.ts`
- 使用示例: `src/features/codex/__tests__/preferenceTracker.example.ts`
- 集成: `src/features/codex/taskRouter.ts`

## 需求追溯

实现需求: **需求1.6 - 用户手动选择执行模式时,系统应记录用户偏好,用于优化后续推荐算法**

满足验收标准:
- ✅ 记录用户手动选择
- ✅ 记录推荐vs实际选择
- ✅ 分析偏好模式
- ✅ 持久化到文件
- ✅ 集成到TaskRouter
