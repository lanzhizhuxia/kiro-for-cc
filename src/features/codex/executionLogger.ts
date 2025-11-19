/**
 * 执行日志记录器
 *
 * 职责:
 * 1. 记录MCP通信内容（请求和响应）
 * 2. 记录推理步骤和上下文
 * 3. 记录文件操作
 * 4. 实时输出到OutputChannel
 * 5. 持久化保存到日志文件
 *
 * 日志格式:
 * [2025-01-18 14:30:45] [MCP-REQUEST] callCodex: {...}
 * [2025-01-18 14:30:46] [THINKING] Step 1: Problem decomposition
 * [2025-01-18 14:30:50] [FILE-OP] Read: src/extension.ts
 * [2025-01-18 14:30:51] [MCP-RESPONSE] Success
 *
 * 需求: 需求9.1, 需求9.4
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 日志级别
 */
export enum LogLevel {
  /** 调试信息 */
  DEBUG = 'DEBUG',
  /** 一般信息 */
  INFO = 'INFO',
  /** 警告 */
  WARN = 'WARN',
  /** 错误 */
  ERROR = 'ERROR'
}

/**
 * 日志类型
 */
export enum LogType {
  /** MCP请求 */
  MCP_REQUEST = 'MCP-REQUEST',
  /** MCP响应 */
  MCP_RESPONSE = 'MCP-RESPONSE',
  /** 思考步骤 */
  THINKING = 'THINKING',
  /** 文件操作 */
  FILE_OP = 'FILE-OP',
  /** 一般信息 */
  INFO = 'INFO',
  /** 错误 */
  ERROR = 'ERROR'
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: Date;
  /** 日志级别 */
  level: LogLevel;
  /** 日志类型 */
  type: LogType;
  /** 日志消息 */
  message: string;
  /** 额外数据（可选） */
  data?: any;
}

/**
 * 执行日志记录器
 *
 * 负责记录Codex执行过程中的所有关键事件，包括：
 * - MCP通信（请求/响应）
 * - 深度推理步骤
 * - 文件操作
 * - 错误信息
 *
 * 日志同时输出到：
 * 1. VSCode OutputChannel（实时查看）
 * 2. 文件系统（持久化存储）
 *
 * @example
 * ```typescript
 * const logger = new ExecutionLogger('task-001', outputChannel);
 * await logger.init();
 *
 * logger.logMCPRequest('callCodex', { prompt: '...' });
 * logger.logThinkingStep('Problem decomposition', { complexity: 7 });
 * logger.logFileOperation('Read', 'src/extension.ts');
 *
 * await logger.flush();
 * logger.dispose();
 * ```
 */
export class ExecutionLogger {
  /** 日志文件路径 */
  private logFilePath: string = '';

  /** 日志缓冲区 */
  private logBuffer: LogEntry[] = [];

  /** 是否已初始化 */
  private initialized: boolean = false;

  /** 写入流（用于高效文件写入） */
  private writeStream?: fs.WriteStream;

  /** 最大缓冲区大小（超过此大小会自动flush） */
  private readonly MAX_BUFFER_SIZE = 50;

  /** 自动flush定时器 */
  private autoFlushTimer?: NodeJS.Timeout;

  /** 自动flush间隔（毫秒） */
  private readonly AUTO_FLUSH_INTERVAL_MS = 5000; // 5秒

  /**
   * 构造函数
   *
   * @param taskId 任务ID
   * @param outputChannel VSCode输出通道
   */
  constructor(
    private taskId: string,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * 初始化日志记录器
   *
   * 创建日志文件路径和目录，启动自动flush定时器
   *
   * @throws 如果无法创建日志目录
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 获取工作区根目录
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      // 构建日志文件路径
      const logDir = path.join(workspaceRoot, '.claude/codex/execution-history');
      this.logFilePath = path.join(logDir, `${this.taskId}.log`);

      // 创建日志目录（如果不存在）
      await fs.promises.mkdir(logDir, { recursive: true });

      // 创建写入流
      this.writeStream = fs.createWriteStream(this.logFilePath, {
        flags: 'a', // append模式
        encoding: 'utf8'
      });

      // 写入日志头
      const header = this._formatLogEntry({
        timestamp: new Date(),
        level: LogLevel.INFO,
        type: LogType.INFO,
        message: `=== Execution Log Started for Task: ${this.taskId} ===`
      });

      this.writeStream.write(header + '\n');

      // 启动自动flush定时器
      this._startAutoFlush();

      this.initialized = true;
      this.outputChannel.appendLine(`[ExecutionLogger] Initialized for task: ${this.taskId}`);
      this.outputChannel.appendLine(`[ExecutionLogger] Log file: ${this.logFilePath}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ExecutionLogger] Initialization failed: ${errorMessage}`);
      throw new Error(`Failed to initialize execution logger: ${errorMessage}`);
    }
  }

  /**
   * 记录MCP请求
   *
   * @param method MCP方法名
   * @param params 请求参数
   */
  logMCPRequest(method: string, params: any): void {
    const message = `${method}`;
    const data = this._sanitizeData(params);

    this._log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      type: LogType.MCP_REQUEST,
      message,
      data
    });
  }

  /**
   * 记录MCP响应
   *
   * @param method MCP方法名
   * @param response 响应数据
   */
  logMCPResponse(method: string, response: any): void {
    const isError = response.status === 'error' || response.error;
    const level = isError ? LogLevel.ERROR : LogLevel.INFO;
    const message = isError
      ? `${method} - Error: ${response.error?.message || 'Unknown error'}`
      : `${method} - Success`;

    this._log({
      timestamp: new Date(),
      level,
      type: LogType.MCP_RESPONSE,
      message,
      data: this._sanitizeData(response)
    });
  }

  /**
   * 记录推理步骤
   *
   * @param step 步骤描述
   * @param details 步骤详情
   */
  logThinkingStep(step: string, details: any): void {
    this._log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      type: LogType.THINKING,
      message: step,
      data: this._sanitizeData(details)
    });
  }

  /**
   * 记录文件操作
   *
   * @param operation 操作类型（Read/Write/Delete等）
   * @param filePath 文件路径
   */
  logFileOperation(operation: string, filePath: string): void {
    this._log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      type: LogType.FILE_OP,
      message: `${operation}: ${filePath}`
    });
  }

  /**
   * 记录错误
   *
   * @param error 错误对象
   * @param context 错误上下文（可选）
   */
  logError(error: Error, context?: string): void {
    const message = context
      ? `${context}: ${error.message}`
      : error.message;

    this._log({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      type: LogType.ERROR,
      message,
      data: {
        stack: error.stack,
        name: error.name
      }
    });
  }

  /**
   * 记录普通信息
   *
   * @param message 消息内容
   * @param data 额外数据（可选）
   */
  logInfo(message: string, data?: any): void {
    this._log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      type: LogType.INFO,
      message,
      data: data ? this._sanitizeData(data) : undefined
    });
  }

  /**
   * 刷新日志缓冲区到文件
   *
   * 将缓冲区中的所有日志写入文件
   */
  async flush(): Promise<void> {
    if (!this.initialized || this.logBuffer.length === 0) {
      return;
    }

    try {
      // 如果写入流不可用，直接使用appendFile
      if (!this.writeStream || this.writeStream.destroyed) {
        const logLines = this.logBuffer.map(entry => this._formatLogEntry(entry)).join('\n');
        await fs.promises.appendFile(this.logFilePath, logLines + '\n', 'utf8');
      } else {
        // 使用写入流，并等待写入完成
        const promises: Promise<void>[] = [];
        for (const entry of this.logBuffer) {
          const line = this._formatLogEntry(entry);
          promises.push(new Promise((resolve, reject) => {
            if (this.writeStream) {
              const success = this.writeStream.write(line + '\n');
              if (!success) {
                // 如果缓冲区满了，等待drain事件
                this.writeStream.once('drain', () => resolve());
              } else {
                resolve();
              }
            } else {
              resolve();
            }
          }));
        }

        await Promise.all(promises);
      }

      // 清空缓冲区
      this.logBuffer = [];

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ExecutionLogger] Flush failed: ${errorMessage}`);
    }
  }

  /**
   * 清理资源
   *
   * 停止自动flush定时器，刷新剩余日志，关闭写入流
   */
  dispose(): void {
    // 停止自动flush定时器
    this._stopAutoFlush();

    // 同步刷新剩余日志（阻塞方式）
    if (this.logBuffer.length > 0 && this.writeStream && !this.writeStream.destroyed) {
      for (const entry of this.logBuffer) {
        const line = this._formatLogEntry(entry);
        this.writeStream.write(line + '\n');
      }
      this.logBuffer = [];
    }

    // 关闭写入流
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.end(() => {
        this.outputChannel.appendLine(`[ExecutionLogger] Log file closed: ${this.logFilePath}`);
      });
    }

    this.initialized = false;
    this.outputChannel.appendLine(`[ExecutionLogger] Disposed for task: ${this.taskId}`);
  }

  /**
   * 获取日志文件路径
   *
   * @returns 日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  // ==================== 私有方法 ====================

  /**
   * 内部日志记录方法
   *
   * 将日志同时输出到OutputChannel和缓冲区
   *
   * @param entry 日志条目
   */
  private _log(entry: LogEntry): void {
    // 输出到OutputChannel（实时）
    const formattedLine = this._formatLogEntry(entry);
    this.outputChannel.appendLine(formattedLine);

    // 添加到缓冲区
    this.logBuffer.push(entry);

    // 如果缓冲区满了，自动flush
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush().catch(error => {
        this.outputChannel.appendLine(
          `[ExecutionLogger] Auto-flush failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
  }

  /**
   * 格式化日志条目为字符串
   *
   * 格式: [2025-01-18 14:30:45] [INFO] [MCP-REQUEST] callCodex: {...}
   *
   * @param entry 日志条目
   * @returns 格式化的日志字符串
   */
  private _formatLogEntry(entry: LogEntry): string {
    const timestamp = this._formatTimestamp(entry.timestamp);
    const level = entry.level.padEnd(5); // 对齐
    const type = entry.type.padEnd(12); // 对齐

    let line = `[${timestamp}] [${level}] [${type}] ${entry.message}`;

    // 添加数据（如果存在）
    if (entry.data !== undefined) {
      const dataStr = typeof entry.data === 'string'
        ? entry.data
        : JSON.stringify(entry.data, null, 2);

      // 如果数据太长，截断
      const maxDataLength = 500;
      if (dataStr.length > maxDataLength) {
        line += `\n  Data: ${dataStr.substring(0, maxDataLength)}... (truncated)`;
      } else {
        line += `\n  Data: ${dataStr}`;
      }
    }

    return line;
  }

  /**
   * 格式化时间戳
   *
   * 格式: 2025-01-18 14:30:45.123
   *
   * @param date 日期对象
   * @returns 格式化的时间字符串
   */
  private _formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 清理敏感数据
   *
   * 移除可能包含敏感信息的字段（如密码、token等）
   *
   * @param data 原始数据
   * @returns 清理后的数据
   */
  private _sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 深拷贝
    const sanitized = JSON.parse(JSON.stringify(data));

    // 移除敏感字段
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'credential',
      'authorization'
    ];

    const sanitizeObject = (obj: any): void => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * 启动自动flush定时器
   */
  private _startAutoFlush(): void {
    this.autoFlushTimer = setInterval(() => {
      this.flush().catch(error => {
        this.outputChannel.appendLine(
          `[ExecutionLogger] Auto-flush error: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }, this.AUTO_FLUSH_INTERVAL_MS);
  }

  /**
   * 停止自动flush定时器
   */
  private _stopAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = undefined;
    }
  }
}
