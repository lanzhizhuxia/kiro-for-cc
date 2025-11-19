/**
 * 核心类型定义 - Codex工作流编排系统
 *
 * 定义了系统中使用的所有核心接口和类型。
 */

/**
 * 执行模式枚举
 * - local: 使用本地agent执行任务
 * - codex: 使用Claude-Codex执行任务
 * - auto: 自动根据复杂度评分选择执行模式
 */
export type ExecutionMode = 'local' | 'codex' | 'auto';

/**
 * 执行阶段枚举
 * 定义任务执行的各个阶段
 */
export type ExecutionPhase =
  | 'initializing'
  | 'routing'
  | 'analyzing-codebase'
  | 'deep-thinking'
  | 'executing'
  | 'saving-results'
  | 'completed';

/**
 * 任务描述符
 * 包含任务的完整上下文信息
 */
export interface TaskDescriptor {
  /** 任务ID（唯一标识） */
  id: string;

  /** 任务类型（如：requirements, design, tasks, review） */
  type: 'requirements' | 'design' | 'tasks' | 'review' | 'implementation' | 'debug';

  /** 任务描述 */
  description: string;

  /** 关联的spec名称 */
  specName?: string;

  /** 涉及的文件路径列表 */
  relatedFiles?: string[];

  /** 任务上下文（需求文档、设计文档等） */
  context?: {
    requirements?: string;
    design?: string;
    tasks?: string;
    additionalContext?: Record<string, any>;
  };

  /** 用户提供的额外信息 */
  metadata?: Record<string, any>;
}

/**
 * 复杂度评分结构
 * 用于量化任务的复杂程度（1-10分）
 */
export interface ComplexityScore {
  /** 总分（加权计算，范围：1-10） */
  total: number;

  /** 代码规模评分（权重：30%） */
  codeScale: number;

  /** 技术难度评分（权重：40%） */
  technicalDifficulty: number;

  /** 业务影响评分（权重：30%） */
  businessImpact: number;

  /** 详细分析指标 */
  details: {
    /** 涉及的文件数量 */
    fileCount: number;

    /** 函数调用链深度 */
    functionDepth: number;

    /** 外部依赖数量 */
    externalDeps: number;

    /** 圈复杂度（McCabe复杂度） */
    cyclomaticComplexity: number;

    /** 认知复杂度 */
    cognitiveComplexity: number;

    /** 是否影响多个模块 */
    crossModuleImpact: boolean;

    /** 重构范围 */
    refactoringScope: 'none' | 'single' | 'multiple';

    /** 是否涉及AST修改 */
    involvesASTModification?: boolean;

    /** 是否涉及异步复杂度 */
    involvesAsyncComplexity?: boolean;

    /** 是否涉及新技术栈 */
    involvesNewTechnology?: boolean;

    /** 是否需要数据库迁移 */
    requiresDatabaseMigration?: boolean;

    /** 是否影响核心API */
    affectsCoreAPI?: boolean;
  };
}

/**
 * 执行结果
 * 包含任务执行的完整结果信息
 */
export interface ExecutionResult {
  /** 执行是否成功 */
  success: boolean;

  /** 使用的执行模式 */
  mode: ExecutionMode;

  /** 会话ID */
  sessionId: string;

  /** 执行开始时间 */
  startTime: Date;

  /** 执行结束时间 */
  endTime: Date;

  /** 执行耗时（毫秒） */
  duration: number;

  /** 生成的文件列表 */
  generatedFiles?: string[];

  /** 执行输出内容 */
  output?: string;

  /** 错误信息（如果失败） */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };

  /** 推理摘要（如果启用深度推理） */
  thinkingSummary?: ThinkingResult;

  /** 潜在风险提示 */
  risks?: string[];

  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 会话数据结构
 * 用于管理Codex任务的执行状态
 */
export interface Session {
  /** 会话ID（格式：codex-{timestamp}-{uuid}） */
  id: string;

  /** 关联的任务 */
  task: TaskDescriptor;

  /** 会话状态 */
  status: 'active' | 'completed' | 'failed' | 'timeout' | 'cancelled';

  /** 创建时间 */
  createdAt: Date;

  /** 最后活跃时间 */
  lastActiveAt: Date;

  /** 会话上下文信息 */
  context?: {
    /** 代码库扫描结果 */
    codebaseSnapshot?: CodebaseSnapshot;

    /** 复杂度评分 */
    complexityScore?: ComplexityScore;

    /** 执行选项 */
    options?: ExecutionOptions;
  };

  /** 检查点列表（用于恢复） */
  checkpoints?: SessionCheckpoint[];

  /** 会话元数据 */
  metadata?: Record<string, any>;
}

/**
 * 会话检查点
 * 用于保存会话的中间状态，支持恢复
 */
export interface SessionCheckpoint {
  /** 检查点ID */
  id: string;

  /** 创建时间 */
  timestamp: Date;

  /** 检查点描述 */
  description: string;

  /** 保存的状态数据 */
  state: Record<string, any>;
}

/**
 * MCP服务器状态
 */
export interface MCPServerStatus {
  /** 服务器状态 */
  status: 'stopped' | 'starting' | 'running' | 'error';

  /** 进程ID（如果正在运行） */
  pid?: number;

  /** 服务器端口 */
  port?: number;

  /** 最后健康检查时间 */
  lastHealthCheck?: Date;

  /** 健康检查失败次数 */
  healthCheckFailures: number;

  /** 健康状态 */
  isHealthy?: boolean;

  /** 错误信息（如果状态为error） */
  error?: {
    message: string;
    code?: string;
  };

  /** 启动时间 */
  startedAt?: Date;

  /** 运行时长（毫秒） */
  uptime?: number;
}

/**
 * 问题节点（树形结构）
 */
export interface ProblemNode {
  /** 节点ID */
  id: string;

  /** 问题描述 */
  description: string;

  /** 子问题 */
  subProblems: ProblemNode[];

  /** 复杂度（1-10） */
  complexity: number;
}

/**
 * 风险条目
 */
export interface Risk {
  /** 风险ID */
  id: string;

  /** 风险类别 */
  category: 'technical' | 'security' | 'performance' | 'maintainability';

  /** 严重程度 */
  severity: 'high' | 'medium' | 'low';

  /** 风险描述 */
  description: string;

  /** 缓解措施 */
  mitigation: string;
}

/**
 * 解决方案
 */
export interface Solution {
  /** 方案ID */
  id: string;

  /** 方案描述 */
  approach: string;

  /** 优点 */
  pros: string[];

  /** 缺点 */
  cons: string[];

  /** 实现复杂度（1-10） */
  complexity: number;

  /** 综合评分（1-10） */
  score: number;
}

/**
 * 决策建议
 */
export interface Decision {
  /** 选择的方案ID */
  selectedSolution: string;

  /** 决策理由 */
  rationale: string;

  /** 预计工作量 */
  estimatedEffort: string;

  /** 后续步骤 */
  nextSteps: string[];
}

/**
 * 深度推理结果（增强版）
 */
export interface ThinkingResult {
  /** 问题分解树 */
  problemDecomposition: ProblemNode[];

  /** 风险识别 */
  riskIdentification: Risk[];

  /** 方案对比 */
  solutionComparison: Solution[];

  /** 推荐决策 */
  recommendedDecision: Decision;

  /** 完整的思考链（可选） */
  thinkingChain?: Array<{
    step: number;
    thought: string;
  }>;
}

/**
 * 思考链条（Codex响应）
 */
export interface ThinkingChain {
  /** 原始响应 */
  rawResponse: string;

  /** 结构化的思考步骤 */
  steps: Array<{
    step: number;
    thought: string;
  }>;

  /** 提取的关键洞察 */
  insights: string[];
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  /** 强制指定执行模式（覆盖自动路由） */
  forceMode?: ExecutionMode;

  /** 是否启用深度推理 */
  enableDeepThinking?: boolean;

  /** 是否启用代码库扫描 */
  enableCodebaseScan?: boolean;

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 是否在后台运行 */
  runInBackground?: boolean;

  /** 自定义配置 */
  customConfig?: Record<string, any>;
}

/**
 * 模式推荐结果
 */
export interface ModeRecommendation {
  /** 推荐的执行模式 */
  mode: ExecutionMode;

  /** 复杂度评分 */
  score: number;

  /** 推荐理由列表 */
  reasons: string[];

  /** 推荐置信度（0-100） */
  confidence: number;
}

/**
 * 代码库快照
 * 代码库扫描的结果
 */
export interface CodebaseSnapshot {
  /** 扫描时间 */
  timestamp: Date;

  /** 文件列表 */
  files: string[];

  /** 依赖图 */
  dependencyGraph?: DependencyGraph;

  /** 类型定义映射 */
  typeDefinitions?: Map<string, TypeDefinition>;

  /** 函数调用链 */
  functionCallChain?: FunctionCallChain;

  /** 外部依赖列表 */
  externalDependencies?: string[];

  /** 循环依赖 */
  circularDependencies?: Array<{
    files: string[];
    description: string;
  }>;
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  /** 节点列表（文件） */
  nodes: Array<{
    id: string;
    path: string;
    type: 'source' | 'external';
  }>;

  /** 边列表（依赖关系） */
  edges: Array<{
    from: string;
    to: string;
    type: 'import' | 'require' | 'dynamic';
  }>;
}

/**
 * 类型定义
 */
export interface TypeDefinition {
  /** 类型名称 */
  name: string;

  /** 类型种类 */
  kind: 'interface' | 'type' | 'class' | 'enum';

  /** 定义位置 */
  location: {
    file: string;
    line: number;
    column: number;
  };

  /** 类型签名 */
  signature?: string;

  /** 成员列表（如果是interface或class） */
  members?: Array<{
    name: string;
    type: string;
  }>;
}

/**
 * 函数调用链
 */
export interface FunctionCallChain {
  /** 调用链条 */
  chains: Array<{
    /** 起始函数 */
    start: string;

    /** 调用路径 */
    path: string[];

    /** 调用深度 */
    depth: number;
  }>;

  /** 最大调用深度 */
  maxDepth: number;
}

/**
 * 分析上下文
 * 用于深度推理分析
 */
export interface AnalysisContext {
  /** 任务描述 */
  task: TaskDescriptor;

  /** 代码库快照（可选） */
  codebaseSnapshot?: CodebaseSnapshot;

  /** 复杂度评分（可选） */
  complexityScore?: ComplexityScore;

  /** 自定义上下文 */
  customContext?: Record<string, any>;
}

/**
 * 配置冲突
 */
export interface ConfigConflict {
  /** 冲突类型 */
  type: 'port' | 'path' | 'missing' | 'invalid';

  /** 冲突描述 */
  description: string;

  /** 建议修复方案 */
  suggestedFix?: string;

  /** 严重程度 */
  severity: 'error' | 'warning';
}

/**
 * 任务队列项
 */
export interface TaskQueueItem {
  /** 任务ID */
  id: string;

  /** 任务描述符 */
  task: TaskDescriptor;

  /** 优先级 */
  priority: 'high' | 'medium' | 'low';

  /** 入队时间 */
  enqueuedAt: Date;

  /** 状态 */
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

/**
 * 队列状态
 */
export interface QueueStatus {
  /** 队列中的任务数量 */
  queuedCount: number;

  /** 正在处理的任务数量 */
  processingCount: number;

  /** 已完成的任务数量 */
  completedCount: number;

  /** 失败的任务数量 */
  failedCount: number;

  /** 最大并发数 */
  maxConcurrency: number;
}

/**
 * AST分析指标
 */
export interface ASTMetrics {
  /** 圈复杂度 */
  cyclomaticComplexity: number;

  /** 认知复杂度 */
  cognitiveComplexity: number;

  /** 函数调用链 */
  functionCallChain: string[];

  /** 外部依赖 */
  externalDependencies: string[];

  /** 类型引用 */
  typeReferences: string[];
}

/**
 * 用户决策记录
 * 记录用户对于模式推荐的选择
 */
export interface UserDecisionRecord {
  /** 记录ID */
  id: string;

  /** 记录时间 */
  timestamp: Date;

  /** 任务描述符 */
  task: TaskDescriptor;

  /** 推荐的模式 */
  recommendedMode: ExecutionMode;

  /** 推荐时的复杂度评分 */
  recommendedScore: number;

  /** 用户选择的模式 */
  chosenMode: ExecutionMode;

  /** 是否接受推荐 */
  acceptedRecommendation: boolean;

  /** 决策上下文 */
  context?: {
    /** 推荐理由 */
    reasons?: string[];

    /** 推荐置信度 */
    confidence?: number;
  };
}

/**
 * 偏好模式
 * 分析用户的偏好趋势
 */
export interface PreferencePattern {
  /** 总决策次数 */
  totalDecisions: number;

  /** 接受推荐的次数 */
  acceptedCount: number;

  /** 拒绝推荐的次数 */
  rejectedCount: number;

  /** 接受率 (0-100) */
  acceptanceRate: number;

  /** 偏好的模式 ('local' | 'codex' | 'balanced') */
  preferredMode: 'local' | 'codex' | 'balanced';

  /** 按任务类型统计的偏好 */
  byTaskType: Record<string, {
    /** 该类型任务的决策次数 */
    count: number;

    /** 选择codex的次数 */
    codexCount: number;

    /** 选择local的次数 */
    localCount: number;

    /** 该类型的偏好模式 */
    preference: 'local' | 'codex' | 'balanced';
  }>;

  /** 按复杂度范围统计的偏好 */
  byComplexityRange: {
    /** 低复杂度 (1-3) */
    low: { codexCount: number; localCount: number };

    /** 中等复杂度 (4-6) */
    medium: { codexCount: number; localCount: number };

    /** 高复杂度 (7-10) */
    high: { codexCount: number; localCount: number };
  };

  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 复杂度阈值调整建议
 * 基于用户偏好建议调整路由阈值
 */
export interface ComplexityThresholdAdjustment {
  /** 当前阈值 */
  currentThreshold: number;

  /** 建议的新阈值 */
  suggestedThreshold: number;

  /** 调整理由 */
  reason: string;

  /** 置信度 (0-100) */
  confidence: number;

  /** 是否建议应用调整 */
  shouldApply: boolean;

  /** 影响分析 */
  impact?: {
    /** 预计减少推荐Codex的比例 */
    reducedCodexRecommendations?: number;

    /** 预计增加推荐Codex的比例 */
    increasedCodexRecommendations?: number;
  };
}
