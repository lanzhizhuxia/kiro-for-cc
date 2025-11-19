/**
 * MCP生命周期管理器
 *
 * 负责管理Codex MCP服务器的启动、停止、健康检查等生命周期操作。
 * 实现状态机管理，确保服务器状态的正确转换。
 *
 * @module mcpLifecycleManager
 */

import { exec, spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { MCPServerStatus } from './types';
import { ConfigManager } from '../../utils/configManager';

/**
 * MCP服务器状态枚举
 */
export enum MCPServerState {
  /** 已停止 */
  STOPPED = 'stopped',
  /** 正在启动 */
  STARTING = 'starting',
  /** 运行中 */
  RUNNING = 'running',
  /** 错误状态 */
  ERROR = 'error'
}

/**
 * MCP配置接口
 */
export interface MCPConfig {
  /** 服务器端口 */
  port: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * MCP生命周期管理器接口
 */
export interface IMCPLifecycleManager {
  /**
   * 确保MCP服务器已启动
   * 如果服务器未运行，则启动它；如果正在启动，则等待；如果已运行，直接返回状态
   */
  ensureStarted(): Promise<MCPServerStatus>;

  /**
   * 停止MCP服务器
   * 优雅关闭服务器进程，先发送SIGTERM，等待5秒后如果未退出则发送SIGKILL
   */
  stop(): Promise<void>;

  /**
   * 健康检查
   * 检查MCP服务器是否正常运行
   */
  healthCheck(): Promise<boolean>;

  /**
   * 获取服务器当前状态
   */
  getStatus(): MCPServerStatus;
}

/**
 * MCP生命周期管理器实现
 *
 * 管理MCP服务器的完整生命周期，包括：
 * - 启动和停止服务器进程
 * - 状态机管理（STOPPED → STARTING → RUNNING → ERROR）
 * - 健康检查和自动重启
 * - 进程异常处理
 *
 * @example
 * ```typescript
 * const manager = new MCPLifecycleManager(outputChannel);
 * const status = await manager.ensureStarted();
 * console.log('MCP Server running on port:', status.port);
 * ```
 */
export class MCPLifecycleManager implements IMCPLifecycleManager {
  /** 当前服务器状态 */
  private state: MCPServerState;

  /** MCP服务器进程 */
  private process?: ChildProcess;

  /** 健康检查定时器 */
  private healthCheckInterval?: NodeJS.Timeout;

  /** 健康检查失败计数 */
  private healthCheckFailureCount: number = 0;

  /** 健康检查间隔（毫秒） */
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30秒

  /** 最大健康检查失败次数 */
  private readonly MAX_HEALTH_CHECK_FAILURES = 3;

  /** 健康检查超时时间（毫秒） */
  private readonly HEALTH_CHECK_TIMEOUT = 5000; // 5秒

  /** 配置管理器 */
  private configManager: ConfigManager;

  /** 输出通道（用于日志） */
  private outputChannel: vscode.OutputChannel;

  /** 服务器状态详细信息 */
  private statusDetails: {
    pid?: number;
    port?: number;
    startTime?: Date;
    lastHealthCheck?: Date;
    errorMessage?: string;
  };

  /**
   * 构造函数
   * @param outputChannel VSCode输出通道，用于记录日志
   */
  constructor(outputChannel: vscode.OutputChannel) {
    this.state = MCPServerState.STOPPED;
    this.statusDetails = {};
    this.configManager = ConfigManager.getInstance();
    this.outputChannel = outputChannel;
  }

  /**
   * 确保MCP服务器已启动
   *
   * 状态机转换：
   * - STOPPED → STARTING → RUNNING (成功)
   * - STOPPED → STARTING → ERROR (失败)
   * - STARTING → 等待就绪 → RUNNING
   * - RUNNING → 直接返回状态
   *
   * @returns MCP服务器状态
   * @throws 如果启动失败或超时
   */
  async ensureStarted(): Promise<MCPServerStatus> {
    // 如果已经运行，直接返回
    if (this.state === MCPServerState.RUNNING) {
      return this.getStatus();
    }

    // 如果正在启动，等待就绪
    if (this.state === MCPServerState.STARTING) {
      return await this._waitForReady();
    }

    // 启动服务器
    return await this._start();
  }

  /**
   * 停止MCP服务器
   *
   * 状态机转换：
   * - RUNNING → STOPPED
   * - STARTING → STOPPED
   * - ERROR → STOPPED
   * - STOPPED → 无操作
   *
   * 实现优雅关闭：
   * 1. 停止健康检查定时器
   * 2. 发送SIGTERM信号
   * 3. 等待5秒
   * 4. 如果进程仍未退出，发送SIGKILL强制终止
   */
  async stop(): Promise<void> {
    if (this.state === MCPServerState.STOPPED) {
      return;
    }

    this.outputChannel.appendLine('[MCPLifecycleManager] Stopping MCP server...');

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // 优雅关闭进程
    if (this.process) {
      this.process.kill('SIGTERM');

      // 等待最多5秒
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.outputChannel.appendLine('[MCPLifecycleManager] Process did not exit gracefully, forcing kill...');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = undefined;
    }

    // 更新状态
    this.state = MCPServerState.STOPPED;
    this.statusDetails = {};
    this.outputChannel.appendLine('[MCPLifecycleManager] MCP server stopped');
  }

  /**
   * 健康检查
   *
   * 检查MCP服务器是否正常运行：
   * 1. 检查进程是否存在
   * 2. 检查状态是否为RUNNING
   * 3. 发送健康检查请求（HTTP/TCP）
   *
   * @returns true表示健康，false表示不健康
   */
  async healthCheck(): Promise<boolean> {
    if (this.state !== MCPServerState.RUNNING) {
      return false;
    }

    if (!this.process || this.process.killed) {
      return false;
    }

    try {
      // 发送健康检查请求
      const config = await this._getConfig();
      const result = await this._sendHealthCheckRequest(config.port);

      this.statusDetails.lastHealthCheck = new Date();
      return result.ok;
    } catch (error) {
      this.outputChannel.appendLine(`[MCPLifecycleManager] Health check failed: ${error}`);
      return false;
    }
  }

  /**
   * 获取服务器当前状态
   *
   * @returns MCP服务器状态对象
   */
  getStatus(): MCPServerStatus {
    const status: MCPServerStatus = {
      status: this.state,
      pid: this.statusDetails.pid,
      port: this.statusDetails.port,
      lastHealthCheck: this.statusDetails.lastHealthCheck,
      healthCheckFailures: this.healthCheckFailureCount,
      isHealthy: this.state === MCPServerState.RUNNING,
      startedAt: this.statusDetails.startTime
    };

    // 计算运行时长
    if (this.state === MCPServerState.RUNNING && this.statusDetails.startTime) {
      status.uptime = Date.now() - this.statusDetails.startTime.getTime();
    }

    // 添加错误信息
    if (this.state === MCPServerState.ERROR && this.statusDetails.errorMessage) {
      status.error = {
        message: this.statusDetails.errorMessage
      };
    }

    return status;
  }

  /**
   * 启动MCP服务器（内部方法）
   *
   * 执行步骤：
   * 1. 检查Codex CLI是否安装
   * 2. 加载配置
   * 3. 启动MCP服务器进程
   * 4. 监听进程输出
   * 5. 等待就绪信号
   * 6. 启动健康检查
   *
   * @returns MCP服务器状态
   * @throws 如果启动失败
   */
  private async _start(): Promise<MCPServerStatus> {
    this.outputChannel.appendLine('[MCPLifecycleManager] Starting MCP server...');
    this.state = MCPServerState.STARTING;

    try {
      // 1. 检查Codex CLI是否安装
      await this._checkCodexCLI();

      // 2. 加载配置
      const config = await this._getConfig();

      // 3. 启动MCP服务器进程
      this.process = spawn('codex', ['mcp-server', '--port', config.port.toString()], {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        env: process.env
      });

      // 记录PID和端口
      this.statusDetails.pid = this.process.pid;
      this.statusDetails.port = config.port;

      // 4. 监听进程输出
      this.process.stdout?.on('data', (data) => {
        this.outputChannel.appendLine(`[MCP Server] ${data.toString().trim()}`);
      });

      this.process.stderr?.on('data', (data) => {
        this.outputChannel.appendLine(`[MCP Server Error] ${data.toString().trim()}`);
      });

      // 监听进程退出
      this.process.on('exit', (code, signal) => {
        this.outputChannel.appendLine(`[MCP Server] Process exited with code ${code}, signal ${signal}`);
        this.state = MCPServerState.STOPPED;
        this.statusDetails = {};
      });

      // 监听进程错误
      this.process.on('error', (error) => {
        this.outputChannel.appendLine(`[MCP Server] Process error: ${error.message}`);
        this.state = MCPServerState.ERROR;
        this.statusDetails.errorMessage = error.message;
      });

      // 5. 等待就绪信号
      await this._waitForReady();

      // 6. 启动健康检查
      this._startHealthChecks();

      // 更新状态
      this.state = MCPServerState.RUNNING;
      this.statusDetails.startTime = new Date();

      this.outputChannel.appendLine(`[MCPLifecycleManager] MCP server started (PID: ${this.process.pid}, Port: ${config.port})`);
      return this.getStatus();

    } catch (error) {
      // 启动失败，更新状态
      this.state = MCPServerState.ERROR;
      this.statusDetails.errorMessage = error instanceof Error ? error.message : String(error);

      this.outputChannel.appendLine(`[MCPLifecycleManager] Failed to start: ${this.statusDetails.errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查Codex CLI是否已安装
   *
   * 执行 `codex --version` 命令检查CLI是否可用
   * 如果未安装，显示详细的错误提示和安装指引
   *
   * 实现步骤：
   * 1. 执行 `codex --version` 命令
   * 2. 检查命令返回状态
   * 3. 如果失败，显示详细的安装指引对话框
   * 4. 提供多个操作选项：查看安装指南、查看系统要求、取消
   *
   * @throws 如果Codex CLI未安装或检测失败
   */
  private async _checkCodexCLI(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('codex --version', { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          // 记录详细的错误信息
          const errorDetails = {
            message: error.message,
            code: (error as any).code,
            stderr: stderr.trim()
          };

          this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');
          this.outputChannel.appendLine('[MCPLifecycleManager] Codex CLI检测失败');
          this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');
          this.outputChannel.appendLine(`[MCPLifecycleManager] 错误信息: ${errorDetails.message}`);
          if (errorDetails.code) {
            this.outputChannel.appendLine(`[MCPLifecycleManager] 错误代码: ${errorDetails.code}`);
          }
          if (errorDetails.stderr) {
            this.outputChannel.appendLine(`[MCPLifecycleManager] 标准错误: ${errorDetails.stderr}`);
          }

          // 显示详细的错误提示对话框
          this._showCodexInstallationGuide(errorDetails);

          reject(new Error('Codex CLI is not installed or not accessible'));
        } else {
          const version = stdout.trim();
          this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');
          this.outputChannel.appendLine('[MCPLifecycleManager] Codex CLI检测成功');
          this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');
          this.outputChannel.appendLine(`[MCPLifecycleManager] Codex CLI版本: ${version}`);

          // 检查版本是否符合要求（假设最低版本为1.0.0）
          if (!this._isCodexVersionSupported(version)) {
            this.outputChannel.appendLine('[MCPLifecycleManager] 警告: Codex CLI版本可能不受支持');
            vscode.window.showWarningMessage(
              `Codex CLI版本 ${version} 可能不受支持。推荐使用1.0.0及以上版本。`,
              '继续使用',
              '查看版本要求'
            ).then(choice => {
              if (choice === '查看版本要求') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude/docs/codex-requirements'));
              }
            });
          }

          resolve();
        }
      });
    });
  }

  /**
   * 显示Codex安装指引对话框
   *
   * 提供详细的安装说明和多个操作选项：
   * - 查看安装指南（打开官方文档）
   * - 查看系统要求（打开系统要求页面）
   * - 查看输出日志（打开OutputChannel）
   * - 取消
   *
   * @param errorDetails 错误详细信息
   */
  private _showCodexInstallationGuide(errorDetails: { message: string; code?: string; stderr?: string }): void {
    // 构建详细的错误消息
    let errorMessage = 'Codex CLI未安装或无法访问。';

    if (errorDetails.code === 'ENOENT' || errorDetails.message.includes('not found')) {
      errorMessage += '\n\n原因：系统中未找到codex命令。';
    } else if (errorDetails.code === 'ETIMEDOUT') {
      errorMessage += '\n\n原因：命令执行超时，可能是网络问题或CLI响应缓慢。';
    } else {
      errorMessage += `\n\n原因：${errorDetails.message}`;
    }

    errorMessage += '\n\n请按照以下步骤安装Codex CLI：';
    errorMessage += '\n\n1. 访问Anthropic官方文档获取最新安装方式';
    errorMessage += '\n2. 确保系统满足运行要求（Node.js 18+）';
    errorMessage += '\n3. 安装后重新启动VSCode';
    errorMessage += '\n4. 验证安装：在终端运行 `codex --version`';

    // 显示详细的错误对话框
    vscode.window.showErrorMessage(
      errorMessage,
      {
        modal: true,
        detail: '您需要安装Codex CLI才能使用Codex工作流编排功能。'
      },
      '查看安装指南',
      '查看系统要求',
      '查看详细日志'
    ).then(choice => {
      switch (choice) {
        case '查看安装指南':
          vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude/docs/codex-installation'));
          break;
        case '查看系统要求':
          vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude/docs/codex-requirements'));
          break;
        case '查看详细日志':
          this.outputChannel.show();
          break;
      }
    });
  }

  /**
   * 检查Codex CLI版本是否受支持
   *
   * 当前支持的版本：1.0.0及以上
   *
   * @param versionString 版本字符串（如："codex version 1.2.3"）
   * @returns true表示版本受支持，false表示不受支持
   */
  private _isCodexVersionSupported(versionString: string): boolean {
    try {
      // 从版本字符串中提取版本号
      // 支持格式：
      // - "codex version 1.2.3"
      // - "1.2.3"
      // - "v1.2.3"
      const versionMatch = versionString.match(/(\d+)\.(\d+)\.(\d+)/);

      if (!versionMatch) {
        this.outputChannel.appendLine(`[MCPLifecycleManager] 无法解析版本号: ${versionString}`);
        return true; // 无法解析时默认允许继续
      }

      const major = parseInt(versionMatch[1], 10);
      const minor = parseInt(versionMatch[2], 10);
      const patch = parseInt(versionMatch[3], 10);

      // 检查是否为1.0.0及以上版本
      if (major >= 1) {
        this.outputChannel.appendLine(`[MCPLifecycleManager] 版本检查通过: ${major}.${minor}.${patch} >= 1.0.0`);
        return true;
      }

      this.outputChannel.appendLine(`[MCPLifecycleManager] 版本过低: ${major}.${minor}.${patch} < 1.0.0`);
      return false;
    } catch (error) {
      this.outputChannel.appendLine(`[MCPLifecycleManager] 版本检查异常: ${error}`);
      return true; // 检查失败时默认允许继续
    }
  }

  /**
   * 获取MCP配置
   *
   * 从配置管理器读取MCP配置，如果未配置则使用默认值：
   * - port: 8765
   * - timeout: 300000ms (5分钟)
   * - logLevel: 'info'
   *
   * @returns MCP配置对象
   */
  private async _getConfig(): Promise<MCPConfig> {
    const settings = await this.configManager.getSettings();
    return settings.codex?.mcp || {
      port: 8765,
      timeout: 300000,  // 5 minutes
      logLevel: 'info'
    };
  }

  /**
   * 等待服务器就绪
   *
   * 轮询检查服务器状态，直到：
   * - 状态变为RUNNING（通过健康检查）
   * - 状态变为ERROR（启动失败）
   * - 超时（默认5秒）
   *
   * @returns MCP服务器状态
   * @throws 如果超时或启动失败
   */
  private async _waitForReady(): Promise<MCPServerStatus> {
    const maxWaitTime = 5000; // 5秒
    const checkInterval = 500; // 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否已经运行
      if (this.state === MCPServerState.RUNNING) {
        return this.getStatus();
      }

      // 检查是否出错
      if (this.state === MCPServerState.ERROR) {
        throw new Error(this.statusDetails.errorMessage || 'MCP server failed to start');
      }

      // 尝试健康检查
      const healthy = await this.healthCheck();
      if (healthy) {
        this.state = MCPServerState.RUNNING;
        return this.getStatus();
      }

      // 等待下一次检查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('MCP server start timeout (waited 5 seconds)');
  }

  /**
   * 启动健康检查定时器
   *
   * 每30秒执行一次健康检查，如果检查失败：
   * 1. 增加失败计数
   * 2. 如果失败次数达到阈值（3次），触发自动重启
   * 3. 重启后重置失败计数
   */
  private _startHealthChecks(): void {
    // 清理旧的定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 重置失败计数
    this.healthCheckFailureCount = 0;

    this.outputChannel.appendLine(`[MCPLifecycleManager] Starting health checks (interval: ${this.HEALTH_CHECK_INTERVAL}ms, max failures: ${this.MAX_HEALTH_CHECK_FAILURES})`);

    // 定时健康检查
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthy = await this.healthCheck();

        if (healthy) {
          // 健康检查成功，重置失败计数
          if (this.healthCheckFailureCount > 0) {
            this.outputChannel.appendLine(`[MCPLifecycleManager] Health check recovered, resetting failure count from ${this.healthCheckFailureCount}`);
            this.healthCheckFailureCount = 0;
          }
        } else if (this.state === MCPServerState.RUNNING) {
          // 健康检查失败
          await this._handleHealthCheckFailure();
        }
      } catch (error) {
        this.outputChannel.appendLine(`[MCPLifecycleManager] Health check error: ${error}`);
        await this._handleHealthCheckFailure();
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 处理健康检查失败
   *
   * 增加失败计数，当达到阈值时触发自动重启：
   * 1. 增加 healthCheckFailureCount
   * 2. 如果失败次数 >= MAX_HEALTH_CHECK_FAILURES，触发自动重启
   * 3. 调用 stop() 然后 ensureStarted()
   * 4. 重启成功后重置失败计数
   */
  private async _handleHealthCheckFailure(): Promise<void> {
    this.healthCheckFailureCount++;
    this.outputChannel.appendLine(`[MCPLifecycleManager] Health check failed (${this.healthCheckFailureCount}/${this.MAX_HEALTH_CHECK_FAILURES})`);

    if (this.healthCheckFailureCount >= this.MAX_HEALTH_CHECK_FAILURES) {
      this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');
      this.outputChannel.appendLine('[MCPLifecycleManager] Max health check failures reached, attempting auto-restart...');
      this.outputChannel.appendLine('[MCPLifecycleManager] ========================================');

      try {
        // 停止当前服务器
        await this.stop();

        // 等待一小段时间确保资源释放
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 重新启动
        await this.ensureStarted();

        this.outputChannel.appendLine('[MCPLifecycleManager] Auto-restart successful');
        this.healthCheckFailureCount = 0;
      } catch (error) {
        this.outputChannel.appendLine(`[MCPLifecycleManager] Auto-restart failed: ${error}`);
        this.state = MCPServerState.ERROR;
        this.statusDetails.errorMessage = `Auto-restart failed after ${this.MAX_HEALTH_CHECK_FAILURES} health check failures: ${error}`;
      }
    }
  }

  /**
   * 发送健康检查请求
   *
   * 向MCP服务器发送健康检查请求，验证服务器是否正常响应
   * 使用TCP连接检查端口是否可访问
   *
   * 实现方式：
   * 1. 首先检查进程是否存在
   * 2. 尝试创建TCP连接到指定端口
   * 3. 设置超时时间（5秒）
   * 4. 连接成功则表示健康，失败则不健康
   *
   * @param port 服务器端口
   * @returns 健康检查结果
   */
  private async _sendHealthCheckRequest(port: number): Promise<{ ok: boolean }> {
    // 1. 首先检查进程是否存在
    if (!this.process || this.process.killed) {
      this.outputChannel.appendLine('[MCPLifecycleManager] Health check failed: process not running');
      return { ok: false };
    }

    // 2. 尝试TCP连接
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();

      // 设置超时
      const timeout = setTimeout(() => {
        socket.destroy();
        this.outputChannel.appendLine(`[MCPLifecycleManager] Health check timeout after ${this.HEALTH_CHECK_TIMEOUT}ms`);
        resolve({ ok: false });
      }, this.HEALTH_CHECK_TIMEOUT);

      // 尝试连接
      socket.connect(port, 'localhost', () => {
        // 连接成功
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true });
      });

      // 连接错误
      socket.on('error', (error: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        this.outputChannel.appendLine(`[MCPLifecycleManager] Health check connection error: ${error.message}`);
        resolve({ ok: false });
      });
    });
  }
}
