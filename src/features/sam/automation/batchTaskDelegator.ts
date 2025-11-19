/**
 * 批量任务委派器
 *
 * 职责：
 * 1. 批量将任务委派给 Codex
 * 2. 管理并发执行
 * 3. 处理失败重试
 * 4. 收集所有执行结果
 */

import * as vscode from 'vscode';
import { CodexOrchestrator } from '../../codex/codexOrchestrator';
import { TaskDescriptor, ExecutionResult } from '../../codex/types';
import {
  TaskEvaluation,
  DelegationOptions,
  DelegationResult
} from './types';

/**
 * 批量任务委派器
 */
export class BatchTaskDelegator {
  constructor(
    private codexOrchestrator: CodexOrchestrator,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * 批量委派任务给 Codex
   * @param evaluations 任务评估结果
   * @param specName spec 名称
   * @param context 上下文（requirements, design）
   * @param options 委派选项
   * @returns 委派结果列表
   */
  async delegateTasks(
    evaluations: TaskEvaluation[],
    specName: string,
    context: { requirements?: string; design?: string },
    options?: DelegationOptions
  ): Promise<DelegationResult[]> {
    const {
      maxConcurrency = 3,
      retryCount = 1, // 1次重试（总共2次尝试）- 因为重试从头开始，不宜过多
      timeout = 360000, // 初始6分钟，给Codex足够时间完成
      showProgress = true
    } = options || {};

    this.outputChannel.appendLine(
      `[BatchTaskDelegator] Starting batch delegation: ${evaluations.length} tasks, ` +
      `maxConcurrency=${maxConcurrency}, retryCount=${retryCount}`
    );

    const results: DelegationResult[] = [];
    const queue = [...evaluations];
    const inProgress: Map<string, Promise<DelegationResult>> = new Map();

    // 创建进度通知
    let progressNotification: vscode.Progress<{ message?: string; increment?: number }> | undefined;
    let progressResolve: (() => void) | undefined;

    if (showProgress) {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Codex 批量执行任务`,
          cancellable: false
        },
        async (progress) => {
          progressNotification = progress;
          progress.report({ message: `准备执行 ${evaluations.length} 个任务...`, increment: 0 });

          // 等待所有任务完成
          return new Promise<void>((resolve) => {
            progressResolve = resolve;
          });
        }
      );
    }

    try {
      // 并发执行任务
      while (queue.length > 0 || inProgress.size > 0) {
        // 启动新任务（如果有空闲槽位）
        while (queue.length > 0 && inProgress.size < maxConcurrency) {
          const evaluation = queue.shift()!;
          const taskPromise = this.delegateTask(
            evaluation,
            specName,
            context,
            retryCount,
            timeout
          );

          inProgress.set(evaluation.task.number, taskPromise);

          // 更新进度
          if (progressNotification) {
            const completed = results.length;
            const total = evaluations.length;
            const percent = Math.floor((completed / total) * 100);
            progressNotification.report({
              message: `执行中... (${completed}/${total}) - 当前: 任务 ${evaluation.task.number}`,
              increment: 0
            });
          }

          // 等待任务完成
          taskPromise.then((result) => {
            inProgress.delete(evaluation.task.number);
            results.push(result);

            // 更新进度
            if (progressNotification) {
              const completed = results.length;
              const total = evaluations.length;
              const percent = Math.floor((completed / total) * 100);
              progressNotification.report({
                message: `已完成 ${completed}/${total} (${percent}%)`,
                increment: (1 / total) * 100
              });
            }
          }).catch((error) => {
            this.outputChannel.appendLine(
              `[BatchTaskDelegator] Unexpected error in task ${evaluation.task.number}: ${error}`
            );
            inProgress.delete(evaluation.task.number);
          });
        }

        // 等待至少一个任务完成
        if (inProgress.size > 0) {
          await Promise.race(Array.from(inProgress.values()));
        }
      }

      // 等待所有任务完成
      await Promise.all(Array.from(inProgress.values()));

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      this.outputChannel.appendLine(
        `[BatchTaskDelegator] Batch delegation complete: ` +
        `${successCount} succeeded, ${failedCount} failed`
      );

      // 关闭进度通知
      if (progressResolve) {
        progressResolve();
      }

      return results;

    } catch (error) {
      this.outputChannel.appendLine(`[BatchTaskDelegator] Error in batch delegation: ${error}`);

      // 关闭进度通知
      if (progressResolve) {
        progressResolve();
      }

      throw error;
    }
  }

  /**
   * 委派单个任务给 Codex（带重试）
   */
  private async delegateTask(
    evaluation: TaskEvaluation,
    specName: string,
    context: { requirements?: string; design?: string },
    retryCount: number,
    timeout: number
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    // 智能选择推理深度
    const reasoningEffort =
      evaluation.complexityScore > 80 ? 'high' :
      evaluation.complexityScore > 50 ? 'medium' : 'low';

    this.outputChannel.appendLine(
      `[BatchTaskDelegator] Delegating task ${evaluation.task.number}: ${evaluation.task.title} ` +
      `(complexity: ${evaluation.complexityScore}, reasoningEffort: ${reasoningEffort})`
    );

    let lastError: Error | undefined;

    // 尝试执行（包括重试）
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      if (attempt > 0) {
        this.outputChannel.appendLine(
          `[BatchTaskDelegator] Retrying task ${evaluation.task.number} (attempt ${attempt + 1}/${retryCount + 1}) with resetSession=true`
        );
      }

      try {
        // 构建任务描述符
        const taskDescriptor: TaskDescriptor = {
          id: `sam-task-${specName}-${evaluation.task.number}-${Date.now()}`,
          type: 'implementation',
          description: `${evaluation.task.title}\n\n${evaluation.task.details.map(d => `- ${d}`).join('\n')}`,
          specName: specName,
          context: {
            requirements: context.requirements,
            design: context.design,
            tasks: evaluation.task.fullText,
            additionalContext: {
              taskNumber: evaluation.task.number,
              taskTitle: evaluation.task.title,
              taskType: evaluation.type,
              complexityScore: evaluation.complexityScore
            }
          },
          resetSession: attempt > 0 // 重试时重置会话，避免上下文污染
        };

        // 执行任务
        const executionResult: ExecutionResult = await this.codexOrchestrator.executeTask(
          taskDescriptor,
          {
            forceMode: 'codex',
            enableDeepThinking: evaluation.complexityScore > 50,
            enableCodebaseScan: false,
            reasoningEffort, // 智能推理深度
            timeout: timeout
          }
        );

        const duration = Date.now() - startTime;

        // 成功
        const result: DelegationResult = {
          evaluation,
          executionResult,
          duration,
          success: executionResult.success
        };

        this.outputChannel.appendLine(
          `[BatchTaskDelegator] Task ${evaluation.task.number} completed successfully in ${duration}ms`
        );

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message || '';

        this.outputChannel.appendLine(
          `[BatchTaskDelegator] Task ${evaluation.task.number} failed (attempt ${attempt + 1}): ${lastError.message}`
        );

        // 检测是否为超时错误
        const isTimeout = errorMsg.toLowerCase().includes('timeout') ||
                         errorMsg.toLowerCase().includes('timed out');

        if (isTimeout && attempt < retryCount) {
          // 超时错误：增加超时时间并重试
          // 注意：当前重试是从头开始，未来应该实现基于会话的继续机制
          timeout = Math.min(timeout * 1.5, 600000); // 最多增加到10分钟
          this.outputChannel.appendLine(
            `[BatchTaskDelegator] Timeout detected, retrying from scratch with increased timeout: ${timeout}ms`
          );
          this.outputChannel.appendLine(
            `[BatchTaskDelegator] ⚠️  Warning: Retry will start from beginning (session continuation not implemented yet)`
          );
          await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒后重试
        } else if (attempt < retryCount) {
          // 其他错误：使用递增延迟
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }

    // 所有尝试都失败
    const duration = Date.now() - startTime;
    const result: DelegationResult = {
      evaluation,
      executionResult: {
        success: false,
        output: '',
        error: {
          message: lastError?.message || 'Unknown error',
          stack: lastError?.stack,
          code: 'DELEGATION_FAILED'
        }
      } as ExecutionResult,
      duration,
      success: false,
      error: lastError?.message || 'Unknown error'
    };

    this.outputChannel.appendLine(
      `[BatchTaskDelegator] Task ${evaluation.task.number} failed after ${retryCount + 1} attempts`
    );

    return result;
  }

  /**
   * 取消所有正在执行的任务
   */
  async cancelAll(): Promise<void> {
    this.outputChannel.appendLine(`[BatchTaskDelegator] Cancelling all tasks...`);
    // TODO: 实现取消逻辑
    // 需要 CodexOrchestrator 支持任务取消
  }
}
