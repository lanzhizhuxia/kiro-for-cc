/**
 * Task CodeLens Provider for Codex Mode
 *
 * 为tasks.md文档中的任务项提供CodeLens支持
 * 允许用户为单个任务启用Codex深度分析执行模式
 *
 * 功能:
 * 1. 识别tasks.md中的任务项
 * 2. 为每个任务添加"使用Codex执行"和"查看详情"CodeLens
 * 3. 支持任务级别的执行模式切换
 *
 * 需求: T55 - 任务级别Codex模式支持
 */

import * as vscode from 'vscode';

export class TaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private outputChannel: vscode.OutputChannel) {
    // 监听配置变化，刷新CodeLens
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('kfc.codex.enableTaskCodeLens')) {
        this.refresh();
      }
    });
  }

  /**
   * 提供CodeLens
   *
   * 扫描tasks.md文档，为每个任务项提供CodeLens
   */
  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    // 检查是否启用了Task CodeLens功能
    const config = vscode.workspace.getConfiguration('kfc.codex');
    const enabled = config.get<boolean>('enableTaskCodeLens', true);

    if (!enabled) {
      return [];
    }

    // 仅在tasks.md文件中提供CodeLens
    if (!document.fileName.endsWith('tasks.md')) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // 查找任务项（格式: - [ ] 1. 任务描述 或 - [x] 1. 任务描述）
    const taskPattern = /^-\s+\[[ x]\]\s+(\d+(?:\.\d+)*)\.\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(taskPattern);

      if (match) {
        const taskNumber = match[1]; // 支持 "1" 或 "2.1" 格式
        const taskTitle = match[2];
        const isCompleted = line.includes('- [x]');
        const range = new vscode.Range(i, 0, i, line.length);

        // 只为未完成的任务添加"使用Codex执行"CodeLens
        if (!isCompleted) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: '$(sparkle) 使用Codex执行',
              tooltip: '使用Codex深度分析执行此任务',
              command: 'kfc.codex.executeTask',
              arguments: [taskNumber, taskTitle, document.uri]
            })
          );
        }

        // 为所有任务添加"查看详情"CodeLens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '$(info) 详情',
            tooltip: '查看任务详细信息',
            command: 'kfc.codex.showTaskDetails',
            arguments: [taskNumber, taskTitle, document.uri]
          })
        );
      }
    }

    return codeLenses;
  }

  /**
   * 解析CodeLens（可选）
   */
  resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.CodeLens | Thenable<vscode.CodeLens> {
    return codeLens;
  }

  /**
   * 刷新CodeLens
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}
