/**
 * Codex工作流编排器（简化版）
 *
 * 职责:
 * 1. 管理Codex任务的完整执行流程
 * 2. 集成SessionStateManager和CodexExecutor
 * 3. 监听VSCode生命周期事件，确保资源正确清理
 *
 * 主要流程：
 * 1. 创建会话（SessionStateManager）
 * 2. 执行任务（CodexExecutor）
 * 3. 保存状态（SessionStateManager）
 * 4. 返回执行结果
 */

import * as vscode from 'vscode';
import { SessionStateManager } from './sessionStateManager';
import { ConfigManager } from '../../utils/configManager';
import { CodexExecutor } from './codexExecutor';
import { ProgressIndicator } from './progressIndicator';
import {
  TaskDescriptor,
  ExecutionMode,
  ExecutionOptions,
  ExecutionResult,
  Session
} from './types';

/**
 * Codex编排器
 *
 * 作为Codex工作流系统的统一入口和协调者
 * 核心功能：
 * - 会话管理（创建、恢复、保存状态）
 * - Codex执行器协调
 * - 资源清理和生命周期管理
 */
export class CodexOrchestrator {
  /** 会话状态管理器 */
  private sessionStateManager: SessionStateManager;

  /** 配置管理器 */
  private configManager: ConfigManager;

  /** Codex执行器实例（按需创建） */
  private codexExecutor?: CodexExecutor;

  /**
   * 构造函数
   *
   * @param context VSCode扩展上下文
   * @param outputChannel 输出通道
   */
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {
    // 初始化会话状态管理器
    this.sessionStateManager = new SessionStateManager(context, outputChannel);

    // 获取配置管理器实例
    this.configManager = ConfigManager.getInstance();

    this.outputChannel.appendLine('[CodexOrchestrator] Orchestrator initialized');
  }

  /**
   * 执行任务（主入口）
   *
   * 完整执行流程:
   * 1. 创建会话
   * 2. 使用Codex执行任务
   * 3. 保存会话状态
   *
   * @param task 任务描述符
   * @param options 执行选项
   * @returns 执行结果
   */
  async executeTask(
    task: TaskDescriptor,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    this.outputChannel.appendLine(`[CodexOrchestrator] Executing task: ${task.id}`);
    this.outputChannel.appendLine(`[CodexOrchestrator] Task type: ${task.type}, description: ${task.description.substring(0, 100)}...`);

    const startTime = new Date();

    // 创建进度指示器
    const indicator = new ProgressIndicator();

    // 异步启动进度窗口
    const progressPromise = indicator.start(`执行任务: ${task.description.substring(0, 50)}...`, true);

    try {
      // 1. 初始化阶段
      indicator.setPhase('initializing');

      // 检查取消
      if (indicator.isCancelled()) {
        throw new Error('Task cancelled by user');
      }

      // 创建会话
      const session = await this.sessionStateManager.createSession(task);
      this.outputChannel.appendLine(`[CodexOrchestrator] Session created: ${session.id}`);

      // 2. 保存执行选项到会话上下文
      if (session.context) {
        session.context.options = options;
      }

      // 3. 执行任务阶段（直接使用Codex模式）
      indicator.setPhase('executing');

      // 检查取消
      if (indicator.isCancelled()) {
        throw new Error('Task cancelled by user');
      }

      // 使用Codex执行器
      const executor = this.getCodexExecutor();
      const result = await executor.execute(task, session);

      // 4. 保存结果阶段
      indicator.setPhase('saving-results');

      // 检查取消
      if (indicator.isCancelled()) {
        // 即使取消，也保存中间结果
        this.outputChannel.appendLine(`[CodexOrchestrator] Task cancelled, saving intermediate results`);
      }

      await this.sessionStateManager.saveState(session, result);
      this.outputChannel.appendLine(`[CodexOrchestrator] Session state saved`);

      // 5. 完成阶段
      indicator.setPhase('completed');
      indicator.complete();

      // 等待进度窗口关闭
      await progressPromise;

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.outputChannel.appendLine(`[CodexOrchestrator] Task execution failed: ${errorMessage}`);

      // 完成进度指示器
      indicator.complete();
      await progressPromise;

      // 返回失败结果
      const failureResult: ExecutionResult = {
        success: false,
        mode: options?.forceMode || 'local',
        sessionId: task.id,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      };

      return failureResult;
    }
  }


  /**
   * 恢复会话
   *
   * 从历史会话中恢复并继续执行
   * 需求: 需求8.7
   *
   * @param sessionId 会话ID
   * @returns 恢复的会话对象，如果不存在则返回null
   */
  async restoreSession(sessionId: string): Promise<Session | null> {
    this.outputChannel.appendLine(`[CodexOrchestrator] Restoring session: ${sessionId}`);

    try {
      const session = await this.sessionStateManager.restoreSession(sessionId);

      if (session) {
        this.outputChannel.appendLine(`[CodexOrchestrator] Session restored: ${sessionId}`);
        this.outputChannel.appendLine(`[CodexOrchestrator] Session status: ${session.status}`);
      } else {
        this.outputChannel.appendLine(`[CodexOrchestrator] Session not found: ${sessionId}`);
      }

      return session;

    } catch (error) {
      this.outputChannel.appendLine(`[CodexOrchestrator] Failed to restore session: ${error}`);
      throw error;
    }
  }

  /**
   * 获取Codex执行器（按需创建）
   *
   * @returns CodexExecutor实例
   */
  getCodexExecutor(): CodexExecutor {
    if (!this.codexExecutor) {
      this.codexExecutor = new CodexExecutor(this.outputChannel, this.sessionStateManager);
      this.outputChannel.appendLine('[CodexOrchestrator] Codex executor created');
    }
    return this.codexExecutor;
  }




  /**
   * 获取会话状态管理器
   *
   * @returns SessionStateManager实例
   */
  getSessionStateManager(): SessionStateManager {
    return this.sessionStateManager;
  }

  /**
   * 释放资源
   *
   * 在扩展deactivate时调用
   * 需求: 需求8.5 - 用户关闭VSCode时优雅关闭所有活跃会话
   */
  async dispose(): Promise<void> {
    this.outputChannel.appendLine('[CodexOrchestrator] Disposing orchestrator...');

    try {
      // 释放Codex执行器
      if (this.codexExecutor) {
        await this.codexExecutor.dispose();
        this.outputChannel.appendLine('[CodexOrchestrator] Codex executor disposed');
      }

      // 释放会话状态管理器
      await this.sessionStateManager.dispose();

      this.outputChannel.appendLine('[CodexOrchestrator] Orchestrator disposed successfully');

    } catch (error) {
      this.outputChannel.appendLine(
        `[CodexOrchestrator] Error during disposal: ${error}`
      );
      throw error;
    }
  }
}
