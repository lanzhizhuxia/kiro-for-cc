/**
 * 代码整合器
 *
 * 职责：
 * 1. 将 Codex 生成的代码整合到实际项目文件
 * 2. 处理文件创建、更新
 * 3. 生成 diff 视图供用户审查
 * 4. 支持自动和手动整合模式
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskInfo, IntegrationStrategy, IntegrationResult } from './types';

/**
 * 代码整合器
 */
export class CodeIntegrator {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * 整合代码到项目
   * @param code 生成的代码
   * @param task 任务信息
   * @param strategy 整合策略
   * @returns 整合结果
   */
  async integrateCode(
    code: string,
    task: TaskInfo,
    strategy: IntegrationStrategy
  ): Promise<IntegrationResult> {
    this.outputChannel.appendLine(
      `[CodeIntegrator] Integrating code for task ${task.number}: ${task.title}`
    );

    try {
      // 提取代码（如果是 markdown 格式）
      const extractedCode = this.extractCodeFromMarkdown(code);

      // 确定目标文件路径
      const targetPath = strategy.targetPath || this.suggestFilePath(task, extractedCode);

      // 检查文件是否存在
      const fileExists = await this.fileExists(targetPath);

      let method: 'created' | 'updated' | 'merged' = 'created';
      let backupPath: string | undefined;
      let userConfirmed = true; // 默认确认

      if (fileExists) {
        // 文件存在，需要处理合并或覆盖
        method = 'updated';

        // 创建备份
        if (strategy.createBackup !== false) {
          backupPath = await this.createBackup(targetPath);
          this.outputChannel.appendLine(`[CodeIntegrator] Backup created: ${backupPath}`);
        }

        // 根据模式处理
        if (strategy.mode === 'review' || strategy.mode === 'interactive') {
          // 显示 diff
          if (strategy.showDiff !== false) {
            const originalContent = await fs.readFile(targetPath, 'utf-8');
            await this.showDiff(originalContent, extractedCode, targetPath);
          }

          // 交互模式：询问用户
          if (strategy.mode === 'interactive') {
            const choice = await vscode.window.showQuickPick(
              [
                { label: '✅ 接受', description: '用新代码替换现有文件', value: 'accept' },
                { label: '🔀 合并', description: '手动合并更改', value: 'merge' },
                { label: '❌ 拒绝', description: '保留现有文件', value: 'reject' }
              ],
              { placeHolder: `如何处理 ${path.basename(targetPath)} 的更改？` }
            );

            if (!choice || choice.value === 'reject') {
              userConfirmed = false;
              return {
                success: false,
                filePath: targetPath,
                method: 'updated',
                backupPath,
                userConfirmed: false,
                error: '用户拒绝整合代码'
              };
            }

            if (choice.value === 'merge') {
              method = 'merged';
              // TODO: 实现智能合并
              // 当前版本：打开两个文件让用户手动合并
              await this.openForManualMerge(targetPath, extractedCode);
              return {
                success: true,
                filePath: targetPath,
                method: 'merged',
                backupPath,
                userConfirmed: true
              };
            }
          }
        }
      }

      // 写入文件
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.writeFile(targetPath, extractedCode, 'utf-8');

      this.outputChannel.appendLine(`[CodeIntegrator] Code integrated to: ${targetPath}`);

      // 打开文件
      const doc = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(doc);

      return {
        success: true,
        filePath: targetPath,
        method,
        backupPath,
        userConfirmed
      };

    } catch (error) {
      this.outputChannel.appendLine(`[CodeIntegrator] Error integrating code: ${error}`);

      return {
        success: false,
        filePath: strategy.targetPath || '',
        method: 'created',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 显示 diff 视图
   * @param originalContent 原始内容
   * @param newContent 新内容
   * @param filePath 文件路径
   */
  async showDiff(
    originalContent: string,
    newContent: string,
    filePath: string
  ): Promise<void> {
    this.outputChannel.appendLine(`[CodeIntegrator] Showing diff for: ${filePath}`);

    try {
      // 创建临时文件存储新内容
      const tempPath = `${filePath}.codex-generated`;
      await fs.writeFile(tempPath, newContent, 'utf-8');

      // 打开 diff 视图
      const originalUri = vscode.Uri.file(filePath);
      const newUri = vscode.Uri.file(tempPath);

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        newUri,
        `${path.basename(filePath)} ← Codex Generated`
      );

    } catch (error) {
      this.outputChannel.appendLine(`[CodeIntegrator] Error showing diff: ${error}`);
      vscode.window.showErrorMessage(`无法显示 diff: ${error}`);
    }
  }

  /**
   * 从 markdown 中提取代码
   */
  private extractCodeFromMarkdown(content: string): string {
    // 检查是否是 markdown 格式（包含代码块）
    const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)\n```/g;
    const matches = Array.from(content.matchAll(codeBlockRegex));

    if (matches.length > 0) {
      // 提取第一个代码块的内容
      return matches[0][1].trim();
    }

    // 不是 markdown 格式，直接返回
    return content.trim();
  }

  /**
   * 根据任务和代码内容建议文件路径
   */
  private suggestFilePath(task: TaskInfo, code: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder found');
    }

    // 尝试从代码中推断文件名
    let fileName = this.inferFileNameFromCode(code);

    // 如果无法推断，使用任务标题
    if (!fileName) {
      fileName = this.sanitizeFileName(task.title);
    }

    // 确定文件扩展名
    const extension = this.inferFileExtension(code);
    if (!fileName.endsWith(extension)) {
      fileName += extension;
    }

    // 默认放在 src 目录下
    return path.join(workspaceRoot, 'src', fileName);
  }

  /**
   * 从代码中推断文件名
   */
  private inferFileNameFromCode(code: string): string | null {
    // 尝试匹配 TypeScript/JavaScript 的类或函数声明
    const classMatch = code.match(/(?:export\s+)?(?:class|interface)\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }

    const functionMatch = code.match(/(?:export\s+)?function\s+(\w+)/);
    if (functionMatch) {
      return functionMatch[1];
    }

    const constMatch = code.match(/(?:export\s+)?const\s+(\w+)\s*=/);
    if (constMatch) {
      return constMatch[1];
    }

    return null;
  }

  /**
   * 推断文件扩展名
   */
  private inferFileExtension(code: string): string {
    // TypeScript
    if (code.includes(': ') || code.includes('interface ') || code.includes('type ')) {
      return '.ts';
    }

    // React/JSX
    if (code.includes('React') || code.includes('jsx') || code.includes('<')) {
      return code.includes(': ') ? '.tsx' : '.jsx';
    }

    // Python
    if (code.includes('def ') || code.includes('import ')) {
      return '.py';
    }

    // 默认 JavaScript
    return '.js';
  }

  /**
   * 清理文件名（移除非法字符）
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50); // 限制长度
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // 忽略错误（目录可能已存在）
    }
  }

  /**
   * 创建备份文件
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;

    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  /**
   * 打开文件进行手动合并
   */
  private async openForManualMerge(originalPath: string, newCode: string): Promise<void> {
    // 创建临时文件
    const tempPath = `${originalPath}.codex-generated`;
    await fs.writeFile(tempPath, newCode, 'utf-8');

    // 打开两个文件（并排）
    const originalDoc = await vscode.workspace.openTextDocument(originalPath);
    await vscode.window.showTextDocument(originalDoc, vscode.ViewColumn.One);

    const tempDoc = await vscode.workspace.openTextDocument(tempPath);
    await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Two);

    vscode.window.showInformationMessage(
      '请手动合并代码，完成后删除临时文件（.codex-generated）'
    );
  }
}
