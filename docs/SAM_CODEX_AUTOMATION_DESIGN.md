# Sam + Codex 自动化协作系统设计

## 概述

本文档描述 Sam（Spec Automation Manager）和 Codex 的完整自动化协作流程设计，实现从任务评估、委派、执行到验收的全自动化工作流。

## 目标

实现以下完整流程：

```
Sam 创建 tasks.md
  ↓
Sam 自动评估每个任务（复杂度、类型）
  ↓
Sam 标记适合 Codex 的任务
  ↓
Sam 批量委派给 Codex
  ↓
Codex 生成代码实现
  ↓
Sam 验收代码（运行测试、代码审查）
  ↓
Sam 整合到实际项目文件
  ↓
更新 PROGRESS.md 和 tasks.md
```

## 核心模块设计

### 1. TaskEvaluator（任务评估器）

**职责**：
- 解析 tasks.md 文件，提取所有任务
- 评估每个任务的复杂度、类型、适合的执行方式
- 推荐哪些任务应该使用 Codex

**接口设计**：

```typescript
interface TaskInfo {
  /** 任务编号（如 "1.1", "2.3"） */
  number: string;

  /** 任务标题 */
  title: string;

  /** 任务详细描述（缩进的子项） */
  details: string[];

  /** 任务状态（是否已完成） */
  completed: boolean;

  /** 在文件中的行号范围 */
  lineRange: { start: number; end: number };
}

interface TaskEvaluation {
  /** 任务信息 */
  task: TaskInfo;

  /** 复杂度评分 (0-100) */
  complexityScore: number;

  /** 任务类型 */
  type: 'algorithm' | 'component' | 'api' | 'data-processing' | 'utility' | 'other';

  /** 是否推荐使用 Codex */
  recommendCodex: boolean;

  /** 推荐原因 */
  reason: string;

  /** 预估工作量（小时） */
  estimatedHours?: number;
}

class TaskEvaluator {
  /**
   * 解析 tasks.md 文件
   * @param tasksFilePath tasks.md 文件路径
   * @returns 任务列表
   */
  async parseTasks(tasksFilePath: string): Promise<TaskInfo[]>;

  /**
   * 评估单个任务
   * @param task 任务信息
   * @param context 上下文（requirements, design）
   * @returns 任务评估结果
   */
  async evaluateTask(
    task: TaskInfo,
    context: { requirements?: string; design?: string }
  ): Promise<TaskEvaluation>;

  /**
   * 批量评估所有任务
   * @param tasks 任务列表
   * @param context 上下文
   * @returns 评估结果列表
   */
  async evaluateAllTasks(
    tasks: TaskInfo[],
    context: { requirements?: string; design?: string }
  ): Promise<TaskEvaluation[]>;
}
```

**评估规则**：

1. **推荐使用 Codex 的场景**：
   - 算法实现（排序、搜索、图算法等）
   - 纯函数工具类（数据转换、格式化等）
   - 数据处理逻辑（解析、验证等）
   - 独立的组件实现（明确的输入输出）

2. **不推荐使用 Codex 的场景**：
   - 需要深度理解现有代码库的重构任务
   - UI/UX 相关的主观决策
   - 需要人工判断的架构设计
   - 涉及敏感数据或安全策略的任务

3. **复杂度评估因素**：
   - 任务描述的长度和详细程度
   - 涉及的技术栈数量
   - 依赖关系复杂度
   - 是否有明确的输入输出定义

### 2. BatchTaskDelegator（批量任务委派器）

**职责**：
- 批量将任务委派给 Codex
- 管理并发执行
- 处理失败重试
- 收集所有执行结果

**接口设计**：

```typescript
interface DelegationOptions {
  /** 最大并发数 */
  maxConcurrency?: number;

  /** 失败重试次数 */
  retryCount?: number;

  /** 执行超时（毫秒） */
  timeout?: number;

  /** 是否显示进度条 */
  showProgress?: boolean;
}

interface DelegationResult {
  /** 任务评估信息 */
  evaluation: TaskEvaluation;

  /** Codex 执行结果 */
  executionResult: ExecutionResult;

  /** 执行时长（毫秒） */
  duration: number;

  /** 是否成功 */
  success: boolean;
}

class BatchTaskDelegator {
  constructor(
    private codexOrchestrator: CodexOrchestrator,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * 批量委派任务给 Codex
   * @param evaluations 任务评估结果
   * @param specName spec 名称
   * @param context 上下文（requirements, design）
   * @param options 委派选项
   * @returns 委派结果列表
   */
  async delegateTasks(
    evaluations: TaskEvaluation[],
    specName: string,
    context: { requirements: string; design: string },
    options?: DelegationOptions
  ): Promise<DelegationResult[]>;
}
```

### 3. CodeAcceptanceTester（代码验收测试器）

**职责**：
- 验证 Codex 生成的代码质量
- 运行单元测试（如果有）
- 检查代码风格和规范
- 提供验收报告

**接口设计**：

```typescript
interface AcceptanceCriteria {
  /** 是否需要通过编译 */
  requiresCompilation?: boolean;

  /** 是否需要通过测试 */
  requiresTests?: boolean;

  /** 是否需要通过代码检查 */
  requiresLinting?: boolean;

  /** 自定义验证函数 */
  customValidation?: (code: string) => Promise<boolean>;
}

interface AcceptanceResult {
  /** 是否通过验收 */
  passed: boolean;

  /** 验收详情 */
  details: {
    compilation?: { passed: boolean; errors?: string[] };
    tests?: { passed: boolean; results?: string };
    linting?: { passed: boolean; warnings?: string[] };
    custom?: { passed: boolean; message?: string };
  };

  /** 建议的改进措施 */
  suggestions?: string[];
}

class CodeAcceptanceTester {
  /**
   * 验收 Codex 生成的代码
   * @param code 生成的代码
   * @param criteria 验收标准
   * @returns 验收结果
   */
  async acceptCode(
    code: string,
    criteria: AcceptanceCriteria
  ): Promise<AcceptanceResult>;

  /**
   * 要求 Codex 修复问题
   * @param originalCode 原始代码
   * @param acceptanceResult 验收结果
   * @param task 任务描述
   * @returns 修复后的代码
   */
  async requestFix(
    originalCode: string,
    acceptanceResult: AcceptanceResult,
    task: TaskDescriptor
  ): Promise<string>;
}
```

### 4. CodeIntegrator（代码整合器）

**职责**：
- 将 Codex 生成的代码整合到实际项目文件
- 处理文件创建、更新
- 生成 diff 视图供用户审查
- 支持自动和手动整合模式

**接口设计**：

```typescript
interface IntegrationStrategy {
  /** 整合模式：自动、手动审查、交互式 */
  mode: 'auto' | 'review' | 'interactive';

  /** 目标文件路径 */
  targetPath?: string;

  /** 是否创建备份 */
  createBackup?: boolean;

  /** 是否显示 diff */
  showDiff?: boolean;
}

interface IntegrationResult {
  /** 是否成功整合 */
  success: boolean;

  /** 整合的文件路径 */
  filePath: string;

  /** 整合方式 */
  method: 'created' | 'updated' | 'merged';

  /** 备份文件路径（如果有） */
  backupPath?: string;

  /** 用户是否确认（交互模式） */
  userConfirmed?: boolean;
}

class CodeIntegrator {
  /**
   * 整合代码到项目
   * @param code 生成的代码
   * @param task 任务信息
   * @param strategy 整合策略
   * @returns 整合结果
   */
  async integrateCode(
    code: string,
    task: TaskInfo,
    strategy: IntegrationStrategy
  ): Promise<IntegrationResult>;

  /**
   * 显示 diff 视图
   * @param originalContent 原始内容
   * @param newContent 新内容
   * @param filePath 文件路径
   */
  async showDiff(
    originalContent: string,
    newContent: string,
    filePath: string
  ): Promise<void>;
}
```

### 5. SamCodexCoordinator（Sam-Codex 协调器）

**职责**：
- 协调整个自动化流程
- 集成所有子模块
- 更新 PROGRESS.md 和 tasks.md
- 提供完整的执行报告

**接口设计**：

```typescript
interface AutomationOptions {
  /** spec 名称 */
  specName: string;

  /** 是否自动验收 */
  autoAcceptance?: boolean;

  /** 是否自动整合 */
  autoIntegration?: boolean;

  /** 验收标准 */
  acceptanceCriteria?: AcceptanceCriteria;

  /** 整合策略 */
  integrationStrategy?: IntegrationStrategy;

  /** 批量委派选项 */
  delegationOptions?: DelegationOptions;
}

interface AutomationReport {
  /** 总任务数 */
  totalTasks: number;

  /** 委派给 Codex 的任务数 */
  delegatedToCodex: number;

  /** 成功完成的任务数 */
  successCount: number;

  /** 失败的任务数 */
  failedCount: number;

  /** 需要人工处理的任务数 */
  manualCount: number;

  /** 详细结果 */
  results: {
    task: TaskInfo;
    evaluation: TaskEvaluation;
    delegationResult?: DelegationResult;
    acceptanceResult?: AcceptanceResult;
    integrationResult?: IntegrationResult;
  }[];

  /** 总耗时（毫秒） */
  totalDuration: number;
}

class SamCodexCoordinator {
  constructor(
    private taskEvaluator: TaskEvaluator,
    private batchDelegator: BatchTaskDelegator,
    private acceptanceTester: CodeAcceptanceTester,
    private codeIntegrator: CodeIntegrator,
    private progressTracker: ProgressTracker,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * 执行完整的自动化流程
   * @param options 自动化选项
   * @returns 自动化报告
   */
  async runAutomation(options: AutomationOptions): Promise<AutomationReport>;

  /**
   * 更新 PROGRESS.md
   * @param specName spec 名称
   * @param report 自动化报告
   */
  async updateProgress(
    specName: string,
    report: AutomationReport
  ): Promise<void>;

  /**
   * 更新 tasks.md（标记完成状态）
   * @param tasksFilePath tasks.md 文件路径
   * @param completedTasks 已完成的任务编号列表
   */
  async updateTasksStatus(
    tasksFilePath: string,
    completedTasks: string[]
  ): Promise<void>;
}
```

## 完整执行流程

### Phase 1: 任务评估

```typescript
// 1. 解析 tasks.md
const tasks = await taskEvaluator.parseTasks(tasksFilePath);

// 2. 加载上下文
const requirements = await fs.readFile(requirementsPath, 'utf-8');
const design = await fs.readFile(designPath, 'utf-8');

// 3. 评估所有任务
const evaluations = await taskEvaluator.evaluateAllTasks(tasks, {
  requirements,
  design
});

// 4. 筛选推荐使用 Codex 的任务
const codexTasks = evaluations.filter(e => e.recommendCodex);
```

### Phase 2: 批量委派

```typescript
// 1. 批量委派给 Codex
const delegationResults = await batchDelegator.delegateTasks(
  codexTasks,
  specName,
  { requirements, design },
  { maxConcurrency: 3, showProgress: true }
);
```

### Phase 3: 代码验收

```typescript
// 对每个成功生成的代码进行验收
for (const result of delegationResults) {
  if (result.success && result.executionResult.output) {
    // 验收代码
    const acceptanceResult = await acceptanceTester.acceptCode(
      result.executionResult.output,
      acceptanceCriteria
    );

    // 如果未通过验收，尝试修复
    if (!acceptanceResult.passed) {
      const fixedCode = await acceptanceTester.requestFix(
        result.executionResult.output,
        acceptanceResult,
        result.evaluation.task
      );

      // 重新验收
      const retryAcceptance = await acceptanceTester.acceptCode(
        fixedCode,
        acceptanceCriteria
      );
    }
  }
}
```

### Phase 4: 代码整合

```typescript
// 整合通过验收的代码
for (const result of successfulResults) {
  const integrationResult = await codeIntegrator.integrateCode(
    result.code,
    result.task,
    integrationStrategy
  );

  if (integrationResult.success) {
    // 记录成功整合的任务
    completedTasks.push(result.task.number);
  }
}
```

### Phase 5: 更新状态

```typescript
// 更新 tasks.md
await coordinator.updateTasksStatus(tasksFilePath, completedTasks);

// 更新 PROGRESS.md
await coordinator.updateProgress(specName, automationReport);
```

## VSCode 命令集成

### 新增命令

在 `package.json` 中添加：

```json
{
  "command": "kfc.sam.autoEvaluateTasks",
  "title": "Sam: Auto-Evaluate Tasks"
},
{
  "command": "kfc.sam.autoImplementTasks",
  "title": "Sam: Auto-Implement Tasks with Codex"
},
{
  "command": "kfc.sam.reviewCodexResults",
  "title": "Sam: Review Codex Implementation Results"
}
```

### 命令处理

在 `extension.ts` 中注册：

```typescript
// 自动评估任务
context.subscriptions.push(
  vscode.commands.registerCommand('kfc.sam.autoEvaluateTasks', async (uri) => {
    const coordinator = getSamCodexCoordinator();
    const specName = extractSpecNameFromUri(uri);

    // 只执行评估阶段
    const evaluations = await coordinator.evaluateTasks(specName);

    // 显示评估报告
    await showEvaluationReport(evaluations);
  })
);

// 自动实现任务
context.subscriptions.push(
  vscode.commands.registerCommand('kfc.sam.autoImplementTasks', async (uri) => {
    const coordinator = getSamCodexCoordinator();
    const specName = extractSpecNameFromUri(uri);

    // 执行完整自动化流程
    const report = await coordinator.runAutomation({
      specName,
      autoAcceptance: true,
      autoIntegration: false, // 需要用户审查
      integrationStrategy: { mode: 'review' }
    });

    // 显示自动化报告
    await showAutomationReport(report);
  })
);
```

## UI/UX 设计

### 1. 任务评估报告 WebView

显示：
- 任务列表
- 复杂度评分
- 推荐的执行方式（Codex / 手动）
- 推荐理由

操作：
- 用户可以手动调整推荐
- 批量选择要委派的任务
- 开始自动实现

### 2. 执行进度 WebView

实时显示：
- 当前正在执行的任务
- 已完成 / 总数
- 成功 / 失败统计
- 预估剩余时间

### 3. 代码审查 Diff View

对于 `integrationStrategy: { mode: 'review' }`：
- 并排显示生成的代码和目标文件（如果存在）
- 高亮差异
- 提供接受/拒绝/修改按钮

### 4. 自动化报告 WebView

完成后显示：
- 总体统计信息
- 成功/失败任务列表
- 详细的执行日志
- 生成的文件列表
- 建议的后续步骤

## 配置选项

在 `package.json` 中添加配置：

```json
"kfc.sam.automation.maxConcurrency": {
  "type": "number",
  "default": 3,
  "description": "Maximum number of tasks to execute concurrently"
},
"kfc.sam.automation.autoAcceptance": {
  "type": "boolean",
  "default": false,
  "description": "Automatically accept code that passes all tests"
},
"kfc.sam.automation.autoIntegration": {
  "type": "boolean",
  "default": false,
  "description": "Automatically integrate accepted code into project"
},
"kfc.sam.automation.requireTests": {
  "type": "boolean",
  "default": true,
  "description": "Require tests to pass for code acceptance"
}
```

## 安全和错误处理

### 安全措施

1. **代码审查强制**：即使 `autoIntegration: true`，仍生成 diff 并记录到日志
2. **备份机制**：整合前自动备份目标文件
3. **回滚支持**：保存整合前的状态，支持一键回滚
4. **敏感代码检测**：检测生成的代码是否包含硬编码密钥、密码等

### 错误处理

1. **任务失败重试**：自动重试失败的任务（可配置次数）
2. **部分失败处理**：部分任务失败不影响其他任务
3. **优雅降级**：Codex 不可用时降级到提示用户手动实现
4. **详细日志**：所有操作记录到日志，便于调试

## 实现优先级

### P0 - 核心功能（第一阶段）

1. ✅ TaskEvaluator - 任务解析和评估
2. ✅ BatchTaskDelegator - 批量委派
3. ✅ SamCodexCoordinator - 基础协调器

### P1 - 验收和整合（第二阶段）

4. ✅ CodeAcceptanceTester - 代码验收
5. ✅ CodeIntegrator - 代码整合
6. ✅ 更新 PROGRESS.md 和 tasks.md

### P2 - UI 和体验优化（第三阶段）

7. ⬜ 评估报告 WebView
8. ⬜ 执行进度 WebView
9. ⬜ Diff 视图
10. ⬜ 自动化报告 WebView

### P3 - 高级特性（第四阶段）

11. ⬜ 智能修复（Codex 根据测试失败自动修复）
12. ⬜ 任务依赖分析（识别任务间依赖关系）
13. ⬜ 增量执行（只执行新增或修改的任务）
14. ⬜ 成本估算（预估 Codex API 调用成本）

## 文件结构

```
src/features/sam/
├── automation/
│   ├── taskEvaluator.ts          # 任务评估器
│   ├── batchTaskDelegator.ts     # 批量任务委派器
│   ├── codeAcceptanceTester.ts   # 代码验收测试器
│   ├── codeIntegrator.ts         # 代码整合器
│   ├── samCodexCoordinator.ts    # Sam-Codex 协调器
│   └── types.ts                  # 类型定义
├── samManager.ts                 # Sam Manager（已有）
└── progressTracker.ts            # Progress Tracker（已有）

docs/
└── SAM_CODEX_AUTOMATION_DESIGN.md  # 本设计文档
```

## 测试策略

### 单元测试

- 每个模块的独立测试
- Mock Codex 执行结果
- 测试边界情况和错误处理

### 集成测试

- 端到端自动化流程测试
- 使用真实的 tasks.md 文件
- 验证 PROGRESS.md 和 tasks.md 更新

### E2E 测试

- 用户交互流程测试
- WebView 显示测试
- 多并发任务执行测试

## 下一步行动

1. ✅ 创建设计文档（本文档）
2. ⬜ 实现 TaskEvaluator 模块
3. ⬜ 实现 BatchTaskDelegator 模块
4. ⬜ 实现 SamCodexCoordinator 基础版
5. ⬜ 编写单元测试
6. ⬜ 集成到 VSCode 命令
7. ⬜ 端到端测试
8. ⬜ 编写用户文档

---

**设计版本**: v1.0
**创建时间**: 2025-01-19
**作者**: Claude Code AI
