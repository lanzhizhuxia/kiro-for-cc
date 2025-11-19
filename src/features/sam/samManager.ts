import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import { ProgressTracker } from './progressTracker';
import { CodexOrchestrator } from '../codex/codexOrchestrator';
import { TaskDescriptor, ExecutionOptions } from '../codex/types';

export interface ProjectContext {
  workspacePath?: string;
  workspaceName?: string;
  languagePreference?: string;
  projectRules?: string;
  existingSpecs?: string[];
  gitBranch?: string;
}

/**
 * Sam Manager - Manages Sam (Spec Automation Manager) workflows
 */
export class SamManager {
  private progressTracker?: ProgressTracker;
  private codexOrchestrator?: CodexOrchestrator;

  constructor(
    private claudeProvider: ClaudeCodeProvider,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Set the progress tracker (called from extension.ts after SpecExplorer is initialized)
   */
  public setProgressTracker(tracker: ProgressTracker): void {
    this.progressTracker = tracker;
  }

  /**
   * Set the Codex orchestrator (called from extension.ts after Codex is initialized)
   */
  public setCodexOrchestrator(orchestrator: CodexOrchestrator): void {
    this.codexOrchestrator = orchestrator;
    this.outputChannel.appendLine('[SamManager] Codex orchestrator connected');
  }

  /**
   * Ask Sam to work on a new feature
   * @param featureDescription Optional feature description (will prompt if not provided)
   */
  async askSam(featureDescription?: string): Promise<void> {
    try {
      // 1. Get feature description from user if not provided
      if (!featureDescription) {
        featureDescription = await vscode.window.showInputBox({
          prompt: 'Describe the feature you want Sam to build',
          placeHolder: 'e.g., User authentication system with JWT',
          validateInput: (value) => {
            return value.trim() ? null : 'Feature description cannot be empty';
          }
        });

        if (!featureDescription) {
          this.outputChannel.appendLine('[SamManager] User cancelled feature input');
          return; // User cancelled
        }
      }

      this.outputChannel.appendLine(`[SamManager] Starting Sam for feature: ${featureDescription}`);

      // 2. Build project context
      const context = await this.buildProjectContext();
      this.outputChannel.appendLine(`[SamManager] Built context: ${JSON.stringify(context, null, 2)}`);

      // 3. Build Sam prompt
      const prompt = this.buildSamPrompt(featureDescription, context);

      // 4. Show progress notification and execute
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Sam is working on: ${featureDescription}`,
          cancellable: false
        },
        async () => {
          // 5. Execute with system prompt
          await this.claudeProvider.executeWithSystemPrompt(
            prompt,
            'spec-workflow-starter'
          );
        }
      );

      this.outputChannel.appendLine('[SamManager] Sam execution completed');
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error in askSam: ${error}`);
      vscode.window.showErrorMessage(`Failed to start Sam: ${error}`);
    }
  }

  /**
   * Continue previous work on a feature
   * @param featureName The feature name to continue
   */
  async continueWork(featureName: string): Promise<void> {
    try {
      if (!this.progressTracker) {
        throw new Error('ProgressTracker not initialized');
      }

      // 1. Get progress information
      const progress = this.progressTracker.getProgress(featureName);

      if (!progress) {
        vscode.window.showWarningMessage(`No progress found for ${featureName}`);
        return;
      }

      this.outputChannel.appendLine(
        `[SamManager] Continue work: ${featureName} - Phase: ${progress.currentPhase}`
      );

      // 2. Check for blockers
      if (progress.blockers.length > 0) {
        const blockersText = progress.blockers.join('\n- ');
        const answer = await vscode.window.showWarningMessage(
          `${featureName} has blockers:\n\n- ${blockersText}\n\nHave these been resolved?`,
          'Yes, continue',
          'Cancel'
        );

        if (answer !== 'Yes, continue') {
          this.outputChannel.appendLine('[SamManager] User cancelled due to blockers');
          return;
        }
      }

      // 3. Build continue prompt
      const continuePrompt = await this.buildContinuePrompt(featureName, progress);

      // 4. Show progress notification and execute
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Sam is continuing: ${featureName} (${progress.currentPhase})`,
          cancellable: false
        },
        async () => {
          // 5. Execute with system prompt
          await this.claudeProvider.executeWithSystemPrompt(
            continuePrompt,
            'spec-workflow-starter'
          );
        }
      );

      this.outputChannel.appendLine('[SamManager] Continue work execution completed');
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error in continueWork: ${error}`);
      vscode.window.showErrorMessage(`Failed to continue work: ${error}`);
    }
  }

  /**
   * Build prompt for continuing work
   */
  private async buildContinuePrompt(
    featureName: string,
    progress: any
  ): Promise<string> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace found');
    }

    // Read PROGRESS.md file
    const progressPath = path.join(
      workspaceRoot,
      '.claude/specs',
      featureName,
      'PROGRESS.md'
    );

    let progressContent = '';
    if (fs.existsSync(progressPath)) {
      progressContent = fs.readFileSync(progressPath, 'utf-8');
    }

    const prompt = `Continue working on the feature: ${featureName}

**Current Progress**:
\`\`\`markdown
${progressContent}
\`\`\`

**Current Phase**: ${progress.currentPhase}
**Completed Phases**: ${progress.completedPhases.join(', ') || 'None'}
**In Progress Tasks**: ${progress.inProgressTasks.join(', ') || 'None'}

**Instructions**:
Please continue from where we left off. Review the progress above and proceed with the next logical step in the spec workflow.
${progress.blockers.length > 0 ? '\n**Note**: User has confirmed blockers are resolved.' : ''}`;

    this.outputChannel.appendLine(`[SamManager] Built continue prompt (${prompt.length} chars)`);
    return prompt;
  }

  /**
   * Build project context from workspace
   */
  private async buildProjectContext(): Promise<ProjectContext> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      this.outputChannel.appendLine('[SamManager] No workspace root found');
      return {};
    }

    const context: ProjectContext = {
      workspacePath: workspaceRoot,
      workspaceName: path.basename(workspaceRoot),
      languagePreference: await this.getLanguagePreference(),
      projectRules: await this.getProjectRules(workspaceRoot),
      existingSpecs: await this.scanSpecs(workspaceRoot),
      gitBranch: await this.getGitBranch(workspaceRoot)
    };

    return context;
  }

  /**
   * Get language preference from ~/.claude/CLAUDE.md
   */
  private async getLanguagePreference(): Promise<string> {
    try {
      const homedir = process.env.HOME || process.env.USERPROFILE;
      if (!homedir) {
        this.outputChannel.appendLine('[SamManager] No home directory found');
        return 'English';
      }

      const claudeMdPath = path.join(homedir, '.claude', 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        this.outputChannel.appendLine('[SamManager] ~/.claude/CLAUDE.md not found');
        return 'English';
      }

      const content = fs.readFileSync(claudeMdPath, 'utf-8');

      // Look for Chinese language indicators
      if (content.includes('中文') || content.includes('Chinese') || content.includes('使用中文')) {
        this.outputChannel.appendLine('[SamManager] Language preference: Chinese');
        return 'Chinese';
      }

      this.outputChannel.appendLine('[SamManager] Language preference: English (default)');
      return 'English';
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error reading language preference: ${error}`);
      return 'English';
    }
  }

  /**
   * Get project rules from CLAUDE.md
   */
  private async getProjectRules(workspaceRoot: string): Promise<string> {
    try {
      const claudeMdPath = path.join(workspaceRoot, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        this.outputChannel.appendLine('[SamManager] No CLAUDE.md found in workspace');
        return '';
      }

      const content = fs.readFileSync(claudeMdPath, 'utf-8');
      this.outputChannel.appendLine(`[SamManager] Loaded project rules (${content.length} chars)`);
      return content;
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error reading project rules: ${error}`);
      return '';
    }
  }

  /**
   * Scan existing specs from .claude/specs/
   */
  private async scanSpecs(workspaceRoot: string): Promise<string[]> {
    const specs: string[] = [];

    try {
      const specsDir = path.join(workspaceRoot, '.claude/specs');
      if (!fs.existsSync(specsDir)) {
        this.outputChannel.appendLine('[SamManager] No .claude/specs directory found');
        return specs;
      }

      const entries = fs.readdirSync(specsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          specs.push(entry.name);
        }
      }

      this.outputChannel.appendLine(`[SamManager] Found ${specs.length} existing specs: ${specs.join(', ')}`);
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error scanning specs: ${error}`);
    }

    return specs;
  }

  /**
   * Get current Git branch
   */
  private async getGitBranch(workspaceRoot: string): Promise<string | undefined> {
    try {
      const headPath = path.join(workspaceRoot, '.git', 'HEAD');
      if (!fs.existsSync(headPath)) {
        this.outputChannel.appendLine('[SamManager] No Git repository found');
        return undefined;
      }

      const head = fs.readFileSync(headPath, 'utf-8').trim();
      const match = head.match(/ref: refs\/heads\/(.+)/);

      if (match) {
        this.outputChannel.appendLine(`[SamManager] Git branch: ${match[1]}`);
        return match[1];
      }

      this.outputChannel.appendLine('[SamManager] Could not parse Git branch');
      return undefined;
    } catch (error) {
      this.outputChannel.appendLine(`[SamManager] Error reading Git branch: ${error}`);
      return undefined;
    }
  }

  /**
   * Build the prompt for Sam
   */
  private buildSamPrompt(featureDescription: string, context: ProjectContext): string {
    const contextInfo = `
**Project Context:**
- Workspace: ${context.workspaceName || 'Unknown'} (${context.workspacePath || 'Unknown'})
- Language Preference: ${context.languagePreference || 'English'}
- Git Branch: ${context.gitBranch || 'N/A'}
- Existing Specs: ${context.existingSpecs && context.existingSpecs.length > 0 ? context.existingSpecs.join(', ') : 'None'}

${context.projectRules ? `**Project Rules (from CLAUDE.md):**\n\`\`\`\n${context.projectRules.substring(0, 1000)}${context.projectRules.length > 1000 ? '...(truncated)' : ''}\n\`\`\`\n` : ''}
`;

    const prompt = `I need you to work on a new feature using the spec-driven workflow.

**Feature Description:**
${featureDescription}

${contextInfo}

**Instructions:**
Please act as Sam (Spec Automation Manager) and help me develop this feature following the spec workflow:
1. Create requirements document
2. Create design document
3. Create tasks document

Please start by creating the requirements document. Use the project context above to inform your decisions.`;

    this.outputChannel.appendLine(`[SamManager] Built prompt (${prompt.length} chars)`);
    return prompt;
  }

  /**
   * Implement a specific task using Codex
   *
   * This method allows Sam to delegate implementation tasks to Codex.
   * Sam evaluates tasks and decides which ones are suitable for Codex.
   *
   * @param specName - The spec name
   * @param taskDescription - Description of the task to implement
   * @param taskContext - Additional context (requirements, design, related files)
   * @returns Execution result from Codex
   */
  async implementTaskWithCodex(
    specName: string,
    taskDescription: string,
    taskContext?: {
      requirements?: string;
      design?: string;
      relatedFiles?: string[];
    }
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.codexOrchestrator) {
      const error = 'Codex is not available. Please ensure Codex is configured.';
      this.outputChannel.appendLine(`[SamManager] ${error}`);
      return { success: false, error };
    }

    try {
      this.outputChannel.appendLine(`[SamManager] Implementing task with Codex: ${taskDescription}`);

      // 1. Build task descriptor for Codex
      const task: TaskDescriptor = {
        id: `sam-task-${specName}-${Date.now()}`,
        type: 'implementation',
        description: `请用中文实现以下开发任务：

${taskDescription}

**要求**：
1. 提供完整的代码实现（带中文注释）
2. 遵循项目现有的代码风格
3. 包含必要的错误处理
4. 如果需要修改现有文件，说明修改点
5. 提供简要的实现说明

请直接给出代码实现，无需过多解释。`,
        specName,
        context: {
          requirements: taskContext?.requirements,
          design: taskContext?.design,
          additionalContext: {
            outputLanguage: 'zh-CN',
            taskType: 'implementation'
          }
        },
        relatedFiles: taskContext?.relatedFiles
      };

      // 2. Execute with Codex
      const options: ExecutionOptions = {
        forceMode: 'codex',
        enableCodebaseScan: true,  // 扫描代码库以了解上下文
        enableDeepThinking: false  // 编程任务不需要深度推理
      };

      this.outputChannel.appendLine(`[SamManager] Calling Codex orchestrator...`);
      const result = await this.codexOrchestrator.executeTask(task, options);

      // 3. Process result
      if (result.success) {
        this.outputChannel.appendLine(
          `[SamManager] Task implemented successfully (${result.duration}ms)`
        );

        // Save implementation result to spec directory
        if (result.output) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (workspaceRoot) {
            const implPath = path.join(
              workspaceRoot,
              '.claude/specs',
              specName,
              `task-implementation-${Date.now()}.md`
            );

            fs.writeFileSync(implPath, result.output, 'utf-8');
            this.outputChannel.appendLine(`[SamManager] Saved implementation to: ${implPath}`);

            // Show the result
            const doc = await vscode.workspace.openTextDocument(implPath);
            await vscode.window.showTextDocument(doc);
          }
        }

        return {
          success: true,
          output: result.output
        };
      } else {
        const errorMsg = result.error?.message || 'Unknown error';
        this.outputChannel.appendLine(`[SamManager] Task implementation failed: ${errorMsg}`);

        return {
          success: false,
          error: errorMsg
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SamManager] Error in implementTaskWithCodex: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Auto-evaluate all tasks in a spec
   * @param specName Spec name (optional, will prompt if not provided)
   * @returns Evaluation results
   */
  async autoEvaluateTasks(specName?: string): Promise<any> {
    try {
      // 1. Get spec name if not provided
      if (!specName) {
        specName = await vscode.window.showInputBox({
          prompt: 'Enter the spec name to evaluate tasks',
          placeHolder: 'e.g., test-automation'
        });

        if (!specName) {
          this.outputChannel.appendLine('[SamManager] User cancelled spec input');
          return null;
        }
      }

      // 2. Lazy import TaskEvaluator
      const { TaskEvaluator } = await import('./automation/taskEvaluator');
      const taskEvaluator = new TaskEvaluator(this.outputChannel);

      // 3. Find tasks.md file
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      const tasksPath = path.join(workspaceRoot, '.claude/specs', specName, 'tasks.md');

      if (!fs.existsSync(tasksPath)) {
        throw new Error(`Tasks file not found: ${tasksPath}`);
      }

      // 4. Load context (requirements and design) for evaluation
      const reqPath = path.join(workspaceRoot, 'docs/specs', specName, 'requirements.md');
      const designPath = path.join(workspaceRoot, 'docs/specs', specName, 'design.md');

      const evalContext: { requirements?: string; design?: string } = {};

      if (fs.existsSync(reqPath)) {
        evalContext.requirements = fs.readFileSync(reqPath, 'utf-8');
      }

      if (fs.existsSync(designPath)) {
        evalContext.design = fs.readFileSync(designPath, 'utf-8');
      }

      // 5. Parse and evaluate tasks
      this.outputChannel.appendLine(`[SamManager] Evaluating tasks from: ${tasksPath}`);
      const tasks = await taskEvaluator.parseTasks(tasksPath);
      const evaluations = await taskEvaluator.evaluateAllTasks(tasks, evalContext);

      // 6. Show summary
      const codexTasks = evaluations.filter((e: any) => e.recommendCodex);
      const manualTasks = evaluations.filter((e: any) => !e.recommendCodex);

      const summary = `
📊 任务评估完成

总任务数: ${evaluations.length}
推荐 Codex: ${codexTasks.length} 个
推荐手动: ${manualTasks.length} 个

详情见输出面板
      `;

      vscode.window.showInformationMessage(summary.trim());

      // 7. Log detailed results
      this.outputChannel.appendLine('\n=== 详细评估结果 ===');
      evaluations.forEach((e: any) => {
        this.outputChannel.appendLine(
          `\n任务 ${e.task.number}: ${e.task.title}\n` +
          `  类型: ${e.type}\n` +
          `  复杂度: ${e.complexityScore}/100\n` +
          `  推荐: ${e.recommendCodex ? 'Codex' : '手动'}\n` +
          `  原因: ${e.reason}`
        );
      });

      return evaluations;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SamManager] Error in autoEvaluateTasks: ${errorMsg}`);
      vscode.window.showErrorMessage(`Failed to evaluate tasks: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Auto-implement tasks with Codex (batch processing)
   * @param specName Spec name (optional, will prompt if not provided)
   * @returns Automation report
   */
  async autoImplementTasks(specName?: string): Promise<any> {
    try {
      // 1. Check Codex availability
      if (!this.codexOrchestrator) {
        const error = 'Codex is not available. Please ensure Codex is configured.';
        vscode.window.showErrorMessage(error);
        return null;
      }

      // 2. Get spec name if not provided
      if (!specName) {
        specName = await vscode.window.showInputBox({
          prompt: 'Enter the spec name to auto-implement tasks',
          placeHolder: 'e.g., test-automation'
        });

        if (!specName) {
          this.outputChannel.appendLine('[SamManager] User cancelled spec input');
          return null;
        }
      }

      // 3. Lazy import automation components
      const { TaskEvaluator } = await import('./automation/taskEvaluator');
      const { BatchTaskDelegator } = await import('./automation/batchTaskDelegator');

      const taskEvaluator = new TaskEvaluator(this.outputChannel);
      const batchDelegator = new BatchTaskDelegator(this.codexOrchestrator, this.outputChannel);

      // 4. Find tasks.md file
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      const tasksPath = path.join(workspaceRoot, '.claude/specs', specName, 'tasks.md');

      if (!fs.existsSync(tasksPath)) {
        throw new Error(`Tasks file not found: ${tasksPath}`);
      }

      // 5. Load context (requirements and design) first
      const reqPath = path.join(workspaceRoot, 'docs/specs', specName, 'requirements.md');
      const designPath = path.join(workspaceRoot, 'docs/specs', specName, 'design.md');

      const context: { requirements?: string; design?: string } = {};

      if (fs.existsSync(reqPath)) {
        context.requirements = fs.readFileSync(reqPath, 'utf-8');
        this.outputChannel.appendLine('[SamManager] Loaded requirements context');
      }

      if (fs.existsSync(designPath)) {
        context.design = fs.readFileSync(designPath, 'utf-8');
        this.outputChannel.appendLine('[SamManager] Loaded design context');
      }

      // 6. Parse and evaluate tasks
      this.outputChannel.appendLine(`[SamManager] Parsing tasks from: ${tasksPath}`);
      const tasks = await taskEvaluator.parseTasks(tasksPath);
      const allEvaluations = await taskEvaluator.evaluateAllTasks(tasks, context);

      // 7. Filter for Codex-suitable tasks (excluding completed tasks)
      const codexEvaluations = allEvaluations.filter((e: any) =>
        e.recommendCodex && !e.task.completed
      );

      if (codexEvaluations.length === 0) {
        vscode.window.showInformationMessage('没有需要 Codex 处理的任务');
        return null;
      }

      // 7. Confirm with user
      const confirmed = await vscode.window.showInformationMessage(
        `发现 ${codexEvaluations.length} 个任务可以使用 Codex 自动实现，是否继续？`,
        '继续',
        '取消'
      );

      if (confirmed !== '继续') {
        this.outputChannel.appendLine('[SamManager] User cancelled auto-implementation');
        return null;
      }

      // 8. Execute batch delegation (context already loaded in step 5)
      this.outputChannel.appendLine(
        `[SamManager] Starting batch delegation for ${codexEvaluations.length} tasks...`
      );

      const results = await batchDelegator.delegateTasks(
        codexEvaluations,
        specName,
        context,
        {
          maxConcurrency: 3,
          retryCount: 1,
          timeout: 360000, // 6 minutes initial
          showProgress: true
        }
      );

      // 9. Show summary
      const successCount = results.filter((r: any) => r.success).length;
      const failedCount = results.filter((r: any) => !r.success).length;

      const summaryMsg = `
✅ 批量实现完成！

成功: ${successCount}/${codexEvaluations.length}
失败: ${failedCount}/${codexEvaluations.length}
成功率: ${Math.round((successCount / codexEvaluations.length) * 100)}%

详情见输出面板
      `;

      vscode.window.showInformationMessage(summaryMsg.trim());

      // 10. Log detailed results
      this.outputChannel.appendLine('\n=== 批量实现结果 ===');
      results.forEach((r: any) => {
        const status = r.success ? '✅ 成功' : '❌ 失败';
        this.outputChannel.appendLine(
          `\n${status} 任务 ${r.evaluation.task.number}: ${r.evaluation.task.title}\n` +
          `  耗时: ${Math.round(r.duration / 1000)}s\n` +
          `  ${r.error ? `错误: ${r.error}` : '已完成'}`
        );
      });

      return results;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SamManager] Error in autoImplementTasks: ${errorMsg}`);
      vscode.window.showErrorMessage(`Failed to auto-implement tasks: ${errorMsg}`);
      return null;
    }
  }
}
