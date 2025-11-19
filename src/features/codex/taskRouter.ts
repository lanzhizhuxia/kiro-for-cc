/**
 * 任务路由器 - Codex工作流编排系统
 *
 * 负责分析任务特征,决定使用Codex或本地agent执行
 * 路由策略:
 * 1. 用户配置的默认模式 (local/codex/auto)
 * 2. 基于复杂度评分的智能推荐 (评分≥7推荐Codex)
 * 3. 用户确认机制
 */

import * as vscode from 'vscode';
import { ComplexityAnalyzer } from './complexityAnalyzer';
import { ConfigManager } from '../../utils/configManager';
import { PreferenceTracker } from './preferenceTracker';
import {
  TaskDescriptor,
  ExecutionMode,
  ModeRecommendation,
  ComplexityScore
} from './types';

/**
 * 任务路由器类
 *
 * 提供智能任务路由决策能力,根据复杂度评分推荐最佳执行模式
 */
export class TaskRouter {
  private analyzer: ComplexityAnalyzer;
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;
  private preferenceTracker: PreferenceTracker | null = null;

  /**
   * 构造函数
   *
   * @param context VSCode扩展上下文
   * @param outputChannel 输出通道
   */
  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.analyzer = new ComplexityAnalyzer();
    this.configManager = ConfigManager.getInstance();
    this.outputChannel = outputChannel;

    // 初始化偏好追踪器
    this._initializePreferenceTracker();
  }

  /**
   * 初始化偏好追踪器
   */
  private async _initializePreferenceTracker(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.preferenceTracker = new PreferenceTracker(workspaceRoot, this.outputChannel);
        await this.preferenceTracker.initialize();
        this.outputChannel.appendLine('[TaskRouter] Preference tracker initialized successfully');
      } else {
        this.outputChannel.appendLine('[TaskRouter] No workspace folder found, preference tracking disabled');
      }
    } catch (error) {
      this.outputChannel.appendLine(`[TaskRouter] Failed to initialize preference tracker: ${error}`);
      this.preferenceTracker = null;
    }
  }

  /**
   * 路由任务到合适的执行器
   *
   * 决策流程:
   * 1. 检查用户配置的默认模式
   * 2. 如果是auto模式,基于复杂度评分决策
   * 3. 如果推荐Codex,询问用户确认
   * 4. 记录用户决策用于偏好学习
   *
   * @param task 任务描述符
   * @returns 选择的执行模式
   */
  async route(task: TaskDescriptor): Promise<ExecutionMode> {
    this.outputChannel.appendLine('[TaskRouter] Starting route decision...');
    this.outputChannel.appendLine(`[TaskRouter] Task type: ${task.type}, description: ${task.description.substring(0, 100)}...`);

    // 1. 获取用户配置的默认模式
    const defaultMode = await this._getDefaultMode();
    this.outputChannel.appendLine(`[TaskRouter] Default mode from config: ${defaultMode}`);

    // 2. 如果是固定模式(local或codex),直接返回(不记录偏好)
    if (defaultMode === 'local' || defaultMode === 'codex') {
      this.outputChannel.appendLine(`[TaskRouter] Using fixed mode: ${defaultMode}`);
      return defaultMode;
    }

    // 3. Auto模式: 基于复杂度评分决策
    this.outputChannel.appendLine('[TaskRouter] Auto mode enabled, analyzing complexity...');
    const recommendation = await this.recommend(task);

    this.outputChannel.appendLine(`[TaskRouter] Recommendation: ${recommendation.mode}, score: ${recommendation.score}, confidence: ${recommendation.confidence}`);

    let chosenMode: ExecutionMode;

    // 4. 如果推荐Codex,询问用户确认
    if (recommendation.mode === 'codex') {
      this.outputChannel.appendLine('[TaskRouter] Codex mode recommended, requesting user confirmation...');
      const confirmed = await this._confirmCodexMode(recommendation);

      if (confirmed) {
        this.outputChannel.appendLine('[TaskRouter] User confirmed Codex mode');
        chosenMode = 'codex';
      } else {
        this.outputChannel.appendLine('[TaskRouter] User declined Codex mode, falling back to local');
        chosenMode = 'local';
      }
    } else {
      // 5. 推荐本地模式
      this.outputChannel.appendLine('[TaskRouter] Using local mode (recommended)');
      chosenMode = 'local';
    }

    // 6. 记录用户决策(用于偏好学习)
    if (this.preferenceTracker) {
      try {
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
      } catch (error) {
        this.outputChannel.appendLine(`[TaskRouter] Failed to record decision: ${error}`);
        // 不抛出错误,偏好记录失败不应影响路由决策
      }
    }

    return chosenMode;
  }

  /**
   * 获取偏好追踪器实例
   * 用于外部访问偏好分析功能
   *
   * @returns 偏好追踪器实例 (如果已初始化)
   */
  getPreferenceTracker(): PreferenceTracker | null {
    return this.preferenceTracker;
  }

  /**
   * 获取推荐的执行模式 (不直接执行)
   *
   * @param task 任务描述符
   * @returns 推荐结果和理由
   */
  async recommend(task: TaskDescriptor): Promise<ModeRecommendation> {
    this.outputChannel.appendLine('[TaskRouter] Generating recommendation...');

    // 1. 分析任务复杂度
    const score = await this.analyzer.analyze(task);
    this.outputChannel.appendLine(`[TaskRouter] Complexity score: ${JSON.stringify(score, null, 2)}`);

    // 2. 基于评分决定模式 (阈值: 7分)
    const mode: ExecutionMode = score.total >= 7 ? 'codex' : 'local';

    // 3. 生成推荐理由
    const reasons = this._generateReasons(score);

    // 4. 计算推荐置信度
    const confidence = this._calculateConfidence(score);

    const recommendation: ModeRecommendation = {
      mode,
      score: score.total,
      reasons,
      confidence
    };

    this.outputChannel.appendLine(`[TaskRouter] Recommendation generated: ${JSON.stringify(recommendation, null, 2)}`);

    return recommendation;
  }

  /**
   * 获取默认执行模式 (从配置)
   *
   * @returns 默认执行模式
   */
  private async _getDefaultMode(): Promise<ExecutionMode | 'auto'> {
    try {
      const settings = await this.configManager.loadSettings();
      return settings.codex?.defaultMode || 'auto';
    } catch (error) {
      this.outputChannel.appendLine(`[TaskRouter] Failed to load config, using default 'auto': ${error}`);
      return 'auto';
    }
  }

  /**
   * 询问用户确认使用Codex模式
   *
   * 显示推荐理由和评分,提供"使用Codex"和"使用本地Agent"两个选项
   *
   * @param recommendation 推荐结果
   * @returns 用户是否确认使用Codex
   */
  private async _confirmCodexMode(
    recommendation: ModeRecommendation
  ): Promise<boolean> {
    // 构建确认消息
    const message = [
      `建议使用Codex深度分析 (复杂度评分: ${recommendation.score.toFixed(1)}/10)`,
      '',
      '推荐理由:',
      ...recommendation.reasons,
      '',
      `置信度: ${recommendation.confidence.toFixed(0)}%`
    ].join('\n');

    this.outputChannel.appendLine(`[TaskRouter] Showing confirmation dialog: ${message}`);

    // 显示确认对话框
    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      '使用Codex',
      '使用本地Agent'
    );

    const confirmed = choice === '使用Codex';
    this.outputChannel.appendLine(`[TaskRouter] User choice: ${choice} (confirmed: ${confirmed})`);

    return confirmed;
  }

  /**
   * 生成推荐理由列表
   *
   * 基于复杂度评分的各个维度生成人类可读的理由
   *
   * @param score 复杂度评分
   * @returns 推荐理由列表
   */
  private _generateReasons(score: ComplexityScore): string[] {
    const reasons: string[] = [];

    // 1. 代码规模因素 (权重30%)
    if (score.codeScale >= 7) {
      const fileCountText = score.details.fileCount > 0
        ? `涉及${score.details.fileCount}个文件`
        : '涉及大规模代码修改';
      reasons.push(`• 代码规模较大 (评分: ${score.codeScale.toFixed(1)}/10) - ${fileCountText}`);
    } else if (score.codeScale >= 5) {
      reasons.push(`• 代码规模中等 (评分: ${score.codeScale.toFixed(1)}/10)`);
    }

    // 2. 技术难度因素 (权重40%)
    if (score.technicalDifficulty >= 8) {
      const complexityFactors: string[] = [];
      if (score.details.involvesASTModification) {
        complexityFactors.push('AST修改');
      }
      if (score.details.involvesAsyncComplexity) {
        complexityFactors.push('异步/并发处理');
      }
      if (score.details.involvesNewTechnology) {
        complexityFactors.push('新技术引入');
      }
      if (score.details.requiresDatabaseMigration) {
        complexityFactors.push('数据库迁移');
      }

      const factorsText = complexityFactors.length > 0
        ? ` - 包含: ${complexityFactors.join(', ')}`
        : '';
      reasons.push(`• 技术难度很高 (评分: ${score.technicalDifficulty.toFixed(1)}/10)${factorsText}`);
    } else if (score.technicalDifficulty >= 6) {
      reasons.push(`• 技术难度较高 (评分: ${score.technicalDifficulty.toFixed(1)}/10)`);
    }

    // 3. 业务影响因素 (权重30%)
    if (score.businessImpact >= 7) {
      const impactFactors: string[] = [];
      if (score.details.crossModuleImpact) {
        impactFactors.push('跨多个模块');
      }
      if (score.details.affectsCoreAPI) {
        impactFactors.push('影响核心API');
      }

      const factorsText = impactFactors.length > 0
        ? ` - ${impactFactors.join(', ')}`
        : '';
      reasons.push(`• 业务影响范围广 (评分: ${score.businessImpact.toFixed(1)}/10)${factorsText}`);
    } else if (score.businessImpact >= 5) {
      reasons.push(`• 业务影响中等 (评分: ${score.businessImpact.toFixed(1)}/10)`);
    }

    // 4. 重构范围
    if (score.details.refactoringScope === 'multiple') {
      reasons.push('• 需要跨文件重构');
    }

    // 5. 如果没有生成任何理由,添加默认理由
    if (reasons.length === 0) {
      if (score.total >= 7) {
        reasons.push('• 任务整体复杂度较高,建议使用深度分析');
      } else {
        reasons.push('• 任务复杂度适中,本地Agent可以胜任');
      }
    }

    return reasons;
  }

  /**
   * 计算推荐置信度 (0-100)
   *
   * 置信度计算逻辑:
   * 1. 基于三个维度评分的标准差
   * 2. 标准差越小,评分越一致,置信度越高
   * 3. 标准差越大,评分越分散,置信度越低
   *
   * @param score 复杂度评分
   * @returns 置信度 (0-100)
   */
  private _calculateConfidence(score: ComplexityScore): number {
    // 1. 计算三个维度的评分数组
    const scores = [
      score.codeScale,
      score.technicalDifficulty,
      score.businessImpact
    ];

    // 2. 计算平均值
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // 3. 计算方差
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;

    // 4. 计算标准差
    const stdDev = Math.sqrt(variance);

    // 5. 将标准差转换为置信度
    // 标准差范围: 0-10 (理论上,实际通常小于5)
    // 置信度: 100 - (标准差 * 10)
    // 例如: 标准差0 -> 置信度100%, 标准差5 -> 置信度50%
    const confidence = Math.max(0, 100 - stdDev * 10);

    // 6. 如果评分明确 (总分接近边界值),提升置信度
    if (score.total >= 9 || score.total <= 2) {
      // 极端值 (+10% bonus)
      return Math.min(100, confidence + 10);
    } else if (score.total >= 8 || score.total <= 3) {
      // 较明确值 (+5% bonus)
      return Math.min(100, confidence + 5);
    }

    return Math.round(confidence);
  }
}
