/**
 * 任务评估器
 *
 * 职责：
 * 1. 解析 tasks.md 文件，提取所有任务
 * 2. 评估每个任务的复杂度、类型、适合的执行方式
 * 3. 推荐哪些任务应该使用 Codex
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { TaskInfo, TaskEvaluation, TaskType } from './types';

/**
 * 任务评估器
 */
export class TaskEvaluator {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * 解析 tasks.md 文件
   * @param tasksFilePath tasks.md 文件路径
   * @returns 任务列表
   */
  async parseTasks(tasksFilePath: string): Promise<TaskInfo[]> {
    this.outputChannel.appendLine(`[TaskEvaluator] Parsing tasks from: ${tasksFilePath}`);

    try {
      const content = await fs.readFile(tasksFilePath, 'utf-8');
      const lines = content.split('\n');
      const tasks: TaskInfo[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const taskMatch = line.match(/^-\s+\[([ x])\]\s+(\d+(?:\.\d+)*)\.\s+(.+)$/);

        if (taskMatch) {
          const completed = taskMatch[1] === 'x';
          const number = taskMatch[2];
          let title = taskMatch[3];

          // 识别执行模式标签（如 `[codex]`, `[manual]`, `[skip]`）
          let executionMode: 'codex' | 'manual' | 'skip' | undefined;
          const tagMatch = title.match(/`\[(codex|manual|skip)\]`/);
          if (tagMatch) {
            executionMode = tagMatch[1] as 'codex' | 'manual' | 'skip';
            // 移除标签，保留干净的标题
            title = title.replace(/\s*`\[(codex|manual|skip)\]`\s*/g, '').trim();
          }

          // 提取详细描述（缩进的子项）
          const details: string[] = [];
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            // 检查是否是缩进的子项（以 "  -" 开头）
            if (nextLine.match(/^\s{2,}-\s+(.+)$/)) {
              const detailMatch = nextLine.match(/^\s{2,}-\s+(.+)$/);
              if (detailMatch) {
                details.push(detailMatch[1]);
              }
              j++;
            } else if (nextLine.trim() === '') {
              // 空行，继续
              j++;
            } else {
              // 遇到非缩进行，停止
              break;
            }
          }

          // 构建完整文本
          const fullText = `${title}\n${details.map(d => `- ${d}`).join('\n')}`;

          tasks.push({
            number,
            title,
            details,
            completed,
            lineRange: { start: i, end: j - 1 },
            fullText,
            executionMode
          });

          // 跳过已处理的行
          i = j - 1;
        }
      }

      this.outputChannel.appendLine(`[TaskEvaluator] Found ${tasks.length} tasks`);
      return tasks;

    } catch (error) {
      this.outputChannel.appendLine(`[TaskEvaluator] Error parsing tasks: ${error}`);
      throw error;
    }
  }

  /**
   * 评估单个任务
   * @param task 任务信息
   * @param context 上下文（requirements, design）
   * @returns 任务评估结果
   */
  async evaluateTask(
    task: TaskInfo,
    context: { requirements?: string; design?: string }
  ): Promise<TaskEvaluation> {
    this.outputChannel.appendLine(`[TaskEvaluator] Evaluating task: ${task.number} - ${task.title}`);

    try {
      // 1. 分析任务类型
      const type = this.analyzeTaskType(task);

      // 2. 计算复杂度评分
      const complexityScore = this.calculateComplexityScore(task, context);

      // 3. 优先使用用户标签，否则自动评估
      let recommendCodex: boolean;
      let reason: string;
      let confidence: number;

      if (task.executionMode) {
        // 用户明确标注了执行模式
        switch (task.executionMode) {
          case 'codex':
            recommendCodex = true;
            reason = '用户标注 `[codex]`，强制使用 Codex';
            confidence = 1.0;
            break;
          case 'manual':
            recommendCodex = false;
            reason = '用户标注 `[manual]`，需要人工处理';
            confidence = 1.0;
            break;
          case 'skip':
            recommendCodex = false;
            reason = '用户标注 `[skip]`，跳过此任务';
            confidence = 1.0;
            break;
        }
      } else {
        // 没有标签，使用自动评估
        const autoEval = this.shouldUseCodex(task, type, complexityScore);
        recommendCodex = autoEval.recommendCodex;
        reason = autoEval.reason;
        confidence = autoEval.confidence;
      }

      // 4. 预估工作量
      const estimatedHours = this.estimateWorkload(complexityScore);

      const evaluation: TaskEvaluation = {
        task,
        complexityScore,
        type,
        recommendCodex,
        reason,
        estimatedHours,
        confidence
      };

      this.outputChannel.appendLine(
        `[TaskEvaluator] Task ${task.number}: type=${type}, complexity=${complexityScore}, ` +
        `executionMode=${task.executionMode || 'auto'}, recommendCodex=${recommendCodex}, reason=${reason}`
      );

      return evaluation;

    } catch (error) {
      this.outputChannel.appendLine(`[TaskEvaluator] Error evaluating task ${task.number}: ${error}`);
      throw error;
    }
  }

  /**
   * 批量评估所有任务
   * @param tasks 任务列表
   * @param context 上下文
   * @returns 评估结果列表
   */
  async evaluateAllTasks(
    tasks: TaskInfo[],
    context: { requirements?: string; design?: string }
  ): Promise<TaskEvaluation[]> {
    this.outputChannel.appendLine(`[TaskEvaluator] Evaluating ${tasks.length} tasks...`);

    const evaluations: TaskEvaluation[] = [];

    for (const task of tasks) {
      // 跳过已完成的任务
      if (task.completed) {
        this.outputChannel.appendLine(`[TaskEvaluator] Skipping completed task: ${task.number}`);
        continue;
      }

      const evaluation = await this.evaluateTask(task, context);
      evaluations.push(evaluation);
    }

    // 统计信息
    const codexCount = evaluations.filter(e => e.recommendCodex).length;
    this.outputChannel.appendLine(
      `[TaskEvaluator] Evaluation complete: ${codexCount}/${evaluations.length} tasks recommended for Codex`
    );

    return evaluations;
  }

  /**
   * 分析任务类型
   */
  private analyzeTaskType(task: TaskInfo): TaskType {
    const text = task.fullText.toLowerCase();

    // 文档关键词 - 优先级最高，避免被其他关键词误判（如"API文档"被识别为API）
    const docKeywords = ['文档', 'documentation', 'doc', 'readme', '说明', '编写.*文档', '撰写.*文档'];
    if (docKeywords.some(keyword => text.includes(keyword))) {
      return 'documentation';
    }

    // 测试关键词 - 优先级较高
    const testKeywords = ['测试', 'test', 'unit test', '单元测试', '集成测试'];
    if (testKeywords.some(keyword => text.includes(keyword))) {
      return 'test';
    }

    // 算法关键词
    const algorithmKeywords = ['算法', '排序', '搜索', '查找', '遍历', 'algorithm', 'sort', 'search'];
    if (algorithmKeywords.some(keyword => text.includes(keyword))) {
      return 'algorithm';
    }

    // 组件关键词
    const componentKeywords = ['组件', '页面', 'component', 'page', 'ui', '界面', '表单'];
    if (componentKeywords.some(keyword => text.includes(keyword))) {
      return 'component';
    }

    // API 关键词
    const apiKeywords = ['api', '接口', 'endpoint', 'rest', 'graphql', '路由'];
    if (apiKeywords.some(keyword => text.includes(keyword))) {
      return 'api';
    }

    // 数据处理关键词
    const dataKeywords = ['解析', '转换', '验证', '格式化', 'parse', 'validate', 'transform'];
    if (dataKeywords.some(keyword => text.includes(keyword))) {
      return 'data-processing';
    }

    // 工具函数关键词
    const utilityKeywords = ['工具', '辅助', '帮助', 'util', 'helper', '函数'];
    if (utilityKeywords.some(keyword => text.includes(keyword))) {
      return 'utility';
    }

    // 重构关键词
    const refactorKeywords = ['重构', '优化', '改进', 'refactor', 'optimize', 'improve'];
    if (refactorKeywords.some(keyword => text.includes(keyword))) {
      return 'refactor';
    }

    return 'other';
  }

  /**
   * 计算复杂度评分 (0-100)
   */
  private calculateComplexityScore(
    task: TaskInfo,
    context: { requirements?: string; design?: string }
  ): number {
    let score = 0;

    // 因素1: 任务描述长度（20分）
    const descriptionLength = task.fullText.length;
    if (descriptionLength < 50) {
      score += 5;
    } else if (descriptionLength < 150) {
      score += 10;
    } else if (descriptionLength < 300) {
      score += 15;
    } else {
      score += 20;
    }

    // 因素2: 详细描述数量（20分）
    const detailCount = task.details.length;
    score += Math.min(detailCount * 4, 20);

    // 因素3: 技术栈复杂度（30分）
    const techKeywords = [
      'react', 'vue', 'angular', 'typescript', 'javascript',
      'node', 'express', 'nest', 'mongodb', 'sql',
      'graphql', 'rest', 'websocket', 'redis', 'docker'
    ];
    const techCount = techKeywords.filter(keyword =>
      task.fullText.toLowerCase().includes(keyword)
    ).length;
    score += Math.min(techCount * 6, 30);

    // 因素4: 依赖复杂度（15分）
    const dependencyKeywords = ['集成', '对接', '依赖', 'integrate', 'depend', '配合'];
    if (dependencyKeywords.some(keyword => task.fullText.toLowerCase().includes(keyword))) {
      score += 15;
    }

    // 因素5: 明确性（15分，越明确分数越低）
    const clarityKeywords = ['实现', '创建', '添加', 'implement', 'create', 'add'];
    const hasClearAction = clarityKeywords.some(keyword =>
      task.fullText.toLowerCase().includes(keyword)
    );
    if (!hasClearAction) {
      score += 15; // 不明确的任务更复杂
    } else {
      score += 5; // 明确的任务相对简单
    }

    // 限制在 0-100 范围内
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 判断是否推荐使用 Codex
   */
  private shouldUseCodex(
    task: TaskInfo,
    type: TaskType,
    complexityScore: number
  ): { recommendCodex: boolean; reason: string; confidence: number } {
    const text = task.fullText.toLowerCase();

    // 规则1: 文档和重构任务不推荐
    if (type === 'documentation' || type === 'refactor') {
      return {
        recommendCodex: false,
        reason: `${type === 'documentation' ? '文档' : '重构'}任务需要人工判断和深度理解现有代码`,
        confidence: 0.9
      };
    }

    // 规则2: 算法、工具函数、数据处理强烈推荐
    if (type === 'algorithm' || type === 'utility' || type === 'data-processing') {
      return {
        recommendCodex: true,
        reason: `${type}任务有明确的输入输出，适合 Codex 自动生成`,
        confidence: 0.95
      };
    }

    // 规则3: UI/UX 主观任务不推荐
    const subjectiveKeywords = ['美观', '好看', '体验', 'beautiful', 'ux', 'user experience'];
    if (subjectiveKeywords.some(keyword => text.includes(keyword))) {
      return {
        recommendCodex: false,
        reason: 'UI/UX 任务涉及主观判断，不适合自动化',
        confidence: 0.85
      };
    }

    // 规则4: 复杂度适中（30-70分）推荐
    if (complexityScore >= 30 && complexityScore <= 70) {
      return {
        recommendCodex: true,
        reason: `复杂度适中（${complexityScore}分），适合 Codex 处理`,
        confidence: 0.75
      };
    }

    // 规则5: 复杂度过低（<30分）推荐
    if (complexityScore < 30) {
      return {
        recommendCodex: true,
        reason: `任务简单（${complexityScore}分），Codex 可快速完成`,
        confidence: 0.8
      };
    }

    // 规则6: 复杂度过高（>70分）不推荐
    if (complexityScore > 70) {
      return {
        recommendCodex: false,
        reason: `任务过于复杂（${complexityScore}分），建议人工实现`,
        confidence: 0.7
      };
    }

    // 默认：根据类型决定
    const recommendedTypes: TaskType[] = ['algorithm', 'utility', 'data-processing', 'test'];
    const recommendCodex = recommendedTypes.includes(type);

    return {
      recommendCodex,
      reason: recommendCodex
        ? `${type}类型任务适合 Codex`
        : `${type}类型任务建议人工实现`,
      confidence: 0.6
    };
  }

  /**
   * 预估工作量（小时）
   */
  private estimateWorkload(complexityScore: number): number {
    // 简单映射：复杂度每10分对应0.5小时
    const baseHours = (complexityScore / 10) * 0.5;

    // 最少0.5小时，最多8小时
    return Math.min(Math.max(baseHours, 0.5), 8);
  }
}
