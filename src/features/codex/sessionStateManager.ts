/**
 * 会话状态管理器
 *
 * 职责:
 * 1. 创建和管理Codex会话的生命周期
 * 2. 持久化会话状态到sessions.json
 * 3. 提供会话检查点和恢复机制
 * 4. 清理过期会话
 *
 * 需求: 需求8.1, 需求8.4, 需求8.7
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import {
  Session,
  TaskDescriptor,
  SessionCheckpoint,
  ExecutionOptions,
  ComplexityScore,
  CodebaseSnapshot
} from './types';

/**
 * 文件锁管理器
 * 防止并发写入冲突
 */
class FileLock {
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * 获取文件锁，等待直到可以获取
   */
  async acquire(filePath: string): Promise<() => void> {
    // 等待现有锁释放
    while (this.locks.has(filePath)) {
      await this.locks.get(filePath);
    }

    // 创建新锁
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(filePath, lockPromise);

    // 返回释放函数
    return () => {
      this.locks.delete(filePath);
      releaseLock!();
    };
  }
}

/**
 * 会话持久化数据结构
 */
interface SessionsData {
  /** 会话列表 */
  sessions: Session[];

  /** 最后更新时间 */
  lastUpdated: string;

  /** 版本号（用于迁移） */
  version: string;
}

/**
 * 会话状态管理器
 *
 * 管理Codex任务的会话状态，包括创建、保存、恢复和清理。
 */
export class SessionStateManager {
  private sessions: Map<string, Session> = new Map();
  private sessionsFilePath: string;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分钟无活动超时
  private readonly CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 每5分钟检查一次超时会话
  private readonly DATA_VERSION = '1.0.0';
  private cleanupTimer?: NodeJS.Timeout;

  // 文件锁管理器（防止并发写入冲突）
  private fileLock: FileLock = new FileLock();

  // 增量更新追踪：记录哪些会话已修改
  private dirtySessionIds: Set<string> = new Set();

  // 上次持久化的时间戳
  private lastPersistTime: number = 0;

  // 最小持久化间隔（毫秒）- 防止过于频繁的写入
  private readonly MIN_PERSIST_INTERVAL_MS = 1000;

  /**
   * 构造函数
   *
   * @param context VSCode扩展上下文
   * @param outputChannel 输出通道（用于日志）
   */
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {
    // 计算sessions.json文件路径
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder found');
    }

    this.sessionsFilePath = path.join(workspaceRoot, '.claude', 'codex', 'sessions.json');

    // 加载已有会话
    this._loadSessions().catch(err => {
      this.outputChannel.appendLine(`[SessionStateManager] Failed to load sessions: ${err.message}`);
    });

    // 启动定时清理检查
    this._startCleanupTimer();
  }

  /**
   * 创建新会话
   *
   * @param task 任务描述符
   * @param options 执行选项（可选）
   * @returns 创建的会话对象
   *
   * 需求: 需求8.1 - 创建会话ID并记录到sessions.json
   */
  async createSession(
    task: TaskDescriptor,
    options?: ExecutionOptions
  ): Promise<Session> {
    // 生成会话ID (格式: codex-{timestamp}-{uuid})
    const sessionId = this._generateSessionId();

    const now = new Date();
    const session: Session = {
      id: sessionId,
      task,
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
      context: {
        options
      },
      checkpoints: [],
      metadata: {}
    };

    // 存储到内存中
    this.sessions.set(sessionId, session);

    // 标记为脏数据
    this.dirtySessionIds.add(sessionId);

    // 持久化到文件（强制立即持久化）
    await this._persistSessions(true);

    this.outputChannel.appendLine(`[SessionStateManager] Created session: ${sessionId}`);

    return session;
  }

  /**
   * 保存会话状态
   *
   * @param session 会话对象
   * @param result 执行结果（可选）
   *
   * 需求: 需求8.4 - 保存当前工作状态
   */
  async saveState(session: Session, result?: any): Promise<void> {
    // 更新会话的最后活跃时间
    session.lastActiveAt = new Date();

    // 如果提供了结果，更新会话元数据
    if (result) {
      session.metadata = {
        ...session.metadata,
        lastResult: result
      };
    }

    // 更新内存中的会话
    this.sessions.set(session.id, session);

    // 标记为脏数据
    this.dirtySessionIds.add(session.id);

    // 持久化到文件
    await this._persistSessions();

    this.outputChannel.appendLine(`[SessionStateManager] Saved state for session: ${session.id}`);
  }

  /**
   * 更新会话上下文
   *
   * @param sessionId 会话ID
   * @param complexityScore 复杂度评分（可选）
   * @param codebaseSnapshot 代码库快照（可选）
   */
  async updateContext(
    sessionId: string,
    complexityScore?: ComplexityScore,
    codebaseSnapshot?: CodebaseSnapshot
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 更新上下文
    session.context = session.context || {};
    if (complexityScore) {
      session.context.complexityScore = complexityScore;
    }
    if (codebaseSnapshot) {
      session.context.codebaseSnapshot = codebaseSnapshot;
    }

    // 更新最后活跃时间
    session.lastActiveAt = new Date();

    // 标记为脏数据
    this.dirtySessionIds.add(sessionId);

    // 持久化（强制立即持久化）
    await this._persistSessions(true);

    this.outputChannel.appendLine(`[SessionStateManager] Updated context for session: ${sessionId}`);
  }

  /**
   * 创建会话检查点
   *
   * @param sessionId 会话ID
   * @param state 状态数据
   * @param description 检查点描述
   *
   * 需求: 需求8.4 - 创建检查点用于恢复
   */
  async createCheckpoint(
    sessionId: string,
    state: Record<string, any>,
    description: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const checkpoint: SessionCheckpoint = {
      id: randomUUID(),
      timestamp: new Date(),
      description,
      state
    };

    // 添加检查点
    session.checkpoints = session.checkpoints || [];
    session.checkpoints.push(checkpoint);

    // 更新最后活跃时间
    session.lastActiveAt = new Date();

    // 标记为脏数据
    this.dirtySessionIds.add(sessionId);

    // 持久化（强制立即持久化）
    await this._persistSessions(true);

    this.outputChannel.appendLine(
      `[SessionStateManager] Created checkpoint for session ${sessionId}: ${description}`
    );
  }

  /**
   * 恢复会话
   *
   * @param sessionId 会话ID
   * @returns 恢复的会话对象，如果不存在则返回null
   *
   * 需求: 需求8.7 - 加载之前的上下文信息，继续未完成任务
   */
  async restoreSession(sessionId: string): Promise<Session | null> {
    let session = this.sessions.get(sessionId);

    // 如果内存中没有，尝试从文件加载
    if (!session) {
      await this._loadSessions();
      session = this.sessions.get(sessionId);
    }

    if (!session) {
      this.outputChannel.appendLine(
        `[SessionStateManager] Session not found: ${sessionId}`
      );
      return null;
    }

    // 更新最后活跃时间
    session.lastActiveAt = new Date();
    await this._persistSessions();

    this.outputChannel.appendLine(
      `[SessionStateManager] Restored session: ${sessionId}`
    );

    return session;
  }

  /**
   * 获取会话
   *
   * @param sessionId 会话ID
   * @returns 会话对象，如果不存在则返回null
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 更新会话状态
   *
   * @param sessionId 会话ID
   * @param status 新状态
   */
  async updateSessionStatus(
    sessionId: string,
    status: Session['status']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    session.lastActiveAt = new Date();

    // 标记为脏数据
    this.dirtySessionIds.add(sessionId);

    await this._persistSessions(true);

    this.outputChannel.appendLine(
      `[SessionStateManager] Updated session ${sessionId} status to: ${status}`
    );
  }

  /**
   * 获取所有活跃会话
   *
   * @returns 活跃会话列表
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'active'
    );
  }

  /**
   * 清理旧会话
   *
   * @param maxAge 最大年龄（毫秒），默认30分钟
   * @returns 清理的会话数量
   *
   * 需求: 需求8.6 - 无活动30分钟后自动关闭会话
   */
  async cleanupOldSessions(maxAge: number = this.SESSION_TIMEOUT_MS): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActiveAt.getTime();

      // 只清理活跃会话（已完成或失败的会话保留用于历史记录）
      if (session.status === 'active' && age > maxAge) {
        session.status = 'timeout';
        cleanedCount++;

        // 标记为脏数据
        this.dirtySessionIds.add(sessionId);

        this.outputChannel.appendLine(
          `[SessionStateManager] Session ${sessionId} timed out (age: ${Math.round(age / 1000)}s)`
        );
      }
    }

    if (cleanedCount > 0) {
      await this._persistSessions();
    }

    return cleanedCount;
  }

  /**
   * 删除会话
   *
   * @param sessionId 会话ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.sessions.delete(sessionId);
    await this._persistSessions();

    this.outputChannel.appendLine(
      `[SessionStateManager] Deleted session: ${sessionId}`
    );
  }

  /**
   * 优雅关闭所有活跃会话
   *
   * 需求: 需求8.5 - 用户关闭VSCode时优雅关闭所有活跃会话
   */
  async shutdownAllActiveSessions(): Promise<void> {
    const activeSessions = this.getActiveSessions();

    this.outputChannel.appendLine(
      `[SessionStateManager] Shutting down ${activeSessions.length} active sessions...`
    );

    for (const session of activeSessions) {
      session.status = 'cancelled';
      session.lastActiveAt = new Date();

      // 标记为脏数据
      this.dirtySessionIds.add(session.id);
    }

    if (activeSessions.length > 0) {
      await this._persistSessions();
    }

    this.outputChannel.appendLine(
      `[SessionStateManager] All active sessions shut down`
    );
  }

  /**
   * 获取会话统计信息
   *
   * @returns 统计信息对象
   */
  getStatistics(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    timeout: number;
    cancelled: number;
  } {
    const stats = {
      total: this.sessions.size,
      active: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
      cancelled: 0
    };

    for (const session of this.sessions.values()) {
      stats[session.status]++;
    }

    return stats;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成会话ID
   * 格式: codex-{timestamp}-{uuid}
   *
   * 需求: 需求8.1 - 会话ID格式规范
   */
  private _generateSessionId(): string {
    const timestamp = Date.now();
    const uuid = randomUUID().split('-')[0]; // 取UUID的前8位
    return `codex-${timestamp}-${uuid}`;
  }

  /**
   * 持久化会话到文件
   *
   * 实现增量更新策略和文件锁机制
   * 需求: 需求8.1 - 记录到sessions.json
   * 需求: 任务17 - 增量更新策略和文件锁
   *
   * @param force 强制立即持久化，跳过防抖检查
   */
  private async _persistSessions(force: boolean = false): Promise<void> {
    // 检查是否有脏数据需要保存
    if (this.dirtySessionIds.size === 0) {
      return;
    }

    // 检查是否距离上次持久化时间太短（防抖）
    const now = Date.now();
    const timeSinceLastPersist = now - this.lastPersistTime;
    if (!force && timeSinceLastPersist < this.MIN_PERSIST_INTERVAL_MS) {
      // 延迟持久化
      setTimeout(() => this._persistSessions(false), this.MIN_PERSIST_INTERVAL_MS - timeSinceLastPersist);
      return;
    }

    // 获取文件锁
    const releaseLock = await this.fileLock.acquire(this.sessionsFilePath);

    try {
      // 确保目录存在
      const dir = path.dirname(this.sessionsFilePath);
      await fs.mkdir(dir, { recursive: true });

      // 准备数据（完整保存所有会话，但标记为已持久化）
      const data: SessionsData = {
        sessions: Array.from(this.sessions.values()),
        lastUpdated: new Date().toISOString(),
        version: this.DATA_VERSION
      };

      // 写入文件（原子性写入：先写临时文件，再重命名）
      const tempFilePath = `${this.sessionsFilePath}.tmp`;
      await fs.writeFile(
        tempFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      // 原子性重命名
      await fs.rename(tempFilePath, this.sessionsFilePath);

      // 清空脏数据标记
      this.dirtySessionIds.clear();

      // 更新持久化时间
      this.lastPersistTime = now;

      this.outputChannel.appendLine(
        `[SessionStateManager] Persisted ${data.sessions.length} sessions to file`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[SessionStateManager] Failed to persist sessions: ${errorMessage}`
      );
      throw error;
    } finally {
      // 释放文件锁
      releaseLock();
    }
  }

  /**
   * 从文件加载会话
   *
   * 需求: 需求8.7 - 加载之前的上下文信息
   */
  private async _loadSessions(): Promise<void> {
    try {
      // 检查文件是否存在
      try {
        await fs.access(this.sessionsFilePath);
      } catch {
        // 文件不存在，初始化为空
        this.outputChannel.appendLine(
          `[SessionStateManager] Sessions file not found, starting fresh`
        );
        return;
      }

      // 读取文件
      const content = await fs.readFile(this.sessionsFilePath, 'utf-8');
      const data: SessionsData = JSON.parse(content);

      // 验证版本
      if (data.version !== this.DATA_VERSION) {
        this.outputChannel.appendLine(
          `[SessionStateManager] Warning: Sessions data version mismatch (${data.version} vs ${this.DATA_VERSION})`
        );
      }

      // 加载会话到内存
      this.sessions.clear();
      for (const session of data.sessions) {
        // 将日期字符串转换回Date对象
        session.createdAt = new Date(session.createdAt);
        session.lastActiveAt = new Date(session.lastActiveAt);

        if (session.checkpoints) {
          for (const checkpoint of session.checkpoints) {
            checkpoint.timestamp = new Date(checkpoint.timestamp);
          }
        }

        this.sessions.set(session.id, session);
      }

      this.outputChannel.appendLine(
        `[SessionStateManager] Loaded ${this.sessions.size} sessions from file`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[SessionStateManager] Failed to load sessions: ${errorMessage}`
      );
      // 不抛出错误，继续使用空的会话列表
    }
  }

  /**
   * 启动定时清理检查
   *
   * 每隔CLEANUP_CHECK_INTERVAL_MS（5分钟）检查一次超时会话
   * 需求: 需求8.6 - 无活动30分钟后自动关闭会话
   */
  private _startCleanupTimer(): void {
    // 清除已存在的定时器（防止重复启动）
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        const cleanedCount = await this.cleanupOldSessions();
        if (cleanedCount > 0) {
          this.outputChannel.appendLine(
            `[SessionStateManager] Auto cleanup: ${cleanedCount} session(s) timed out`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[SessionStateManager] Auto cleanup failed: ${errorMessage}`
        );
      }
    }, this.CLEANUP_CHECK_INTERVAL_MS);

    this.outputChannel.appendLine(
      `[SessionStateManager] Cleanup timer started (interval: ${this.CLEANUP_CHECK_INTERVAL_MS / 1000}s)`
    );
  }

  /**
   * 停止定时清理检查
   */
  private _stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      this.outputChannel.appendLine(
        `[SessionStateManager] Cleanup timer stopped`
      );
    }
  }

  /**
   * 释放资源
   *
   * 在扩展deactivate时调用，用于清理定时器和持久化最终状态
   * 需求: 需求8.5 - 用户关闭VSCode时优雅关闭所有活跃会话
   */
  async dispose(): Promise<void> {
    this.outputChannel.appendLine(
      `[SessionStateManager] Disposing session state manager...`
    );

    // 停止定时器
    this._stopCleanupTimer();

    // 优雅关闭所有活跃会话
    await this.shutdownAllActiveSessions();

    this.outputChannel.appendLine(
      `[SessionStateManager] Session state manager disposed`
    );
  }
}
