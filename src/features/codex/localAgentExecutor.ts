/**
 * 本地Agent执行器
 *
 * 负责包装现有的本地agent系统,提供与CodexExecutor兼容的统一接口。
 * 使用ClaudeCodeProvider执行本地agent任务。
 *
 * @module localAgentExecutor
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import {
  TaskDescriptor,
  ExecutionResult,
  ExecutionMode
} from './types';

/**
 * 本地Agent执行器接口
 *
 * 提供与CodexExecutor兼容的执行接口
 */
export interface ILocalAgentExecutor {
  /**
   * 执行任务
   * @param task 任务描述符
   * @returns 执行结果
   */
  execute(task: TaskDescriptor): Promise<ExecutionResult>;
}

/**
 * 本地Agent执行器实现
 *
 * 核心功能：
 * - 包装现有的ClaudeCodeProvider
 * - 根据任务类型选择合适的agent
 * - 提供与CodexExecutor兼容的统一接口
 * - 支持headless模式执行
 *
 * @example
 * ```typescript
 * const executor = new LocalAgentExecutor(outputChannel);
 * const result = await executor.execute(task);
 * console.log('Execution result:', result);
 * ```
 */
export class LocalAgentExecutor implements ILocalAgentExecutor {
  /** Claude Code Provider */
  private claudeProvider: ClaudeCodeProvider;

  /** 输出通道 */
  private outputChannel: vscode.OutputChannel;

  /** Extension上下文 */
  private context: vscode.ExtensionContext;

  /**
   * 构造函数
   * @param outputChannel VSCode输出通道
   * @param context Extension上下文(可选)
   */
  constructor(
    outputChannel: vscode.OutputChannel,
    context?: vscode.ExtensionContext
  ) {
    this.outputChannel = outputChannel;

    // 如果没有传入context,尝试从全局获取
    if (!context) {
      // 创建一个临时的minimal context
      const globalStorageUri = vscode.Uri.file(
        path.join(
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
          '.claude/temp'
        )
      );
      this.context = {
        globalStorageUri,
        // 添加其他必需的属性为空实现
        subscriptions: [],
        workspaceState: {} as any,
        globalState: {} as any,
        extensionUri: vscode.Uri.file(''),
        extensionPath: '',
        asAbsolutePath: (relativePath: string) => relativePath,
        storagePath: undefined,
        globalStoragePath: globalStorageUri.fsPath,
        logPath: '',
        extensionMode: vscode.ExtensionMode.Production,
        extension: {} as any,
        environmentVariableCollection: {} as any,
        secrets: {} as any,
        storageUri: undefined,
        logUri: vscode.Uri.file(''),
        languageModelAccessInformation: {} as any
      };
    } else {
      this.context = context;
    }

    this.claudeProvider = new ClaudeCodeProvider(this.context, outputChannel);
  }

  /**
   * 执行任务
   *
   * 执行流程：
   * 1. 根据任务类型选择agent
   * 2. 构建prompt
   * 3. 调用ClaudeCodeProvider执行
   * 4. 返回标准化的执行结果
   *
   * @param task 任务描述符
   * @returns 执行结果
   */
  async execute(task: TaskDescriptor): Promise<ExecutionResult> {
    const startTime = new Date();
    const sessionId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.outputChannel.appendLine(`[LocalAgentExecutor] Starting execution for task: ${task.id}`);
    this.outputChannel.appendLine(`[LocalAgentExecutor] Task type: ${task.type}`);

    try {
      // 1. 根据任务类型选择agent和构建prompt
      const { agentName, prompt } = await this._prepareAgentPrompt(task);

      this.outputChannel.appendLine(`[LocalAgentExecutor] Using agent: ${agentName || 'default'}`);

      // 2. 执行agent任务
      let output: string = '';
      let exitCode: number | undefined;

      if (agentName) {
        // 使用系统提示词执行
        const terminal = await this.claudeProvider.executeWithSystemPrompt(
          prompt,
          agentName
        );

        // 对于有terminal的执行,我们无法直接获取输出,只能通过headless模式
        // 所以我们改用headless模式
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
          const agentPromptPath = path.join(
            workspaceRoot,
            '.claude/system-prompts',
            `${agentName}.md`
          );

          if (fs.existsSync(agentPromptPath)) {
            const systemPrompt = fs.readFileSync(agentPromptPath, 'utf-8');
            const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

            const result = await this.claudeProvider.invokeClaudeHeadless(fullPrompt);
            exitCode = result.exitCode;
            output = result.output || '';
          }
        }

        // 关闭terminal(如果需要)
        if (terminal) {
          terminal.dispose();
        }
      } else {
        // 直接执行prompt(无系统提示词)
        const result = await this.claudeProvider.invokeClaudeHeadless(prompt);
        exitCode = result.exitCode;
        output = result.output || '';
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // 3. 构建执行结果
      const success = exitCode === 0 || exitCode === undefined;

      this.outputChannel.appendLine(
        `[LocalAgentExecutor] Execution ${success ? 'completed' : 'failed'} in ${duration}ms`
      );

      const result: ExecutionResult = {
        success,
        mode: 'local' as ExecutionMode,
        sessionId,
        startTime,
        endTime,
        duration,
        output,
        generatedFiles: this._extractGeneratedFiles(output),
        metadata: {
          agentName: agentName || 'default',
          taskType: task.type,
          exitCode
        }
      };

      if (!success) {
        result.error = {
          message: `Agent execution failed with exit code: ${exitCode}`,
          code: String(exitCode)
        };
      }

      return result;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.outputChannel.appendLine(`[LocalAgentExecutor] Execution failed: ${error}`);

      // 返回失败结果
      return {
        success: false,
        mode: 'local' as ExecutionMode,
        sessionId,
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
   * 准备agent提示词
   *
   * 根据任务类型选择合适的agent和构建提示词
   *
   * @param task 任务描述符
   * @returns agent名称和提示词
   */
  private async _prepareAgentPrompt(
    task: TaskDescriptor
  ): Promise<{ agentName: string | null; prompt: string }> {
    const parts: string[] = [];

    // 根据任务类型选择agent
    let agentName: string | null = null;

    switch (task.type) {
      case 'requirements':
        agentName = 'spec-requirements';
        break;
      case 'design':
        agentName = 'spec-design';
        break;
      case 'tasks':
        agentName = 'spec-tasks';
        break;
      case 'review':
        agentName = 'spec-judge';
        break;
      case 'implementation':
        agentName = 'spec-impl';
        break;
      default:
        // 对于其他类型,不使用特定agent
        agentName = null;
    }

    // 构建提示词
    parts.push('# Task Description');
    parts.push(task.description);
    parts.push('');

    // 添加spec名称
    if (task.specName) {
      parts.push(`Spec Name: ${task.specName}`);
      parts.push('');
    }

    // 添加关联文件
    if (task.relatedFiles && task.relatedFiles.length > 0) {
      parts.push('# Related Files');
      task.relatedFiles.forEach(file => {
        parts.push(`- ${file}`);
      });
      parts.push('');
    }

    // 添加上下文信息
    if (task.context) {
      if (task.context.requirements) {
        parts.push('# Requirements Context');
        parts.push(task.context.requirements);
        parts.push('');
      }

      if (task.context.design) {
        parts.push('# Design Context');
        parts.push(task.context.design);
        parts.push('');
      }

      if (task.context.tasks) {
        parts.push('# Tasks Context');
        parts.push(task.context.tasks);
        parts.push('');
      }

      if (task.context.additionalContext) {
        parts.push('# Additional Context');
        parts.push(JSON.stringify(task.context.additionalContext, null, 2));
        parts.push('');
      }
    }

    // 添加元数据
    if (task.metadata) {
      parts.push('# Task Metadata');
      parts.push(JSON.stringify(task.metadata, null, 2));
      parts.push('');
    }

    const prompt = parts.join('\n');

    return { agentName, prompt };
  }

  /**
   * 从输出中提取生成的文件列表
   *
   * 简单的启发式方法:查找文件路径模式
   *
   * @param output 执行输出
   * @returns 生成的文件路径列表
   */
  private _extractGeneratedFiles(output: string): string[] {
    const files: string[] = [];

    if (!output) {
      return files;
    }

    // 查找常见的文件路径模式
    const patterns = [
      /Created:\s+(.+\.(md|ts|js|json|yaml|yml))/gi,
      /Generated:\s+(.+\.(md|ts|js|json|yaml|yml))/gi,
      /Saved to:\s+(.+\.(md|ts|js|json|yaml|yml))/gi,
      /Writing to:\s+(.+\.(md|ts|js|json|yaml|yml))/gi,
      /File created:\s+(.+\.(md|ts|js|json|yaml|yml))/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const filePath = match[1].trim();
        if (filePath && !files.includes(filePath)) {
          files.push(filePath);
        }
      }
    }

    return files;
  }

  /**
   * 检查agent是否可用
   *
   * 验证agent系统提示词文件是否存在
   *
   * @param agentName agent名称
   * @returns 是否可用
   */
  async isAgentAvailable(agentName: string): Promise<boolean> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return false;
    }

    const agentPath = path.join(
      workspaceRoot,
      '.claude/system-prompts',
      `${agentName}.md`
    );

    try {
      await fs.promises.access(agentPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出所有可用的agent
   *
   * @returns agent名称列表
   */
  async listAvailableAgents(): Promise<string[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return [];
    }

    const systemPromptsDir = path.join(workspaceRoot, '.claude/system-prompts');

    try {
      const files = await fs.promises.readdir(systemPromptsDir);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
    } catch {
      return [];
    }
  }
}
