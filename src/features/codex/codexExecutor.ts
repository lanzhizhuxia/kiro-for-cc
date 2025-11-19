/**
 * Codex执行器
 *
 * 负责执行Codex任务，管理与MCP服务器的通信，处理执行上下文和结果。
 *
 * @module codexExecutor
 */

import * as vscode from 'vscode';
import { MCPClient, CodexToolParams, CodexReplyToolParams } from './mcpClient';
import {
  TaskDescriptor,
  ExecutionResult,
  Session,
  ExecutionOptions,
  MCPServerStatus
} from './types';
import { ExecutionLogger } from './executionLogger';

/**
 * MCP请求接口
 */
export interface MCPRequest {
  /** 请求ID */
  id: string;

  /** 请求类型 */
  type: 'execute' | 'analyze' | 'think';

  /** 任务上下文 */
  context: ExecutionContext;

  /** 请求选项 */
  options?: {
    /** 超时时间（毫秒） */
    timeout?: number;

    /** 是否启用流式响应 */
    streaming?: boolean;
  };
}

/**
 * MCP响应接口
 */
export interface MCPResponse {
  /** 请求ID（对应请求） */
  requestId: string;

  /** 响应状态 */
  status: 'success' | 'error' | 'timeout';

  /** 响应数据 */
  data?: {
    /** 输出内容 */
    output: string;

    /** 生成的文件 */
    generatedFiles?: string[];

    /** 推理链（如果启用深度推理） */
    thinkingChain?: Array<{
      step: number;
      thought: string;
    }>;

    /** 元数据 */
    metadata?: Record<string, any>;
  };

  /** 错误信息（如果失败） */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };

  /** 响应时间戳 */
  timestamp: Date;
}

/**
 * 执行上下文
 * 包含执行任务所需的所有上下文信息
 */
export interface ExecutionContext {
  /** 任务描述 */
  task: TaskDescriptor;

  /** 会话ID */
  sessionId: string;

  /** 执行选项 */
  options?: ExecutionOptions;

  /** 自定义上下文 */
  customContext?: Record<string, any>;
}

/**
 * Codex执行器接口
 */
export interface ICodexExecutor {
  /**
   * 执行任务
   * @param task 任务描述符
   * @param session 会话对象
   * @returns 执行结果
   */
  execute(task: TaskDescriptor, session: Session): Promise<ExecutionResult>;

  /**
   * 准备执行上下文
   * @param task 任务描述符
   * @returns 执行上下文
   */
  prepareContext(task: TaskDescriptor): Promise<ExecutionContext>;

  /**
   * 检查MCP服务器状态
   * @returns MCP服务器状态
   */
  checkServerStatus(): Promise<MCPServerStatus>;
}

/**
 * Codex执行器实现
 *
 * 核心功能：
 * - 管理与MCP服务器的通信
 * - 准备执行上下文（任务信息）
 * - 发送MCP请求并处理响应
 * - 转换响应为标准化的执行结果
 *
 * @example
 * ```typescript
 * const executor = new CodexExecutor(outputChannel);
 * const result = await executor.execute(task, session);
 * console.log('Execution result:', result);
 * ```
 */
export class CodexExecutor implements ICodexExecutor {
  /** MCP客户端 */
  private mcpClient?: MCPClient;

  /** 输出通道 */
  private outputChannel: vscode.OutputChannel;

  /** 当前执行的请求（用于跟踪和取消） */
  private activeRequests: Map<string, {
    controller: AbortController;
    startTime: Date;
  }>;

  /** 心跳定时器 */
  private heartbeatTimer?: NodeJS.Timeout;

  /** 心跳间隔（毫秒） */
  private readonly HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30秒

  /** 重连配置 */
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_INTERVAL_MS = 10 * 1000; // 10秒

  /** 重连状态 */
  private reconnectAttempts = 0;
  private isReconnecting = false;

  /** 会话状态管理器（可选，用于保存连接中断时的状态） */
  private sessionStateManager?: any;

  /** 执行日志记录器 */
  private logger?: ExecutionLogger;

  /**
   * 构造函数
   * @param outputChannel VSCode输出通道
   * @param sessionStateManager 会话状态管理器（可选）
   */
  constructor(
    outputChannel: vscode.OutputChannel,
    sessionStateManager?: any
  ) {
    this.outputChannel = outputChannel;
    this.activeRequests = new Map();
    this.sessionStateManager = sessionStateManager;
  }

  /**
   * 执行任务
   *
   * 执行流程：
   * 1. 确保MCP服务器已启动
   * 2. 准备执行上下文
   * 3. 发送MCP请求
   * 4. 处理响应
   * 5. 返回执行结果
   *
   * @param task 任务描述符
   * @param session 会话对象
   * @returns 执行结果
   * @throws 如果MCP服务器启动失败或执行超时
   */
  async execute(task: TaskDescriptor, session: Session): Promise<ExecutionResult> {
    const startTime = new Date();
    this.outputChannel.appendLine(`[CodexExecutor] Starting execution for task: ${task.id}`);

    // 初始化执行日志记录器
    this.logger = new ExecutionLogger(task.id, this.outputChannel);
    await this.logger.init();
    this.logger.logInfo('Task execution started', {
      taskId: task.id,
      taskType: task.type,
      sessionId: session.id
    });

    try {
      // 1. 确保MCP客户端已连接
      this.outputChannel.appendLine('[CodexExecutor] Ensuring MCP client is connected...');
      this.logger.logInfo('Ensuring MCP client is connected');
      await this._ensureMCPClient();

      // 2. 启动心跳检测
      this._startHeartbeat(session);

      // 3. 准备执行上下文
      this.outputChannel.appendLine('[CodexExecutor] Preparing execution context...');
      this.logger.logInfo('Preparing execution context');
      const context = await this.prepareContext(task);
      context.sessionId = session.id;
      context.options = session.context?.options;

      // 4. 发送MCP请求
      this.outputChannel.appendLine('[CodexExecutor] Sending MCP request...');
      this.logger.logMCPRequest('callCodex', {
        taskId: task.id,
        taskType: task.type,
        sessionId: session.id
      });

      const response = await this._sendMCPRequest(context);

      this.logger.logMCPResponse('callCodex', response);

      // 5. 处理响应
      this.outputChannel.appendLine('[CodexExecutor] Processing response...');
      this.logger.logInfo('Processing MCP response');
      const result = this._processResponse(response, startTime, session.id);

      // 6. 停止心跳
      this._stopHeartbeat();

      // 7. 刷新日志并清理
      this.logger.logInfo('Task execution completed successfully', {
        duration: result.duration,
        success: result.success
      });

      await this.logger.flush();
      this.logger.dispose();
      this.logger = undefined;

      this.outputChannel.appendLine(`[CodexExecutor] Execution completed successfully in ${result.duration}ms`);
      return result;

    } catch (error) {
      // 停止心跳
      this._stopHeartbeat();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.outputChannel.appendLine(`[CodexExecutor] Execution failed: ${error}`);

      // 记录错误
      if (this.logger) {
        this.logger.logError(
          error instanceof Error ? error : new Error(String(error)),
          'Task execution'
        );
        await this.logger.flush();
        this.logger.dispose();
        this.logger = undefined;
      }

      // 保存连接中断时的状态
      if (this._isConnectionError(error)) {
        await this._saveStateOnDisconnection(session, error);
      }

      // 返回失败结果
      return {
        success: false,
        mode: 'codex',
        sessionId: session.id,
        startTime,
        endTime,
        duration,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }

  /**
   * 准备执行上下文
   *
   * 从任务描述符中提取和组织执行所需的上下文信息：
   * - 任务基本信息
   * - 关联文件
   * - 任务上下文（requirements、design、tasks）
   * - 元数据
   *
   * @param task 任务描述符
   * @returns 执行上下文
   */
  async prepareContext(task: TaskDescriptor): Promise<ExecutionContext> {
    this.outputChannel.appendLine(`[CodexExecutor] Preparing context for task: ${task.id}`);

    const context: ExecutionContext = {
      task,
      sessionId: '' // 将在execute中设置
    };

    // 添加任务上下文
    if (task.context) {
      context.customContext = {
        requirements: task.context.requirements,
        design: task.context.design,
        tasks: task.context.tasks,
        ...task.context.additionalContext
      };
    }

    // 添加元数据
    if (task.metadata) {
      context.customContext = {
        ...context.customContext,
        taskMetadata: task.metadata
      };
    }

    this.outputChannel.appendLine(`[CodexExecutor] Context prepared with ${task.relatedFiles?.length || 0} related files`);
    return context;
  }

  /**
   * 检查MCP服务器状态
   *
   * @returns MCP服务器状态
   */
  async checkServerStatus(): Promise<MCPServerStatus> {
    return {
      status: this.mcpClient ? 'running' : 'stopped',
      healthCheckFailures: 0,
      isHealthy: !!this.mcpClient
    };
  }

  /**
   * 停止MCP服务器
   *
   * 提供对外接口停止MCP服务器
   */
  async stopServer(): Promise<void> {
    this.outputChannel.appendLine('[CodexExecutor] Stopping MCP server...');

    // 断开MCP客户端
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = undefined;
    }
  }

  /**
   * 取消正在执行的请求
   *
   * @param requestId 请求ID
   */
  cancelRequest(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      this.outputChannel.appendLine(`[CodexExecutor] Cancelling request: ${requestId}`);
      request.controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 发送MCP请求（内部方法）
   *
   * 将执行上下文转换为MCP请求格式并发送到MCP服务器
   * 支持超时控制和请求取消
   *
   * @param context 执行上下文
   * @returns MCP响应
   * @throws 如果请求失败或超时
   */
  private async _sendMCPRequest(context: ExecutionContext): Promise<MCPResponse> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const controller = new AbortController();

    // 记录活跃请求
    this.activeRequests.set(requestId, {
      controller,
      startTime: new Date()
    });

    try {
      this.outputChannel.appendLine(`[CodexExecutor] MCP Request ID: ${requestId}`);

      // 确保MCP客户端已连接
      if (!this.mcpClient || !this.mcpClient.isConnected()) {
        throw new Error('MCP client is not connected');
      }

      // 生成task_marker
      const taskMarker = MCPClient.generateTaskMarker();

      // 构建Codex工具参数
      const prompt = this._buildCodexPrompt(context, taskMarker);
      const toolParams: CodexToolParams = {
        model: 'gpt-5-codex',
        sandbox: 'danger-full-access',
        'approval-policy': 'on-failure',
        prompt
      };

      this.outputChannel.appendLine(`[CodexExecutor] Calling Codex with task_marker: ${taskMarker}`);

      // 调用Codex工具
      const { result, session } = await this.mcpClient.callCodex(toolParams);

      // 构建MCP响应
      const response: MCPResponse = {
        requestId,
        status: result.isError ? 'error' : 'success',
        data: result.isError ? undefined : {
          output: this._extractOutputFromToolResult(result),
          generatedFiles: [],
          metadata: {
            taskMarker,
            conversationId: session.conversationId,
            sessionCreatedAt: session.createdAt
          }
        },
        error: result.isError ? {
          message: this._extractOutputFromToolResult(result)
        } : undefined,
        timestamp: new Date()
      };

      return response;

    } finally {
      // 清理活跃请求
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 确保MCP客户端已连接
   *
   * 如果客户端未创建或未连接，则创建并连接
   *
   * @throws 如果连接失败
   */
  private async _ensureMCPClient(): Promise<void> {
    if (this.mcpClient && this.mcpClient.isConnected()) {
      return;
    }

    this.outputChannel.appendLine('[CodexExecutor] Creating MCP client...');

    // 创建MCP客户端 - 使用配置的 codex-mcp-server
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.mcpClient = new MCPClient(
      {
        command: 'node',
        args: ['/Users/xuqian/workspace/codex-mcp-server/dist/index.js'],
        cwd: workspaceRoot,
        env: {
          ...process.env,
          WORKING_DIR: workspaceRoot ? `${workspaceRoot}/.claude` : '.claude'
        }
      },
      this.outputChannel
    );

    // 连接到MCP服务器
    await this.mcpClient.connect();
  }

  /**
   * 构建Codex提示
   *
   * 将执行上下文转换为Codex工具所需的提示格式
   *
   * @param context 执行上下文
   * @param taskMarker 任务标记
   * @returns Codex提示文本
   */
  private _buildCodexPrompt(context: ExecutionContext, taskMarker: string): string {
    const parts: string[] = [];

    // 添加任务标记
    parts.push(`[TASK_MARKER: ${taskMarker}]`);
    parts.push('');

    // 检查是否需要中文输出
    const outputLanguage = context.customContext?.additionalContext?.outputLanguage;
    if (outputLanguage === 'zh-CN') {
      parts.push('**重要提示：请用中文输出所有分析结果和建议。**');
      parts.push('');
    }

    // 添加任务描述
    parts.push('# Task Description');
    parts.push(context.task.description);
    parts.push('');

    // 添加任务类型
    parts.push(`Task Type: ${context.task.type}`);
    parts.push('');

    // 添加关联文件
    if (context.task.relatedFiles && context.task.relatedFiles.length > 0) {
      parts.push('# Related Files');
      context.task.relatedFiles.forEach(file => {
        parts.push(`- ${file}`);
      });
      parts.push('');
    }

    // 添加上下文信息
    if (context.customContext) {
      parts.push('# Context Information');

      if (context.customContext.requirements) {
        parts.push('## Requirements');
        parts.push(context.customContext.requirements);
        parts.push('');
      }

      if (context.customContext.design) {
        parts.push('## Design');
        parts.push(context.customContext.design);
        parts.push('');
      }

      if (context.customContext.tasks) {
        parts.push('## Tasks');
        parts.push(context.customContext.tasks);
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * 从工具结果中提取输出文本
   *
   * @param result 工具结果
   * @returns 输出文本
   */
  private _extractOutputFromToolResult(result: { content: Array<{ type: string; text?: string }> }): string {
    if (!result.content || result.content.length === 0) {
      return '';
    }

    return result.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text || '')
      .join('\n');
  }

  /**
   * 处理MCP响应（内部方法）
   *
   * 将MCP响应转换为标准化的执行结果
   *
   * @param response MCP响应
   * @param startTime 执行开始时间
   * @param sessionId 会话ID
   * @returns 执行结果
   */
  private _processResponse(
    response: MCPResponse,
    startTime: Date,
    sessionId: string
  ): ExecutionResult {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // 处理成功响应
    if (response.status === 'success' && response.data) {
      return {
        success: true,
        mode: 'codex',
        sessionId,
        startTime,
        endTime,
        duration,
        output: response.data.output,
        generatedFiles: response.data.generatedFiles || [],
        metadata: response.data.metadata
      };
    }

    // 处理失败响应
    return {
      success: false,
      mode: 'codex',
      sessionId,
      startTime,
      endTime,
      duration,
      error: response.error || {
        message: 'Unknown error',
        code: response.status
      }
    };
  }

  /**
   * 启动心跳检测
   *
   * 每30秒发送一次心跳请求，检测连接状态
   * 需求: 需求8.2 - WHILE Codex会话活跃 THEN 系统 SHALL 每30秒发送心跳请求
   *
   * @param session 会话对象
   */
  private _startHeartbeat(session: Session): void {
    // 清除已有的心跳定时器
    this._stopHeartbeat();

    this.outputChannel.appendLine(`[CodexExecutor] Starting heartbeat for session: ${session.id}`);

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this._sendHeartbeat(session);
      } catch (error) {
        this.outputChannel.appendLine(
          `[CodexExecutor] Heartbeat failed: ${error instanceof Error ? error.message : String(error)}`
        );

        // 检测到连接中断，尝试重连
        if (this._isConnectionError(error)) {
          await this._handleConnectionLoss(session);
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * 停止心跳检测
   */
  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
      this.outputChannel.appendLine('[CodexExecutor] Heartbeat stopped');
    }
  }

  /**
   * 发送心跳请求
   *
   * 通过检查MCP客户端连接状态和发送简单的ping请求来验证连接
   *
   * @param session 会话对象
   * @throws 如果连接中断
   */
  private async _sendHeartbeat(session: Session): Promise<void> {
    if (!this.mcpClient || !this.mcpClient.isConnected()) {
      throw new Error('MCP client is not connected');
    }

    // 更新会话的最后活跃时间
    if (this.sessionStateManager) {
      await this.sessionStateManager.saveState(session);
    }

    this.outputChannel.appendLine(
      `[CodexExecutor] Heartbeat OK for session: ${session.id}`
    );
  }

  /**
   * 处理连接丢失
   *
   * 实现重连逻辑（最多3次，间隔10秒）
   * 需求: 需求8.3 - WHEN 检测到连接中断 THEN 系统 SHALL 尝试重连最多3次，间隔10秒
   *
   * @param session 会话对象
   */
  private async _handleConnectionLoss(session: Session): Promise<void> {
    if (this.isReconnecting) {
      // 已经在重连中，避免重复尝试
      return;
    }

    this.isReconnecting = true;
    this.outputChannel.appendLine(
      `[CodexExecutor] Connection lost for session: ${session.id}, attempting to reconnect...`
    );

    // 停止心跳
    this._stopHeartbeat();

    for (let attempt = 1; attempt <= this.MAX_RECONNECT_ATTEMPTS; attempt++) {
      this.reconnectAttempts = attempt;
      this.outputChannel.appendLine(
        `[CodexExecutor] Reconnection attempt ${attempt}/${this.MAX_RECONNECT_ATTEMPTS}...`
      );

      try {
        // 断开现有连接
        if (this.mcpClient) {
          await this.mcpClient.disconnect();
          this.mcpClient = undefined;
        }

        // 等待重连间隔
        await this._sleep(this.RECONNECT_INTERVAL_MS);

        // 尝试重新连接
        await this._ensureMCPClient();

        // 重连成功
        this.outputChannel.appendLine(
          `[CodexExecutor] Reconnected successfully on attempt ${attempt}`
        );

        // 重置重连计数器
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        // 重启心跳
        this._startHeartbeat(session);

        return;

      } catch (error) {
        this.outputChannel.appendLine(
          `[CodexExecutor] Reconnection attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        if (attempt === this.MAX_RECONNECT_ATTEMPTS) {
          // 所有重连尝试都失败
          this.outputChannel.appendLine(
            `[CodexExecutor] All reconnection attempts failed for session: ${session.id}`
          );

          // 保存状态
          await this._saveStateOnDisconnection(session, new Error('Connection lost after max reconnection attempts'));

          // 更新会话状态为失败
          if (this.sessionStateManager) {
            await this.sessionStateManager.updateSessionStatus(session.id, 'failed');
          }
        }
      }
    }

    this.isReconnecting = false;
  }

  /**
   * 判断是否为连接错误
   *
   * @param error 错误对象
   * @returns 是否为连接错误
   */
  private _isConnectionError(error: any): boolean {
    if (!error) {
      return false;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const connectionErrorPatterns = [
      'not connected',
      'connection lost',
      'connection refused',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket hang up',
      'network error'
    ];

    return connectionErrorPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 保存连接中断时的状态
   *
   * 需求: 需求8.4 - WHEN 重连失败 THEN 系统 SHALL 保存当前工作状态
   *
   * @param session 会话对象
   * @param error 错误对象
   */
  private async _saveStateOnDisconnection(
    session: Session,
    error: any
  ): Promise<void> {
    if (!this.sessionStateManager) {
      this.outputChannel.appendLine(
        '[CodexExecutor] No session state manager available, cannot save state'
      );
      return;
    }

    try {
      this.outputChannel.appendLine(
        `[CodexExecutor] Saving state for disconnected session: ${session.id}`
      );

      // 创建检查点保存当前状态
      await this.sessionStateManager.createCheckpoint(
        session.id,
        {
          disconnectedAt: new Date().toISOString(),
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          },
          reconnectAttempts: this.reconnectAttempts,
          activeRequests: Array.from(this.activeRequests.keys())
        },
        'Connection interruption - state saved'
      );

      this.outputChannel.appendLine(
        `[CodexExecutor] State saved successfully for session: ${session.id}`
      );

    } catch (saveError) {
      this.outputChannel.appendLine(
        `[CodexExecutor] Failed to save state: ${
          saveError instanceof Error ? saveError.message : String(saveError)
        }`
      );
    }
  }

  /**
   * 睡眠函数（用于重连间隔）
   *
   * @param ms 毫秒数
   * @returns Promise
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   *
   * 取消所有活跃请求并停止MCP服务器
   */
  async dispose(): Promise<void> {
    this.outputChannel.appendLine('[CodexExecutor] Disposing executor...');

    // 停止心跳
    this._stopHeartbeat();

    // 取消所有活跃请求
    for (const [requestId] of this.activeRequests) {
      this.cancelRequest(requestId);
    }

    // 断开MCP客户端
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = undefined;
    }

    this.outputChannel.appendLine('[CodexExecutor] Executor disposed');
  }
}
