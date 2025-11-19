import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import { ConfigManager } from '../../utils/configManager';
import { NotificationUtils } from '../../utils/notificationUtils';
import { PromptLoader } from '../../services/promptLoader';
import { CodexOrchestrator } from '../codex/codexOrchestrator';
import { TaskDescriptor, ExecutionOptions, ExecutionResult } from '../codex/types';

export type SpecDocumentType = 'requirements' | 'design' | 'tasks';

export class SpecManager {
    private configManager: ConfigManager;
    private promptLoader: PromptLoader;
    private codexOrchestrator?: CodexOrchestrator;

    constructor(
        private claudeProvider: ClaudeCodeProvider,
        private outputChannel: vscode.OutputChannel
    ) {
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
        this.promptLoader = PromptLoader.getInstance();
    }

    /**
     * Initialize Codex integration (called from extension.ts)
     */
    setCodexOrchestrator(orchestrator: CodexOrchestrator): void {
        this.codexOrchestrator = orchestrator;
        this.outputChannel.appendLine('[SpecManager] Codex orchestrator set');
    }

    /**
     * Check if Codex is available
     */
    isCodexAvailable(): boolean {
        return !!this.codexOrchestrator;
    }

    public async getSpecBasePath(): Promise<string> {
        await this.configManager.loadSettings();
        return this.configManager.getPath('specs');
    }

    async create() {
        // Get feature description only
        const description = await vscode.window.showInputBox({
            title: '✨ Create New Spec ✨',
            prompt: 'Specs are a structured way to build features so you can plan before building',
            placeHolder: 'Enter your idea to generate requirement, design, and task specs...',
            ignoreFocusOut: false
        });

        if (!description) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Show notification immediately after user input
        NotificationUtils.showAutoDismissNotification('Claude is creating your spec. Check the terminal for progress.');

        // Let Claude handle everything - directory creation, naming, and file creation
        // Load and render the spec creation prompt
        const specBasePath = await this.getSpecBasePath();
        const prompt = this.promptLoader.renderPrompt('create-spec', {
            description,
            workspacePath: workspaceFolder.uri.fsPath,
            specBasePath
        });

        // Send to Claude and get the terminal
        const terminal = await this.claudeProvider.invokeClaudeSplitView(prompt, 'KFC - Creating Spec');

        // Set up automatic terminal renaming when spec folder is created
        this.setupSpecFolderWatcher(workspaceFolder, terminal).catch(error => {
            this.outputChannel.appendLine(`[SpecManager] Failed to set up watcher: ${error}`);
        });
    }

    async createWithAgents() {
        // Get feature description only
        const description = await vscode.window.showInputBox({
            title: '✨ Create New Spec with Agents ✨',
            prompt: 'This will use specialized subagents for creating requirements, design, and tasks',
            placeHolder: 'Enter your idea to generate requirement, design, and task specs...',
            ignoreFocusOut: false
        });

        if (!description) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Show notification immediately after user input
        NotificationUtils.showAutoDismissNotification('Claude is creating your spec with specialized agents. Check the terminal for progress.');

        // Use the specialized subagent prompt
        const specBasePath = await this.getSpecBasePath();
        const prompt = this.promptLoader.renderPrompt('create-spec-with-agents', {
            description,
            workspacePath: workspaceFolder.uri.fsPath,
            specBasePath
        });

        // Send to Claude and get the terminal
        const terminal = await this.claudeProvider.invokeClaudeSplitView(prompt, 'KFC - Creating Spec (Agents)');

        // Set up automatic terminal renaming when spec folder is created
        this.setupSpecFolderWatcher(workspaceFolder, terminal).catch(error => {
            this.outputChannel.appendLine(`[SpecManager] Failed to set up watcher: ${error}`);
        });
    }

    async implTask(taskFilePath: string, taskDescription: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Show notification immediately after user input
        NotificationUtils.showAutoDismissNotification('Claude is implementing your task. Check the terminal for progress.');

        const prompt = this.promptLoader.renderPrompt('impl-task', {
            taskFilePath,
            taskDescription
        });

        await this.claudeProvider.invokeClaudeSplitView(prompt, 'KFC - Implementing Task');
    }

    /**
     * Set up a file system watcher to automatically rename the terminal 
     * when a new spec folder is created
     */
    private async setupSpecFolderWatcher(workspaceFolder: vscode.WorkspaceFolder, terminal: vscode.Terminal): Promise<void> {
        // Create watcher for new folders in the specs directory
        const specBasePath = await this.getSpecBasePath();
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, `${specBasePath}/*`),
            false, // Watch for creates
            true,  // Ignore changes
            true   // Ignore deletes
        );

        let disposed = false;

        // Handle folder creation
        const disposable = watcher.onDidCreate(async (uri) => {
            if (disposed) return;

            // Validate it's a directory
            try {
                const stats = await vscode.workspace.fs.stat(uri);
                if (stats.type !== vscode.FileType.Directory) {
                    this.outputChannel.appendLine(`[SpecManager] Skipping non-directory: ${uri.fsPath}`);
                    return;
                }
            } catch (error) {
                this.outputChannel.appendLine(`[SpecManager] Error checking path: ${error}`);
                return;
            }

            const specName = path.basename(uri.fsPath);
            this.outputChannel.appendLine(`[SpecManager] New spec detected: ${specName}`);
            try {
                await this.claudeProvider.renameTerminal(terminal, `Spec: ${specName}`);
            } catch (error) {
                this.outputChannel.appendLine(`[SpecManager] Failed to rename terminal: ${error}`);
            }

            // Clean up after successful rename
            this.disposeWatcher(disposable, watcher);
            disposed = true;
        });

        // Auto-cleanup after timeout
        setTimeout(() => {
            if (!disposed) {
                this.outputChannel.appendLine(`[SpecManager] Watcher timeout - cleaning up`);
                this.disposeWatcher(disposable, watcher);
                disposed = true;
            }
        }, 60000); // 60 seconds timeout
    }

    /**
     * Dispose watcher and its event handler
     */
    private disposeWatcher(disposable: vscode.Disposable, watcher: vscode.FileSystemWatcher): void {
        disposable.dispose();
        watcher.dispose();
        this.outputChannel.appendLine(`[SpecManager] Watcher disposed`);
    }

    async navigateToDocument(specName: string, type: SpecDocumentType) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const specBasePath = await this.getSpecBasePath();
        const docPath = path.join(
            workspaceFolder.uri.fsPath,
            specBasePath,
            specName,
            `${type}.md`
        );

        try {
            const doc = await vscode.workspace.openTextDocument(docPath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            // File doesn't exist, look for already open virtual documents
            // Create unique identifier for this spec document
            const uniqueMarker = `<!-- kiro-spec: ${specName}/${type} -->`;

            for (const doc of vscode.workspace.textDocuments) {
                // Check if this is an untitled document with our unique marker
                if (doc.isUntitled && doc.getText().includes(uniqueMarker)) {
                    // Found our specific virtual document, show it
                    await vscode.window.showTextDocument(doc, {
                        preview: false,
                        viewColumn: vscode.ViewColumn.Active
                    });
                    return;
                }
            }

            // No existing virtual document found, create a new one
            let placeholderContent = `${uniqueMarker}
# ${type.charAt(0).toUpperCase() + type.slice(1)} Document

This document has not been created yet.`;

            if (type === 'design') {
                placeholderContent += '\n\nPlease approve the requirements document first.';
            } else if (type === 'tasks') {
                placeholderContent += '\n\nPlease approve the design document first.';
            } else if (type === 'requirements') {
                placeholderContent += '\n\nRun "Create New Spec" to generate this document.';
            }

            // Create a new untitled document
            const doc = await vscode.workspace.openTextDocument({
                content: placeholderContent,
                language: 'markdown'
            });

            // Show it
            await vscode.window.showTextDocument(doc, {
                preview: false,
                viewColumn: vscode.ViewColumn.Active
            });
        }
    }

    async delete(specName: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const specBasePath = await this.getSpecBasePath();
        const specPath = path.join(
            workspaceFolder.uri.fsPath,
            specBasePath,
            specName
        );

        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(specPath), { recursive: true });
            await NotificationUtils.showAutoDismissNotification(`Spec "${specName}" deleted successfully`);
        } catch (error) {
            this.outputChannel.appendLine(`[SpecManager] Failed to delete spec: ${error}`);
            vscode.window.showErrorMessage(`Failed to delete spec: ${error}`);
        }
    }

    async getSpecList(): Promise<string[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const specBasePath = await this.getSpecBasePath();
        const specsPath = path.join(workspaceFolder.uri.fsPath, specBasePath);

        // Check if directory exists first before creating
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(specsPath));
        } catch {
            // Directory doesn't exist, create it
            try {
                this.outputChannel.appendLine(`[SpecManager] Creating ${specBasePath} directory`);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(specsPath)));
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(specsPath));
            } catch {
                // Ignore errors
            }
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsPath));
            return entries
                .filter(([, type]) => type === vscode.FileType.Directory)
                .map(([name]) => name);
        } catch (error) {
            // Directory doesn't exist yet
            return [];
        }
    }

    /**
     * Review design document with Codex deep analysis
     *
     * @param specName - Spec name
     * @param designPath - Path to design document
     */
    async reviewDesignWithCodex(
        specName: string,
        designPath: string
    ): Promise<void> {
        if (!this.codexOrchestrator) {
            throw new Error('Codex is not available');
        }

        this.outputChannel.appendLine(`[SpecManager] Starting Codex analysis for design: ${specName}`);

        try {
            // 1. Read design document content
            const designContent = await vscode.workspace.fs.readFile(
                vscode.Uri.file(designPath)
            );
            const content = Buffer.from(designContent).toString('utf-8');

            // 2. Build task descriptor
            const task: TaskDescriptor = {
                id: `design-review-${specName}-${Date.now()}`,
                type: 'review',
                description: `请用中文对设计文档进行深度分析。分析要点：
1. 设计方案的完整性和可行性
2. 技术选型是否合理
3. 潜在的风险和问题
4. 性能和稳定性考虑
5. 改进建议

请以中文输出完整的分析报告。

Design document to analyze: ${specName}`,
                specName,
                context: {
                    design: content,
                    additionalContext: {
                        documentType: 'design',
                        filePath: designPath,
                        outputLanguage: 'zh-CN'
                    }
                }
            };

            // 3. Enable deep analysis options
            const options: ExecutionOptions = {
                enableDeepThinking: true,
                enableCodebaseScan: true,
                forceMode: 'codex'  // Force Codex mode
            };

            // 4. Execute Codex analysis
            this.outputChannel.appendLine(`[SpecManager] Executing Codex task: ${task.id}`);
            const result = await this.codexOrchestrator.executeTask(task, options);

            // 5. Handle analysis result
            if (result.success) {
                // 5a. Save analysis result to file
                const analysisPath = designPath.replace('.md', '-codex-analysis.md');
                await this._saveAnalysisResult(analysisPath, result);

                // 5b. Show analysis result in WebView (if deep thinking result is available)
                if (result.thinkingSummary) {
                    this.outputChannel.appendLine(`[SpecManager] Showing analysis result in WebView`);

                    // Prepare metadata
                    const metadata = {
                        sessionId: result.sessionId,
                        mode: result.mode,
                        executionTime: result.duration,
                        timestamp: result.endTime.toISOString()
                    };

                    // Show WebView
                    await this.codexOrchestrator.showAnalysisResult(
                        result.thinkingSummary,
                        metadata
                    );
                }

                // 5c. Show result notification
                const choice = await vscode.window.showInformationMessage(
                    `Codex analysis completed! Saved to: ${path.basename(analysisPath)}`,
                    'View Result',
                    'Close'
                );

                if (choice === 'View Result') {
                    const doc = await vscode.workspace.openTextDocument(analysisPath);
                    await vscode.window.showTextDocument(doc);
                }
            } else {
                vscode.window.showErrorMessage(`Codex analysis failed: ${result.error?.message}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`[SpecManager] Codex analysis error: ${errorMessage}`);
            vscode.window.showErrorMessage(`Failed to analyze design with Codex: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Review requirements document with Codex deep analysis
     *
     * @param specName - Spec name
     * @param reqPath - Path to requirements document
     */
    async reviewRequirementsWithCodex(
        specName: string,
        reqPath: string
    ): Promise<void> {
        if (!this.codexOrchestrator) {
            throw new Error('Codex is not available');
        }

        this.outputChannel.appendLine(`[SpecManager] Starting Codex analysis for requirements: ${specName}`);

        try {
            // 1. Read requirements document content
            const reqContent = await vscode.workspace.fs.readFile(
                vscode.Uri.file(reqPath)
            );
            const content = Buffer.from(reqContent).toString('utf-8');

            // 2. Build task descriptor
            const task: TaskDescriptor = {
                id: `requirements-review-${specName}-${Date.now()}`,
                type: 'review',
                description: `请用中文对需求文档进行深度分析。分析要点：
1. 需求的清晰度和完整性
2. 需求的可行性和合理性
3. 需求之间的一致性和冲突
4. 潜在的遗漏或模糊点
5. 改进建议

请以中文输出完整的分析报告。

Requirements document to analyze: ${specName}`,
                specName,
                context: {
                    requirements: content,
                    additionalContext: {
                        documentType: 'requirements',
                        filePath: reqPath,
                        outputLanguage: 'zh-CN'
                    }
                }
            };

            // 3. Enable deep thinking (but not codebase scan for requirements)
            const options: ExecutionOptions = {
                enableDeepThinking: true,
                enableCodebaseScan: false,  // Requirements analysis doesn't need codebase scan
                forceMode: 'codex'
            };

            // 4. Execute Codex analysis
            this.outputChannel.appendLine(`[SpecManager] Executing Codex task: ${task.id}`);
            const result = await this.codexOrchestrator.executeTask(task, options);

            // 5. Handle analysis result
            if (result.success) {
                // 5a. Save analysis result to file
                const analysisPath = reqPath.replace('.md', '-codex-analysis.md');
                await this._saveAnalysisResult(analysisPath, result);

                // 5b. Show result notification
                const choice = await vscode.window.showInformationMessage(
                    `Codex analysis completed! Saved to: ${path.basename(analysisPath)}`,
                    'View Result',
                    'Close'
                );

                if (choice === 'View Result') {
                    const doc = await vscode.workspace.openTextDocument(analysisPath);
                    await vscode.window.showTextDocument(doc);
                }
            } else {
                vscode.window.showErrorMessage(`Codex analysis failed: ${result.error?.message}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`[SpecManager] Codex analysis error: ${errorMessage}`);
            vscode.window.showErrorMessage(`Failed to analyze requirements with Codex: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Save analysis result to file
     *
     * @param outputPath - Output file path
     * @param result - Execution result
     */
    private async _saveAnalysisResult(
        outputPath: string,
        result: ExecutionResult
    ): Promise<void> {
        const markdown = this._formatAnalysisAsMarkdown(result);

        // Add Codex generation marker
        const markedContent = `<!-- Generated by Codex Deep Analysis -->
<!-- Session ID: ${result.sessionId} -->
<!-- Generated at: ${result.endTime.toISOString()} -->

${markdown}`;

        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(outputPath),
            Buffer.from(markedContent, 'utf-8')
        );

        this.outputChannel.appendLine(`[SpecManager] Analysis result saved to: ${outputPath}`);
    }

    /**
     * Format analysis result as Markdown
     *
     * @param result - Execution result
     * @returns Formatted markdown string
     */
    private _formatAnalysisAsMarkdown(result: ExecutionResult): string {
        let md = `# Codex Deep Analysis Result\n\n`;

        // Add thinking result if available
        if (result.thinkingSummary) {
            md += `## Problem Decomposition\n\n${this._formatProblemDecomposition(result.thinkingSummary.problemDecomposition)}\n\n`;
            md += `## Risk Identification\n\n${this._formatRisks(result.thinkingSummary.riskIdentification)}\n\n`;

            if (result.thinkingSummary.solutionComparison && result.thinkingSummary.solutionComparison.length > 0) {
                md += `## Solution Comparison\n\n${this._formatSolutions(result.thinkingSummary.solutionComparison)}\n\n`;
            }

            md += `## Recommended Decision\n\n${this._formatDecision(result.thinkingSummary.recommendedDecision)}\n\n`;
        }

        // Add output if available
        if (result.output) {
            md += `## Analysis Output\n\n${result.output}\n\n`;
        }

        // Add execution information
        md += `## Execution Information\n\n`;
        md += `- Session ID: ${result.sessionId}\n`;
        md += `- Execution Mode: ${result.mode}\n`;
        md += `- Duration: ${result.duration}ms\n`;
        md += `- Start Time: ${result.startTime.toLocaleString()}\n`;
        md += `- End Time: ${result.endTime.toLocaleString()}\n`;

        if (result.generatedFiles && result.generatedFiles.length > 0) {
            md += `- Generated Files: ${result.generatedFiles.join(', ')}\n`;
        }

        return md;
    }

    /**
     * Format problem decomposition (tree structure)
     */
    private _formatProblemDecomposition(nodes: any[]): string {
        let md = `**Problem Breakdown:**\n\n`;

        const formatNode = (node: any, level: number = 0): void => {
            const indent = '  '.repeat(level);
            md += `${indent}- ${node.description} (Complexity: ${node.complexity}/10)\n`;

            if (node.subProblems && node.subProblems.length > 0) {
                node.subProblems.forEach((sub: any) => formatNode(sub, level + 1));
            }
        };

        nodes.forEach(node => formatNode(node, 0));
        return md;
    }

    /**
     * Format risks
     */
    private _formatRisks(risks: any[]): string {
        let md = `**Identified Risks:**\n\n`;

        if (risks.length === 0) {
            md += `No significant risks identified.\n`;
        } else {
            risks.forEach((risk, index) => {
                md += `${index + 1}. **[${risk.severity.toUpperCase()}] ${risk.description}**\n`;
                md += `   - Category: ${risk.category}\n`;
                md += `   - Mitigation: ${risk.mitigation}\n`;
                md += `\n`;
            });
        }

        return md;
    }

    /**
     * Format solution comparison
     */
    private _formatSolutions(solutions: any[]): string {
        let md = `**Alternative Solutions:**\n\n`;

        solutions.forEach((solution, index) => {
            md += `### Option ${index + 1}: ${solution.approach} (Score: ${solution.score}/10)\n\n`;
            md += `**Pros:**\n`;
            solution.pros.forEach((pro: string) => md += `- ${pro}\n`);
            md += `\n**Cons:**\n`;
            solution.cons.forEach((con: string) => md += `- ${con}\n`);
            md += `\n**Complexity:** ${solution.complexity}/10\n\n`;
        });

        return md;
    }

    /**
     * Format decision
     */
    private _formatDecision(decision: any): string {
        let md = `**Selected Solution:** ${decision.selectedSolution}\n\n`;
        md += `**Rationale:** ${decision.rationale}\n\n`;
        md += `**Estimated Effort:** ${decision.estimatedEffort}\n\n`;
        md += `**Next Steps:**\n\n`;
        decision.nextSteps.forEach((step: string, index: number) => {
            md += `${index + 1}. ${step}\n`;
        });
        return md;
    }
}
