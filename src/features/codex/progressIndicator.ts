/**
 * 任务执行进度指示器 (Task 44)
 *
 * 职责:
 * 1. 在VSCode状态栏显示任务执行进度
 * 2. 显示当前执行阶段描述
 * 3. 支持进度取消操作
 * 4. 管理进度窗口的生命周期
 *
 * 需求: 需求9.2
 */

import * as vscode from 'vscode';

/**
 * 执行阶段枚举
 * 定义任务执行的各个阶段
 */
export type ExecutionPhase =
  | 'initializing'
  | 'routing'
  | 'analyzing-codebase'
  | 'deep-thinking'
  | 'executing'
  | 'saving-results'
  | 'completed';

/**
 * 进度指示器配置
 */
export interface ProgressIndicatorConfig {
  /** 进度窗口标题 */
  title: string;

  /** 是否可取消 */
  cancellable?: boolean;

  /** 进度显示位置 */
  location?: vscode.ProgressLocation;
}

/**
 * 进度指示器类
 *
 * 使用VSCode进度API显示任务执行进度，支持:
 * - 阶段切换和消息更新
 * - 增量进度更新
 * - 用户取消操作
 * - 优雅的生命周期管理
 */
export class ProgressIndicator {
  /** VSCode进度对象 */
  private progress?: vscode.Progress<{ message?: string; increment?: number }>;

  /** 取消令牌 */
  private token?: vscode.CancellationToken;

  /** 是否被取消 */
  private cancelled: boolean = false;

  /** 完成回调（用于控制进度窗口关闭时机） */
  private completeCallback?: () => void;

  /** 当前阶段 */
  private currentPhase?: ExecutionPhase;

  /** 当前进度值 (0-100) */
  private currentProgress: number = 0;

  /** 阶段到消息的映射 */
  private readonly PHASE_MESSAGES: Record<ExecutionPhase, string> = {
    'initializing': '正在初始化执行环境...',
    'routing': '正在分析任务复杂度...',
    'analyzing-codebase': '正在扫描代码库...',
    'deep-thinking': '正在执行深度推理...',
    'executing': '正在执行任务...',
    'saving-results': '正在保存执行结果...',
    'completed': '任务执行完成'
  };

  /** 阶段到进度基准的映射（百分比） */
  private readonly PHASE_PROGRESS_BASE: Record<ExecutionPhase, number> = {
    'initializing': 0,
    'routing': 10,
    'analyzing-codebase': 30,
    'deep-thinking': 50,
    'executing': 70,
    'saving-results': 90,
    'completed': 100
  };

  /**
   * 启动进度指示器
   *
   * 创建VSCode进度窗口并开始显示进度
   *
   * @param title 进度窗口标题
   * @param cancellable 是否允许取消（默认true）
   * @param location 进度显示位置（默认通知区域）
   * @returns Promise，在进度完成时resolve
   */
  async start(
    title: string,
    cancellable: boolean = true,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
  ): Promise<void> {
    this.cancelled = false;
    this.currentProgress = 0;

    return vscode.window.withProgress(
      {
        location,
        title,
        cancellable
      },
      async (progress, token) => {
        this.progress = progress;
        this.token = token;

        // 监听取消事件
        token.onCancellationRequested(() => {
          this.cancelled = true;
        });

        // 保持进度窗口打开直到 complete() 被调用
        await new Promise<void>(resolve => {
          this.completeCallback = resolve;
        });
      }
    );
  }

  /**
   * 更新进度消息
   *
   * @param message 新的进度消息
   */
  updateMessage(message: string): void {
    if (this.progress) {
      this.progress.report({ message });
    }
  }

  /**
   * 更新进度值（增量）
   *
   * @param increment 进度增量（0-100）
   */
  updateProgress(increment: number): void {
    if (this.progress && increment > 0) {
      this.progress.report({ increment });
      this.currentProgress = Math.min(100, this.currentProgress + increment);
    }
  }

  /**
   * 设置执行阶段
   *
   * 自动更新进度消息和进度值
   *
   * @param phase 执行阶段
   */
  setPhase(phase: ExecutionPhase): void {
    this.currentPhase = phase;
    const message = this.PHASE_MESSAGES[phase];
    const targetProgress = this.PHASE_PROGRESS_BASE[phase];

    // 计算需要增加的进度
    const increment = Math.max(0, targetProgress - this.currentProgress);

    if (this.progress) {
      this.progress.report({
        message,
        increment
      });

      this.currentProgress = targetProgress;
    }
  }

  /**
   * 检查是否被取消
   *
   * @returns 如果用户取消了操作返回true
   */
  isCancelled(): boolean {
    return this.cancelled || (this.token?.isCancellationRequested ?? false);
  }

  /**
   * 获取当前阶段
   *
   * @returns 当前执行阶段
   */
  getCurrentPhase(): ExecutionPhase | undefined {
    return this.currentPhase;
  }

  /**
   * 获取当前进度值
   *
   * @returns 当前进度（0-100）
   */
  getCurrentProgress(): number {
    return this.currentProgress;
  }

  /**
   * 完成进度指示
   *
   * 关闭进度窗口
   */
  complete(): void {
    if (this.completeCallback) {
      this.completeCallback();
      this.completeCallback = undefined;
    }

    // 清理引用
    this.progress = undefined;
    this.token = undefined;
  }

  /**
   * 创建阶段消息的自定义映射
   *
   * 允许覆盖默认的阶段消息
   *
   * @param customMessages 自定义消息映射
   */
  setCustomPhaseMessages(customMessages: Partial<Record<ExecutionPhase, string>>): void {
    Object.assign(this.PHASE_MESSAGES, customMessages);
  }
}
