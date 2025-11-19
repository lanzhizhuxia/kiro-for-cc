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

