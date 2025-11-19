/**
 * Task Execution Handler for Codex Mode
 *
 * 处理从tasks.md文档中单个任务的Codex执行
 * 提供任务执行、详情查看等功能
 *
 * 功能:
 * 1. 执行单个任务（强制使用Codex模式）
 * 2. 显示任务详情
 * 3. 提取任务详细描述
 * 4. 确保任务执行隔离
 *
 * 需求: T55 - 任务级别Codex模式支持
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodexOrchestrator } from './codexOrchestrator';
import { TaskDescriptor } from './types';

/**
 * 使用Codex执行单个任务
 *
 * @param taskNumber 任务编号（如 "1" 或 "2.1"）
 * @param taskTitle 任务标题
 * @param docUri tasks.md文档URI
 * @param codexOrchestrator Codex编排器实例
 * @param outputChannel 输出通道
 */
export async function handleExecuteTaskWithCodex(
  taskNumber: string,
  taskTitle: string,
  docUri: vscode.Uri,
  codexOrchestrator: CodexOrchestrator,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine(`[TaskCodeLens] Executing task ${taskNumber} with Codex`);
  outputChannel.appendLine(`[TaskCodeLens] Task: ${taskTitle}`);

  try {
    // 1. 确认用户意图
    const confirmed = await vscode.window.showInformationMessage(
      `是否使用Codex深度分析执行任务 ${taskNumber}？\n\n${taskTitle}`,
      { modal: true },
      '执行',
      '取消'
    );

    if (confirmed !== '执行') {
      outputChannel.appendLine('[TaskCodeLens] User cancelled task execution');
      return;
    }

    // 2. 读取任务详细描述
    const document = await vscode.workspace.openTextDocument(docUri);
    const taskDetails = extractTaskDetails(document, taskNumber);

    if (!taskDetails) {
      vscode.window.showErrorMessage(`未找到任务 ${taskNumber} 的详细信息`);
      outputChannel.appendLine(`[TaskCodeLens] Task ${taskNumber} not found in document`);
      return;
    }

    outputChannel.appendLine(`[TaskCodeLens] Task details extracted: ${taskDetails.substring(0, 200)}...`);

    // 3. 提取spec名称（从文档路径）
    const specName = extractSpecNameFromPath(docUri.fsPath);
    if (!specName) {
      vscode.window.showErrorMessage('无法确定Spec名称');
      outputChannel.appendLine('[TaskCodeLens] Failed to extract spec name from path');
      return;
    }

    outputChannel.appendLine(`[TaskCodeLens] Spec name: ${specName}`);

    // 4. 读取相关文档（requirements.md, design.md）
    const specDir = path.dirname(docUri.fsPath);
    const requirementsPath = path.join(specDir, 'requirements.md');
    const designPath = path.join(specDir, 'design.md');

    let requirements: string | undefined;
    let design: string | undefined;

    try {
      const reqDoc = await vscode.workspace.openTextDocument(requirementsPath);
      requirements = reqDoc.getText();
      outputChannel.appendLine('[TaskCodeLens] Requirements document loaded');
    } catch (error) {
      outputChannel.appendLine(`[TaskCodeLens] Requirements document not found: ${error}`);
    }

    try {
      const designDoc = await vscode.workspace.openTextDocument(designPath);
      design = designDoc.getText();
      outputChannel.appendLine('[TaskCodeLens] Design document loaded');
    } catch (error) {
      outputChannel.appendLine(`[TaskCodeLens] Design document not found: ${error}`);
    }

    // 5. 构建TaskDescriptor
    const taskDescriptor: TaskDescriptor = {
      id: `task-${specName}-${taskNumber}-${Date.now()}`,
      type: 'implementation',
      description: taskTitle,
      specName: specName,
      context: {
        requirements,
        design,
        tasks: taskDetails,
        additionalContext: {
          taskNumber,
          taskTitle,
          specName,
          tasksFilePath: docUri.fsPath
        }
      }
    };

    outputChannel.appendLine(`[TaskCodeLens] Task descriptor created: ${taskDescriptor.id}`);

    // 6. 执行任务（强制使用Codex模式）
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在使用Codex执行任务 ${taskNumber}...`,
        cancellable: true
      },
      async (progress, token) => {
        try {
          progress.report({ increment: 0, message: '初始化Codex会话...' });

          const result = await codexOrchestrator.executeTask(taskDescriptor, {
            forceMode: 'codex', // 强制使用Codex模式
            enableDeepThinking: true,
            enableCodebaseScan: true
          });

          progress.report({ increment: 50, message: '任务执行完成，生成分析报告...' });

          // 7. 处理结果
          if (result.success) {
            // 显示深度推理结果（如果有）
            if (result.thinkingSummary) {
              await codexOrchestrator.showAnalysisResult(result.thinkingSummary, {
                sessionId: result.sessionId,
                mode: 'codex',
                executionTime: result.duration,
                timestamp: new Date().toISOString()
              });
            }

            progress.report({ increment: 100, message: '完成' });

            vscode.window.showInformationMessage(
              `任务 ${taskNumber} 执行完成 (耗时: ${(result.duration / 1000).toFixed(2)}s)`
            );

            outputChannel.appendLine(`[TaskCodeLens] Task execution completed successfully`);
            outputChannel.appendLine(`[TaskCodeLens] Duration: ${result.duration}ms`);
            outputChannel.appendLine(`[TaskCodeLens] Session ID: ${result.sessionId}`);
          } else {
            vscode.window.showErrorMessage(
              `任务执行失败: ${result.error?.message || '未知错误'}`
            );

            outputChannel.appendLine(`[TaskCodeLens] Task execution failed: ${result.error?.message}`);
            if (result.error?.stack) {
              outputChannel.appendLine(`[TaskCodeLens] Error stack: ${result.error.stack}`);
            }
          }
        } catch (error) {
          if (token.isCancellationRequested) {
            vscode.window.showWarningMessage('任务执行已取消');
            outputChannel.appendLine('[TaskCodeLens] Task execution cancelled by user');
          } else {
            throw error;
          }
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`执行任务时出错: ${errorMessage}`);
    outputChannel.appendLine(`[TaskCodeLens] Error executing task: ${errorMessage}`);

    if (error instanceof Error && error.stack) {
      outputChannel.appendLine(`[TaskCodeLens] Error stack: ${error.stack}`);
    }
  }
}

/**
 * 显示任务详情
 *
 * @param taskNumber 任务编号
 * @param taskTitle 任务标题
 * @param docUri tasks.md文档URI
 * @param outputChannel 输出通道
 */
export async function handleShowTaskDetails(
  taskNumber: string,
  taskTitle: string,
  docUri: vscode.Uri,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine(`[TaskCodeLens] Showing details for task ${taskNumber}`);

  try {
    // 读取任务详细描述
    const document = await vscode.workspace.openTextDocument(docUri);
    const taskDetails = extractTaskDetails(document, taskNumber);
    const specName = extractSpecNameFromPath(docUri.fsPath);

    // 显示快速信息面板
    const panel = vscode.window.createWebviewPanel(
      'taskDetails',
      `任务 ${taskNumber} 详情`,
      vscode.ViewColumn.Two,
      { enableScripts: false }
    );

    panel.webview.html = generateTaskDetailsHTML(
      taskNumber,
      taskTitle,
      taskDetails || '无详细描述',
      specName || '未知Spec'
    );

    outputChannel.appendLine('[TaskCodeLens] Task details webview created');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`显示任务详情时出错: ${errorMessage}`);
    outputChannel.appendLine(`[TaskCodeLens] Error showing task details: ${errorMessage}`);
  }
}

/**
 * 从tasks.md文档中提取任务详细信息
 *
 * 识别任务标题及其缩进的子项（详细描述）
 *
 * @param document tasks.md文档
 * @param taskNumber 任务编号（如 "1" 或 "2.1"）
 * @returns 任务详细描述，如果未找到则返回null
 */
export function extractTaskDetails(
  document: vscode.TextDocument,
  taskNumber: string
): string | null {
  const text = document.getText();
  const lines = text.split(/\r?\n/);

  // 查找任务标题（转义taskNumber中的特殊字符）
  const escapedTaskNumber = taskNumber.replace(/\./g, '\\.');
  const taskHeaderPattern = new RegExp(`^-\\s+\\[[ x]\\]\\s+${escapedTaskNumber}\\.\\s+`);
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (taskHeaderPattern.test(lines[i])) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    return null;
  }

  // 提取任务标题
  const headerLine = lines[startIndex];
  const titleMatch = headerLine.match(new RegExp(`^-\\s+\\[[ x]\\]\\s+${escapedTaskNumber}\\.\\s+(.+)$`));
  const title = titleMatch ? titleMatch[1] : '';

  // 提取任务描述（缩进的子项）
  const details: string[] = [title]; // 包含标题

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // 如果遇到下一个任务或空行结束（连续两个空行）
    if (line.match(/^-\s+\[[ x]\]\s+\d+(?:\.\d+)*\./)) {
      break;
    }

    // 收集非空行（包括缩进的行）
    if (line.trim() !== '') {
      // 移除前导空格，但保留相对缩进
      details.push(line);
    } else if (details.length > 1 && i + 1 < lines.length && lines[i + 1].trim() === '') {
      // 遇到连续空行，结束
      break;
    }
  }

  return details.join('\n');
}

/**
 * 从文档路径中提取spec名称
 *
 * @param docPath 文档路径
 * @returns spec名称，如果无法提取则返回null
 */
export function extractSpecNameFromPath(docPath: string): string | null {
  // 路径格式: .../specs/{spec-name}/tasks.md
  const normalizedPath = docPath.replace(/\\/g, '/');
  const specsMatch = normalizedPath.match(/\/specs\/([^/]+)\/tasks\.md$/);

  if (specsMatch) {
    return specsMatch[1];
  }

  // 尝试另一种格式: .../.claude/specs/{spec-name}/tasks.md
  const claudeSpecsMatch = normalizedPath.match(/\/.claude\/specs\/([^/]+)\/tasks\.md$/);
  if (claudeSpecsMatch) {
    return claudeSpecsMatch[1];
  }

  return null;
}

/**
 * 生成任务详情HTML
 *
 * @param taskNumber 任务编号
 * @param taskTitle 任务标题
 * @param taskDetails 任务详细描述
 * @param specName spec名称
 * @returns HTML内容
 */
function generateTaskDetailsHTML(
  taskNumber: string,
  taskTitle: string,
  taskDetails: string,
  specName: string
): string {
  // 转义HTML
  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const escapedTitle = escapeHtml(taskTitle);
  const escapedDetails = escapeHtml(taskDetails);
  const escapedSpecName = escapeHtml(specName);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>任务 ${taskNumber} 详情</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        padding: 20px;
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        line-height: 1.6;
      }
      h1 {
        color: var(--vscode-foreground);
        border-bottom: 2px solid var(--vscode-textLink-foreground);
        padding-bottom: 10px;
      }
      .task-number {
        color: var(--vscode-textLink-foreground);
        font-weight: bold;
      }
      .spec-name {
        color: var(--vscode-textPreformat-foreground);
        background-color: var(--vscode-textBlockQuote-background);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.9em;
      }
      .details {
        margin-top: 20px;
        padding: 15px;
        background-color: var(--vscode-textBlockQuote-background);
        border-left: 4px solid var(--vscode-textLink-foreground);
        white-space: pre-wrap;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
      }
      .info-section {
        margin-top: 20px;
        padding: 15px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 4px;
      }
      .info-section h2 {
        margin-top: 0;
        font-size: 1.1em;
        color: var(--vscode-textLink-foreground);
      }
    </style>
</head>
<body>
    <h1>任务 <span class="task-number">${taskNumber}</span></h1>
    <p><strong>Spec:</strong> <span class="spec-name">${escapedSpecName}</span></p>
    <h2>${escapedTitle}</h2>

    <div class="details">${escapedDetails}</div>

    <div class="info-section">
      <h2>如何执行</h2>
      <p>点击任务旁边的 <strong>$(sparkle) 使用Codex执行</strong> 按钮来启动深度分析执行。</p>
      <p>Codex模式将：</p>
      <ul>
        <li>执行完整的代码库扫描</li>
        <li>进行深度推理分析</li>
        <li>识别潜在风险</li>
        <li>提供多种解决方案对比</li>
        <li>给出推荐决策和后续步骤</li>
      </ul>
    </div>
</body>
</html>`;
}
