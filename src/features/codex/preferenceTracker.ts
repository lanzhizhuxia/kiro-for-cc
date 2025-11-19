/**
 * 用户偏好学习机制 - Codex工作流编排系统
 *
 * 负责记录和分析用户对执行模式的选择偏好,
 * 用于优化任务路由推荐算法
 *
 * 核心功能:
 * 1. 记录用户决策 (推荐模式 vs 实际选择)
 * 2. 分析偏好模式 (按任务类型、复杂度范围)
 * 3. 建议阈值调整 (优化路由决策)
 * 4. 持久化偏好数据
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  TaskDescriptor,
  ExecutionMode,
  UserDecisionRecord,
  PreferencePattern,
  ComplexityThresholdAdjustment
} from './types';

/**
 * 默认的复杂度阈值
 * 评分 >= 7 推荐使用 Codex
 */
const DEFAULT_COMPLEXITY_THRESHOLD = 7;

/**
 * 偏好数据存储路径
 */
const PREFERENCES_FILE = 'preferences.json';

/**
 * 持久化的偏好数据结构
 */
interface PreferencesData {
  /** 决策记录列表 */
  decisions: SerializedDecisionRecord[];

  /** 最后更新时间 */
  lastUpdated: string;

  /** 数据版本 */
  version: string;
}

/**
 * 序列化的决策记录 (用于JSON存储)
 */
interface SerializedDecisionRecord {
  id: string;
  timestamp: string;
  taskType: string;
  taskDescription: string;
  recommendedMode: ExecutionMode;
  recommendedScore: number;
  chosenMode: ExecutionMode;
  acceptedRecommendation: boolean;
  context?: {
    reasons?: string[];
    confidence?: number;
  };
}

/**
 * 用户偏好追踪器类
 *
 * 提供偏好学习和分析能力
 */
export class PreferenceTracker {
  private workspaceRoot: string;
  private preferencesPath: string;
  private decisions: UserDecisionRecord[] = [];
  private outputChannel: vscode.OutputChannel;

  /**
   * 构造函数
   *
   * @param workspaceRoot 工作空间根目录
   * @param outputChannel 输出通道
   */
  constructor(
    workspaceRoot: string,
    outputChannel: vscode.OutputChannel
  ) {
    this.workspaceRoot = workspaceRoot;
    this.preferencesPath = path.join(workspaceRoot, '.claude', 'codex', PREFERENCES_FILE);
    this.outputChannel = outputChannel;
  }

  /**
   * 初始化偏好追踪器
   * 加载已有的偏好数据
   */
  async initialize(): Promise<void> {
    this.outputChannel.appendLine('[PreferenceTracker] Initializing...');

    try {
      await this._loadPreferences();
      this.outputChannel.appendLine(`[PreferenceTracker] Loaded ${this.decisions.length} decision records`);
    } catch (error) {
      this.outputChannel.appendLine(`[PreferenceTracker] Failed to load preferences: ${error}`);
      this.outputChannel.appendLine('[PreferenceTracker] Starting with empty preferences');
      this.decisions = [];
    }
  }

  /**
   * 记录用户决策
   *
   * @param task 任务描述符
   * @param recommendedMode 推荐的模式
   * @param recommendedScore 推荐时的复杂度评分
   * @param chosenMode 用户选择的模式
   * @param context 决策上下文 (推荐理由、置信度)
   */
  async recordDecision(
    task: TaskDescriptor,
    recommendedMode: ExecutionMode,
    recommendedScore: number,
    chosenMode: ExecutionMode,
    context?: { reasons?: string[]; confidence?: number }
  ): Promise<void> {
    this.outputChannel.appendLine('[PreferenceTracker] Recording decision...');
    this.outputChannel.appendLine(`  Task: ${task.type} - ${task.description.substring(0, 50)}...`);
    this.outputChannel.appendLine(`  Recommended: ${recommendedMode} (score: ${recommendedScore})`);
    this.outputChannel.appendLine(`  Chosen: ${chosenMode}`);

    // 创建决策记录
    const record: UserDecisionRecord = {
      id: this._generateRecordId(),
      timestamp: new Date(),
      task,
      recommendedMode,
      recommendedScore,
      chosenMode,
      acceptedRecommendation: recommendedMode === chosenMode,
      context
    };

    // 添加到内存
    this.decisions.push(record);

    // 持久化
    try {
      await this._savePreferences();
      this.outputChannel.appendLine(`[PreferenceTracker] Decision recorded successfully (ID: ${record.id})`);
    } catch (error) {
      this.outputChannel.appendLine(`[PreferenceTracker] Failed to save decision: ${error}`);
      throw error;
    }
  }

  /**
   * 获取偏好模式分析
   *
   * @returns 偏好模式
   */
  getPreferencePattern(): PreferencePattern {
    this.outputChannel.appendLine('[PreferenceTracker] Analyzing preference pattern...');

    // 基础统计
    const totalDecisions = this.decisions.length;
    const acceptedCount = this.decisions.filter(d => d.acceptedRecommendation).length;
    const rejectedCount = totalDecisions - acceptedCount;
    const acceptanceRate = totalDecisions > 0 ? (acceptedCount / totalDecisions) * 100 : 0;

    // 按任务类型统计
    const byTaskType: Record<string, any> = {};
    this.decisions.forEach(decision => {
      const taskType = decision.task.type;
      if (!byTaskType[taskType]) {
        byTaskType[taskType] = {
          count: 0,
          codexCount: 0,
          localCount: 0,
          preference: 'balanced'
        };
      }

      byTaskType[taskType].count++;
      if (decision.chosenMode === 'codex') {
        byTaskType[taskType].codexCount++;
      } else if (decision.chosenMode === 'local') {
        byTaskType[taskType].localCount++;
      }
    });

    // 确定每种任务类型的偏好
    Object.keys(byTaskType).forEach(taskType => {
      const stats = byTaskType[taskType];
      const codexRate = stats.codexCount / stats.count;
      if (codexRate >= 0.7) {
        stats.preference = 'codex';
      } else if (codexRate <= 0.3) {
        stats.preference = 'local';
      } else {
        stats.preference = 'balanced';
      }
    });

    // 按复杂度范围统计
    const byComplexityRange = {
      low: { codexCount: 0, localCount: 0 },
      medium: { codexCount: 0, localCount: 0 },
      high: { codexCount: 0, localCount: 0 }
    };

    this.decisions.forEach(decision => {
      const score = decision.recommendedScore;
      let range: 'low' | 'medium' | 'high';

      if (score <= 3) {
        range = 'low';
      } else if (score <= 6) {
        range = 'medium';
      } else {
        range = 'high';
      }

      if (decision.chosenMode === 'codex') {
        byComplexityRange[range].codexCount++;
      } else if (decision.chosenMode === 'local') {
        byComplexityRange[range].localCount++;
      }
    });

    // 确定整体偏好模式
    const codexChoices = this.decisions.filter(d => d.chosenMode === 'codex').length;
    const localChoices = this.decisions.filter(d => d.chosenMode === 'local').length;
    const codexRate = totalDecisions > 0 ? codexChoices / totalDecisions : 0;

    let preferredMode: 'local' | 'codex' | 'balanced';
    if (codexRate >= 0.7) {
      preferredMode = 'codex';
    } else if (codexRate <= 0.3) {
      preferredMode = 'local';
    } else {
      preferredMode = 'balanced';
    }

    const pattern: PreferencePattern = {
      totalDecisions,
      acceptedCount,
      rejectedCount,
      acceptanceRate,
      preferredMode,
      byTaskType,
      byComplexityRange,
      lastUpdated: new Date()
    };

    this.outputChannel.appendLine(`[PreferenceTracker] Pattern analysis complete:`);
    this.outputChannel.appendLine(`  Total decisions: ${totalDecisions}`);
    this.outputChannel.appendLine(`  Acceptance rate: ${acceptanceRate.toFixed(1)}%`);
    this.outputChannel.appendLine(`  Preferred mode: ${preferredMode}`);

    return pattern;
  }

  /**
   * 建议复杂度阈值调整
   *
   * 基于用户偏好分析,建议是否需要调整路由阈值
   *
   * @returns 阈值调整建议
   */
  suggestAdjustment(): ComplexityThresholdAdjustment {
    this.outputChannel.appendLine('[PreferenceTracker] Generating threshold adjustment suggestion...');

    const pattern = this.getPreferencePattern();

    // 需要至少10个决策记录才能提供可靠建议
    if (pattern.totalDecisions < 10) {
      this.outputChannel.appendLine('[PreferenceTracker] Insufficient data for adjustment (need 10+ decisions)');
      return {
        currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
        suggestedThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
        reason: '数据不足,需要至少10个决策记录才能提供可靠建议',
        confidence: 0,
        shouldApply: false
      };
    }

    // 分析高复杂度任务的选择
    const highComplexity = pattern.byComplexityRange.high;
    const highTotal = highComplexity.codexCount + highComplexity.localCount;

    // 如果用户在高复杂度任务中倾向于选择local,建议提高阈值
    if (highTotal >= 5) {
      const localRate = highComplexity.localCount / highTotal;

      if (localRate >= 0.7) {
        // 70%以上选择local -> 建议提高阈值到8或9
        const suggestedThreshold = 8;
        const confidence = Math.min(95, 60 + localRate * 30);

        this.outputChannel.appendLine('[PreferenceTracker] User prefers local mode even for high complexity tasks');
        this.outputChannel.appendLine(`  Suggesting threshold increase: ${DEFAULT_COMPLEXITY_THRESHOLD} -> ${suggestedThreshold}`);

        return {
          currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
          suggestedThreshold,
          reason: `在高复杂度任务中,您有 ${(localRate * 100).toFixed(0)}% 的情况选择本地模式。建议提高阈值以减少Codex推荐频率。`,
          confidence,
          shouldApply: true,
          impact: {
            reducedCodexRecommendations: 30
          }
        };
      }
    }

    // 分析中等复杂度任务的选择
    const mediumComplexity = pattern.byComplexityRange.medium;
    const mediumTotal = mediumComplexity.codexCount + mediumComplexity.localCount;

    // 如果用户在中等复杂度任务中经常选择codex,建议降低阈值
    if (mediumTotal >= 5) {
      const codexRate = mediumComplexity.codexCount / mediumTotal;

      if (codexRate >= 0.7) {
        // 70%以上选择codex -> 建议降低阈值到5或6
        const suggestedThreshold = 6;
        const confidence = Math.min(95, 60 + codexRate * 30);

        this.outputChannel.appendLine('[PreferenceTracker] User prefers codex mode even for medium complexity tasks');
        this.outputChannel.appendLine(`  Suggesting threshold decrease: ${DEFAULT_COMPLEXITY_THRESHOLD} -> ${suggestedThreshold}`);

        return {
          currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
          suggestedThreshold,
          reason: `在中等复杂度任务中,您有 ${(codexRate * 100).toFixed(0)}% 的情况选择Codex模式。建议降低阈值以更早推荐Codex。`,
          confidence,
          shouldApply: true,
          impact: {
            increasedCodexRecommendations: 25
          }
        };
      }
    }

    // 分析整体接受率
    if (pattern.acceptanceRate >= 80) {
      // 高接受率,当前阈值合适
      this.outputChannel.appendLine('[PreferenceTracker] High acceptance rate, current threshold is appropriate');

      return {
        currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
        suggestedThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
        reason: `您的推荐接受率为 ${pattern.acceptanceRate.toFixed(0)}%,当前阈值设置合理,无需调整。`,
        confidence: 90,
        shouldApply: false
      };
    }

    if (pattern.acceptanceRate <= 40) {
      // 低接受率,需要调整策略
      const codexRejectionRate = this.decisions.filter(
        d => d.recommendedMode === 'codex' && d.chosenMode === 'local'
      ).length / Math.max(1, this.decisions.filter(d => d.recommendedMode === 'codex').length);

      if (codexRejectionRate >= 0.6) {
        // 经常拒绝Codex推荐 -> 建议提高阈值
        this.outputChannel.appendLine('[PreferenceTracker] User frequently rejects Codex recommendations');

        return {
          currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
          suggestedThreshold: 8,
          reason: `您的推荐接受率较低 (${pattern.acceptanceRate.toFixed(0)}%),且经常拒绝Codex推荐。建议提高阈值以减少不必要的推荐。`,
          confidence: 75,
          shouldApply: true,
          impact: {
            reducedCodexRecommendations: 35
          }
        };
      }
    }

    // 默认:不建议调整
    this.outputChannel.appendLine('[PreferenceTracker] No significant adjustment needed');

    return {
      currentThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
      suggestedThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
      reason: '当前偏好模式暂无明显趋势,建议继续观察。',
      confidence: 50,
      shouldApply: false
    };
  }

  /**
   * 获取决策历史记录
   *
   * @param limit 返回的记录数量限制 (默认50)
   * @returns 决策记录列表
   */
  getDecisionHistory(limit: number = 50): UserDecisionRecord[] {
    // 按时间倒序返回
    return this.decisions
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 清除偏好数据
   * 用于重置或测试
   */
  async clearPreferences(): Promise<void> {
    this.outputChannel.appendLine('[PreferenceTracker] Clearing all preferences...');

    this.decisions = [];

    try {
      await this._savePreferences();
      this.outputChannel.appendLine('[PreferenceTracker] Preferences cleared successfully');
    } catch (error) {
      this.outputChannel.appendLine(`[PreferenceTracker] Failed to clear preferences: ${error}`);
      throw error;
    }
  }

  /**
   * 加载偏好数据
   */
  private async _loadPreferences(): Promise<void> {
    try {
      const content = await fs.readFile(this.preferencesPath, 'utf-8');
      const data: PreferencesData = JSON.parse(content);

      // 反序列化决策记录
      this.decisions = data.decisions.map(record => ({
        id: record.id,
        timestamp: new Date(record.timestamp),
        task: {
          id: record.id,
          type: record.taskType as any,
          description: record.taskDescription
        },
        recommendedMode: record.recommendedMode,
        recommendedScore: record.recommendedScore,
        chosenMode: record.chosenMode,
        acceptedRecommendation: record.acceptedRecommendation,
        context: record.context
      }));

      this.outputChannel.appendLine(`[PreferenceTracker] Loaded ${this.decisions.length} decisions from ${this.preferencesPath}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 文件不存在,返回空数组
        this.decisions = [];
        this.outputChannel.appendLine('[PreferenceTracker] Preferences file not found, starting fresh');
      } else {
        // 其他错误,抛出
        throw error;
      }
    }
  }

  /**
   * 保存偏好数据
   */
  private async _savePreferences(): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(this.preferencesPath);
    await fs.mkdir(dir, { recursive: true });

    // 序列化决策记录
    const serializedDecisions: SerializedDecisionRecord[] = this.decisions.map(record => ({
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      taskType: record.task.type,
      taskDescription: record.task.description,
      recommendedMode: record.recommendedMode,
      recommendedScore: record.recommendedScore,
      chosenMode: record.chosenMode,
      acceptedRecommendation: record.acceptedRecommendation,
      context: record.context
    }));

    const data: PreferencesData = {
      decisions: serializedDecisions,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeFile(this.preferencesPath, JSON.stringify(data, null, 2), 'utf-8');
    this.outputChannel.appendLine(`[PreferenceTracker] Saved ${this.decisions.length} decisions to ${this.preferencesPath}`);
  }

  /**
   * 生成决策记录ID
   */
  private _generateRecordId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `decision-${timestamp}-${random}`;
  }
}
