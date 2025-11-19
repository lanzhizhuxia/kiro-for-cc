# Codex工作流编排系统 - 架构文档

## 目录

1. [系统架构概览](#系统架构概览)
2. [核心组件详解](#核心组件详解)
3. [数据流图](#数据流图)
4. [关键流程说明](#关键流程说明)
5. [扩展指南](#扩展指南)
6. [测试策略](#测试策略)
7. [调试技巧](#调试技巧)

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         VSCode Extension                         │
│                      (用户界面层 / UI Layer)                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CodexOrchestrator (主编排器)                   │
│         统一入口，协调所有组件，管理任务执行生命周期              │
└───┬───────────┬───────────┬───────────┬─────────────┬──────────┘
    │           │           │           │             │
    ▼           ▼           ▼           ▼             ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐
│ Task   │ │Session │ │Deep      │ │Security│ │Progress      │
│ Router │ │State   │ │Thinking  │ │Guard   │ │Indicator     │
│        │ │Manager │ │Engine    │ │        │ │              │
└────────┘ └────────┘ └──────────┘ └────────┘ └──────────────┘
    │           │           │           │             │
    ▼           ▼           ▼           ▼             ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐
│Complex-│ │sessions│ │MCP       │ │.claude-│ │VSCode        │
│ity     │ │.json   │ │Client    │ │ignore  │ │Progress UI   │
│Analyzer│ │        │ │          │ │        │ │              │
└────────┘ └────────┘ └──────────┘ └────────┘ └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │MCP Lifecycle │
                    │Manager       │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │Codex MCP     │
                    │Server        │
                    └──────────────┘
```

### 1.2 核心组件列表

| 组件名称 | 职责 | 关键文件 |
|---------|------|---------|
| **CodexOrchestrator** | 主编排器，统一入口和协调者 | `codexOrchestrator.ts` |
| **TaskRouter** | 任务路由决策，智能推荐执行模式 | `taskRouter.ts` |
| **ComplexityAnalyzer** | 任务复杂度分析和评分 | `complexityAnalyzer.ts` |
| **DeepThinkingEngine** | 深度推理分析引擎 | `deepThinkingEngine.ts` |
| **MCPLifecycleManager** | MCP服务器生命周期管理 | `mcpLifecycleManager.ts` |
| **SecurityGuard** | 安全守卫，控制文件访问和命令执行 | `securityGuard.ts` |
| **SessionStateManager** | 会话状态管理和持久化 | `sessionStateManager.ts` |
| **ExecutionLogger** | 执行日志记录 | `executionLogger.ts` |
| **ProgressIndicator** | 进度指示器 | `progressIndicator.ts` |
| **PreferenceTracker** | 用户偏好追踪和学习 | `preferenceTracker.ts` |

### 1.3 技术栈

- **语言**: TypeScript 5.x
- **运行时**: Node.js 18+
- **框架**: VSCode Extension API
- **通信协议**: MCP (Model Context Protocol)
- **AI模型**: Claude Codex (Sequential Thinking API)
- **数据持久化**: JSON 文件存储

### 1.4 设计原则

1. **单一职责原则** - 每个组件专注于单一功能领域
2. **按需加载** - 组件实例按需创建，减少启动开销
3. **状态持久化** - 会话状态和用户偏好持久化到文件系统
4. **安全优先** - 多层安全防护机制，保护敏感数据
5. **可扩展性** - 模块化设计，支持添加新的分析规则和执行器
6. **用户体验** - 提供清晰的进度反馈和取消操作支持

---

## 2. 核心组件详解

### 2.1 CodexOrchestrator (主编排器)

#### 职责

- 作为整个系统的统一入口点
- 协调所有子组件的工作流程
- 管理任务执行的完整生命周期
- 提供深度推理和分析能力
- 处理资源清理和异常恢复

#### 关键方法

```typescript
// 执行任务（主入口）
async executeTask(
  task: TaskDescriptor,
  options?: ExecutionOptions
): Promise<ExecutionResult>

// 获取推荐的执行模式
async getRecommendedMode(
  task: TaskDescriptor
): Promise<ModeRecommendation>

// 启用深度推理
async enableDeepThinking(
  context: AnalysisContext
): Promise<ThinkingResult>

// 展示分析结果
async showAnalysisResult(
  thinkingResult: ThinkingResult,
  metadata?: AnalysisMetadata
): Promise<void>

// 恢复会话
async restoreSession(
  sessionId: string
): Promise<Session | null>

// 释放资源
async dispose(): Promise<void>
```

#### 依赖关系

```
CodexOrchestrator
├── SessionStateManager (会话管理)
├── TaskRouter (任务路由)
├── CodexExecutor (Codex执行器)
├── LocalAgentExecutor (本地执行器)
├── DeepThinkingEngine (深度推理)
├── MCPClient (MCP客户端)
├── CodexAnalysisWebview (分析结果展示)
└── FeedbackCollector (反馈收集)
```

#### 执行流程

```
1. executeTask() 调用
   │
   ├─> 2. 创建 ProgressIndicator
   │
   ├─> 3. 创建 Session (SessionStateManager)
   │
   ├─> 4. 路由决策 (TaskRouter)
   │       ├─> 强制模式优先 (options.forceMode)
   │       ├─> 全局默认模式 (codex.defaultMode)
   │       └─> 智能路由 (ComplexityAnalyzer)
   │
   ├─> 5. 代码库扫描 (可选)
   │
   ├─> 6. 深度推理 (可选, DeepThinkingEngine)
   │
   ├─> 7. 执行任务
   │       ├─> CodexExecutor (Codex模式)
   │       └─> LocalAgentExecutor (本地模式)
   │
   ├─> 8. 保存会话状态 (SessionStateManager)
   │
   └─> 9. 返回执行结果
```

### 2.2 TaskRouter (任务路由器)

#### 职责

- 分析任务特征，决定使用Codex或本地agent
- 基于复杂度评分生成智能推荐
- 提供用户确认机制（当推荐Codex时）
- 记录用户决策用于偏好学习

#### 路由决策算法

```typescript
/**
 * 决策流程：
 * 1. 获取用户配置的默认模式
 * 2. 如果是固定模式(local/codex)，直接返回
 * 3. 如果是auto模式，调用ComplexityAnalyzer
 * 4. 基于评分决策 (阈值: 7分)
 *    - score >= 7 → 推荐Codex → 用户确认
 *    - score < 7 → 推荐local → 直接执行
 * 5. 记录用户决策到PreferenceTracker
 */

async route(task: TaskDescriptor): Promise<ExecutionMode> {
  // 1. 获取默认模式
  const defaultMode = await this._getDefaultMode();

  // 2. 固定模式直接返回
  if (defaultMode !== 'auto') return defaultMode;

  // 3. 智能路由
  const recommendation = await this.recommend(task);

  // 4. 用户确认（如果推荐Codex）
  let chosenMode: ExecutionMode;
  if (recommendation.mode === 'codex') {
    const confirmed = await this._confirmCodexMode(recommendation);
    chosenMode = confirmed ? 'codex' : 'local';
  } else {
    chosenMode = 'local';
  }

  // 5. 记录决策
  await this.preferenceTracker?.recordDecision(
    task,
    recommendation.mode,
    recommendation.score,
    chosenMode
  );

  return chosenMode;
}
```

#### 复杂度评分模型

```
总分 = 代码规模 × 30% + 技术难度 × 40% + 业务影响 × 30%

阈值: 7分
- 总分 >= 7 → 推荐Codex (高复杂度)
- 总分 < 7 → 推荐local (低/中复杂度)
```

#### 推荐理由生成

根据评分的各个维度生成人类可读的推荐理由：

```typescript
private _generateReasons(score: ComplexityScore): string[] {
  const reasons: string[] = [];

  // 代码规模
  if (score.codeScale >= 7) {
    reasons.push(`• 代码规模较大 (${score.codeScale}/10) - 涉及${score.details.fileCount}个文件`);
  }

  // 技术难度
  if (score.technicalDifficulty >= 8) {
    reasons.push(`• 技术难度很高 (${score.technicalDifficulty}/10) - 包含: AST修改, 异步处理`);
  }

  // 业务影响
  if (score.businessImpact >= 7) {
    reasons.push(`• 业务影响范围广 (${score.businessImpact}/10) - 跨多个模块`);
  }

  return reasons;
}
```

### 2.3 ComplexityAnalyzer (复杂度分析器)

#### 分析维度

##### 1. 代码规模 (权重: 30%)

评估因素:
- 涉及的文件数量
- 文件总代码行数
- 项目整体规模

评分规则:
```
0个文件    → 1.0分
1个文件    → 2.0分
2-3个文件  → 4.0分
4-5个文件  → 6.0分
6-10个文件 → 8.0分
>10个文件  → 10.0分

额外加分:
- 每1000行代码 +0.5分 (最多+2分)
- 跨文件重构 +1分
```

##### 2. 技术难度 (权重: 40%)

评估因素:
- 任务类型的固有难度
- 技术栈复杂度
- 架构变更程度
- 新技术引入

评分规则:
```
基础评分（按任务类型）:
- requirements: 2.0分
- design: 6.0分
- tasks: 3.0分
- implementation: 7.0分
- review: 5.0分
- debug: 8.0分

额外加分:
- AST修改/重构 +2分
- 异步/并发复杂度 +2分
- 新技术引入 +2分
- 数据库相关 +1分
- 性能优化 +1分
- 安全相关 +1分
```

##### 3. 业务影响 (权重: 30%)

评估因素:
- 是否影响核心功能
- 是否影响多个子系统
- 用户体验影响程度

评分规则:
```
基础评分: 5.0分

额外加分:
- 核心功能影响 +3分
- 多个子系统交互 +2分
- 核心API影响 +2分
- 数据库迁移 +2分
- 用户体验影响 +1.5分
- 数据完整性 +2分

减分:
- 简单文档任务 -3分
```

#### 评分算法

```typescript
async analyze(task: TaskDescriptor): Promise<ComplexityScore> {
  // 1. 分析代码规模
  const codeScale = await this._analyzeCodeScale(task);

  // 2. 分析技术难度
  const technicalDifficulty = await this._analyzeTechnicalDifficulty(task);

  // 3. 分析业务影响
  const businessImpact = await this._analyzeBusinessImpact(task);

  // 4. 计算加权总分
  const total =
    codeScale * 0.30 +
    technicalDifficulty * 0.40 +
    businessImpact * 0.30;

  // 5. 生成详细指标
  const details = await this._generateDetails(task, ...);

  return {
    total: Math.round(total * 10) / 10,
    codeScale,
    technicalDifficulty,
    businessImpact,
    details
  };
}
```

#### AST分析能力

支持分析TypeScript/JavaScript代码的抽象语法树：

- **圈复杂度 (Cyclomatic Complexity)**: 代码路径数量
- **认知复杂度 (Cognitive Complexity)**: 代码理解难度
- **函数调用链深度**: 调用栈深度
- **依赖关系分析**: 模块依赖图

#### 扩展新规则

添加新的复杂度检测规则：

```typescript
// 1. 在ComplexityAnalyzer中添加检测方法
private _detectNewPattern(fullText: string): boolean {
  return this._containsKeywords(fullText, [
    'new-keyword', 'pattern', '新模式'
  ]);
}

// 2. 在评分方法中调用
private async _analyzeTechnicalDifficulty(task: TaskDescriptor): Promise<number> {
  // ...existing code...

  // 检测新模式 (+X分)
  if (this._detectNewPattern(fullText)) {
    score = Math.min(10.0, score + X);
  }

  return score;
}

// 3. 更新details字段
private async _generateDetails(...): Promise<ComplexityScore['details']> {
  return {
    // ...existing fields...
    involvesNewPattern: this._detectNewPattern(fullText)
  };
}

// 4. 在types.ts中添加类型定义
export interface ComplexityScore {
  details: {
    // ...existing fields...
    involvesNewPattern?: boolean;
  };
}

// 5. 在TaskRouter中添加推荐理由
private _generateReasons(score: ComplexityScore): string[] {
  // ...existing code...

  if (score.details.involvesNewPattern) {
    reasons.push('• 涉及新模式');
  }

  return reasons;
}
```

### 2.4 DeepThinkingEngine (深度推理引擎)

#### 职责

- 与Codex MCP服务器通信，触发sequential thinking模式
- 执行深度分析：问题分解、风险识别、方案对比、决策建议
- 解析Codex响应，结构化推理结果
- 处理超时和取消操作

#### 核心能力

1. **问题分解 (Problem Decomposition)**
   - 将复杂任务拆解为子问题树
   - 评估每个子问题的复杂度
   - 识别问题依赖关系

2. **风险识别 (Risk Identification)**
   - 技术风险：实现难度、技术栈不熟悉
   - 安全风险：敏感数据暴露、权限问题
   - 性能风险：性能瓶颈、资源消耗
   - 可维护性风险：代码复杂度、文档缺失

3. **方案对比 (Solution Comparison)**
   - 列举多个可行方案
   - 分析每个方案的优缺点
   - 评估实现复杂度和风险
   - 给出综合评分

4. **决策建议 (Recommended Decision)**
   - 推荐最佳方案
   - 提供详细理由
   - 估算工作量
   - 规划后续步骤

#### 执行流程

```typescript
async analyze(context: AnalysisContext): Promise<ThinkingResult> {
  // 1. 初始化阶段
  this._reportProgress('initializing', '正在初始化深度推理引擎...', 0);

  // 2. 构建深度推理prompt
  const prompt = this._buildDeepThinkingPrompt(context);

  // 3. 分析阶段
  this._reportProgress('analyzing', '正在执行深度分析...', 30);
  const thinkingChain = await this._callWithTimeout(
    () => this._callSequentialThinkingAPI(prompt),
    this.config.timeout
  );

  // 4. 解析阶段
  this._reportProgress('parsing', '正在解析推理结果...', 70);
  const result = this._parseThinkingChain(thinkingChain, context);

  // 5. 完成阶段
  this._reportProgress('completed', '深度分析完成', 100);

  return result;
}
```

#### 推理链解析

```typescript
private _parseThinkingChain(
  thinkingChain: ThinkingChain,
  context: AnalysisContext
): ThinkingResult {
  const response = thinkingChain.rawResponse;

  // 1. 提取问题分解
  const problemDecomposition = this._extractProblemDecomposition(response, context);

  // 2. 提取风险识别
  const riskIdentification = this._extractRisks(response, context);

  // 3. 提取方案对比
  const solutionComparison = this._extractSolutions(response, context);

  // 4. 提取决策建议
  const recommendedDecision = this._extractDecision(response, solutionComparison);

  return {
    problemDecomposition,
    riskIdentification,
    solutionComparison,
    recommendedDecision,
    thinkingChain: thinkingChain.steps
  };
}
```

#### 超时和取消机制

```typescript
// 设置超时
const timeout = this.config.timeout || 120000; // 2分钟

// 带超时的调用
const thinkingChain = await Promise.race([
  this._callSequentialThinkingAPI(prompt),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeout)
  )
]);

// 取消操作
cancel(): void {
  this.cancelled = true;
  if (this.config.onCancel) {
    this.config.onCancel();
  }
}

// 检查点检查取消状态
if (this.cancelled) {
  await this._saveIntermediateResult(context);
  throw new Error('Analysis cancelled by user');
}
```

#### WebView展示

使用VSCode WebView展示分析结果：

```typescript
async showAnalysisResult(
  thinkingResult: ThinkingResult,
  metadata?: AnalysisMetadata
): Promise<void> {
  const webview = this.getAnalysisWebview();
  await webview.show(thinkingResult, metadata);
}
```

### 2.5 MCPLifecycleManager (MCP生命周期管理)

#### 职责

- 启动和停止MCP服务器进程
- 状态机管理：STOPPED → STARTING → RUNNING → ERROR
- 健康检查和自动重启
- 进程异常处理

#### 状态机

```
         start()
STOPPED ─────────> STARTING
   ^                  │
   │                  │ ready
   │                  ▼
   │               RUNNING ───> ERROR
   │                  │            │
   │                  │            │
   └──────────────────┴────────────┘
          stop() / error
```

#### 启动流程

```typescript
private async _start(): Promise<MCPServerStatus> {
  // 1. 检查Codex CLI是否安装
  await this._checkCodexCLI();

  // 2. 加载配置
  const config = await this._getConfig();

  // 3. 启动MCP服务器进程
  this.process = spawn('codex', ['mcp-server', '--port', config.port.toString()]);

  // 4. 监听进程输出
  this.process.stdout?.on('data', (data) => {
    this.outputChannel.appendLine(`[MCP Server] ${data}`);
  });

  // 5. 等待就绪信号
  await this._waitForReady();

  // 6. 启动健康检查
  this._startHealthChecks();

  this.state = MCPServerState.RUNNING;
  return this.getStatus();
}
```

#### 健康检查机制

```typescript
private _startHealthChecks(): void {
  // 每30秒执行一次健康检查
  this.healthCheckInterval = setInterval(async () => {
    const healthy = await this.healthCheck();

    if (!healthy) {
      this.healthCheckFailureCount++;

      // 连续失败3次，触发自动重启
      if (this.healthCheckFailureCount >= 3) {
        await this.stop();
        await this.ensureStarted();
        this.healthCheckFailureCount = 0;
      }
    } else {
      // 恢复健康，重置失败计数
      this.healthCheckFailureCount = 0;
    }
  }, 30000);
}
```

#### 进程管理

```typescript
// 优雅关闭
async stop(): Promise<void> {
  // 1. 发送SIGTERM信号
  this.process.kill('SIGTERM');

  // 2. 等待5秒
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      // 3. 如果仍未退出，发送SIGKILL强制终止
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    this.process?.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
```

#### 错误恢复

- 启动失败：记录错误信息，显示详细的安装指引
- 进程崩溃：自动重启（最多3次）
- 健康检查失败：连续失败3次触发重启
- 版本不兼容：警告用户，提供升级指引

### 2.6 SecurityGuard (安全守卫)

#### 职责

- 控制Codex的文件访问权限
- 拦截危险操作
- 保护敏感文件
- 记录安全审计日志

#### 核心功能

##### 1. 文件访问权限检查

```typescript
async checkFileAccess(filePath: string): Promise<AccessResult> {
  // 1. 检查是否在.claudeignore中
  if (await this._isIgnored(filePath)) {
    return { allowed: false, reason: 'Blocked by .claudeignore' };
  }

  // 2. 检查文件名是否匹配敏感模式
  const isSensitiveByName = this._isSensitiveFile(filePath);

  // 3. 读取内容检查
  const isSensitiveByContent = this._detectSensitiveContent(content);

  // 4. 检查是否在白名单中
  if (this.allowedPaths.length > 0) {
    const isAllowed = this.allowedPaths.some(pattern =>
      this._globToRegex(pattern).test(relativePath)
    );
    if (!isAllowed) {
      return { allowed: false, reason: 'Not in allowed paths' };
    }
  }

  // 5. 返回结果
  return {
    allowed: true,
    requiresSanitization: isSensitiveByName || isSensitiveByContent
  };
}
```

##### 2. Shell命令安全检查

```typescript
async checkCommandExecution(command: string): Promise<CommandCheckResult> {
  // 1. 检查危险命令模式
  for (const pattern of this.dangerousPatterns) {
    if (pattern.pattern.test(command)) {
      // 2. 显示警告对话框
      const confirmed = await vscode.window.showWarningMessage(
        `危险命令警告\n\n命令: ${command}\n风险: ${pattern.reason}\n等级: ${pattern.severity}`,
        '允许执行',
        '拒绝'
      );

      // 3. 记录安全日志
      await this._logCommandSecurityEvent(command, pattern.reason, pattern.severity, confirmed);

      return {
        allowed: confirmed === '允许执行',
        reason: confirmed ? undefined : pattern.reason,
        requiresConfirmation: true
      };
    }
  }

  return { allowed: true, requiresConfirmation: false };
}
```

##### 3. 敏感文件保护和脱敏

敏感文件模式：
```typescript
private readonly sensitivePatterns: RegExp[] = [
  /\.env$/,
  /\.env\..+$/,
  /credentials\.json$/,
  /secrets\.json$/,
  /\.ssh\//,
  /\.aws\//,
  /id_rsa$/,
  /\.pem$/,
  /\.key$/
];
```

内容脱敏：
```typescript
sanitizeContent(content: string, fileType: string): string {
  let sanitized = content;

  // 1. 私钥脱敏
  sanitized = sanitized.replace(
    /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)([\s\S]*?)(-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
    '$1\n***REDACTED PRIVATE KEY***\n$3'
  );

  // 2. AWS密钥脱敏
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, '***REDACTED_AWS_KEY***');

  // 3. API密钥脱敏
  sanitized = sanitized.replace(
    /(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi,
    '$1***REDACTED***'
  );

  // 4. 密码脱敏
  sanitized = sanitized.replace(
    /(password\s*[:=]\s*)([^\s,;]+)/gi,
    '$1***REDACTED***'
  );

  // 5. JWT Token脱敏
  sanitized = sanitized.replace(
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    'eyJ***REDACTED_JWT_TOKEN***'
  );

  return sanitized;
}
```

##### 4. 配置文件修改保护

```typescript
async checkAndBackupConfigFile(
  filePath: string,
  newContent: string
): Promise<boolean> {
  // 1. 检查是否是配置文件
  if (!this._isConfigFile(filePath)) {
    return true;
  }

  // 2. 创建备份
  const backupCreated = await this._createBackup(filePath);
  if (!backupCreated) {
    return false;
  }

  // 3. 生成diff
  const oldContent = await fs.promises.readFile(filePath, 'utf-8');
  const diff = this._generateDiff(oldContent, newContent);

  // 4. 显示确认对话框
  const confirmed = await this._showConfigModificationDialog(fileName, diff);

  // 5. 记录日志
  await this._logSecurityEvent(filePath, 'write', !confirmed);

  return confirmed;
}
```

#### 安全审计日志

所有安全事件记录到 `.claude/codex/security-log.json`：

```json
[
  {
    "timestamp": "2025-01-18T12:00:00.000Z",
    "file": "/path/to/.env",
    "operation": "read",
    "user": "developer",
    "denied": false,
    "reason": "Sensitive file (AWS密钥)"
  },
  {
    "timestamp": "2025-01-18T12:05:00.000Z",
    "command": "rm -rf /",
    "reason": "删除根目录",
    "severity": "critical",
    "allowed": false,
    "user": "developer"
  }
]
```

### 2.7 SessionStateManager (会话管理)

#### 职责

- 创建和管理Codex会话的生命周期
- 持久化会话状态到sessions.json
- 提供会话检查点和恢复机制
- 清理过期会话

#### 会话数据结构

```typescript
export interface Session {
  id: string;  // 格式: codex-{timestamp}-{uuid}
  task: TaskDescriptor;
  status: 'active' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  createdAt: Date;
  lastActiveAt: Date;
  context?: {
    codebaseSnapshot?: CodebaseSnapshot;
    complexityScore?: ComplexityScore;
    options?: ExecutionOptions;
  };
  checkpoints?: SessionCheckpoint[];
  metadata?: Record<string, any>;
}
```

#### 持久化策略

增量更新策略：
```typescript
// 只保存修改过的会话
private dirtySessionIds: Set<string> = new Set();

// 标记会话为脏数据
this.dirtySessionIds.add(sessionId);

// 持久化时只写入脏数据
if (this.dirtySessionIds.size === 0) {
  return; // 无需更新
}
```

文件锁机制：
```typescript
class FileLock {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(filePath: string): Promise<() => void> {
    // 等待现有锁释放
    while (this.locks.has(filePath)) {
      await this.locks.get(filePath);
    }

    // 创建新锁
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(filePath, lockPromise);

    // 返回释放函数
    return () => {
      this.locks.delete(filePath);
      releaseLock!();
    };
  }
}
```

原子性写入：
```typescript
// 先写临时文件，再重命名
const tempFilePath = `${this.sessionsFilePath}.tmp`;
await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2));
await fs.rename(tempFilePath, this.sessionsFilePath);
```

#### 会话超时清理

```typescript
// 每5分钟检查一次
private readonly CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// 30分钟无活动超时
private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000;

private _startCleanupTimer(): void {
  this.cleanupTimer = setInterval(async () => {
    const cleanedCount = await this.cleanupOldSessions();
    if (cleanedCount > 0) {
      this.outputChannel.appendLine(
        `Auto cleanup: ${cleanedCount} session(s) timed out`
      );
    }
  }, this.CLEANUP_CHECK_INTERVAL_MS);
}
```

#### 会话恢复

```typescript
async restoreSession(sessionId: string): Promise<Session | null> {
  // 1. 从内存查找
  let session = this.sessions.get(sessionId);

  // 2. 如果内存中没有，从文件加载
  if (!session) {
    await this._loadSessions();
    session = this.sessions.get(sessionId);
  }

  if (!session) {
    return null;
  }

  // 3. 更新最后活跃时间
  session.lastActiveAt = new Date();
  await this._persistSessions();

  return session;
}
```

### 2.8 ExecutionLogger (执行日志)

#### 职责

- 记录任务执行的完整日志
- 双重输出：OutputChannel + 文件
- 敏感数据清理
- 结构化日志格式

#### 日志记录策略

```typescript
// 双重输出
logInfo(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [INFO] ${message}`;

  // 1. 输出到VSCode OutputChannel
  this.outputChannel.appendLine(logMessage);

  // 2. 追加到日志文件
  this.logBuffer.push({
    timestamp,
    level: 'info',
    message,
    data: this._sanitizeData(data)
  });
}

// 敏感数据清理
private _sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return data
      .replace(/AKIA[0-9A-Z]{16}/g, '***REDACTED_AWS_KEY***')
      .replace(/(password|token|secret)\s*[:=]\s*[^\s]+/gi, '$1=***REDACTED***');
  }
  return data;
}

// 批量刷新到文件
async flush(): Promise<void> {
  if (this.logBuffer.length === 0) return;

  const logContent = this.logBuffer
    .map(entry => JSON.stringify(entry))
    .join('\n') + '\n';

  await fs.promises.appendFile(this.logFilePath, logContent);
  this.logBuffer = [];
}
```

### 2.9 ProgressIndicator (进度指示器)

#### 7阶段进度跟踪

```typescript
export type ExecutionPhase =
  | 'initializing'      // 初始化 (0%)
  | 'routing'           // 路由决策 (15%)
  | 'analyzing-codebase'// 代码库分析 (30%)
  | 'deep-thinking'     // 深度推理 (50%)
  | 'executing'         // 执行任务 (70%)
  | 'saving-results'    // 保存结果 (90%)
  | 'completed';        // 完成 (100%)
```

#### VSCode UI集成

```typescript
async start(title: string, cancellable: boolean = false): Promise<void> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable
    },
    async (progress, token) => {
      this.progress = progress;
      this.cancellationToken = token;

      // 监听取消事件
      token.onCancellationRequested(() => {
        this.cancelled = true;
      });

      // 等待完成
      await this.completionPromise;
    }
  );
}
```

#### 取消操作支持

```typescript
// 检查取消状态
if (indicator.isCancelled()) {
  throw new Error('Task cancelled by user');
}

// 取消后保存中间结果
if (indicator.isCancelled()) {
  await this.sessionStateManager.saveState(session, intermediateResult);
  this.outputChannel.appendLine('Task cancelled, intermediate results saved');
}
```

---

## 3. 数据流图

### 3.1 任务执行完整流程

```
┌──────────────┐
│ User Trigger │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ CodexOrchestrator.executeTask()             │
└──────────────────────┬──────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       │                               │
       ▼                               ▼
┌────────────────┐            ┌────────────────┐
│ Create Session │            │ Create Progress│
│ (SessionState  │            │ Indicator      │
│  Manager)      │            │                │
└───────┬────────┘            └────────┬───────┘
        │                              │
        ▼                              ▼
┌────────────────────────────┐  ┌──────────────┐
│ TaskRouter.route()         │  │ Phase:       │
│ ├─> Get default mode       │  │ initializing │
│ ├─> ComplexityAnalyzer     │  └──────────────┘
│ │   .analyze()             │
│ │   ├─> Code scale (30%)   │
│ │   ├─> Tech difficulty(40%)
│ │   └─> Business impact(30%)
│ ├─> Calculate weighted    │
│ │   total score            │
│ ├─> Generate reasons      │
│ └─> User confirmation     │
│     (if codex)            │
└───────┬────────────────────┘
        │
        ▼         ┌──────────────┐
    score >= 7 ?  │ Phase:       │
        │         │ routing      │
  ┌─────┴─────┐   └──────────────┘
  │           │
 Yes         No
  │           │
  ▼           ▼
Codex       Local
mode        mode
  │           │
  └─────┬─────┘
        │
┌───────▼──────────────────────────────┐
│ Optional: enableCodebaseScan?        │
│ ├─> CodebaseAnalyzer.scan()          │
│ └─> Update session context           │
└───────┬──────────────────────────────┘
        │         ┌──────────────────┐
        │         │ Phase:           │
        │         │ analyzing-       │
        │         │ codebase         │
        │         └──────────────────┘
        ▼
┌───────────────────────────────────────┐
│ Optional: enableDeepThinking?         │
│ ├─> DeepThinkingEngine.analyze()      │
│ │   ├─> Build prompt                 │
│ │   ├─> Call Sequential Thinking API │
│ │   ├─> Parse thinking chain         │
│ │   │   ├─> Problem decomposition   │
│ │   │   ├─> Risk identification     │
│ │   │   ├─> Solution comparison     │
│ │   │   └─> Recommended decision    │
│ │   └─> Show WebView result         │
│ └─> Update session metadata          │
└───────┬───────────────────────────────┘
        │         ┌──────────────────┐
        │         │ Phase:           │
        │         │ deep-thinking    │
        │         └──────────────────┘
        ▼
┌───────────────────────────────────────┐
│ Execute Task                          │
│                                       │
│ IF mode = 'codex':                    │
│   ├─> CodexExecutor.execute()        │
│   │   ├─> MCPLifecycleManager        │
│   │   │   .ensureStarted()           │
│   │   │   ├─> Check CLI installed   │
│   │   │   ├─> Start MCP server      │
│   │   │   ├─> Wait for ready        │
│   │   │   └─> Start health checks   │
│   │   ├─> MCPClient.callCodex()     │
│   │   ├─> SecurityGuard              │
│   │   │   .checkFileAccess()        │
│   │   │   .checkCommandExecution()  │
│   │   └─> ExecutionLogger.log()     │
│                                       │
│ ELSE mode = 'local':                  │
│   └─> LocalAgentExecutor.execute()   │
│       ├─> Run local Claude instance │
│       └─> ExecutionLogger.log()     │
└───────┬───────────────────────────────┘
        │         ┌──────────────────┐
        │         │ Phase:           │
        │         │ executing        │
        │         └──────────────────┘
        ▼
┌───────────────────────────────────────┐
│ SessionStateManager.saveState()       │
│ ├─> Update lastActiveAt              │
│ ├─> Mark session as dirty            │
│ ├─> Acquire file lock                │
│ ├─> Write to sessions.json (atomic)  │
│ └─> Release file lock                │
└───────┬───────────────────────────────┘
        │         ┌──────────────────┐
        │         │ Phase:           │
        │         │ saving-results   │
        │         └──────────────────┘
        ▼
┌───────────────────────────────────────┐
│ Return ExecutionResult                │
│ ├─> success: boolean                  │
│ ├─> mode: ExecutionMode               │
│ ├─> sessionId: string                 │
│ ├─> duration: number                  │
│ ├─> generatedFiles?: string[]         │
│ ├─> output?: string                   │
│ ├─> error?: Error                     │
│ └─> thinkingSummary?: ThinkingResult  │
└───────┬───────────────────────────────┘
        │         ┌──────────────────┐
        │         │ Phase:           │
        │         │ completed        │
        │         └──────────────────┘
        ▼
┌───────────────────────────────────────┐
│ ProgressIndicator.complete()          │
└───────────────────────────────────────┘
```

### 3.2 路由决策流程

```
┌──────────────────────┐
│ TaskRouter.route()   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ 1. Get Default Mode              │
│    ConfigManager.loadSettings()  │
│    → settings.codex.defaultMode  │
└──────────┬───────────────────────┘
           │
           ▼
      defaultMode ?
     ┌─────┴─────┐
     │           │
  'local'    'codex'
  'auto'        │
     │          │
     │          └────────────────┐
     │                           │
     ▼                           ▼
┌────────────────────┐    ┌──────────────┐
│ 2. Auto Mode:      │    │ Return fixed │
│    Analyze Task    │    │ mode         │
└────────┬───────────┘    └──────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ ComplexityAnalyzer.analyze()           │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Code Scale (30%)                   ││
│ │ ├─> File count                     ││
│ │ ├─> Lines of code                  ││
│ │ └─> Refactoring scope              ││
│ └────────────────────────────────────┘│
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Technical Difficulty (40%)         ││
│ │ ├─> Task type base score           ││
│ │ ├─> AST modification               ││
│ │ ├─> Async complexity               ││
│ │ ├─> New technology                 ││
│ │ ├─> Database migration             ││
│ │ └─> Performance/Security           ││
│ └────────────────────────────────────┘│
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Business Impact (30%)              ││
│ │ ├─> Core functionality             ││
│ │ ├─> Multiple subsystems            ││
│ │ ├─> Core API impact                ││
│ │ ├─> Database migration             ││
│ │ └─> User experience                ││
│ └────────────────────────────────────┘│
│                                        │
│ Weighted Total:                        │
│ = codeScale * 0.3                      │
│ + technicalDifficulty * 0.4            │
│ + businessImpact * 0.3                 │
└────────┬───────────────────────────────┘
         │
         ▼
    Total Score
     ┌──┴──┐
     │     │
  >= 7    < 7
     │     │
     │     ▼
     │  ┌──────────────┐
     │  │ Recommend:   │
     │  │ local        │
     │  └──────┬───────┘
     │         │
     ▼         │
┌────────────────────┐ │
│ Recommend: codex   │ │
└────────┬───────────┘ │
         │             │
         ▼             │
┌────────────────────────────┐ │
│ 3. Generate Reasons        │ │
│    (Human-readable list)   │ │
└────────┬───────────────────┘ │
         │                     │
         ▼                     │
┌────────────────────────────┐ │
│ 4. Calculate Confidence    │ │
│    (0-100)                 │ │
│    Based on score variance │ │
└────────┬───────────────────┘ │
         │                     │
         ▼                     │
┌────────────────────────────┐ │
│ 5. User Confirmation       │ │
│    (Only for codex)        │ │
│                            │ │
│    Show dialog with:       │ │
│    - Score                 │ │
│    - Reasons               │ │
│    - Confidence            │ │
│    - [使用Codex] [使用本地]│ │
└────────┬───────────────────┘ │
         │                     │
    ┌────┴────┐                │
    │         │                │
Accepted   Denied              │
    │         │                │
    │         └────────┬───────┘
    │                  │
    ▼                  ▼
┌────────┐      ┌──────────┐
│ Codex  │      │  Local   │
│ mode   │      │  mode    │
└───┬────┘      └────┬─────┘
    │                │
    └────────┬───────┘
             │
             ▼
┌────────────────────────────────┐
│ 6. Record Decision             │
│    PreferenceTracker           │
│    .recordDecision()           │
│    ├─> Task descriptor         │
│    ├─> Recommended mode        │
│    ├─> Recommended score       │
│    ├─> Chosen mode             │
│    └─> Context (reasons, conf) │
└────────────────────────────────┘
```

### 3.3 深度推理流程

```
┌───────────────────────────────┐
│ DeepThinkingEngine.analyze()  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 1. Build Prompt                       │
│    ├─> Select scenario (by task type) │
│    │   ├─> DESIGN_REVIEW              │
│    │   ├─> REQUIREMENTS_ANALYSIS      │
│    │   ├─> ARCHITECTURE_REVIEW        │
│    │   └─> CODE_REFACTORING           │
│    ├─> Inject task context           │
│    ├─> Inject complexity score       │
│    └─> Inject codebase snapshot      │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 2. Call Sequential Thinking API       │
│    (with timeout: 2 minutes)          │
│                                       │
│    MCPClient.callCodex()              │
│    ├─> Ensure MCP server started     │
│    ├─> Build CodexToolParams          │
│    │   ├─> model: 'gpt-5-codex'      │
│    │   ├─> sandbox: 'danger-full-...'│
│    │   └─> prompt: (from step 1)     │
│    └─> Send request via stdio        │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 3. Parse Thinking Chain               │
│                                       │
│    rawResponse (text)                 │
│           │                           │
│           ▼                           │
│    ┌─────────────────────────────┐   │
│    │ Extract Thinking Steps      │   │
│    │ (numbered list or paragraphs│   │
│    └──────────┬──────────────────┘   │
│               │                       │
│               ▼                       │
│    ┌─────────────────────────────┐   │
│    │ Extract Insights            │   │
│    │ (key conclusions)           │   │
│    └──────────┬──────────────────┘   │
│               │                       │
│               ▼                       │
│    ThinkingChain {                    │
│      rawResponse,                     │
│      steps,                           │
│      insights                         │
│    }                                  │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 4. Structure Analysis Result          │
│                                       │
│    _extractProblemDecomposition()     │
│    ├─> Find "Problem Decomposition"  │
│    ├─> Extract problem nodes (tree)  │
│    └─> Return ProblemNode[]          │
│                                       │
│    _extractRisks()                    │
│    ├─> Find "Risk Identification"    │
│    ├─> Extract risk items            │
│    │   ├─> Category (tech/security)  │
│    │   ├─> Severity (high/med/low)   │
│    │   ├─> Description               │
│    │   └─> Mitigation                │
│    └─> Return Risk[]                 │
│                                       │
│    _extractSolutions()                │
│    ├─> Find "Solution Comparison"    │
│    ├─> Extract solution items        │
│    │   ├─> Approach                  │
│    │   ├─> Pros                      │
│    │   ├─> Cons                      │
│    │   ├─> Complexity                │
│    │   └─> Score                     │
│    └─> Return Solution[]             │
│                                       │
│    _extractDecision()                 │
│    ├─> Find "Recommended Decision"   │
│    ├─> Extract selected solution     │
│    ├─> Extract rationale             │
│    ├─> Extract estimated effort      │
│    └─> Extract next steps            │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 5. Return ThinkingResult              │
│    {                                  │
│      problemDecomposition,            │
│      riskIdentification,              │
│      solutionComparison,              │
│      recommendedDecision,             │
│      thinkingChain                    │
│    }                                  │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 6. Show WebView                       │
│    CodexAnalysisWebview.show()        │
│    ├─> Render problem tree           │
│    ├─> Render risk list              │
│    ├─> Render solution comparison    │
│    └─> Render decision with actions  │
└───────────────────────────────────────┘
```

### 3.4 会话管理流程

```
┌────────────────────────────┐
│ Session Lifecycle          │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 1. Create Session                  │
│    SessionStateManager             │
│    .createSession(task, options)   │
│                                    │
│    ├─> Generate ID:                │
│    │   codex-{timestamp}-{uuid}    │
│    ├─> Initialize Session object   │
│    │   ├─> id                      │
│    │   ├─> task                    │
│    │   ├─> status: 'active'        │
│    │   ├─> createdAt               │
│    │   ├─> lastActiveAt            │
│    │   ├─> context                 │
│    │   ├─> checkpoints: []         │
│    │   └─> metadata: {}            │
│    ├─> Add to memory map           │
│    ├─> Mark as dirty               │
│    └─> Persist to sessions.json    │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 2. Update Context                  │
│    .updateContext(sessionId, ...)  │
│                                    │
│    ├─> Get session from map        │
│    ├─> Update context fields       │
│    │   ├─> complexityScore         │
│    │   └─> codebaseSnapshot        │
│    ├─> Update lastActiveAt         │
│    ├─> Mark as dirty               │
│    └─> Persist (immediate)         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 3. Create Checkpoint (optional)    │
│    .createCheckpoint(              │
│       sessionId, state, desc       │
│    )                               │
│                                    │
│    ├─> Get session                 │
│    ├─> Create checkpoint object    │
│    │   ├─> id: UUID                │
│    │   ├─> timestamp               │
│    │   ├─> description             │
│    │   └─> state: {}               │
│    ├─> Append to checkpoints[]     │
│    ├─> Mark as dirty               │
│    └─> Persist (immediate)         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 4. Save State                      │
│    .saveState(session, result)     │
│                                    │
│    ├─> Update lastActiveAt         │
│    ├─> Update metadata             │
│    │   └─> lastResult              │
│    ├─> Mark as dirty               │
│    └─> Persist (debounced)         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 5. Persist to File                 │
│    _persistSessions()              │
│                                    │
│    ├─> Check dirty sessions        │
│    ├─> Debounce (1s interval)      │
│    ├─> Acquire file lock           │
│    ├─> Prepare SessionsData        │
│    │   ├─> sessions: Session[]     │
│    │   ├─> lastUpdated: ISO string │
│    │   └─> version: '1.0.0'        │
│    ├─> Atomic write:               │
│    │   ├─> Write to .tmp file      │
│    │   └─> Rename to sessions.json │
│    ├─> Clear dirty set             │
│    └─> Release file lock           │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 6. Cleanup Timer (every 5 min)    │
│    .cleanupOldSessions()           │
│                                    │
│    ├─> Iterate all sessions        │
│    ├─> Check age:                  │
│    │   now - lastActiveAt          │
│    ├─> If age > 30min:             │
│    │   ├─> status = 'timeout'      │
│    │   └─> Mark as dirty           │
│    └─> Persist if cleaned any      │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 7. Restore Session (if needed)    │
│    .restoreSession(sessionId)      │
│                                    │
│    ├─> Check memory map            │
│    ├─> If not found:               │
│    │   └─> Load from sessions.json │
│    ├─> Parse dates from strings    │
│    ├─> Update lastActiveAt         │
│    └─> Return Session              │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ 8. Shutdown (on deactivate)       │
│    .dispose()                      │
│                                    │
│    ├─> Stop cleanup timer          │
│    ├─> Shutdown all active sessions│
│    │   └─> status = 'cancelled'    │
│    └─> Final persist               │
└────────────────────────────────────┘
```

### 3.5 日志记录流程

```
┌─────────────────────────────┐
│ ExecutionLogger             │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────────┐   ┌────────────┐
│ VSCode     │   │ File       │
│ Output     │   │ System     │
│ Channel    │   │            │
└────────────┘   └─────┬──────┘
                       │
                       ▼
              ┌────────────────┐
              │ Log Buffer     │
              │ (in memory)    │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────────┐
              │ Batch Write        │
              │ (every 5s or flush)│
              └────────┬───────────┘
                       │
                       ▼
              ┌────────────────────┐
              │ .claude/codex/     │
              │ execution.log      │
              └────────────────────┘
```

---

## 4. 关键流程说明

### 4.1 任务执行流程

**步骤详解**：

1. **用户触发**
   - 通过VSCode命令面板或CodeLens触发
   - 构建TaskDescriptor对象
   - 调用CodexOrchestrator.executeTask()

2. **初始化阶段**
   - 创建ProgressIndicator（7阶段进度跟踪）
   - 创建Session（SessionStateManager）
   - 生成唯一会话ID: `codex-{timestamp}-{uuid}`

3. **路由决策**
   - 检查强制模式（options.forceMode）
   - 检查全局默认模式（codex.defaultMode）
   - 智能路由（ComplexityAnalyzer）
     - 代码规模分析（30%）
     - 技术难度分析（40%）
     - 业务影响分析（30%）
   - 用户确认（如果推荐Codex）
   - 记录决策（PreferenceTracker）

4. **代码库扫描（可选）**
   - 扫描文件结构
   - 分析依赖关系
   - 生成代码库快照

5. **深度推理（可选）**
   - 构建深度推理prompt
   - 调用Sequential Thinking API
   - 解析推理链
   - 展示分析结果（WebView）

6. **执行任务**
   - **Codex模式**：
     - 确保MCP服务器启动
     - 调用Codex API
     - SecurityGuard检查文件和命令
     - ExecutionLogger记录日志
   - **本地模式**：
     - 使用本地Claude实例
     - ExecutionLogger记录日志

7. **保存结果**
   - 更新会话状态
   - 持久化到sessions.json
   - 生成ExecutionResult

8. **完成**
   - 关闭ProgressIndicator
   - 返回ExecutionResult

**异常处理**：

- **超时**: 保存中间结果，抛出超时错误
- **取消**: 保存当前进度，标记会话为cancelled
- **执行失败**: 记录错误信息，返回失败结果
- **MCP服务器故障**: 自动重启，最多3次

**输入输出**：

```typescript
// 输入
interface ExecutionInput {
  task: TaskDescriptor;
  options?: ExecutionOptions;
}

// 输出
interface ExecutionResult {
  success: boolean;
  mode: ExecutionMode;
  sessionId: string;
  duration: number;
  generatedFiles?: string[];
  output?: string;
  error?: Error;
  thinkingSummary?: ThinkingResult;
}
```

### 4.2 路由决策流程

**决策优先级**：

1. **强制模式** (最高优先级)
   - options.forceMode = 'local' | 'codex' | 'auto'
   - 直接使用指定模式
   - 不记录偏好

2. **全局默认模式**
   - codex.defaultMode配置
   - 如果是'local'或'codex'，直接使用
   - 不记录偏好

3. **智能路由**（auto模式）
   - 调用ComplexityAnalyzer分析
   - 基于评分推荐模式
   - 用户确认（如果推荐Codex）
   - 记录决策用于偏好学习

**复杂度评分**：

```
总分 = 代码规模 × 30% + 技术难度 × 40% + 业务影响 × 30%

示例1：简单文档任务
- 代码规模: 0个文件 → 1.0分
- 技术难度: requirements类型 → 2.0分
- 业务影响: 文档任务 → 2.0分
总分 = 1.0×0.3 + 2.0×0.4 + 2.0×0.3 = 1.7分 → 推荐local

示例2：复杂重构任务
- 代码规模: 8个文件 → 8.0分
- 技术难度: 重构+异步 → 9.0分
- 业务影响: 核心API → 8.0分
总分 = 8.0×0.3 + 9.0×0.4 + 8.0×0.3 = 8.4分 → 推荐codex
```

**用户确认机制**：

当推荐Codex时，显示确认对话框：

```
┌────────────────────────────────────────┐
│ 建议使用Codex深度分析 (复杂度评分: 8.4/10) │
│                                        │
│ 推荐理由:                               │
│ • 代码规模较大 (8.0/10) - 涉及8个文件     │
│ • 技术难度很高 (9.0/10) - 包含: AST修改  │
│ • 业务影响范围广 (8.0/10) - 影响核心API  │
│                                        │
│ 置信度: 85%                             │
│                                        │
│ [使用Codex]  [使用本地Agent]            │
└────────────────────────────────────────┘
```

### 4.3 深度推理流程

**提示词工程**：

根据任务类型选择合适的prompt模板：

| 任务类型 | Prompt场景 | 特点 |
|---------|-----------|------|
| design | DESIGN_REVIEW | 关注架构设计、技术选型 |
| requirements | REQUIREMENTS_ANALYSIS | 关注需求完整性、用户故事 |
| review | ARCHITECTURE_REVIEW | 关注系统设计、模块划分 |
| implementation | CODE_REFACTORING | 关注代码质量、重构策略 |

**Sequential Thinking API调用**：

```typescript
// 参数配置
const params: CodexToolParams = {
  model: 'gpt-5-codex',
  sandbox: 'danger-full-access',
  'approval-policy': 'on-failure',
  prompt: deepThinkingPrompt
};

// 带超时的API调用
const result = await Promise.race([
  mcpClient.callCodex(params),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 120000)
  )
]);
```

**推理链解析**：

从Codex响应中提取结构化信息：

```markdown
# Codex响应示例

## 1. Problem Decomposition

- **P1**: 实现用户认证系统
  - **Complexity**: 8
  - Sub-problems:
    - P1.1: 密码加密存储
    - P1.2: JWT token生成
    - P1.3: 会话管理

## 2. Risk Identification

- **R1**: 密码存储安全风险
  - **Category**: security
  - **Severity**: high
  - **Mitigation**: 使用bcrypt加密

## 3. Solution Comparison

- **S1**: 使用Passport.js
  - **Pros**: 成熟稳定、生态丰富
  - **Cons**: 学习曲线陡峭
  - **Complexity**: 6
  - **Score**: 8

## 4. Recommended Decision

- **Selected Solution**: S1 (Passport.js)
- **Rationale**: 成熟度高，社区支持好
- **Estimated Effort**: 2-3天
- **Next Steps**:
  - 安装依赖
  - 配置策略
  - 实现中间件
```

解析后的结构：

```typescript
{
  problemDecomposition: [
    {
      id: 'P1',
      description: '实现用户认证系统',
      complexity: 8,
      subProblems: [...]
    }
  ],
  riskIdentification: [
    {
      id: 'R1',
      category: 'security',
      severity: 'high',
      description: '密码存储安全风险',
      mitigation: '使用bcrypt加密'
    }
  ],
  solutionComparison: [
    {
      id: 'S1',
      approach: '使用Passport.js',
      pros: ['成熟稳定', '生态丰富'],
      cons: ['学习曲线陡峭'],
      complexity: 6,
      score: 8
    }
  ],
  recommendedDecision: {
    selectedSolution: 'S1',
    rationale: '成熟度高，社区支持好',
    estimatedEffort: '2-3天',
    nextSteps: ['安装依赖', '配置策略', '实现中间件']
  }
}
```

### 4.4 会话管理流程

**会话生命周期**：

```
Create → Active → [Checkpoint*] → Completed/Failed/Timeout/Cancelled
```

**持久化策略**：

1. **增量更新**：只保存修改过的会话
2. **防抖**：最小持久化间隔1秒
3. **文件锁**：防止并发写入冲突
4. **原子性写入**：先写.tmp，再rename

**超时清理**：

```typescript
// 每5分钟检查一次
setInterval(async () => {
  const now = Date.now();

  for (const [id, session] of sessions) {
    const age = now - session.lastActiveAt.getTime();

    // 30分钟无活动
    if (session.status === 'active' && age > 30*60*1000) {
      session.status = 'timeout';
      dirtySessionIds.add(id);
    }
  }

  if (dirtySessionIds.size > 0) {
    await persistSessions();
  }
}, 5*60*1000);
```

**会话恢复**：

支持从任意检查点恢复：

```typescript
// 1. 恢复会话
const session = await sessionStateManager.restoreSession(sessionId);

// 2. 选择检查点（可选）
const checkpoint = session.checkpoints?.[checkpointIndex];

// 3. 恢复状态
if (checkpoint) {
  restoreState(checkpoint.state);
}

// 4. 继续执行
await codexOrchestrator.executeTask(session.task, {
  forceMode: session.context?.options?.forceMode
});
```

### 4.5 日志记录流程

**双重输出机制**：

1. **实时输出**：VSCode OutputChannel
2. **持久化**：文件系统（.claude/codex/execution.log）

**敏感数据清理**：

```typescript
private _sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return data
      // AWS密钥
      .replace(/AKIA[0-9A-Z]{16}/g, '***REDACTED_AWS_KEY***')
      // 密码/token
      .replace(/(password|token|secret)\s*[:=]\s*[^\s]+/gi, '$1=***REDACTED***')
      // JWT token
      .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, 'eyJ***REDACTED_JWT_TOKEN***');
  }
  return data;
}
```

**批量刷新**：

```typescript
// 缓冲区
private logBuffer: LogEntry[] = [];

// 定时刷新（每5秒）
setInterval(() => {
  this.flush();
}, 5000);

// 手动刷新
async flush(): Promise<void> {
  if (this.logBuffer.length === 0) return;

  const logContent = this.logBuffer
    .map(entry => JSON.stringify(entry))
    .join('\n') + '\n';

  await fs.promises.appendFile(this.logFilePath, logContent);
  this.logBuffer = [];
}
```

---

## 5. 扩展指南

### 5.1 添加新的复杂度检测规则

#### 步骤1：在ComplexityAnalyzer中添加检测方法

```typescript
// src/features/codex/complexityAnalyzer.ts

/**
 * 检测是否涉及实时通信（WebSocket/SSE等）
 */
private _involvesRealtimeCommunication(fullText: string): boolean {
  return this._containsKeywords(fullText, [
    'websocket', 'socket.io', 'sse', 'server-sent events',
    '实时通信', 'WebSocket', '双向通信'
  ]);
}
```

#### 步骤2：在评分方法中调用

```typescript
private async _analyzeTechnicalDifficulty(task: TaskDescriptor): Promise<number> {
  let score = /* ...基础评分... */;

  // ...existing checks...

  // 检测实时通信 (+2分)
  if (this._involvesRealtimeCommunication(fullText)) {
    score = Math.min(10.0, score + 2.0);
  }

  return Math.round(score * 10) / 10;
}
```

#### 步骤3：更新details字段

```typescript
private async _generateDetails(...): Promise<ComplexityScore['details']> {
  return {
    // ...existing fields...
    involvesRealtimeCommunication: this._involvesRealtimeCommunication(fullText)
  };
}
```

#### 步骤4：在types.ts中添加类型定义

```typescript
// src/features/codex/types.ts

export interface ComplexityScore {
  details: {
    // ...existing fields...

    /** 是否涉及实时通信 */
    involvesRealtimeCommunication?: boolean;
  };
}
```

#### 步骤5：在TaskRouter中添加推荐理由

```typescript
// src/features/codex/taskRouter.ts

private _generateReasons(score: ComplexityScore): string[] {
  const reasons: string[] = [];

  // ...existing reasons...

  // 实时通信
  if (score.details.involvesRealtimeCommunication) {
    reasons.push('• 涉及实时通信（WebSocket/SSE）');
  }

  return reasons;
}
```

#### 步骤6：添加单元测试

```typescript
// src/features/codex/__tests__/complexityAnalyzer.test.ts

describe('ComplexityAnalyzer - Realtime Communication', () => {
  it('should detect WebSocket usage', async () => {
    const task: TaskDescriptor = {
      id: 'test-1',
      type: 'implementation',
      description: '实现WebSocket实时消息推送功能'
    };

    const analyzer = new ComplexityAnalyzer();
    const score = await analyzer.analyze(task);

    expect(score.details.involvesRealtimeCommunication).toBe(true);
    expect(score.technicalDifficulty).toBeGreaterThanOrEqual(7);
  });
});
```

### 5.2 添加新的安全检查规则

#### 步骤1：在SecurityGuard中添加危险模式

```typescript
// src/features/codex/securityGuard.ts

private readonly dangerousPatterns: Array<{
  pattern: RegExp;
  reason: string;
  severity: 'critical' | 'high' | 'medium';
}> = [
  // ...existing patterns...

  // 添加新规则：检测npm包发布
  {
    pattern: /npm\s+publish/,
    reason: '发布npm包到公共registry',
    severity: 'high'
  },

  // 检测环境变量泄露
  {
    pattern: /export\s+\w+=['"].*(?:password|secret|token|key)/i,
    reason: '可能泄露敏感环境变量',
    severity: 'high'
  }
];
```

#### 步骤2：添加敏感文件模式

```typescript
private readonly sensitivePatterns: RegExp[] = [
  // ...existing patterns...

  // 添加新模式
  /\.npmrc$/,           // npm配置（可能包含token）
  /\.pypirc$/,          // PyPI配置
  /\.docker\/config\.json$/, // Docker配置
];
```

#### 步骤3：添加内容检测模式

```typescript
private readonly contentSensitivePatterns: Array<{
  name: string;
  pattern: RegExp;
  description: string;
}> = [
  // ...existing patterns...

  {
    name: 'docker-token',
    pattern: /DOCKER_AUTH_CONFIG\s*[:=]\s*['"][^'"]+['"]/,
    description: 'Docker认证token'
  },
  {
    name: 'github-token',
    pattern: /ghp_[a-zA-Z0-9]{36}/,
    description: 'GitHub Personal Access Token'
  }
];
```

#### 步骤4：更新脱敏逻辑

```typescript
sanitizeContent(content: string, fileType: string): string {
  let sanitized = content;

  // ...existing sanitization...

  // GitHub token脱敏
  sanitized = sanitized.replace(
    /ghp_[a-zA-Z0-9]{36}/g,
    'ghp_***REDACTED_GITHUB_TOKEN***'
  );

  // Docker auth脱敏
  sanitized = sanitized.replace(
    /(DOCKER_AUTH_CONFIG\s*[:=]\s*)(['"][^'"]+['"])/gi,
    '$1"***REDACTED***"'
  );

  return sanitized;
}
```

#### 步骤5：添加单元测试

```typescript
// src/features/codex/__tests__/securityGuard.test.ts

describe('SecurityGuard - New Rules', () => {
  let guard: SecurityGuard;

  beforeEach(() => {
    guard = new SecurityGuard(outputChannel);
  });

  it('should detect npm publish command', async () => {
    const result = await guard.checkCommandExecution('npm publish --access public');

    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('发布npm包');
  });

  it('should detect GitHub token in content', async () => {
    const content = 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456';
    const sanitized = guard.sanitizeContent(content, 'env');

    expect(sanitized).not.toContain('ghp_abcd');
    expect(sanitized).toContain('***REDACTED_GITHUB_TOKEN***');
  });
});
```

### 5.3 集成新的MCP工具

#### 步骤1：扩展MCPClient添加新工具调用

```typescript
// src/features/codex/mcpClient.ts

/**
 * 调用代码分析工具
 */
async callCodeAnalyzer(params: {
  filePath: string;
  analysisType: 'complexity' | 'security' | 'performance';
}): Promise<MCPCallResult> {
  return await this.call('tools/call', {
    name: 'code-analyzer',
    arguments: {
      file_path: params.filePath,
      analysis_type: params.analysisType
    }
  });
}

/**
 * 调用测试生成工具
 */
async callTestGenerator(params: {
  sourceFile: string;
  testFramework: 'jest' | 'mocha' | 'vitest';
}): Promise<MCPCallResult> {
  return await this.call('tools/call', {
    name: 'test-generator',
    arguments: {
      source_file: params.sourceFile,
      test_framework: params.testFramework
    }
  });
}
```

#### 步骤2：在CodexExecutor中使用新工具

```typescript
// src/features/codex/codexExecutor.ts

/**
 * 分析代码复杂度
 */
async analyzeCodeComplexity(
  filePath: string
): Promise<ComplexityAnalysisResult> {
  // 确保MCP客户端已连接
  const mcpClient = this.getMCPClient();

  // 调用代码分析工具
  const result = await mcpClient.callCodeAnalyzer({
    filePath,
    analysisType: 'complexity'
  });

  // 解析结果
  return this._parseComplexityResult(result);
}

/**
 * 生成单元测试
 */
async generateTests(
  sourceFile: string,
  framework: 'jest' | 'mocha' | 'vitest'
): Promise<string> {
  const mcpClient = this.getMCPClient();

  const result = await mcpClient.callTestGenerator({
    sourceFile,
    testFramework: framework
  });

  // 提取生成的测试代码
  const testCode = result.content
    .find(item => item.type === 'text')
    ?.text || '';

  return testCode;
}
```

#### 步骤3：添加VSCode命令

```typescript
// src/extension.ts

// 注册代码分析命令
context.subscriptions.push(
  vscode.commands.registerCommand(
    'kfc.codex.analyzeComplexity',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const filePath = editor.document.uri.fsPath;
      const executor = orchestrator.getCodexExecutor();

      const result = await executor.analyzeCodeComplexity(filePath);

      // 显示结果
      vscode.window.showInformationMessage(
        `复杂度分析:\n圈复杂度: ${result.cyclomaticComplexity}\n认知复杂度: ${result.cognitiveComplexity}`
      );
    }
  )
);

// 注册测试生成命令
context.subscriptions.push(
  vscode.commands.registerCommand(
    'kfc.codex.generateTests',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const sourceFile = editor.document.uri.fsPath;
      const executor = orchestrator.getCodexExecutor();

      // 询问测试框架
      const framework = await vscode.window.showQuickPick(
        ['jest', 'mocha', 'vitest'],
        { placeHolder: '选择测试框架' }
      );

      if (!framework) return;

      // 生成测试
      const testCode = await executor.generateTests(
        sourceFile,
        framework as any
      );

      // 创建新文档显示测试代码
      const doc = await vscode.workspace.openTextDocument({
        content: testCode,
        language: 'typescript'
      });
      await vscode.window.showTextDocument(doc);
    }
  )
);
```

#### 步骤4：在package.json中注册命令

```json
{
  "contributes": {
    "commands": [
      {
        "command": "kfc.codex.analyzeComplexity",
        "title": "Codex: Analyze Code Complexity"
      },
      {
        "command": "kfc.codex.generateTests",
        "title": "Codex: Generate Unit Tests"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "kfc.codex.analyzeComplexity",
          "when": "editorTextFocus",
          "group": "codex@1"
        },
        {
          "command": "kfc.codex.generateTests",
          "when": "editorTextFocus",
          "group": "codex@2"
        }
      ]
    }
  }
}
```

#### 步骤5：添加集成测试

```typescript
// src/features/codex/__tests__/mcpTools.integration.test.ts

describe('MCP Tools Integration', () => {
  let mcpClient: MCPClient;

  beforeAll(async () => {
    mcpClient = new MCPClient(mcpConfig, outputChannel);
    await mcpClient.connect();
  });

  afterAll(async () => {
    await mcpClient.disconnect();
  });

  it('should analyze code complexity', async () => {
    const result = await mcpClient.callCodeAnalyzer({
      filePath: path.join(__dirname, '../complexityAnalyzer.ts'),
      analysisType: 'complexity'
    });

    expect(result.success).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('should generate unit tests', async () => {
    const result = await mcpClient.callTestGenerator({
      sourceFile: path.join(__dirname, '../taskRouter.ts'),
      testFramework: 'jest'
    });

    expect(result.success).toBe(true);

    const testCode = result.content.find(item => item.type === 'text')?.text;
    expect(testCode).toContain('describe');
    expect(testCode).toContain('it(');
  });
});
```

### 5.4 自定义推理提示词

#### 步骤1：在deepThinkingPrompts.ts中添加新场景

```typescript
// src/features/codex/prompts/deepThinkingPrompts.ts

export enum PromptScenario {
  DESIGN_REVIEW = 'design-review',
  REQUIREMENTS_ANALYSIS = 'requirements-analysis',
  ARCHITECTURE_REVIEW = 'architecture-review',
  CODE_REFACTORING = 'code-refactoring',

  // 添加新场景
  API_DESIGN = 'api-design',
  DATABASE_SCHEMA_DESIGN = 'database-schema-design'
}

export class DeepThinkingPrompts {
  /**
   * API设计场景的提示词
   */
  private static API_DESIGN_TEMPLATE = `
You are an expert API architect. Analyze the following API design task with deep, sequential thinking.

# Task
{{task_description}}

{{#if context}}
# Context
{{context}}
{{/if}}

# Analysis Framework

## 1. API Requirements Analysis
Break down the API requirements:
- What resources need to be exposed?
- What operations (CRUD) are needed?
- What are the relationships between resources?
- What are the data constraints?

## 2. REST vs GraphQL vs RPC
Compare different API paradigms:
- **REST**: Pros, cons, fit for this use case
- **GraphQL**: Pros, cons, fit for this use case
- **RPC**: Pros, cons, fit for this use case

## 3. Endpoint Design
Design the API endpoints:
- Resource naming conventions
- HTTP methods and status codes
- Query parameters and pagination
- Request/response schemas

## 4. Security Considerations
Identify security requirements:
- Authentication methods (JWT, OAuth2, API keys)
- Authorization and access control
- Rate limiting and throttling
- Input validation and sanitization

## 5. Performance Optimization
Consider performance strategies:
- Caching strategies (ETags, Cache-Control)
- Pagination and filtering
- Database query optimization
- Response compression

## 6. Versioning Strategy
Plan for API evolution:
- URI versioning vs Header versioning
- Deprecation policy
- Backward compatibility

## 7. Documentation and Testing
Ensure API usability:
- OpenAPI/Swagger specification
- Example requests/responses
- Error handling and codes
- Integration tests

# Output Format
Provide your analysis in the following structure:

## 1. API Requirements
- List of resources and operations

## 2. Recommended API Style
- Selected paradigm with rationale

## 3. Endpoint Specifications
- Detailed endpoint designs

## 4. Security Plan
- Authentication and authorization strategy

## 5. Performance Plan
- Caching and optimization strategies

## 6. Versioning Plan
- Chosen versioning approach

## 7. Implementation Checklist
- Step-by-step tasks

Think deeply and methodically. Consider trade-offs and provide clear rationales for your recommendations.
`;

  /**
   * 数据库模式设计场景的提示词
   */
  private static DATABASE_SCHEMA_DESIGN_TEMPLATE = `
You are a database architect with expertise in schema design and optimization. Analyze the following database design task.

# Task
{{task_description}}

{{#if context}}
# Context
{{context}}
{{/if}}

# Analysis Framework

## 1. Data Requirements Analysis
Identify entities and relationships:
- What entities exist in the domain?
- What are the attributes of each entity?
- What are the relationships (1:1, 1:N, N:M)?
- What are the cardinality constraints?

## 2. Normalization Analysis
Evaluate normalization forms:
- 1NF, 2NF, 3NF compliance
- Denormalization considerations
- Trade-offs between normalization and performance

## 3. Indexing Strategy
Design indexes for performance:
- Primary keys and foreign keys
- Composite indexes
- Covering indexes
- Full-text search indexes

## 4. Partitioning and Sharding
Consider scalability strategies:
- Horizontal partitioning (sharding)
- Vertical partitioning
- Partition keys selection
- Cross-partition queries

## 5. Data Integrity
Ensure data consistency:
- Constraints (NOT NULL, UNIQUE, CHECK)
- Foreign key constraints
- Triggers for complex validation
- Transaction isolation levels

## 6. Migration Strategy
Plan schema evolution:
- Initial migration scripts
- Versioning approach
- Rollback procedures
- Data migration for existing records

## 7. Performance Considerations
Optimize for read/write patterns:
- Query patterns analysis
- Denormalization decisions
- Caching strategies
- Read replicas

# Output Format

## 1. Entity-Relationship Diagram (ERD)
- Text description of entities and relationships

## 2. Schema Definition
- SQL DDL statements for tables

## 3. Indexing Plan
- Index definitions with rationale

## 4. Normalization Assessment
- Current normal form and justifications

## 5. Scalability Plan
- Partitioning/sharding strategy

## 6. Migration Scripts
- Initial schema creation
- Sample data migration

## 7. Performance Recommendations
- Query optimization tips
- Caching strategies

Think systematically about data modeling best practices and future scalability needs.
`;

  static generatePrompt(
    scenario: PromptScenario,
    context: AnalysisContext
  ): string {
    let template: string;

    switch (scenario) {
      case PromptScenario.API_DESIGN:
        template = this.API_DESIGN_TEMPLATE;
        break;
      case PromptScenario.DATABASE_SCHEMA_DESIGN:
        template = this.DATABASE_SCHEMA_DESIGN_TEMPLATE;
        break;
      // ...existing cases...
      default:
        template = this.DESIGN_REVIEW_TEMPLATE;
    }

    // 使用简单的模板替换（或使用Handlebars等模板引擎）
    let prompt = template
      .replace('{{task_description}}', context.task.description);

    if (context.customContext) {
      const contextStr = JSON.stringify(context.customContext, null, 2);
      prompt = prompt.replace('{{#if context}}', '')
        .replace('{{/if}}', '')
        .replace('{{context}}', contextStr);
    } else {
      // 移除条件块
      prompt = prompt.replace(/\{\{#if context\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    return prompt;
  }
}
```

#### 步骤2：在DeepThinkingEngine中使用新场景

```typescript
// src/features/codex/deepThinkingEngine.ts

private _buildDeepThinkingPrompt(context: AnalysisContext): string {
  let scenario: PromptScenario;

  // 根据任务描述判断场景
  const description = context.task.description.toLowerCase();

  if (description.includes('api') && (
    description.includes('design') ||
    description.includes('endpoint') ||
    description.includes('restful')
  )) {
    scenario = PromptScenario.API_DESIGN;
  } else if (description.includes('database') || description.includes('schema')) {
    scenario = PromptScenario.DATABASE_SCHEMA_DESIGN;
  } else {
    // 使用原有逻辑
    scenario = this._getScenarioByTaskType(context.task.type);
  }

  return DeepThinkingPrompts.generatePrompt(scenario, context);
}
```

#### 步骤3：调整推理链解析逻辑

如果新提示词的输出格式不同，需要添加专门的解析方法：

```typescript
private _parseThinkingChain(
  thinkingChain: ThinkingChain,
  context: AnalysisContext
): ThinkingResult {
  const response = thinkingChain.rawResponse;

  // 检测场景类型
  const isAPIDesign = response.includes('API Requirements') &&
                     response.includes('Endpoint Specifications');

  if (isAPIDesign) {
    return this._parseAPIDesignResult(response, context);
  }

  // 使用通用解析
  return this._parseGenericResult(response, context);
}

private _parseAPIDesignResult(
  response: string,
  context: AnalysisContext
): ThinkingResult {
  // 提取API需求
  const requirements = this._extractSection(response, 'API Requirements');

  // 提取推荐的API风格
  const apiStyle = this._extractSection(response, 'Recommended API Style');

  // 提取端点规范
  const endpoints = this._extractSection(response, 'Endpoint Specifications');

  // 转换为标准ThinkingResult格式
  return {
    problemDecomposition: this._convertToProblems(requirements),
    riskIdentification: this._extractSecurityRisks(response),
    solutionComparison: this._convertToSolutions([apiStyle]),
    recommendedDecision: {
      selectedSolution: apiStyle,
      rationale: this._extractRationale(response),
      estimatedEffort: this._extractEffort(response),
      nextSteps: this._extractSteps(response, 'Implementation Checklist')
    },
    thinkingChain: thinkingChain.steps
  };
}
```

#### 步骤4：验证输出格式

添加测试验证新提示词的输出：

```typescript
// src/features/codex/__tests__/deepThinkingPrompts.test.ts

describe('DeepThinkingPrompts - Custom Scenarios', () => {
  it('should generate API design prompt', () => {
    const context: AnalysisContext = {
      task: {
        id: 'test-1',
        type: 'design',
        description: '设计用户管理REST API'
      }
    };

    const prompt = DeepThinkingPrompts.generatePrompt(
      PromptScenario.API_DESIGN,
      context
    );

    expect(prompt).toContain('API Requirements Analysis');
    expect(prompt).toContain('REST vs GraphQL vs RPC');
    expect(prompt).toContain('Endpoint Design');
    expect(prompt).toContain('Security Considerations');
  });

  it('should generate database schema design prompt', () => {
    const context: AnalysisContext = {
      task: {
        id: 'test-2',
        type: 'design',
        description: '设计电商系统数据库模式'
      }
    };

    const prompt = DeepThinkingPrompts.generatePrompt(
      PromptScenario.DATABASE_SCHEMA_DESIGN,
      context
    );

    expect(prompt).toContain('Data Requirements Analysis');
    expect(prompt).toContain('Normalization Analysis');
    expect(prompt).toContain('Indexing Strategy');
    expect(prompt).toContain('Migration Strategy');
  });
});
```

---

## 6. 测试策略

### 6.1 单元测试指南

**测试框架**: Jest

**覆盖目标**: 80%+ 代码覆盖率

**测试组织**:

```
src/features/codex/
├── __tests__/
│   ├── complexityAnalyzer.test.ts
│   ├── taskRouter.test.ts
│   ├── securityGuard.test.ts
│   ├── sessionStateManager.test.ts
│   ├── mcpLifecycleManager.test.ts
│   ├── deepThinkingEngine.test.ts
│   └── ...
```

**Mock策略**:

```typescript
// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  Uri: {
    file: (path: string) => ({ fsPath: path })
  }
}));

// Mock file system
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}));
```

**测试示例**:

```typescript
describe('ComplexityAnalyzer', () => {
  let analyzer: ComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ComplexityAnalyzer();
  });

  describe('analyze', () => {
    it('should return low score for simple documentation task', async () => {
      const task: TaskDescriptor = {
        id: 'test-1',
        type: 'requirements',
        description: '编写用户故事文档'
      };

      const score = await analyzer.analyze(task);

      expect(score.total).toBeLessThan(4);
      expect(score.codeScale).toBeLessThan(3);
      expect(score.technicalDifficulty).toBeLessThan(3);
    });

    it('should return high score for complex refactoring task', async () => {
      const task: TaskDescriptor = {
        id: 'test-2',
        type: 'implementation',
        description: '重构核心认证模块，支持多种认证方式，涉及AST修改和异步处理',
        relatedFiles: Array(10).fill('file.ts')
      };

      const score = await analyzer.analyze(task);

      expect(score.total).toBeGreaterThanOrEqual(7);
      expect(score.technicalDifficulty).toBeGreaterThan(7);
      expect(score.details.involvesASTModification).toBe(true);
      expect(score.details.involvesAsyncComplexity).toBe(true);
    });
  });
});
```

### 6.2 集成测试指南

**测试范围**: 多组件协同工作

**测试环境**: 需要真实的MCP服务器

**测试示例**:

```typescript
describe('Codex Workflow Integration', () => {
  let orchestrator: CodexOrchestrator;
  let outputChannel: vscode.OutputChannel;

  beforeAll(async () => {
    outputChannel = vscode.window.createOutputChannel('Codex Test');
    orchestrator = new CodexOrchestrator(context, outputChannel);

    // 等待MCP服务器启动
    await orchestrator.getMCPClient().connect();
  });

  afterAll(async () => {
    await orchestrator.dispose();
  });

  it('should execute full workflow from routing to completion', async () => {
    const task: TaskDescriptor = {
      id: 'integration-test-1',
      type: 'design',
      description: '设计用户认证系统架构'
    };

    const result = await orchestrator.executeTask(task, {
      forceMode: 'local',
      enableDeepThinking: false
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('local');
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should handle session restoration', async () => {
    // 创建会话
    const task: TaskDescriptor = {
      id: 'session-test-1',
      type: 'implementation',
      description: '实现用户登录功能'
    };

    const result1 = await orchestrator.executeTask(task);
    const sessionId = result1.sessionId;

    // 恢复会话
    const session = await orchestrator.restoreSession(sessionId);

    expect(session).not.toBeNull();
    expect(session!.id).toBe(sessionId);
    expect(session!.task.description).toBe(task.description);
  });
});
```

### 6.3 E2E测试指南

**测试工具**: VSCode Extension Tester

**测试范围**: 完整的用户操作流程

**测试示例**:

```typescript
import {
  VSBrowser,
  WebDriver,
  EditorView,
  Workbench
} from 'vscode-extension-tester';

describe('Codex Extension E2E Tests', () => {
  let browser: VSBrowser;
  let driver: WebDriver;

  before(async () => {
    browser = VSBrowser.instance;
    driver = browser.driver;
  });

  it('should trigger Codex analysis from command palette', async () => {
    const workbench = new Workbench();

    // 打开命令面板
    const commandPalette = await workbench.openCommandPrompt();

    // 输入命令
    await commandPalette.setText('Codex: Analyze Task Complexity');
    await commandPalette.confirm();

    // 等待分析完成
    await driver.wait(async () => {
      const notifications = await workbench.getNotifications();
      return notifications.some(n =>
        n.getMessage().includes('复杂度分析完成')
      );
    }, 10000);
  });

  it('should execute task via CodeLens', async () => {
    const editorView = new EditorView();

    // 打开spec文件
    await editorView.openEditor('design.md');

    // 查找CodeLens
    const editor = await editorView.openEditor('design.md');
    const codeLenses = await editor.getCodeLenses();

    // 点击"Execute with Codex"
    const executeCodeLens = codeLenses.find(cl =>
      cl.getText().includes('Execute with Codex')
    );

    await executeCodeLens?.click();

    // 验证执行结果
    await driver.wait(async () => {
      const notifications = await new Workbench().getNotifications();
      return notifications.some(n =>
        n.getMessage().includes('任务执行完成')
      );
    }, 60000);
  });
});
```

### 6.4 Mock策略说明

**VSCode API Mock**:

```typescript
// __mocks__/vscode.ts
export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showQuickPick: jest.fn(),
  showInputBox: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn()
  })),
  withProgress: jest.fn((options, task) => task({
    report: jest.fn()
  }, {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn()
  }))
};

export const workspace = {
  workspaceFolders: [
    { uri: { fsPath: '/test/workspace' } }
  ],
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn()
  })),
  openTextDocument: jest.fn(),
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
};
```

**MCP Client Mock**:

```typescript
// __mocks__/mcpClient.ts
export class MCPClient {
  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  isConnected(): boolean {
    return true;
  }

  async callCodex(params: CodexToolParams): Promise<MCPCallResult> {
    return {
      success: true,
      content: [
        {
          type: 'text',
          text: 'Mock Codex response with thinking chain...'
        }
      ]
    };
  }
}
```

---

## 7. 调试技巧

### 7.1 启用详细日志

**方法1: 配置文件**

在 `.vscode/settings.json` 中添加：

```json
{
  "kfc.codex.logLevel": "debug",
  "kfc.codex.logToFile": true
}
```

**方法2: 环境变量**

```bash
export CODEX_LOG_LEVEL=debug
export CODEX_VERBOSE=true
```

**方法3: 代码中设置**

```typescript
// 在需要详细日志的地方
const logger = new ExecutionLogger(outputChannel, {
  logLevel: 'debug',
  verbose: true
});
```

### 7.2 使用VSCode调试器

**launch.json配置**:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ],
      "preLaunchTask": "${defaultBuildTask}",
      "sourceMaps": true
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/out/test/**/*.js"
      ],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

**断点调试**:

1. 在代码中设置断点
2. 按F5启动调试
3. 在Extension Development Host中触发功能
4. 调试器会在断点处暂停

### 7.3 查看MCP服务器日志

**日志位置**:

```
.claude/codex/mcp-server.log
```

**实时查看**:

```bash
tail -f .claude/codex/mcp-server.log
```

**日志格式**:

```
[2025-01-18T12:00:00.000Z] [INFO] MCP Server started on port 8765
[2025-01-18T12:00:05.123Z] [DEBUG] Received request: tools/call
[2025-01-18T12:00:05.456Z] [DEBUG] Calling tool: codex with model: gpt-5-codex
[2025-01-18T12:00:15.789Z] [INFO] Tool call completed in 10333ms
```

**启用详细日志**:

在MCP配置中设置：

```json
{
  "codex": {
    "mcp": {
      "logLevel": "debug"
    }
  }
}
```

### 7.4 常见问题调试

#### 问题1: MCP服务器无法启动

**症状**:
```
Error: MCP server failed to start
Reason: Codex CLI is not installed
```

**调试步骤**:
1. 检查Codex CLI是否安装: `codex --version`
2. 检查PATH环境变量
3. 查看详细错误日志: `.claude/codex/mcp-server.log`
4. 重新安装Codex CLI

#### 问题2: 复杂度评分不准确

**症状**: 简单任务被推荐使用Codex，或复杂任务推荐本地

**调试步骤**:
1. 启用详细日志查看评分详情
2. 检查任务描述是否包含关键词
3. 验证复杂度检测规则
4. 手动测试ComplexityAnalyzer

```typescript
// 单独测试复杂度分析
const analyzer = new ComplexityAnalyzer();
const score = await analyzer.analyze(task);
console.log('Score breakdown:', JSON.stringify(score, null, 2));
```

#### 问题3: 会话状态丢失

**症状**: 恢复会话时找不到或数据不完整

**调试步骤**:
1. 检查sessions.json文件是否存在
2. 验证文件内容格式是否正确
3. 查看持久化日志确认是否成功保存
4. 检查文件锁是否正常释放

```bash
# 检查sessions.json
cat .claude/codex/sessions.json | jq '.'

# 查看最近的持久化日志
grep "Persisted.*sessions" .claude/codex/execution.log | tail -10
```

#### 问题4: 深度推理超时

**症状**:
```
Error: Analysis timeout after 120000ms
```

**调试步骤**:
1. 检查网络连接
2. 检查MCP服务器健康状态
3. 增加超时时间配置
4. 查看中间结果文件

```typescript
// 增加超时时间
const engine = new DeepThinkingEngine(mcpClient, outputChannel, {
  timeout: 300000  // 5分钟
});

// 查看中间结果
const intermediatePath = '.claude/codex/intermediate';
ls -la ${intermediatePath}
```

#### 问题5: 敏感文件未被保护

**症状**: 敏感文件内容未脱敏或未被拦截

**调试步骤**:
1. 检查文件是否匹配敏感模式
2. 检查内容是否匹配敏感模式
3. 验证脱敏逻辑
4. 查看安全日志

```typescript
// 测试敏感文件检测
const guard = new SecurityGuard(outputChannel);
const result = await guard.checkFileAccess('/path/to/.env');
console.log('Access result:', result);

// 测试脱敏效果
const original = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
const sanitized = guard.sanitizeContent(original, 'env');
console.log('Sanitized:', sanitized);
```

---

## 附录

### A. 配置文件示例

**完整的kfc-settings.json**:

```json
{
  "codex": {
    "defaultMode": "auto",
    "mcp": {
      "port": 8765,
      "timeout": 300000,
      "logLevel": "info"
    },
    "security": {
      "requireShellConfirmation": true,
      "allowedPaths": [
        "src/**",
        "tests/**",
        "docs/**"
      ],
      "sensitiveFilePatterns": [
        "**/.env*",
        "**/credentials.json",
        "**/.ssh/**"
      ]
    },
    "routing": {
      "complexityThreshold": 7,
      "enablePreferenceTracking": true
    },
    "deepThinking": {
      "enabled": false,
      "model": "gpt-5-codex",
      "timeout": 120000
    },
    "session": {
      "timeoutMinutes": 30,
      "cleanupIntervalMinutes": 5
    }
  }
}
```

### B. API参考

详见各组件的TypeScript类型定义：
- `src/features/codex/types.ts`
- `src/features/codex/codexOrchestrator.ts`
- `src/features/codex/taskRouter.ts`

### C. 性能优化建议

1. **会话持久化优化**
   - 使用增量更新减少I/O
   - 批量写入（防抖1秒）
   - 文件锁避免冲突

2. **MCP通信优化**
   - 复用连接
   - 启用连接池
   - 设置合理超时

3. **日志优化**
   - 批量刷新（每5秒）
   - 日志轮转（限制1000条）
   - 异步写入

4. **内存优化**
   - 按需加载组件
   - 及时释放资源
   - 限制会话数量

### D. 安全最佳实践

1. **敏感数据保护**
   - 文件名模式检测
   - 文件内容模式检测
   - 多层脱敏处理

2. **命令执行控制**
   - 危险命令分级
   - 用户确认机制
   - 审计日志记录

3. **访问控制**
   - .claudeignore支持
   - 白名单机制
   - 配置文件保护

4. **凭证管理**
   - API密钥加密存储
   - 避免硬编码
   - 使用环境变量

---

## 文档更新日志

| 版本 | 日期 | 更新内容 | 作者 |
|------|------|---------|------|
| 1.0.0 | 2025-01-18 | 初始版本，完整架构文档 | Claude |

---

## 反馈和贡献

如有任何问题或建议，请：
1. 提交GitHub Issue
2. 查阅FAQ文档
3. 联系维护团队

**祝您开发愉快！**
