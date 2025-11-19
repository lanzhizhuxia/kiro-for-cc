/**
 * 深度推理引擎 (Deep Thinking Engine)
 *
 * 职责:
 * 1. 与Codex MCP服务器通信，触发sequential thinking模式
 * 2. 执行深度分析：问题分解、风险识别、方案对比、决策建议
 * 3. 解析Codex响应，结构化推理结果
 * 4. 处理超时和错误情况
 *
 * 核心能力:
 * - 问题分解：将复杂任务拆解为子问题树
 * - 风险识别：识别技术、安全、性能、可维护性风险
 * - 方案对比：评估多个解决方案的优劣
 * - 决策建议：基于分析给出推荐决策
 *
 * 需求: 需求4.1-4.6
 */

import * as vscode from 'vscode';
import { MCPClient, CodexToolParams } from './mcpClient';
import {
  AnalysisContext,
  ThinkingResult,
  ThinkingChain,
  ProblemNode,
  Risk,
  Solution,
  Decision
} from './types';
import { DeepThinkingPrompts, PromptScenario } from './prompts/deepThinkingPrompts';
import { ExecutionLogger } from './executionLogger';

/**
 * 分析进度信息
 */
export interface AnalysisProgress {
  /** 当前阶段 */
  phase: 'initializing' | 'analyzing' | 'parsing' | 'completed';

  /** 进度消息 */
  message: string;

  /** 进度百分比 (0-100) */
  percentage: number;

  /** 已用时间（毫秒） */
  elapsedTime: number;
}

/**
 * 深度推理引擎配置
 */
export interface DeepThinkingConfig {
  /** Codex模型名称 */
  model?: string;

  /** 沙箱模式 */
  sandbox?: string;

  /** 审批策略 */
  approvalPolicy?: string;

  /** 超时时间（毫秒），默认120000 (2分钟) */
  timeout?: number;

  /** 是否启用详细日志 */
  verbose?: boolean;

  /** 进度回调函数 */
  onProgress?: (progress: AnalysisProgress) => void;

  /** 取消回调函数 */
  onCancel?: () => void;
}

/**
 * 深度推理引擎
 *
 * 使用Claude Codex的sequential thinking能力进行深度分析
 *
 * @example
 * ```typescript
 * const engine = new DeepThinkingEngine(mcpClient, outputChannel, {
 *   model: 'gpt-5-codex',
 *   timeout: 120000
 * });
 *
 * const result = await engine.analyze({
 *   task: taskDescriptor,
 *   complexityScore: score,
 *   codebaseSnapshot: snapshot
 * });
 * ```
 */
export class DeepThinkingEngine {
  /** 默认配置 */
  private static readonly DEFAULT_CONFIG: Omit<Required<DeepThinkingConfig>, 'onProgress' | 'onCancel'> = {
    model: 'gpt-5-codex',
    sandbox: 'danger-full-access',
    approvalPolicy: 'on-failure',
    timeout: 120000, // 2分钟
    verbose: true
  };

  /** 合并后的配置 */
  private config: DeepThinkingConfig;

  /** 取消标志 */
  private cancelled: boolean = false;

  /** 分析开始时间 */
  private startTime: number = 0;

  /** 执行日志记录器（可选） */
  private logger?: ExecutionLogger;

  /**
   * 构造函数
   *
   * @param mcpClient MCP客户端实例
   * @param outputChannel VSCode输出通道
   * @param config 深度推理配置（可选）
   * @param logger 执行日志记录器（可选）
   */
  constructor(
    private mcpClient: MCPClient,
    private outputChannel: vscode.OutputChannel,
    config?: DeepThinkingConfig,
    logger?: ExecutionLogger
  ) {
    this.config = { ...DeepThinkingEngine.DEFAULT_CONFIG, ...config };
    this.logger = logger;
    this.outputChannel.appendLine('[DeepThinkingEngine] Engine initialized');
  }

  /**
   * 执行深度分析（主入口）
   *
   * 完整流程：
   * 1. 构建深度推理prompt
   * 2. 调用Codex sequential thinking API
   * 3. 解析推理链
   * 4. 结构化分析结果
   *
   * @param context 分析上下文
   * @returns 深度推理结果
   * @throws 如果分析失败或超时
   */
  async analyze(context: AnalysisContext): Promise<ThinkingResult> {
    this.outputChannel.appendLine('[DeepThinkingEngine] Starting deep analysis...');
    this.outputChannel.appendLine(`[DeepThinkingEngine] Task: ${context.task.id} - ${context.task.description.substring(0, 100)}`);

    // 重置状态
    this.cancelled = false;
    this.startTime = Date.now();

    // 记录分析开始
    if (this.logger) {
      this.logger.logThinkingStep('Deep analysis started', {
        taskId: context.task.id,
        taskType: context.task.type,
        complexity: context.complexityScore?.total
      });
    }

    try {
      // 报告初始化阶段
      this._reportProgress('initializing', '正在初始化深度推理引擎...', 0);

      // 1. 构建深度推理prompt
      const prompt = this._buildDeepThinkingPrompt(context);

      if (this.config.verbose) {
        this.outputChannel.appendLine('[DeepThinkingEngine] Prompt generated:');
        this.outputChannel.appendLine(prompt.substring(0, 500) + '...');
      }

      if (this.logger) {
        this.logger.logThinkingStep('Prompt generation', {
          promptLength: prompt.length,
          scenario: this._getScenario(context.task.type)
        });
      }

      // 检查是否被取消
      if (this.cancelled) {
        throw new Error('Analysis cancelled by user');
      }

      // 报告分析阶段
      this._reportProgress('analyzing', '正在执行深度分析...', 30);

      // 2. 调用Codex sequential thinking API（带超时）
      const timeout = this.config.timeout || DeepThinkingEngine.DEFAULT_CONFIG.timeout;
      const thinkingChain = await this._callWithTimeout(
        () => this._callSequentialThinkingAPI(prompt),
        timeout
      );

      if (this.config.verbose) {
        this.outputChannel.appendLine(`[DeepThinkingEngine] Received thinking chain with ${thinkingChain.steps.length} steps`);
      }

      if (this.logger) {
        this.logger.logThinkingStep('Sequential thinking completed', {
          stepsCount: thinkingChain.steps.length,
          insightsCount: thinkingChain.insights.length
        });
      }

      // 检查是否被取消
      if (this.cancelled) {
        throw new Error('Analysis cancelled by user');
      }

      // 报告解析阶段
      this._reportProgress('parsing', '正在解析推理结果...', 70);

      // 3. 解析推理链为结构化结果
      const result = this._parseThinkingChain(thinkingChain, context);

      const duration = Date.now() - this.startTime;
      this.outputChannel.appendLine(`[DeepThinkingEngine] Analysis completed in ${duration}ms`);
      this.outputChannel.appendLine(`[DeepThinkingEngine] Found ${result.problemDecomposition.length} problem nodes`);
      this.outputChannel.appendLine(`[DeepThinkingEngine] Identified ${result.riskIdentification.length} risks`);
      this.outputChannel.appendLine(`[DeepThinkingEngine] Compared ${result.solutionComparison.length} solutions`);

      if (this.logger) {
        this.logger.logThinkingStep('Analysis result parsed', {
          duration,
          problemsCount: result.problemDecomposition.length,
          risksCount: result.riskIdentification.length,
          solutionsCount: result.solutionComparison.length
        });
      }

      // 报告完成
      this._reportProgress('completed', '深度分析完成', 100);

      return result;

    } catch (error) {
      const duration = Date.now() - this.startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.outputChannel.appendLine(`[DeepThinkingEngine] Analysis failed after ${duration}ms: ${errorMessage}`);

      if (this.logger) {
        this.logger.logError(
          error instanceof Error ? error : new Error(String(error)),
          'Deep analysis'
        );
      }

      // 处理取消
      if (this.cancelled) {
        await this._saveIntermediateResult(context);
        throw new Error('Analysis cancelled by user');
      }

      // 处理超时
      if (errorMessage.includes('timeout')) {
        await this._saveIntermediateResult(context);
        throw new Error(`Analysis timeout after ${this.config.timeout || DeepThinkingEngine.DEFAULT_CONFIG.timeout}ms`);
      }

      throw new Error(`Deep thinking analysis failed: ${errorMessage}`);
    }
  }

  /**
   * 调用Sequential Thinking API
   *
   * 使用MCP客户端调用Codex进行深度推理
   * 包含超时处理和重试逻辑
   *
   * @param prompt 深度推理prompt
   * @returns 思考链条
   * @throws 如果API调用失败或超时
   */
  private async _callSequentialThinkingAPI(prompt: string): Promise<ThinkingChain> {
    this.outputChannel.appendLine('[DeepThinkingEngine] Calling Codex sequential thinking API...');

    // 确保MCP客户端已连接
    if (!this.mcpClient.isConnected()) {
      this.outputChannel.appendLine('[DeepThinkingEngine] MCP client not connected, attempting to connect...');
      await this.mcpClient.connect();
    }

    try {
      // 构建Codex工具参数
      const params: CodexToolParams = {
        model: this.config.model,
        sandbox: this.config.sandbox,
        'approval-policy': this.config.approvalPolicy,
        prompt
      };

      // 调用Codex工具（带超时）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sequential thinking API timeout')), this.config.timeout);
      });

      const apiCallPromise = this.mcpClient.callCodex(params);

      const { result } = await Promise.race([apiCallPromise, timeoutPromise]);

      // 提取响应文本
      const responseText = result.content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text)
        .join('\n\n');

      if (!responseText) {
        throw new Error('Empty response from Codex');
      }

      // 解析为思考链条
      const thinkingChain: ThinkingChain = {
        rawResponse: responseText,
        steps: this._extractThinkingSteps(responseText),
        insights: this._extractInsights(responseText)
      };

      return thinkingChain;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[DeepThinkingEngine] API call failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 解析思考链为结构化结果
   *
   * 从Codex响应中提取：
   * - 问题分解树
   * - 风险识别
   * - 方案对比
   * - 决策建议
   *
   * @param thinkingChain 思考链条
   * @param context 分析上下文
   * @returns 结构化的推理结果
   */
  private _parseThinkingChain(thinkingChain: ThinkingChain, context: AnalysisContext): ThinkingResult {
    this.outputChannel.appendLine('[DeepThinkingEngine] Parsing thinking chain...');

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

  /**
   * 构建深度推理prompt
   *
   * 使用精心设计的prompt触发sequential thinking模式
   * 使用新的提示词工程系统根据任务类型选择合适的模板
   *
   * @param context 分析上下文
   * @returns 深度推理prompt
   */
  private _buildDeepThinkingPrompt(context: AnalysisContext): string {
    const { task } = context;

    // 根据任务类型选择合适的提示词场景
    let scenario: PromptScenario;

    switch (task.type) {
      case 'design':
        scenario = PromptScenario.DESIGN_REVIEW;
        break;
      case 'requirements':
        scenario = PromptScenario.REQUIREMENTS_ANALYSIS;
        break;
      case 'review':
        // 如果是review任务，根据上下文判断具体场景
        if (task.context?.design) {
          scenario = PromptScenario.ARCHITECTURE_REVIEW;
        } else {
          scenario = PromptScenario.DESIGN_REVIEW;
        }
        break;
      case 'implementation':
        // 如果涉及重构，使用重构场景
        if (task.description.toLowerCase().includes('refactor')) {
          scenario = PromptScenario.CODE_REFACTORING;
        } else {
          scenario = PromptScenario.DESIGN_REVIEW;
        }
        break;
      case 'debug':
        scenario = PromptScenario.CODE_REFACTORING;
        break;
      default:
        // 默认使用设计review场景
        scenario = PromptScenario.DESIGN_REVIEW;
    }

    // 使用提示词工程系统生成prompt
    const prompt = DeepThinkingPrompts.generatePrompt(scenario, context);

    this.outputChannel.appendLine(`[DeepThinkingEngine] Selected scenario: ${scenario}`);

    return prompt;
  }

  /**
   * 从响应中提取思考步骤
   *
   * @param response Codex响应文本
   * @returns 结构化的思考步骤
   */
  private _extractThinkingSteps(response: string): Array<{ step: number; thought: string }> {
    const steps: Array<{ step: number; thought: string }> = [];

    // 尝试匹配编号的思考步骤（例如：1. xxx, Step 1: xxx）
    const stepPatterns = [
      /^\s*(\d+)\.\s+(.+)$/gm,
      /^Step\s+(\d+):\s+(.+)$/gmi,
      /^思考步骤\s*(\d+):\s*(.+)$/gm
    ];

    for (const pattern of stepPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        steps.push({
          step: parseInt(match[1], 10),
          thought: match[2].trim()
        });
      }

      if (steps.length > 0) {
        break;
      }
    }

    // 如果没有找到明确的步骤，将段落作为步骤
    if (steps.length === 0) {
      const paragraphs = response.split(/\n\n+/).filter(p => p.trim().length > 50);
      paragraphs.forEach((paragraph, index) => {
        steps.push({
          step: index + 1,
          thought: paragraph.trim()
        });
      });
    }

    return steps;
  }

  /**
   * 从响应中提取关键洞察
   *
   * @param response Codex响应文本
   * @returns 关键洞察列表
   */
  private _extractInsights(response: string): string[] {
    const insights: string[] = [];

    // 查找关键词标记的洞察
    const insightPatterns = [
      /(?:Key Insight|关键洞察|Important|重要):\s*(.+?)(?:\n|$)/gi,
      /(?:Conclusion|结论):\s*(.+?)(?:\n|$)/gi,
      /(?:Recommendation|建议):\s*(.+?)(?:\n|$)/gi
    ];

    for (const pattern of insightPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        insights.push(match[1].trim());
      }
    }

    return insights;
  }

  /**
   * 提取问题分解
   *
   * @param response Codex响应文本
   * @param context 分析上下文
   * @returns 问题节点树
   */
  private _extractProblemDecomposition(response: string, context: AnalysisContext): ProblemNode[] {
    const problems: ProblemNode[] = [];

    // 查找"Problem Decomposition"或"问题分解"部分
    const sectionMatch = response.match(/#+\s*(?:1\.\s*)?Problem Decomposition[\s\S]*?(?=#+\s*(?:\d+\.\s*)?[A-Z]|$)/i);

    if (!sectionMatch) {
      // 如果没有找到专门的部分，创建一个基础的问题节点
      return [{
        id: 'P1',
        description: context.task.description,
        subProblems: [],
        complexity: context.complexityScore?.total || 5
      }];
    }

    const section = sectionMatch[0];

    // 提取问题项（支持多种格式）
    const problemPattern = /(?:^|\n)\s*[-*]?\s*(?:\*\*)?(?:ID|P\d+)(?:\*\*)?:?\s*(.+?)(?:\n|$)/gm;
    let match;
    let currentNode: ProblemNode | null = null;

    while ((match = problemPattern.exec(section)) !== null) {
      const text = match[1].trim();
      const complexity = this._extractComplexity(text) || 5;

      const node: ProblemNode = {
        id: `P${problems.length + 1}`,
        description: text.replace(/\*\*Complexity\*\*:\s*\d+/gi, '').trim(),
        subProblems: [],
        complexity
      };

      problems.push(node);
      currentNode = node;
    }

    // 如果没有提取到问题，创建默认节点
    if (problems.length === 0) {
      problems.push({
        id: 'P1',
        description: context.task.description,
        subProblems: [],
        complexity: context.complexityScore?.total || 5
      });
    }

    return problems;
  }

  /**
   * 提取风险
   *
   * @param response Codex响应文本
   * @param context 分析上下文
   * @returns 风险列表
   */
  private _extractRisks(response: string, context: AnalysisContext): Risk[] {
    const risks: Risk[] = [];

    // 查找"Risk Identification"或"风险识别"部分
    const sectionMatch = response.match(/#+\s*(?:\d+\.\s*)?Risk Identification[\s\S]*?(?=#+\s*(?:\d+\.\s*)?[A-Z]|$)/i);

    if (!sectionMatch) {
      // 创建默认风险（基于复杂度）
      if (context.complexityScore && context.complexityScore.total >= 7) {
        risks.push({
          id: 'R1',
          category: 'technical',
          severity: 'high',
          description: '任务复杂度较高，可能存在实现风险',
          mitigation: '进行详细的技术方案设计和评审'
        });
      }
      return risks;
    }

    const section = sectionMatch[0];

    // 提取风险项
    const riskPattern = /(?:^|\n)\s*[-*]?\s*(?:\*\*)?(?:ID|R\d+)(?:\*\*)?:?\s*(.+?)(?:\n|$)/gm;
    let match;

    while ((match = riskPattern.exec(section)) !== null) {
      const text = match[1].trim();

      risks.push({
        id: `R${risks.length + 1}`,
        category: this._extractRiskCategory(text),
        severity: this._extractSeverity(text),
        description: text,
        mitigation: this._extractMitigation(text) || '待定'
      });
    }

    return risks;
  }

  /**
   * 提取解决方案
   *
   * @param response Codex响应文本
   * @param context 分析上下文
   * @returns 解决方案列表
   */
  private _extractSolutions(response: string, context: AnalysisContext): Solution[] {
    const solutions: Solution[] = [];

    // 查找"Solution Comparison"或"方案对比"部分
    const sectionMatch = response.match(/#+\s*(?:\d+\.\s*)?Solution Comparison[\s\S]*?(?=#+\s*(?:\d+\.\s*)?[A-Z]|$)/i);

    if (!sectionMatch) {
      // 创建默认方案
      solutions.push({
        id: 'S1',
        approach: '标准实现方案',
        pros: ['遵循现有架构', '风险可控'],
        cons: ['可能不是最优解'],
        complexity: context.complexityScore?.total || 5,
        score: 7
      });
      return solutions;
    }

    const section = sectionMatch[0];

    // 提取方案项
    const solutionPattern = /(?:^|\n)\s*[-*]?\s*(?:\*\*)?(?:ID|S\d+|Solution\s+\d+)(?:\*\*)?:?\s*(.+?)(?:\n|$)/gm;
    let match;

    while ((match = solutionPattern.exec(section)) !== null) {
      const text = match[1].trim();

      solutions.push({
        id: `S${solutions.length + 1}`,
        approach: text,
        pros: this._extractListItems(text, 'pros') || ['待评估'],
        cons: this._extractListItems(text, 'cons') || ['待评估'],
        complexity: this._extractComplexity(text) || 5,
        score: this._extractScore(text) || 7
      });
    }

    // 如果没有提取到方案，创建默认方案
    if (solutions.length === 0) {
      solutions.push({
        id: 'S1',
        approach: '推荐方案',
        pros: ['基于现有分析'],
        cons: ['需要进一步细化'],
        complexity: context.complexityScore?.total || 5,
        score: 7
      });
    }

    return solutions;
  }

  /**
   * 提取决策建议
   *
   * @param response Codex响应文本
   * @param solutions 解决方案列表
   * @returns 决策建议
   */
  private _extractDecision(response: string, solutions: Solution[]): Decision {
    // 查找"Recommended Decision"或"推荐决策"部分
    const sectionMatch = response.match(/#+\s*(?:\d+\.\s*)?Recommended Decision[\s\S]*?(?=#+|$)/i);

    let selectedSolution = solutions.length > 0 ? solutions[0].id : 'S1';
    let rationale = '基于综合分析的推荐';
    let estimatedEffort = '待评估';
    const nextSteps: string[] = [];

    if (sectionMatch) {
      const section = sectionMatch[0];

      // 提取选择的方案
      const solutionMatch = section.match(/(?:Selected Solution|选择方案):\s*(.+?)(?:\n|$)/i);
      if (solutionMatch) {
        selectedSolution = solutionMatch[1].trim();
      }

      // 提取理由
      const rationaleMatch = section.match(/(?:Rationale|理由):\s*([\s\S]+?)(?=\n\*\*|$)/i);
      if (rationaleMatch) {
        rationale = rationaleMatch[1].trim();
      }

      // 提取工作量估计
      const effortMatch = section.match(/(?:Estimated Effort|预计工作量):\s*(.+?)(?:\n|$)/i);
      if (effortMatch) {
        estimatedEffort = effortMatch[1].trim();
      }

      // 提取后续步骤
      const stepsMatch = section.match(/(?:Next Steps|后续步骤):?\s*([\s\S]+?)(?=\n#+|$)/i);
      if (stepsMatch) {
        const stepsText = stepsMatch[1];
        const stepItems = stepsText.match(/(?:^|\n)\s*[-*]\s*(.+?)(?:\n|$)/gm);
        if (stepItems) {
          stepItems.forEach(item => {
            nextSteps.push(item.replace(/^\s*[-*]\s*/, '').trim());
          });
        }
      }
    }

    // 如果没有提取到后续步骤，添加默认步骤
    if (nextSteps.length === 0) {
      nextSteps.push('详细设计方案');
      nextSteps.push('实施开发');
      nextSteps.push('测试验证');
    }

    return {
      selectedSolution,
      rationale,
      estimatedEffort,
      nextSteps
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 从文本中提取复杂度分数
   */
  private _extractComplexity(text: string): number | null {
    const match = text.match(/(?:complexity|复杂度):\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * 从文本中提取评分
   */
  private _extractScore(text: string): number | null {
    const match = text.match(/(?:score|评分):\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * 从文本中提取风险类别
   */
  private _extractRiskCategory(text: string): Risk['category'] {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('security') || lowerText.includes('安全')) {
      return 'security';
    }
    if (lowerText.includes('performance') || lowerText.includes('性能')) {
      return 'performance';
    }
    if (lowerText.includes('maintainability') || lowerText.includes('可维护')) {
      return 'maintainability';
    }
    return 'technical';
  }

  /**
   * 从文本中提取严重程度
   */
  private _extractSeverity(text: string): Risk['severity'] {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('high') || lowerText.includes('严重') || lowerText.includes('高')) {
      return 'high';
    }
    if (lowerText.includes('low') || lowerText.includes('低')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * 从文本中提取缓解措施
   */
  private _extractMitigation(text: string): string | null {
    const match = text.match(/(?:mitigation|缓解措施):\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : null;
  }

  /**
   * 从文本中提取列表项（pros/cons）
   */
  private _extractListItems(text: string, type: 'pros' | 'cons'): string[] | null {
    const keyword = type === 'pros' ? '(?:pros|优点|优势)' : '(?:cons|缺点|劣势)';
    const match = text.match(new RegExp(`${keyword}:?\\s*([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'));

    if (!match) {
      return null;
    }

    const listText = match[1];
    const items = listText.match(/(?:^|\n)\s*[-*]\s*(.+?)(?:\n|$)/gm);

    if (!items) {
      return null;
    }

    return items.map(item => item.replace(/^\s*[-*]\s*/, '').trim());
  }

  // ==================== 超时和取消控制 ====================

  /**
   * 取消分析
   *
   * 设置取消标志，当前分析将在下一个检查点停止
   */
  cancel(): void {
    this.cancelled = true;
    this.outputChannel.appendLine('[DeepThinkingEngine] Analysis cancelled');
    if (this.config.onCancel) {
      this.config.onCancel();
    }
  }

  /**
   * 检查是否被取消
   *
   * @returns 是否已被取消
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * 报告进度
   *
   * @param phase 当前阶段
   * @param message 进度消息
   * @param percentage 进度百分比 (0-100)
   */
  private _reportProgress(
    phase: AnalysisProgress['phase'],
    message: string,
    percentage: number
  ): void {
    const progress: AnalysisProgress = {
      phase,
      message,
      percentage,
      elapsedTime: Date.now() - this.startTime
    };

    this.outputChannel.appendLine(
      `[DeepThinkingEngine] Progress: ${phase} (${percentage}%) - ${message}`
    );

    if (this.config.onProgress) {
      this.config.onProgress(progress);
    }
  }

  /**
   * 带超时的调用
   *
   * 使用 Promise.race 实现超时控制
   *
   * @param fn 要执行的异步函数
   * @param timeout 超时时间（毫秒）
   * @returns 执行结果
   * @throws 如果超时则抛出错误
   */
  private async _callWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
    ]);
  }

  /**
   * 保存中间结果
   *
   * 当分析被取消或超时时，保存当前进度和上下文信息
   *
   * @param context 分析上下文
   */
  private async _saveIntermediateResult(context: AnalysisContext): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const vscode = await import('vscode');

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const intermediatePath = path.join(
        workspaceRoot,
        '.claude/codex/intermediate',
        `${context.task.id || Date.now()}.json`
      );

      const intermediateData = {
        timestamp: new Date().toISOString(),
        task: context.task,
        elapsedTime: Date.now() - this.startTime,
        reason: this.cancelled ? 'cancelled' : 'timeout'
      };

      await fs.promises.mkdir(path.dirname(intermediatePath), { recursive: true });
      await fs.promises.writeFile(
        intermediatePath,
        JSON.stringify(intermediateData, null, 2)
      );

      this.outputChannel.appendLine(
        `[DeepThinkingEngine] Intermediate result saved: ${intermediatePath}`
      );
    } catch (error) {
      this.outputChannel.appendLine(
        `[DeepThinkingEngine] Failed to save intermediate result: ${error}`
      );
    }
  }

  /**
   * 根据任务类型获取场景
   *
   * @param taskType 任务类型
   * @returns 提示词场景
   */
  private _getScenario(taskType: string): string {
    switch (taskType) {
      case 'design':
        return 'DESIGN_REVIEW';
      case 'requirements':
        return 'REQUIREMENTS_ANALYSIS';
      case 'review':
        return 'ARCHITECTURE_REVIEW';
      case 'implementation':
        return 'CODE_REFACTORING';
      case 'debug':
        return 'CODE_REFACTORING';
      default:
        return 'DESIGN_REVIEW';
    }
  }
}
