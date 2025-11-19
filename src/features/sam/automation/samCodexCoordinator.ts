/**
 * Sam-Codex 协调器
 *
 * 职责：
 * 1. 协调整个自动化流程
 * 2. 集成所有子模块（TaskEvaluator, BatchTaskDelegator, CodeAcceptanceTester, CodeIntegrator）
 * 3. 更新 PROGRESS.md 和 tasks.md
 * 4. 提供完整的执行报告
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskEvaluator } from './taskEvaluator';
import { BatchTaskDelegator } from './batchTaskDelegator';
import { CodeAcceptanceTester } from './codeAcceptanceTester';
import { CodeIntegrator } from './codeIntegrator';
import { ProgressTracker } from '../progressTracker';
import {
  AutomationOptions,
  AutomationReport,
  TaskInfo,
  TaskEvaluation,
  DelegationResult,
  AcceptanceResult,
  IntegrationResult
} from './types';

/**
 * Sam-Codex 协调器
 */
export class SamCodexCoordinator {
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
  async runAutomation(options: AutomationOptions): Promise<AutomationReport> {
    const startTime = new Date();
    this.outputChannel.appendLine(
      `[SamCodexCoordinator] Starting automation for spec: ${options.specName}`
    );

    try {
      // 1. 获取 spec 路径
      const specPath = this.getSpecPath(options.specName);
      const tasksFilePath = path.join(specPath, 'tasks.md');

      // 2. 解析任务
      const tasks = await this.taskEvaluator.parseTasks(tasksFilePath);
      this.outputChannel.appendLine(`[SamCodexCoordinator] Found ${tasks.length} tasks`);

      if (tasks.length === 0) {
        return this.createEmptyReport(startTime);
      }

      // 3. 加载上下文
      const context = await this.loadContext(specPath);

      // 4. 评估任务
      const evaluations = await this.taskEvaluator.evaluateAllTasks(tasks, context);
      this.outputChannel.appendLine(
        `[SamCodexCoordinator] Evaluated ${evaluations.length} tasks`
      );

      // 如果只是评估，不执行
      if (options.evaluateOnly) {
        return this.createEvaluationOnlyReport(evaluations, startTime);
      }

      // 5. 筛选推荐使用 Codex 的任务
      const codexTasks = evaluations.filter(e => e.recommendCodex);
      this.outputChannel.appendLine(
        `[SamCodexCoordinator] ${codexTasks.length} tasks recommended for Codex`
      );

      if (codexTasks.length === 0) {
        this.outputChannel.appendLine('[SamCodexCoordinator] No tasks to delegate to Codex');
        return this.createNoCodexTasksReport(evaluations, startTime);
      }

      // 6. 批量委派给 Codex
      const delegationResults = await this.batchDelegator.delegateTasks(
        codexTasks,
        options.specName,
        context,
        options.delegationOptions
      );

      // 7. 处理执行结果（验收和整合）
      const results = await this.processResults(
        delegationResults,
        options
      );

      // 8. 更新进度
      const completedTasks = results
        .filter(r => r.integrationResult?.success)
        .map(r => r.task.number);

      if (completedTasks.length > 0) {
        await this.updateTasksStatus(tasksFilePath, completedTasks);
        await this.updateProgress(options.specName, results, startTime);
      }

      // 9. 生成报告
      const endTime = new Date();
      const report = this.createReport(
        evaluations,
        results,
        startTime,
        endTime
      );

      this.outputChannel.appendLine(
        `[SamCodexCoordinator] Automation complete: ` +
        `${report.successCount} succeeded, ${report.failedCount} failed, ` +
        `${report.manualCount} require manual work`
      );

      return report;

    } catch (error) {
      this.outputChannel.appendLine(`[SamCodexCoordinator] Error in automation: ${error}`);
      throw error;
    }
  }

  /**
   * 处理执行结果（验收和整合）
   */
  private async processResults(
    delegationResults: DelegationResult[],
    options: AutomationOptions
  ): Promise<AutomationReport['results']> {
    const results: AutomationReport['results'] = [];

    for (const delegationResult of delegationResults) {
      const result: AutomationReport['results'][0] = {
        task: delegationResult.evaluation.task,
        evaluation: delegationResult.evaluation,
        delegationResult
      };

      // 如果委派失败，跳过验收和整合
      if (!delegationResult.success || !delegationResult.executionResult.output) {
        this.outputChannel.appendLine(
          `[SamCodexCoordinator] Task ${delegationResult.evaluation.task.number} ` +
          `delegation failed, skipping acceptance and integration`
        );
        results.push(result);
        continue;
      }

      // 验收代码
      if (options.autoAcceptance) {
        const acceptanceResult = await this.acceptanceTester.acceptCode(
          delegationResult.executionResult.output,
          options.acceptanceCriteria || {}
        );

        result.acceptanceResult = acceptanceResult;

        this.outputChannel.appendLine(
          `[SamCodexCoordinator] Task ${delegationResult.evaluation.task.number} ` +
          `acceptance: ${acceptanceResult.passed ? 'passed' : 'failed'}`
        );

        // 如果验收失败，不整合
        if (!acceptanceResult.passed) {
          results.push(result);
          continue;
        }
      }

      // 整合代码
      if (options.autoIntegration || options.integrationStrategy) {
        const integrationResult = await this.codeIntegrator.integrateCode(
          delegationResult.executionResult.output,
          delegationResult.evaluation.task,
          options.integrationStrategy || { mode: 'review' }
        );

        result.integrationResult = integrationResult;

        this.outputChannel.appendLine(
          `[SamCodexCoordinator] Task ${delegationResult.evaluation.task.number} ` +
          `integration: ${integrationResult.success ? 'success' : 'failed'}`
        );
      }

      results.push(result);
    }

    return results;
  }

  /**
   * 更新 PROGRESS.md
   */
  async updateProgress(
    specName: string,
    results: AutomationReport['results'],
    startTime: Date
  ): Promise<void> {
    this.outputChannel.appendLine(`[SamCodexCoordinator] Updating PROGRESS.md for ${specName}`);

    try {
      const successfulTasks = results.filter(r => r.integrationResult?.success);
      const failedTasks = results.filter(r => r.delegationResult && !r.delegationResult.success);

      const progressEntry = `
## Codex 自动化执行 - ${startTime.toISOString()}

### 执行摘要
- 总任务数: ${results.length}
- 成功完成: ${successfulTasks.length}
- 执行失败: ${failedTasks.length}
- 需要人工处理: ${results.length - successfulTasks.length - failedTasks.length}

### 完成的任务
${successfulTasks.map(r => `- [x] ${r.task.number}. ${r.task.title}`).join('\n')}

${failedTasks.length > 0 ? `### 失败的任务
${failedTasks.map(r => `- [ ] ${r.task.number}. ${r.task.title} - 原因: ${r.delegationResult?.error || '未知错误'}`).join('\n')}` : ''}

---
`;

      // 直接写入 PROGRESS.md 文件
      const specPath = this.getSpecPath(specName);
      const progressPath = path.join(specPath, 'PROGRESS.md');

      // 读取现有内容（如果存在）
      let existingContent = '';
      try {
        existingContent = await fs.readFile(progressPath, 'utf-8');
      } catch {
        // 文件不存在，创建新文件
      }

      // 追加新内容
      const newContent = existingContent + '\n' + progressEntry;
      await fs.writeFile(progressPath, newContent, 'utf-8');

      this.outputChannel.appendLine(`[SamCodexCoordinator] PROGRESS.md updated: ${progressPath}`);

    } catch (error) {
      this.outputChannel.appendLine(
        `[SamCodexCoordinator] Error updating PROGRESS.md: ${error}`
      );
    }
  }

  /**
   * 更新 tasks.md（标记完成状态）
   */
  async updateTasksStatus(
    tasksFilePath: string,
    completedTasks: string[]
  ): Promise<void> {
    this.outputChannel.appendLine(
      `[SamCodexCoordinator] Updating tasks.md: ${completedTasks.length} tasks completed`
    );

    try {
      let content = await fs.readFile(tasksFilePath, 'utf-8');
      const lines = content.split('\n');

      for (const taskNumber of completedTasks) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // 匹配未完成的任务行
          const match = line.match(/^-\s+\[\s\]\s+(\d+(?:\.\d+)*)\.\s+(.+)$/);

          if (match && match[1] === taskNumber) {
            // 标记为完成
            lines[i] = line.replace('- [ ]', '- [x]');
            this.outputChannel.appendLine(`[SamCodexCoordinator] Marked task ${taskNumber} as completed`);
            break;
          }
        }
      }

      // 写回文件
      await fs.writeFile(tasksFilePath, lines.join('\n'), 'utf-8');

    } catch (error) {
      this.outputChannel.appendLine(
        `[SamCodexCoordinator] Error updating tasks.md: ${error}`
      );
    }
  }

  /**
   * 获取 spec 路径
   */
  private getSpecPath(specName: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder found');
    }

    // 尝试 .claude/specs/{specName}
    let specPath = path.join(workspaceRoot, '.claude', 'specs', specName);

    // 如果不存在，尝试 docs/specs/{specName}
    try {
      require('fs').accessSync(specPath);
    } catch {
      specPath = path.join(workspaceRoot, 'docs', 'specs', specName);
    }

    return specPath;
  }

  /**
   * 加载上下文（requirements, design）
   */
  private async loadContext(specPath: string): Promise<{ requirements?: string; design?: string }> {
    const context: { requirements?: string; design?: string } = {};

    try {
      const requirementsPath = path.join(specPath, 'requirements.md');
      context.requirements = await fs.readFile(requirementsPath, 'utf-8');
    } catch {
      this.outputChannel.appendLine('[SamCodexCoordinator] No requirements.md found');
    }

    try {
      const designPath = path.join(specPath, 'design.md');
      context.design = await fs.readFile(designPath, 'utf-8');
    } catch {
      this.outputChannel.appendLine('[SamCodexCoordinator] No design.md found');
    }

    return context;
  }

  /**
   * 创建完整报告
   */
  private createReport(
    evaluations: TaskEvaluation[],
    results: AutomationReport['results'],
    startTime: Date,
    endTime: Date
  ): AutomationReport {
    const delegatedToCodex = results.length;
    const successCount = results.filter(r => r.integrationResult?.success).length;
    const failedCount = results.filter(r => r.delegationResult && !r.delegationResult.success).length;
    const manualCount = evaluations.length - delegatedToCodex;

    return {
      totalTasks: evaluations.length,
      delegatedToCodex,
      successCount,
      failedCount,
      manualCount,
      results,
      totalDuration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };
  }

  /**
   * 创建空报告（没有任务）
   */
  private createEmptyReport(startTime: Date): AutomationReport {
    const endTime = new Date();
    return {
      totalTasks: 0,
      delegatedToCodex: 0,
      successCount: 0,
      failedCount: 0,
      manualCount: 0,
      results: [],
      totalDuration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };
  }

  /**
   * 创建仅评估报告
   */
  private createEvaluationOnlyReport(
    evaluations: TaskEvaluation[],
    startTime: Date
  ): AutomationReport {
    const endTime = new Date();
    const codexCount = evaluations.filter(e => e.recommendCodex).length;

    return {
      totalTasks: evaluations.length,
      delegatedToCodex: 0,
      successCount: 0,
      failedCount: 0,
      manualCount: evaluations.length - codexCount,
      results: evaluations.map(e => ({ task: e.task, evaluation: e })),
      totalDuration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };
  }

  /**
   * 创建无 Codex 任务报告
   */
  private createNoCodexTasksReport(
    evaluations: TaskEvaluation[],
    startTime: Date
  ): AutomationReport {
    const endTime = new Date();

    return {
      totalTasks: evaluations.length,
      delegatedToCodex: 0,
      successCount: 0,
      failedCount: 0,
      manualCount: evaluations.length,
      results: evaluations.map(e => ({ task: e.task, evaluation: e })),
      totalDuration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };
  }
}
