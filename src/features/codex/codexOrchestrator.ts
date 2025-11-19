/**
 * Codex工作流编排器 (Task 20 完整实现)
 *
 * 职责:
 * 1. 管理Codex任务的完整执行流程
 * 2. 集成SessionStateManager、TaskRouter、执行器等组件
 * 3. 监听VSCode生命周期事件，确保资源正确清理
 * 4. 实现执行模式选择和覆盖逻辑
 * 5. 提供深度推理能力
 *
 * 主要流程：
 * 1. 创建会话（SessionStateManager）
 * 2. 路由决策（TaskRouter）
 * 3. 执行任务（CodexExecutor 或 LocalAgentExecutor）
 * 4. 保存状态（SessionStateManager）
 * 5. 返回执行结果
 *
 * 需求: 需求1.1-1.6, 需求6.1-6.6, 需求7.1-7.3
 */

import * as vscode from 'vscode';
import { SessionStateManager } from './sessionStateManager';
import { TaskRouter } from './taskRouter';
import { ConfigManager } from '../../utils/configManager';
import { CodexExecutor } from './codexExecutor';
import { LocalAgentExecutor } from './localAgentExecutor';
import { DeepThinkingEngine } from './deepThinkingEngine';
import { MCPClient } from './mcpClient';
import { FeedbackCollector } from './feedbackCollector';
import { CodexAnalysisWebview, AnalysisMetadata } from './views/codexAnalysisWebview';
import { ProgressIndicator } from './progressIndicator';
import {
  TaskDescriptor,
  ExecutionMode,
  ExecutionOptions,
  ExecutionResult,
  ModeRecommendation,
  Session,
  ThinkingResult,
  AnalysisContext
} from './types';

/**
 * Codex编排器
 *
 * 作为整个Codex工作流系统的统一入口和协调者
 * 核心功能：
 * - 智能任务路由（自动或手动选择执行模式）
 * - 会话管理（创建、恢复、保存状态）
 * - 执行器协调（Codex 或 Local Agent）
 * - 深度推理能力（可选）
 * - 资源清理和生命周期管理
 */
export class CodexOrchestrator {
  /** 会话状态管理器 */
  private sessionStateManager: SessionStateManager;

  /** 任务路由器 */
  private taskRouter: TaskRouter;

  /** 配置管理器 */
  private configManager: ConfigManager;

  /** Codex执行器实例（按需创建） */
  private codexExecutor?: CodexExecutor;

  /** 本地Agent执行器实例（按需创建） */
  private localAgentExecutor?: LocalAgentExecutor;

  /** 深度推理引擎实例（按需创建） */
  private deepThinkingEngine?: DeepThinkingEngine;

  /** MCP客户端实例（按需创建） */
  private mcpClient?: MCPClient;

  /** 分析结果WebView实例（按需创建） */
  private analysisWebview?: CodexAnalysisWebview;

  /** 反馈收集器实例（按需创建） */
  private feedbackCollector?: FeedbackCollector;

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

    // 初始化任务路由器
    this.taskRouter = new TaskRouter(context, outputChannel);

    // 获取配置管理器实例
    this.configManager = ConfigManager.getInstance();

    this.outputChannel.appendLine('[CodexOrchestrator] Orchestrator initialized');
  }

  /**
   * 执行任务（主入口）
   *
   * 完整执行流程:
   * 1. 创建会话
   * 2. 决定执行模式（支持强制模式、全局配置、智能路由）
   * 3. 执行任务
   * 4. 保存会话状态
   *
   * 需求: 需求7.1, 需求7.2, 需求7.3, 需求6.6, 需求9.2
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

      // 2. 路由决策阶段
      indicator.setPhase('routing');

      // 检查取消
      if (indicator.isCancelled()) {
        throw new Error('Task cancelled by user');
      }

      // 决定执行模式（支持多种优先级）
      const mode = await this._selectExecutionMode(task, options);
      this.outputChannel.appendLine(`[CodexOrchestrator] Selected execution mode: ${mode}`);

      // 3. 保存执行选项到会话上下文
      if (session.context) {
        session.context.options = options;
      }

      // 4. 代码库扫描阶段（如果启用）
      if (options?.enableCodebaseScan) {
        indicator.setPhase('analyzing-codebase');

        // 检查取消
        if (indicator.isCancelled()) {
          throw new Error('Task cancelled by user');
        }

        // TODO: 实际的代码库扫描逻辑
        this.outputChannel.appendLine(`[CodexOrchestrator] Codebase scan enabled`);
      }

      // 5. 深度推理阶段（如果启用）
      if (options?.enableDeepThinking) {
        indicator.setPhase('deep-thinking');

        // 检查取消
        if (indicator.isCancelled()) {
          throw new Error('Task cancelled by user');
        }

        // TODO: 实际的深度推理逻辑
        this.outputChannel.appendLine(`[CodexOrchestrator] Deep thinking enabled`);
      }

      // 6. 执行任务阶段
      indicator.setPhase('executing');

      // 检查取消
      if (indicator.isCancelled()) {
        throw new Error('Task cancelled by user');
      }

      const result = await this._executeWithMode(task, mode, session, options);

      // 7. 保存结果阶段
      indicator.setPhase('saving-results');

      // 检查取消
      if (indicator.isCancelled()) {
        // 即使取消，也保存中间结果
        this.outputChannel.appendLine(`[CodexOrchestrator] Task cancelled, saving intermediate results`);
      }

      await this.sessionStateManager.saveState(session, result);
      this.outputChannel.appendLine(`[CodexOrchestrator] Session state saved`);

      // 8. 完成阶段
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
   * 获取推荐的执行模式（不执行任务）
   *
   * 需求: 需求1.2, 需求1.5
   *
   * @param task 任务描述符
   * @returns 推荐模式和理由
   */
  async getRecommendedMode(task: TaskDescriptor): Promise<ModeRecommendation> {
    this.outputChannel.appendLine(`[CodexOrchestrator] Getting recommended mode for task: ${task.id}`);
    return await this.taskRouter.recommend(task);
  }

  /**
   * 启用深度推理
   *
   * 对给定的分析上下文执行深度推理分析
   * 使用DeepThinkingEngine进行完整的深度分析
   *
   * 需求: 需求4.1-4.6
   *
   * @param context 分析上下文
   * @returns 深度推理结果
   */
  async enableDeepThinking(context: AnalysisContext): Promise<ThinkingResult> {
    this.outputChannel.appendLine('[CodexOrchestrator] Enabling deep thinking...');
    this.outputChannel.appendLine(`[CodexOrchestrator] Task: ${context.task.description.substring(0, 100)}...`);

    try {
      // 获取或创建深度推理引擎
      const engine = this.getDeepThinkingEngine();

      // 获取或创建WebView
      const webview = this.getAnalysisWebview();

      // 配置进度回调
      engine['config'] = {
        ...engine['config'],
        onProgress: (progress) => {
          // 更新WebView进度
          webview.showProgress(progress, () => {
            // 取消回调
            this.outputChannel.appendLine('[CodexOrchestrator] User requested to cancel analysis');
            engine.cancel();
          });
        },
        onCancel: () => {
          this.outputChannel.appendLine('[CodexOrchestrator] Analysis cancelled');
          vscode.window.showInformationMessage('深度分析已取消，中间结果已保存');
        }
      };

      // 执行深度分析
      const result = await engine.analyze(context);

      this.outputChannel.appendLine('[CodexOrchestrator] Deep thinking completed');
      this.outputChannel.appendLine(`[CodexOrchestrator] Problems identified: ${result.problemDecomposition.length}`);
      this.outputChannel.appendLine(`[CodexOrchestrator] Risks identified: ${result.riskIdentification.length}`);
      this.outputChannel.appendLine(`[CodexOrchestrator] Solutions compared: ${result.solutionComparison.length}`);
      this.outputChannel.appendLine(`[CodexOrchestrator] Recommended: ${result.recommendedDecision.selectedSolution}`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[CodexOrchestrator] Deep thinking failed: ${errorMessage}`);

      // 处理取消
      if (errorMessage.includes('cancelled')) {
        this.outputChannel.appendLine('[CodexOrchestrator] Analysis was cancelled by user');
        throw error;
      }

      // 处理超时
      if (errorMessage.includes('timeout')) {
        this.outputChannel.appendLine('[CodexOrchestrator] Analysis timed out');
        vscode.window.showWarningMessage(
          '深度分析超时。中间结果已保存。',
          '查看中间结果'
        ).then(choice => {
          if (choice === '查看中间结果') {
            // TODO: 打开中间结果文件
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const intermediatePath = `${workspaceRoot}/.claude/codex/intermediate`;
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(intermediatePath));
          }
        });
        throw error;
      }

      throw error;
    }
  }

  /**
   * 展示分析结果
   *
   * 使用WebView可视化展示深度推理结果
   * 需求: 需求4.4
   *
   * @param thinkingResult 深度推理结果
   * @param metadata 分析元数据（可选）
   */
  async showAnalysisResult(
    thinkingResult: ThinkingResult,
    metadata?: AnalysisMetadata
  ): Promise<void> {
    this.outputChannel.appendLine('[CodexOrchestrator] Showing analysis result in WebView');

    try {
      // 获取或创建WebView实例
      const webview = this.getAnalysisWebview();

      // 显示分析结果
      await webview.show(thinkingResult, metadata);

      this.outputChannel.appendLine('[CodexOrchestrator] Analysis result displayed successfully');

    } catch (error) {
      this.outputChannel.appendLine(`[CodexOrchestrator] Failed to show analysis result: ${error}`);
      throw error;
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
   * 获取本地Agent执行器（按需创建）
   *
   * @returns LocalAgentExecutor实例
   */
  getLocalAgentExecutor(): LocalAgentExecutor {
    if (!this.localAgentExecutor) {
      this.localAgentExecutor = new LocalAgentExecutor(this.outputChannel, this.context);
      this.outputChannel.appendLine('[CodexOrchestrator] Local agent executor created');
    }
    return this.localAgentExecutor;
  }

  /**
   * 获取深度推理引擎（按需创建）
   *
   * @returns DeepThinkingEngine实例
   */
  getDeepThinkingEngine(): DeepThinkingEngine {
    if (!this.deepThinkingEngine) {
      // 获取或创建MCP客户端
      const mcpClient = this.getMCPClient();

      // 创建深度推理引擎
      this.deepThinkingEngine = new DeepThinkingEngine(
        mcpClient,
        this.outputChannel,
        {
          model: 'gpt-5-codex',
          timeout: 120000, // 2分钟
          verbose: true
        }
      );

      this.outputChannel.appendLine('[CodexOrchestrator] Deep thinking engine created');
    }
    return this.deepThinkingEngine;
  }

  /**
   * 获取MCP客户端（按需创建）
   *
   * @returns MCPClient实例
   */
  getMCPClient(): MCPClient {
    if (!this.mcpClient) {
      // 获取工作区根路径
      const workspaceRoot = this.context.workspaceState.get<string>('workspaceRoot') || process.cwd();

      // 创建MCP客户端 - 使用配置的 codex-mcp-server
      this.mcpClient = new MCPClient(
        {
          command: 'node',
          args: ['/Users/xuqian/workspace/codex-mcp-server/dist/index.js'],
          cwd: workspaceRoot
        },
        this.outputChannel
      );

      this.outputChannel.appendLine('[CodexOrchestrator] MCP client created');
    }
    return this.mcpClient;
  }

  /**
   * 获取分析WebView（按需创建）
   *
   * @returns CodexAnalysisWebview实例
   */
  getAnalysisWebview(): CodexAnalysisWebview {
    if (!this.analysisWebview) {
      this.analysisWebview = new CodexAnalysisWebview(this.context, this.outputChannel);
      this.outputChannel.appendLine('[CodexOrchestrator] Analysis webview created');
    }
    return this.analysisWebview;
  }

  /**
   * 选择执行模式
   *
   * 优先级顺序:
   * 1. options.forceMode（强制模式，最高优先级）
   * 2. 全局默认模式配置（codex.defaultMode）
   * 3. 智能路由决策（基于复杂度评分）
   *
   * 模式切换时保留进度:
   * - 如果会话已存在，恢复之前的进度
   * - 如果模式发生变化，记录模式切换事件
   *
   * 需求: 需求7.1, 需求7.2, 需求7.3, 需求6.6
   *
   * @param task 任务描述符
   * @param options 执行选项
   * @returns 选择的执行模式
   */
  private async _selectExecutionMode(
    task: TaskDescriptor,
    options?: ExecutionOptions
  ): Promise<ExecutionMode> {
    // 1. 优先级1: 强制模式覆盖（options.forceMode）
    if (options?.forceMode) {
      const forceMode = options.forceMode === 'auto' ? await this._resolveAutoMode(task) : options.forceMode;
      this.outputChannel.appendLine(`[CodexOrchestrator] Using forced mode: ${forceMode} (from options.forceMode)`);
      return forceMode;
    }

    // 2. 检查是否有已存在的会话（模式切换时保留进度）
    const existingSession = await this._findExistingSession(task);
    if (existingSession && existingSession.context?.options?.forceMode) {
      const previousMode = existingSession.context.options.forceMode === 'auto'
        ? await this._resolveAutoMode(task)
        : existingSession.context.options.forceMode;

      this.outputChannel.appendLine(`[CodexOrchestrator] Restoring mode from existing session: ${previousMode}`);
      return previousMode;
    }

    // 3. 优先级2: 全局默认模式配置
    const globalMode = await this._getGlobalDefaultMode();
    if (globalMode !== 'auto') {
      this.outputChannel.appendLine(`[CodexOrchestrator] Using global default mode: ${globalMode}`);
      return globalMode;
    }

    // 4. 优先级3: 智能路由决策（auto模式）
    this.outputChannel.appendLine(`[CodexOrchestrator] Using auto mode, routing task...`);
    const routedMode = await this.taskRouter.route(task);

    // 确保返回的是 'local' 或 'codex'，不是 'auto'
    const finalMode = routedMode === 'auto' ? await this._resolveAutoMode(task) : routedMode;
    this.outputChannel.appendLine(`[CodexOrchestrator] Auto mode resolved to: ${finalMode}`);

    return finalMode;
  }

  /**
   * 解析auto模式为具体的执行模式
   * 基于智能路由决策
   *
   * @param task 任务描述符
   * @returns 解析后的执行模式 ('local' | 'codex')
   */
  private async _resolveAutoMode(task: TaskDescriptor): Promise<'local' | 'codex'> {
    const recommendation = await this.taskRouter.recommend(task);
    return recommendation.mode === 'auto' ? 'local' : recommendation.mode;
  }

  /**
   * 获取全局默认模式
   *
   * 需求: 需求7.1 - 支持全局默认模式配置
   *
   * @returns 全局默认执行模式
   */
  private async _getGlobalDefaultMode(): Promise<ExecutionMode | 'auto'> {
    try {
      const settings = await this.configManager.loadSettings();
      return settings.codex?.defaultMode || 'auto';
    } catch (error) {
      this.outputChannel.appendLine(`[CodexOrchestrator] Failed to load global config: ${error}`);
      return 'auto';
    }
  }

  /**
   * 查找已存在的会话
   *
   * 用于实现模式切换时的进度保留
   * 需求: 需求6.6 - 用户切换执行模式时保留原有工作进度
   *
   * @param task 任务描述符
   * @returns 已存在的会话（如果有）
   */
  private async _findExistingSession(task: TaskDescriptor): Promise<Session | null> {
    try {
      // 尝试恢复会话（基于任务ID）
      return await this.sessionStateManager.restoreSession(task.id);
    } catch (error) {
      // 如果没有找到会话，返回null
      return null;
    }
  }

  /**
   * 使用指定模式执行任务
   *
   * @param task 任务描述符
   * @param mode 执行模式
   * @param session 会话对象
   * @param options 执行选项
   * @returns 执行结果
   */
  private async _executeWithMode(
    task: TaskDescriptor,
    mode: ExecutionMode,
    session: Session,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = new Date();

    this.outputChannel.appendLine(`[CodexOrchestrator] Executing with mode: ${mode}`);

    try {
      let result: ExecutionResult;

      if (mode === 'codex') {
        // 使用Codex执行器（按需创建）
        const executor = this.getCodexExecutor();
        result = await executor.execute(task, session);
      } else {
        // 使用本地Agent执行器（按需创建）
        const agent = this.getLocalAgentExecutor();
        result = await agent.execute(task);
      }

      const endTime = new Date();

      // 补充执行时间信息
      return {
        ...result,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.outputChannel.appendLine(`[CodexOrchestrator] Execution error: ${errorMessage}`);

      return {
        success: false,
        mode,
        sessionId: session.id,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }
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
   * 获取任务路由器
   *
   * @returns TaskRouter实例
   */
  getTaskRouter(): TaskRouter {
    return this.taskRouter;
  }

  /**
   * 获取反馈收集器（按需创建）
   *
   * @returns FeedbackCollector实例
   */
  getFeedbackCollector(): FeedbackCollector {
    if (!this.feedbackCollector) {
      // 获取工作区根路径
      const workspaceRoot = this.context.workspaceState.get<string>('workspaceRoot') || process.cwd();

      // 创建反馈收集器
      this.feedbackCollector = new FeedbackCollector(
        workspaceRoot,
        this.outputChannel
      );

      this.outputChannel.appendLine('[CodexOrchestrator] Feedback collector created');
    }
    return this.feedbackCollector;
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

      // 释放MCP客户端
      if (this.mcpClient) {
        await this.mcpClient.disconnect();
        this.outputChannel.appendLine('[CodexOrchestrator] MCP client disconnected');
      }

      // 释放分析WebView
      if (this.analysisWebview) {
        this.analysisWebview.dispose();
        this.outputChannel.appendLine('[CodexOrchestrator] Analysis webview disposed');
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
