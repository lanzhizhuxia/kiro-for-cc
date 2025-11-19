/**
 * Sam + Codex 自动化协作系统类型定义
 */

/**
 * 任务信息
 */
export interface TaskInfo {
  /** 任务编号（如 "1", "1.1", "2.3"） */
  number: string;

  /** 任务标题 */
  title: string;

  /** 任务详细描述（缩进的子项） */
  details: string[];

  /** 任务状态（是否已完成） */
  completed: boolean;

  /** 在文件中的行号范围 */
  lineRange: { start: number; end: number };

  /** 完整的任务文本（包括标题和详情） */
  fullText: string;

  /** 执行模式标签（从 tasks.md 中解析） */
  executionMode?: 'codex' | 'manual' | 'skip';
}

/**
 * 任务类型
 */
export type TaskType =
  | 'algorithm'        // 算法实现
  | 'component'        // 组件开发
  | 'api'              // API 接口
  | 'data-processing'  // 数据处理
  | 'utility'          // 工具函数
  | 'refactor'         // 重构
  | 'test'             // 测试
  | 'documentation'    // 文档
  | 'other';           // 其他

/**
 * 任务评估结果
 */
export interface TaskEvaluation {
  /** 任务信息 */
  task: TaskInfo;

  /** 复杂度评分 (0-100) */
  complexityScore: number;

  /** 任务类型 */
  type: TaskType;

  /** 是否推荐使用 Codex */
  recommendCodex: boolean;

  /** 推荐原因 */
  reason: string;

  /** 预估工作量（小时） */
  estimatedHours?: number;

  /** 置信度 (0-1) */
  confidence?: number;
}

/**
 * 批量委派选项
 */
export interface DelegationOptions {
  /** 最大并发数 */
  maxConcurrency?: number;

  /** 失败重试次数 */
  retryCount?: number;

  /** 执行超时（毫秒） */
  timeout?: number;

  /** 是否显示进度条 */
  showProgress?: boolean;
}

/**
 * 委派结果
 */
export interface DelegationResult {
  /** 任务评估信息 */
  evaluation: TaskEvaluation;

  /** Codex 执行结果 */
  executionResult: any; // 引用 CodexExecutor 的 ExecutionResult

  /** 执行时长（毫秒） */
  duration: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 验收标准
 */
export interface AcceptanceCriteria {
  /** 是否需要通过编译 */
  requiresCompilation?: boolean;

  /** 是否需要通过测试 */
  requiresTests?: boolean;

  /** 是否需要通过代码检查 */
  requiresLinting?: boolean;

  /** 自定义验证函数 */
  customValidation?: (code: string) => Promise<boolean>;
}

/**
 * 验收结果
 */
export interface AcceptanceResult {
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

/**
 * 整合策略
 */
export interface IntegrationStrategy {
  /** 整合模式：自动、手动审查、交互式 */
  mode: 'auto' | 'review' | 'interactive';

  /** 目标文件路径 */
  targetPath?: string;

  /** 是否创建备份 */
  createBackup?: boolean;

  /** 是否显示 diff */
  showDiff?: boolean;
}

/**
 * 整合结果
 */
export interface IntegrationResult {
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

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 自动化选项
 */
export interface AutomationOptions {
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

  /** 是否仅评估（不执行） */
  evaluateOnly?: boolean;
}

/**
 * 自动化报告
 */
export interface AutomationReport {
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

  /** 开始时间 */
  startTime: Date;

  /** 结束时间 */
  endTime: Date;
}
