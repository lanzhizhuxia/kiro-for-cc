/**
 * 推理反馈收集器 (Task 31 完整实现)
 *
 * 职责:
 * 1. 收集用户对深度分析的反馈（有用/无用/建议）
 * 2. 存储反馈数据到持久化文件
 * 3. 生成反馈统计报告
 * 4. 分析常见问题和改进方向
 * 5. 支持按时间、场景过滤统计
 *
 * 需求: 需求4.4
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 反馈条目
 */
export interface FeedbackEntry {
  /** 反馈ID */
  id: string;

  /** 会话ID */
  sessionId: string;

  /** 反馈时间 */
  timestamp: string;

  /** 反馈类型 */
  type: 'useful' | 'not-useful' | 'suggestion';

  /** 评分（1-5星，可选） */
  rating?: number;

  /** 用户评论（可选） */
  comment?: string;

  /** 分析上下文 */
  analysisContext: {
    /** 使用场景 */
    scenario: string;

    /** 任务类型 */
    taskType: string;

    /** 执行时间（毫秒） */
    executionTime: number;
  };
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  /** 总反馈数 */
  totalFeedback: number;

  /** 有用反馈数 */
  usefulCount: number;

  /** 无用反馈数 */
  notUsefulCount: number;

  /** 建议反馈数 */
  suggestionCount: number;

  /** 平均评分 */
  averageRating: number;

  /** 常见问题列表 */
  commonIssues: string[];
}

/**
 * 反馈收集器
 *
 * 用于收集和分析用户对深度推理的反馈
 */
export class FeedbackCollector {
  /** 反馈文件路径 */
  private feedbackPath: string;

  /** 反馈数据（内存缓存） */
  private feedback: FeedbackEntry[] = [];

  /** 是否已初始化 */
  private initialized: boolean = false;

  /**
   * 构造函数
   *
   * @param workspaceRoot 工作区根路径
   * @param outputChannel 输出通道
   */
  constructor(
    private workspaceRoot: string,
    private outputChannel: vscode.OutputChannel
  ) {
    this.feedbackPath = path.join(
      workspaceRoot,
      '.claude/codex/feedback.json'
    );

    this.outputChannel.appendLine('[FeedbackCollector] Feedback collector created');
  }

  /**
   * 初始化（加载已有反馈）
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.outputChannel.appendLine('[FeedbackCollector] Initializing...');

    try {
      // 确保目录存在
      await fs.promises.mkdir(path.dirname(this.feedbackPath), { recursive: true });

      // 尝试加载已有反馈
      if (fs.existsSync(this.feedbackPath)) {
        const content = await fs.promises.readFile(this.feedbackPath, 'utf-8');
        this.feedback = JSON.parse(content);
        this.outputChannel.appendLine(`[FeedbackCollector] Loaded ${this.feedback.length} feedback entries`);
      } else {
        this.feedback = [];
        this.outputChannel.appendLine('[FeedbackCollector] No existing feedback found, starting fresh');
      }

      this.initialized = true;
      this.outputChannel.appendLine('[FeedbackCollector] Initialization completed');

    } catch (error) {
      this.outputChannel.appendLine(`[FeedbackCollector] Failed to initialize: ${error}`);
      // 即使失败也继续，使用空数组
      this.feedback = [];
      this.initialized = true;
    }
  }

  /**
   * 收集反馈
   *
   * @param sessionId 会话ID
   * @param type 反馈类型
   * @param context 分析上下文
   * @param options 可选参数（评分、评论）
   */
  async collectFeedback(
    sessionId: string,
    type: 'useful' | 'not-useful' | 'suggestion',
    context: {
      scenario: string;
      taskType: string;
      executionTime: number;
    },
    options?: {
      rating?: number;
      comment?: string;
    }
  ): Promise<void> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }

    this.outputChannel.appendLine(`[FeedbackCollector] Collecting ${type} feedback for session ${sessionId}`);

    // 创建反馈条目
    const entry: FeedbackEntry = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      timestamp: new Date().toISOString(),
      type,
      rating: options?.rating,
      comment: options?.comment,
      analysisContext: {
        scenario: context.scenario || 'unknown',
        taskType: context.taskType || 'unknown',
        executionTime: context.executionTime || 0
      }
    };

    // 添加到内存缓存
    this.feedback.push(entry);

    // 持久化到文件
    await this._saveFeedback();

    this.outputChannel.appendLine(`[FeedbackCollector] Feedback collected: ${entry.id}`);
  }

  /**
   * 获取反馈统计
   *
   * @param filter 过滤条件
   * @returns 反馈统计
   */
  getStats(filter?: {
    startDate?: Date;
    endDate?: Date;
    scenario?: string;
  }): FeedbackStats {
    // 确保已初始化
    if (!this.initialized) {
      throw new Error('FeedbackCollector not initialized. Call initialize() first.');
    }

    let filtered = this.feedback;

    // 应用过滤器
    if (filter) {
      if (filter.startDate) {
        filtered = filtered.filter(
          f => new Date(f.timestamp) >= filter.startDate!
        );
      }
      if (filter.endDate) {
        filtered = filtered.filter(
          f => new Date(f.timestamp) <= filter.endDate!
        );
      }
      if (filter.scenario) {
        filtered = filtered.filter(
          f => f.analysisContext.scenario === filter.scenario
        );
      }
    }

    // 统计各类型数量
    const usefulCount = filtered.filter(f => f.type === 'useful').length;
    const notUsefulCount = filtered.filter(f => f.type === 'not-useful').length;
    const suggestionCount = filtered.filter(f => f.type === 'suggestion').length;

    // 计算平均评分
    const ratingsWithScores = filtered.filter(f => f.rating !== undefined);
    const averageRating = ratingsWithScores.length > 0
      ? ratingsWithScores.reduce((sum, f) => sum + (f.rating || 0), 0) / ratingsWithScores.length
      : 0;

    return {
      totalFeedback: filtered.length,
      usefulCount,
      notUsefulCount,
      suggestionCount,
      averageRating: Math.round(averageRating * 10) / 10,
      commonIssues: this.analyzeCommonIssues()
    };
  }

  /**
   * 生成反馈报告
   *
   * @param outputPath 报告输出路径
   */
  async generateReport(outputPath: string): Promise<void> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }

    this.outputChannel.appendLine('[FeedbackCollector] Generating feedback report...');

    const stats = this.getStats();

    const report = `# Codex 深度分析反馈报告

生成时间: ${new Date().toISOString()}

## 总体统计

- 总反馈数: ${stats.totalFeedback}
- 有用: ${stats.usefulCount} (${this._percentage(stats.usefulCount, stats.totalFeedback)}%)
- 无用: ${stats.notUsefulCount} (${this._percentage(stats.notUsefulCount, stats.totalFeedback)}%)
- 建议: ${stats.suggestionCount} (${this._percentage(stats.suggestionCount, stats.totalFeedback)}%)
- 平均评分: ${stats.averageRating}/5.0

## 常见问题

${stats.commonIssues.length > 0
      ? stats.commonIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
      : '暂无明显的常见问题'
    }

## 近期反馈详情

${this._generateRecentFeedbackTable()}

## 场景分析

${this._generateScenarioAnalysis()}
`;

    // 确保输出目录存在
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // 写入报告
    await fs.promises.writeFile(outputPath, report);

    this.outputChannel.appendLine(`[FeedbackCollector] Report generated: ${outputPath}`);
  }

  /**
   * 分析常见问题
   *
   * 通过关键词频率分析提取常见问题
   *
   * @returns 常见问题列表
   */
  analyzeCommonIssues(): string[] {
    // 提取所有not-useful和suggestion的评论
    const negativeComments = this.feedback
      .filter(f =>
        (f.type === 'not-useful' || f.type === 'suggestion') &&
        f.comment
      )
      .map(f => f.comment!.toLowerCase());

    if (negativeComments.length === 0) {
      return [];
    }

    // 简单的关键词频率分析
    const keywords = [
      'slow', 'timeout', 'error', 'incorrect', 'missing',
      'incomplete', 'unclear', 'confusing', 'too long',
      'not relevant', 'hallucination', 'inaccurate',
      '慢', '超时', '错误', '不准确', '缺失',
      '不完整', '不清楚', '混乱', '太长', '不相关'
    ];

    const keywordFrequency: Record<string, number> = {};

    for (const comment of negativeComments) {
      for (const keyword of keywords) {
        if (comment.includes(keyword)) {
          keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
        }
      }
    }

    // 按频率排序，返回前5个
    return Object.entries(keywordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([keyword, count]) => `${keyword} (${count} mentions)`);
  }

  /**
   * 清理过期反馈（保留最近1000条）
   */
  async cleanup(): Promise<void> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }

    this.outputChannel.appendLine('[FeedbackCollector] Cleaning up old feedback...');

    const MAX_FEEDBACK = 1000;

    if (this.feedback.length > MAX_FEEDBACK) {
      // 按时间排序，保留最新的
      this.feedback.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const removed = this.feedback.length - MAX_FEEDBACK;
      this.feedback = this.feedback.slice(0, MAX_FEEDBACK);

      await this._saveFeedback();

      this.outputChannel.appendLine(`[FeedbackCollector] Removed ${removed} old feedback entries`);
    } else {
      this.outputChannel.appendLine('[FeedbackCollector] No cleanup needed');
    }
  }

  /**
   * 保存反馈到文件
   */
  private async _saveFeedback(): Promise<void> {
    try {
      // 确保目录存在
      await fs.promises.mkdir(path.dirname(this.feedbackPath), { recursive: true });

      // 写入JSON文件
      await fs.promises.writeFile(
        this.feedbackPath,
        JSON.stringify(this.feedback, null, 2)
      );

      this.outputChannel.appendLine('[FeedbackCollector] Feedback saved to file');

    } catch (error) {
      this.outputChannel.appendLine(
        `[FeedbackCollector] Failed to save feedback: ${error}`
      );
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 计算百分比
   */
  private _percentage(count: number, total: number): string {
    return total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  }

  /**
   * 生成近期反馈表格
   */
  private _generateRecentFeedbackTable(): string {
    const recent = this.feedback.slice(-10).reverse();

    if (recent.length === 0) {
      return '暂无反馈';
    }

    let table = '| 时间 | 类型 | 评分 | 场景 | 备注 |\n';
    table += '|------|------|------|------|------|\n';

    for (const fb of recent) {
      const time = new Date(fb.timestamp).toLocaleString('zh-CN');
      const type = this._getTypeEmoji(fb.type);
      const rating = fb.rating ? `${fb.rating}⭐` : 'N/A';
      const scenario = fb.analysisContext.scenario;
      const comment = fb.comment ? fb.comment.substring(0, 30) + '...' : '';

      table += `| ${time} | ${type} | ${rating} | ${scenario} | ${comment} |\n`;
    }

    return table;
  }

  /**
   * 获取类型的Emoji表示
   */
  private _getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'useful': '✅ 有用',
      'not-useful': '❌ 无用',
      'suggestion': '💡 建议'
    };
    return emojis[type] || type;
  }

  /**
   * 生成场景分析表格
   */
  private _generateScenarioAnalysis(): string {
    const scenarioStats: Record<string, { total: number; useful: number }> = {};

    // 统计各场景的反馈
    for (const fb of this.feedback) {
      const scenario = fb.analysisContext.scenario;
      if (!scenarioStats[scenario]) {
        scenarioStats[scenario] = { total: 0, useful: 0 };
      }
      scenarioStats[scenario].total++;
      if (fb.type === 'useful') {
        scenarioStats[scenario].useful++;
      }
    }

    if (Object.keys(scenarioStats).length === 0) {
      return '暂无场景数据';
    }

    let analysis = '| 场景 | 反馈数 | 有用率 |\n';
    analysis += '|------|--------|--------|\n';

    for (const [scenario, stats] of Object.entries(scenarioStats)) {
      const usefulRate = this._percentage(stats.useful, stats.total);
      analysis += `| ${scenario} | ${stats.total} | ${usefulRate}% |\n`;
    }

    return analysis;
  }

  /**
   * 获取反馈总数
   */
  getFeedbackCount(): number {
    return this.feedback.length;
  }

  /**
   * 获取所有反馈（仅用于测试）
   */
  getAllFeedback(): FeedbackEntry[] {
    return [...this.feedback];
  }
}
