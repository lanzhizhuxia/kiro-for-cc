import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeCodeProvider } from './providers/claudeCodeProvider';
import { SpecManager } from './features/spec/specManager';
import { SteeringManager } from './features/steering/steeringManager';
import { SpecExplorerProvider } from './providers/specExplorerProvider';
import { SteeringExplorerProvider } from './providers/steeringExplorerProvider';
import { HooksExplorerProvider } from './providers/hooksExplorerProvider';
import { MCPExplorerProvider } from './providers/mcpExplorerProvider';
import { OverviewProvider } from './providers/overviewProvider';
import { AgentsExplorerProvider } from './providers/agentsExplorerProvider';
import { AgentManager } from './features/agents/agentManager';
import { ConfigManager } from './utils/configManager';
import { CONFIG_FILE_NAME, VSC_CONFIG_NAMESPACE } from './constants';
import { PromptLoader } from './services/promptLoader';
import { UpdateChecker } from './utils/updateChecker';
import { PermissionManager } from './features/permission/permissionManager';
import { NotificationUtils } from './utils/notificationUtils';
import { SpecTaskCodeLensProvider } from './providers/specTaskCodeLensProvider';
import { SamManager } from './features/sam/samManager';
import { CodexOrchestrator } from './features/codex/codexOrchestrator';

let claudeCodeProvider: ClaudeCodeProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
let permissionManager: PermissionManager;
let agentManager: AgentManager;
let samManager: SamManager;
let codexOrchestrator: CodexOrchestrator | undefined;
export let outputChannel: vscode.OutputChannel;

// 导出 getter 函数供其他模块使用
export function getPermissionManager(): PermissionManager {
    return permissionManager;
}

export async function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('Kiro for Claude Code - Debug');

    // Initialize PromptLoader
    try {
        const promptLoader = PromptLoader.getInstance();
        promptLoader.initialize();
        outputChannel.appendLine('PromptLoader initialized successfully');
    } catch (error) {
        outputChannel.appendLine(`Failed to initialize PromptLoader: ${error}`);
        vscode.window.showErrorMessage(`Failed to initialize prompt system: ${error}`);
    }

    // 检查工作区状态
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        outputChannel.appendLine('WARNING: No workspace folder found!');
    }


    // Initialize Claude Code SDK provider with output channel
    claudeCodeProvider = new ClaudeCodeProvider(context, outputChannel);

    // 创建并初始化 PermissionManager
    permissionManager = new PermissionManager(context, outputChannel);

    // 初始化权限系统（包含重试逻辑）
    await permissionManager.initializePermissions();

    // Initialize feature managers with output channel
    specManager = new SpecManager(claudeCodeProvider, outputChannel);
    steeringManager = new SteeringManager(claudeCodeProvider, outputChannel);
    samManager = new SamManager(claudeCodeProvider, outputChannel);

    // Initialize Agent Manager and agents
    agentManager = new AgentManager(context, outputChannel);
    await agentManager.initializeBuiltInAgents();

    // Initialize ConfigManager with credential manager (done before Codex initialization)
    ConfigManager.getInstance().initializeCredentialManager(context);
    outputChannel.appendLine('Credential Manager initialized successfully');

    // Initialize Codex Orchestrator (for session management and lifecycle)
    try {
        codexOrchestrator = new CodexOrchestrator(context, outputChannel);
        outputChannel.appendLine('Codex Orchestrator initialized successfully');

        // Integrate Codex with SpecManager and SamManager
        specManager.setCodexOrchestrator(codexOrchestrator);
        samManager.setCodexOrchestrator(codexOrchestrator);
        outputChannel.appendLine('Codex integrated with SpecManager and SamManager');
    } catch (error) {
        // Codex功能是可选的，初始化失败不应影响其他功能
        outputChannel.appendLine(`Codex Orchestrator initialization skipped: ${error}`);
    }

    // Register tree data providers
    const overviewProvider = new OverviewProvider(context);
    const specExplorer = new SpecExplorerProvider(context, outputChannel);
    const steeringExplorer = new SteeringExplorerProvider(context);
    const hooksExplorer = new HooksExplorerProvider(context);
    const mcpExplorer = new MCPExplorerProvider(context, outputChannel);
    const agentsExplorer = new AgentsExplorerProvider(context, agentManager, outputChannel);

    // Set managers
    specExplorer.setSpecManager(specManager);
    steeringExplorer.setSteeringManager(steeringManager);

    // Connect ProgressTracker to SamManager
    samManager.setProgressTracker(specExplorer.getProgressTracker());

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kfc.views.overview', overviewProvider),
        vscode.window.registerTreeDataProvider('kfc.views.specExplorer', specExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.agentsExplorer', agentsExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.steeringExplorer', steeringExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.hooksStatus', hooksExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.mcpServerStatus', mcpExplorer)
    );

    // Initialize update checker
    const updateChecker = new UpdateChecker(context, outputChannel);

    // Register commands
    registerCommands(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer, agentsExplorer, updateChecker);

    // Initialize default settings file if not exists
    await initializeDefaultSettings();

    // Set up file watchers
    setupFileWatchers(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer, agentsExplorer);

    // Check for updates on startup
    updateChecker.checkForUpdates();
    outputChannel.appendLine('Update check initiated');

    const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();
    const configManager = ConfigManager.getInstance();

    let specDir = '.claude/specs';
    try {
        await configManager.loadSettings();
        const configuredSpecDir = configManager.getPath('specs');
        specDir = configuredSpecDir || specDir;
    } catch (error) {
        outputChannel.appendLine(`Failed to load settings for spec CodeLens: ${error}`);
    }

    // // Register CodeLens provider for spec tasks once settings are ready
    // const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();

    const normalizedSpecDir = specDir.replace(/\\/g, '/');

    // 使用更明确的文档选择器
    const selector: vscode.DocumentSelector = [
        {
            language: 'markdown',
            pattern: `**/${normalizedSpecDir}/*/tasks.md`,
            scheme: 'file'
        }
    ];

    const disposable = vscode.languages.registerCodeLensProvider(
        selector,
        specTaskCodeLensProvider
    );

    context.subscriptions.push(disposable);

    outputChannel.appendLine('CodeLens provider for spec tasks registered');
}

async function initializeDefaultSettings() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    // Create .claude/settings directory if it doesn't exist
    const claudeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.claude');
    const settingsDir = vscode.Uri.joinPath(claudeDir, 'settings');

    try {
        await vscode.workspace.fs.createDirectory(claudeDir);
        await vscode.workspace.fs.createDirectory(settingsDir);
    } catch (error) {
        // Directory might already exist
    }

    // Create kfc-settings.json if it doesn't exist
    const settingsFile = vscode.Uri.joinPath(settingsDir, CONFIG_FILE_NAME);

    try {
        // Check if file exists
        await vscode.workspace.fs.stat(settingsFile);
    } catch (error) {
        // File doesn't exist, create it with default settings
        const configManager = ConfigManager.getInstance();
        const defaultSettings = configManager.getSettings();

        await vscode.workspace.fs.writeFile(
            settingsFile,
            Buffer.from(JSON.stringify(defaultSettings, null, 2))
        );
    }
}

/**
 * Handle design document review command
 */
async function handleReviewDesignCommand(designUri?: vscode.Uri): Promise<void> {
    // 1. Determine the design document to analyze
    let filePath: string;

    if (designUri) {
        // Called from right-click menu or CodeLens
        filePath = designUri.fsPath;
    } else {
        // Called from command palette, user needs to select file
        const selectedUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Markdown files': ['md']
            },
            title: 'Select design document to analyze'
        });

        if (!selectedUri || selectedUri.length === 0) {
            return; // User cancelled
        }

        filePath = selectedUri[0].fsPath;
    }

    // 2. Verify file exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
        return;
    }

    // 3. Extract spec name (infer from path)
    const specName = _extractSpecName(filePath);

    // 4. Check if Codex is available
    if (!specManager.isCodexAvailable()) {
        const choice = await vscode.window.showWarningMessage(
            'Codex deep analysis feature is not available. Please ensure Codex is properly configured.',
            'View Configuration Guide',
            'Cancel'
        );

        if (choice === 'View Configuration Guide') {
            // Open configuration guide
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/notdp/kiro-for-cc#codex-configuration'));
        }
        return;
    }

    // 5. Show progress notification
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing design document: ${path.basename(filePath)}`,
        cancellable: true
    }, async (progress, token) => {
        // 6. Call SpecManager's reviewDesignWithCodex method
        try {
            progress.report({ increment: 10, message: 'Reading document...' });

            await specManager.reviewDesignWithCodex(specName, filePath);

            progress.report({ increment: 90, message: 'Analysis complete' });

            vscode.window.showInformationMessage(
                `Design document analysis complete: ${path.basename(filePath)}`
            );
        } catch (error) {
            // Handle cancellation
            if (token.isCancellationRequested) {
                vscode.window.showWarningMessage('Analysis cancelled');
            } else {
                // Check if it's an MCP-related error
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('mcp__codex') || errorMessage.includes('Unknown tool')) {
                    const choice = await vscode.window.showErrorMessage(
                        'Codex 是实验性功能，需要配置 MCP 服务器。基本 Spec 功能可正常使用。',
                        '查看配置指南',
                        '暂时禁用 Codex',
                        '取消'
                    );
                    if (choice === '查看配置指南') {
                        // Open local documentation
                        const docPath = path.join(
                            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                            'docs',
                            'CODEX_SETUP.md'
                        );
                        if (fs.existsSync(docPath)) {
                            vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(docPath));
                        } else {
                            vscode.env.openExternal(vscode.Uri.parse('https://github.com/notdp/kiro-for-cc/blob/main/docs/CODEX_SETUP.md'));
                        }
                    } else if (choice === '暂时禁用 Codex') {
                        vscode.window.showInformationMessage(
                            '请在 src/features/spec/specManager.ts 的 isCodexAvailable() 方法中返回 false，然后重新编译安装。详见配置指南。'
                        );
                    }
                } else {
                    throw error;
                }
            }
        }
    });
}

/**
 * Handle requirements document review command
 */
async function handleReviewRequirementsCommand(reqUri?: vscode.Uri): Promise<void> {
    // 1. Determine the requirements document to analyze
    let filePath: string;

    if (reqUri) {
        // Called from right-click menu or CodeLens
        filePath = reqUri.fsPath;
    } else {
        // Called from command palette, user needs to select file
        const selectedUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Markdown files': ['md']
            },
            title: 'Select requirements document to analyze'
        });

        if (!selectedUri || selectedUri.length === 0) {
            return; // User cancelled
        }

        filePath = selectedUri[0].fsPath;
    }

    // 2. Verify file exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File does not exist: ${filePath}`);
        return;
    }

    // 3. Extract spec name (infer from path)
    const specName = _extractSpecName(filePath);

    // 4. Check if Codex is available
    if (!specManager.isCodexAvailable()) {
        const choice = await vscode.window.showWarningMessage(
            'Codex deep analysis feature is not available. Please ensure Codex is properly configured.',
            'View Configuration Guide',
            'Cancel'
        );

        if (choice === 'View Configuration Guide') {
            // Open configuration guide
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/notdp/kiro-for-cc#codex-configuration'));
        }
        return;
    }

    // 5. Show progress notification
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing requirements document: ${path.basename(filePath)}`,
        cancellable: true
    }, async (progress, token) => {
        // 6. Call SpecManager's reviewRequirementsWithCodex method
        try {
            progress.report({ increment: 10, message: 'Reading document...' });

            await specManager.reviewRequirementsWithCodex(specName, filePath);

            progress.report({ increment: 90, message: 'Analysis complete' });

            vscode.window.showInformationMessage(
                `Requirements document analysis complete: ${path.basename(filePath)}`
            );
        } catch (error) {
            // Handle cancellation
            if (token.isCancellationRequested) {
                vscode.window.showWarningMessage('Analysis cancelled');
            } else {
                // Check if it's an MCP-related error
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('mcp__codex') || errorMessage.includes('Unknown tool')) {
                    const choice = await vscode.window.showErrorMessage(
                        'Codex 是实验性功能，需要配置 MCP 服务器。基本 Spec 功能可正常使用。',
                        '查看配置指南',
                        '暂时禁用 Codex',
                        '取消'
                    );
                    if (choice === '查看配置指南') {
                        // Open local documentation
                        const docPath = path.join(
                            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                            'docs',
                            'CODEX_SETUP.md'
                        );
                        if (fs.existsSync(docPath)) {
                            vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(docPath));
                        } else {
                            vscode.env.openExternal(vscode.Uri.parse('https://github.com/notdp/kiro-for-cc/blob/main/docs/CODEX_SETUP.md'));
                        }
                    } else if (choice === '暂时禁用 Codex') {
                        vscode.window.showInformationMessage(
                            '请在 src/features/spec/specManager.ts 的 isCodexAvailable() 方法中返回 false，然后重新编译安装。详见配置指南。'
                        );
                    }
                } else {
                    throw error;
                }
            }
        }
    });
}

/**
 * Handle generic document analysis command (from command palette)
 */
async function handleAnalyzeDocumentCommand(): Promise<void> {
    // 1. Let user select document type
    const docType = await vscode.window.showQuickPick(
        [
            { label: 'Design Document (design.md)', value: 'design' },
            { label: 'Requirements Document (requirements.md)', value: 'requirements' },
            { label: 'Tasks Document (tasks.md)', value: 'tasks' }
        ],
        {
            placeHolder: 'Select the type of document to analyze'
        }
    );

    if (!docType) {
        return; // User cancelled
    }

    // 2. Call corresponding command based on type
    switch (docType.value) {
        case 'design':
            await vscode.commands.executeCommand('kfc.codex.reviewDesign');
            break;
        case 'requirements':
            await vscode.commands.executeCommand('kfc.codex.reviewRequirements');
            break;
        case 'tasks':
            vscode.window.showInformationMessage('Tasks document analysis feature coming soon');
            break;
    }
}

/**
 * Extract spec name from file path
 */
function _extractSpecName(filePath: string): string {
    // Assume path format: .../specs/{specName}/design.md
    const parts = filePath.split(path.sep);
    const specsIndex = parts.indexOf('specs');

    if (specsIndex >= 0 && specsIndex < parts.length - 1) {
        return parts[specsIndex + 1];
    }

    // Fallback: use directory name containing the file
    return path.basename(path.dirname(filePath));
}

async function toggleViews() {
    const config = vscode.workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
    const currentVisibility = {
        specs: config.get('views.specs.visible', true),
        hooks: config.get('views.hooks.visible', true),
        steering: config.get('views.steering.visible', true),
        mcp: config.get('views.mcp.visible', true)
    };

    const items = [
        {
            label: `$(${currentVisibility.specs ? 'check' : 'blank'}) Specs`,
            picked: currentVisibility.specs,
            id: 'specs'
        },
        {
            label: `$(${currentVisibility.hooks ? 'check' : 'blank'}) Agent Hooks`,
            picked: currentVisibility.hooks,
            id: 'hooks'
        },
        {
            label: `$(${currentVisibility.steering ? 'check' : 'blank'}) Agent Steering`,
            picked: currentVisibility.steering,
            id: 'steering'
        },
        {
            label: `$(${currentVisibility.mcp ? 'check' : 'blank'}) MCP Servers`,
            picked: currentVisibility.mcp,
            id: 'mcp'
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select views to show'
    });

    if (selected) {
        const newVisibility = {
            specs: selected.some(item => item.id === 'specs'),
            hooks: selected.some(item => item.id === 'hooks'),
            steering: selected.some(item => item.id === 'steering'),
            mcp: selected.some(item => item.id === 'mcp')
        };

        await config.update('views.specs.visible', newVisibility.specs, vscode.ConfigurationTarget.Workspace);
        await config.update('views.hooks.visible', newVisibility.hooks, vscode.ConfigurationTarget.Workspace);
        await config.update('views.steering.visible', newVisibility.steering, vscode.ConfigurationTarget.Workspace);
        await config.update('views.mcp.visible', newVisibility.mcp, vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage('View visibility updated!');
    }
}


function registerCommands(context: vscode.ExtensionContext, specExplorer: SpecExplorerProvider, steeringExplorer: SteeringExplorerProvider, hooksExplorer: HooksExplorerProvider, mcpExplorer: MCPExplorerProvider, agentsExplorer: AgentsExplorerProvider, updateChecker: UpdateChecker) {

    // Permission commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.permission.reset', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to reset Claude Code permissions? This will revoke the granted permissions.',
                'Yes', 'No'
            );

            if (confirm === 'Yes') {
                const success = await permissionManager.resetPermission();
                if (success) {
                    NotificationUtils.showAutoDismissNotification(
                        'Permissions have been reset'
                    );
                } else {
                    vscode.window.showErrorMessage('Failed to reset permissions. Please check the output log.');
                }
            }
        })
    );

    // Spec commands
    const createSpecCommand = vscode.commands.registerCommand('kfc.spec.create', async () => {
        outputChannel.appendLine('\n=== COMMAND kfc.spec.create TRIGGERED ===');
        outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);

        try {
            await specManager.create();
        } catch (error) {
            outputChannel.appendLine(`Error in createNewSpec: ${error}`);
            vscode.window.showErrorMessage(`Failed to create spec: ${error}`);
        }
    });

    const createSpecWithAgentsCommand = vscode.commands.registerCommand('kfc.spec.createWithAgents', async () => {
        try {
            await specManager.createWithAgents();
        } catch (error) {
            outputChannel.appendLine(`Error in createWithAgents: ${error}`);
            vscode.window.showErrorMessage(`Failed to create spec with agents: ${error}`);
        }
    });

    context.subscriptions.push(createSpecCommand, createSpecWithAgentsCommand);

    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.spec.navigate.requirements', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'requirements');
        }),

        vscode.commands.registerCommand('kfc.spec.navigate.design', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'design');
        }),

        vscode.commands.registerCommand('kfc.spec.navigate.tasks', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'tasks');
        }),

        vscode.commands.registerCommand('kfc.spec.implTask', async (documentUri: vscode.Uri, lineNumber: number, taskDescription: string) => {
            outputChannel.appendLine(`[Task Execute] Line ${lineNumber + 1}: ${taskDescription}`);

            // 更新任务状态为已完成
            const document = await vscode.workspace.openTextDocument(documentUri);
            const edit = new vscode.WorkspaceEdit();
            const line = document.lineAt(lineNumber);
            const newLine = line.text.replace('- [ ]', '- [x]');
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.text.length);
            edit.replace(documentUri, range, newLine);
            await vscode.workspace.applyEdit(edit);

            // 使用 Claude Code 执行任务
            await specManager.implTask(documentUri.fsPath, taskDescription);
        }),
        vscode.commands.registerCommand('kfc.spec.refresh', async () => {
            outputChannel.appendLine('[Manual Refresh] Refreshing spec explorer...');
            specExplorer.refresh();
        })
    );

    // Codex commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.codex.reviewDesign', async (item?: any) => {
            try {
                // Handle both TreeItem (from context menu) and Uri (from other sources)
                let designUri: vscode.Uri | undefined;

                if (item) {
                    if (item instanceof vscode.Uri) {
                        designUri = item;
                    } else if (item.resourceUri) {
                        // TreeItem with resourceUri
                        designUri = item.resourceUri;
                    } else if (item.filePath) {
                        // Custom TreeItem with filePath
                        designUri = vscode.Uri.file(item.filePath);
                    }
                }

                await handleReviewDesignCommand(designUri);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Design document analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

        vscode.commands.registerCommand('kfc.codex.reviewRequirements', async (item?: any) => {
            try {
                // Handle both TreeItem (from context menu) and Uri (from other sources)
                let reqUri: vscode.Uri | undefined;

                if (item) {
                    if (item instanceof vscode.Uri) {
                        reqUri = item;
                    } else if (item.resourceUri) {
                        reqUri = item.resourceUri;
                    } else if (item.filePath) {
                        reqUri = vscode.Uri.file(item.filePath);
                    }
                }

                await handleReviewRequirementsCommand(reqUri);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Requirements document analysis failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

        vscode.commands.registerCommand('kfc.codex.analyzeDocument', async () => {
            await handleAnalyzeDocumentCommand();
        }),

        vscode.commands.registerCommand('kfc.codex.viewExecutionLog', async (taskId: string) => {
            try {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage('No workspace folder found');
                    return;
                }

                const logPath = path.join(workspaceRoot, '.claude/codex/execution-history', `${taskId}.log`);

                // 检查文件是否存在
                if (!fs.existsSync(logPath)) {
                    vscode.window.showWarningMessage(`Execution log not found for task: ${taskId}`);
                    return;
                }

                // 打开日志文件
                const doc = await vscode.workspace.openTextDocument(logPath);
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to view execution log: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );

    // Sam commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.sam.ask', async () => {
            outputChannel.appendLine('\n=== COMMAND kfc.sam.ask TRIGGERED ===');
            outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);

            try {
                await samManager.askSam();
            } catch (error) {
                outputChannel.appendLine(`Error in sam.ask: ${error}`);
                vscode.window.showErrorMessage(`Failed to start Sam: ${error}`);
            }
        }),

        vscode.commands.registerCommand('kfc.sam.continue', async (item: any) => {
            outputChannel.appendLine('\n=== COMMAND kfc.sam.continue TRIGGERED ===');
            outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);

            try {
                if (item && item.specName) {
                    await samManager.continueWork(item.specName);
                } else {
                    vscode.window.showWarningMessage('No spec selected');
                }
            } catch (error) {
                outputChannel.appendLine(`Error in sam.continue: ${error}`);
                vscode.window.showErrorMessage(`Failed to continue Sam work: ${error}`);
            }
        }),

        vscode.commands.registerCommand('kfc.sam.viewProgress', async (item: any) => {
            outputChannel.appendLine('\n=== COMMAND kfc.sam.viewProgress TRIGGERED ===');

            try {
                if (item && item.specName) {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceRoot) {
                        const progressPath = path.join(
                            workspaceRoot,
                            '.claude/specs',
                            item.specName,
                            'PROGRESS.md'
                        );

                        if (fs.existsSync(progressPath)) {
                            const doc = await vscode.workspace.openTextDocument(progressPath);
                            await vscode.window.showTextDocument(doc);
                        } else {
                            vscode.window.showWarningMessage(`No progress file found for ${item.specName}`);
                        }
                    }
                } else {
                    vscode.window.showWarningMessage('No spec selected');
                }
            } catch (error) {
                outputChannel.appendLine(`Error in sam.viewProgress: ${error}`);
                vscode.window.showErrorMessage(`Failed to view progress: ${error}`);
            }
        }),

        vscode.commands.registerCommand('kfc.sam.implementWithCodex', async () => {
            outputChannel.appendLine('\n=== COMMAND kfc.sam.implementWithCodex TRIGGERED ===');

            try {
                // 1. Get spec name from user
                const specName = await vscode.window.showInputBox({
                    prompt: 'Enter the spec name',
                    placeHolder: 'e.g., bubble-sort'
                });

                if (!specName) {
                    return;
                }

                // 2. Get task description from user
                const taskDescription = await vscode.window.showInputBox({
                    prompt: 'Describe the task you want Codex to implement',
                    placeHolder: 'e.g., 实现冒泡排序算法，支持升序和降序',
                    validateInput: (value) => {
                        return value.trim() ? null : 'Task description cannot be empty';
                    }
                });

                if (!taskDescription) {
                    return;
                }

                // 3. Try to load requirements and design for context
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                let taskContext: { requirements?: string; design?: string } | undefined;

                if (workspaceRoot) {
                    const reqPath = path.join(workspaceRoot, 'docs/specs', specName, 'requirements.md');
                    const designPath = path.join(workspaceRoot, 'docs/specs', specName, 'design.md');

                    taskContext = {};

                    if (fs.existsSync(reqPath)) {
                        taskContext.requirements = fs.readFileSync(reqPath, 'utf-8');
                        outputChannel.appendLine('[Sam] Loaded requirements context');
                    }

                    if (fs.existsSync(designPath)) {
                        taskContext.design = fs.readFileSync(designPath, 'utf-8');
                        outputChannel.appendLine('[Sam] Loaded design context');
                    }
                }

                // 4. Execute with Codex
                outputChannel.appendLine(`[Sam] Delegating task to Codex: ${taskDescription}`);

                const result = await samManager.implementTaskWithCodex(
                    specName,
                    taskDescription,
                    taskContext
                );

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `✅ Task implemented successfully by Codex! Check the output.`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `❌ Codex implementation failed: ${result.error}`
                    );
                }

            } catch (error) {
                outputChannel.appendLine(`Error in sam.implementWithCodex: ${error}`);
                vscode.window.showErrorMessage(`Failed to implement task: ${error}`);
            }
        })
    );

    // Steering commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.steering.create', async () => {
            await steeringManager.createCustom();
        }),

        vscode.commands.registerCommand('kfc.steering.generateInitial', async () => {
            await steeringManager.init();
        }),

        vscode.commands.registerCommand('kfc.steering.refine', async (item: any) => {
            // Item is always from tree view
            const uri = vscode.Uri.file(item.resourcePath);
            await steeringManager.refine(uri);
        }),

        vscode.commands.registerCommand('kfc.steering.delete', async (item: any) => {
            outputChannel.appendLine(`[Steering] Deleting: ${item.label}`);

            // Use SteeringManager to delete the document and update CLAUDE.md
            const result = await steeringManager.delete(item.label, item.resourcePath);

            if (!result.success && result.error) {
                vscode.window.showErrorMessage(result.error);
            }
        }),

        // CLAUDE.md commands
        vscode.commands.registerCommand('kfc.steering.createUserRule', async () => {
            await steeringManager.createUserClaudeMd();
        }),

        vscode.commands.registerCommand('kfc.steering.createProjectRule', async () => {
            await steeringManager.createProjectClaudeMd();
        }),

        vscode.commands.registerCommand('kfc.steering.refresh', async () => {
            outputChannel.appendLine('[Manual Refresh] Refreshing steering explorer...');
            steeringExplorer.refresh();
        }),

        // Agents commands
        vscode.commands.registerCommand('kfc.agents.refresh', async () => {
            outputChannel.appendLine('[Manual Refresh] Refreshing agents explorer...');
            agentsExplorer.refresh();
        })
    );

    // Add file save confirmation for agent files
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(async (event) => {
            const document = event.document;
            const filePath = document.fileName;

            // Check if this is an agent file
            if (filePath.includes('.claude/agents/') && filePath.endsWith('.md')) {
                // Show confirmation dialog
                const result = await vscode.window.showWarningMessage(
                    'Are you sure you want to save changes to this agent file?',
                    { modal: true },
                    'Save',
                    'Cancel'
                );

                if (result !== 'Save') {
                    // Cancel the save operation by waiting forever
                    event.waitUntil(new Promise(() => { }));
                }
            }
        })
    );

    // Spec delete command
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.spec.delete', async (item: any) => {
            await specManager.delete(item.label);
        })
    );

    // Claude Code integration commands
    // (removed unused kfc.claude.implementTask command)

    // Hooks commands (only refresh for Claude Code hooks)
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.hooks.refresh', () => {
            hooksExplorer.refresh();
        }),

        vscode.commands.registerCommand('kfc.hooks.copyCommand', async (command: string) => {
            await vscode.env.clipboard.writeText(command);
        })
    );

    // MCP commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.mcp.refresh', () => {
            mcpExplorer.refresh();
        }),

        // Update checker command
        vscode.commands.registerCommand('kfc.checkForUpdates', async () => {
            outputChannel.appendLine('Manual update check requested');
            await updateChecker.checkForUpdates(true); // Force check
        }),

        // Overview and settings commands
        vscode.commands.registerCommand('kfc.settings.open', async () => {
            outputChannel.appendLine('Opening Kiro settings...');

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Create .claude/settings directory if it doesn't exist
            const claudeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.claude');
            const settingsDir = vscode.Uri.joinPath(claudeDir, 'settings');

            try {
                await vscode.workspace.fs.createDirectory(claudeDir);
                await vscode.workspace.fs.createDirectory(settingsDir);
            } catch (error) {
                // Directory might already exist
            }

            // Create or open kfc-settings.json
            const settingsFile = vscode.Uri.joinPath(settingsDir, CONFIG_FILE_NAME);

            try {
                // Check if file exists
                await vscode.workspace.fs.stat(settingsFile);
            } catch (error) {
                // File doesn't exist, create it with default settings
                const configManager = ConfigManager.getInstance();
                const defaultSettings = configManager.getSettings();

                await vscode.workspace.fs.writeFile(
                    settingsFile,
                    Buffer.from(JSON.stringify(defaultSettings, null, 2))
                );
            }

            // Open the settings file
            const document = await vscode.workspace.openTextDocument(settingsFile);
            await vscode.window.showTextDocument(document);
        }),

        vscode.commands.registerCommand('kfc.help.open', async () => {
            outputChannel.appendLine('Opening Kiro help...');
            const helpUrl = 'https://github.com/notdp/kiro-for-cc#readme';
            vscode.env.openExternal(vscode.Uri.parse(helpUrl));
        }),

        vscode.commands.registerCommand('kfc.menu.open', async () => {
            outputChannel.appendLine('Opening Kiro menu...');
            await toggleViews();
        }),

        // Permission debug commands
        vscode.commands.registerCommand('kfc.permission.check', async () => {
            // 使用新的 PermissionManager 检查真实的权限状态
            const hasPermission = await permissionManager.checkPermission();
            const configPath = require('os').homedir() + '/.claude.json';

            vscode.window.showInformationMessage(
                `Claude Code Permission Status: ${hasPermission ? '✅ Granted' : '❌ Not Granted'}`
            );

            outputChannel.appendLine(`[Permission Check] Status: ${hasPermission}`);
            outputChannel.appendLine(`[Permission Check] Config file: ${configPath}`);
            outputChannel.appendLine(`[Permission Check] Checking bypassPermissionsModeAccepted field in ~/.claude.json`);
        }),

    );
}

function setupFileWatchers(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider,
    agentsExplorer: AgentsExplorerProvider
) {
    // Watch for changes in .claude directory with debouncing
    const kfcWatcher = vscode.workspace.createFileSystemWatcher('**/.claude/**/*');

    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = (event: string, uri: vscode.Uri) => {
        outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath}`);

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            specExplorer.refresh();
            steeringExplorer.refresh();
            hooksExplorer.refresh();
            mcpExplorer.refresh();
            agentsExplorer.refresh();
        }, 1000); // Increase debounce time to 1 second
    };

    kfcWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
    kfcWatcher.onDidDelete((uri) => debouncedRefresh('Delete', uri));
    kfcWatcher.onDidChange((uri) => debouncedRefresh('Change', uri));

    context.subscriptions.push(kfcWatcher);

    // Watch for changes in Claude settings
    const claudeSettingsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(process.env.HOME || '', '.claude/settings.json')
    );

    claudeSettingsWatcher.onDidChange(() => {
        hooksExplorer.refresh();
        mcpExplorer.refresh();
    });

    context.subscriptions.push(claudeSettingsWatcher);

    // Watch for changes in CLAUDE.md files
    const globalClaudeMdWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(process.env.HOME || '', '.claude/CLAUDE.md')
    );
    const projectClaudeMdWatcher = vscode.workspace.createFileSystemWatcher('**/CLAUDE.md');

    globalClaudeMdWatcher.onDidCreate(() => steeringExplorer.refresh());
    globalClaudeMdWatcher.onDidDelete(() => steeringExplorer.refresh());
    projectClaudeMdWatcher.onDidCreate(() => steeringExplorer.refresh());
    projectClaudeMdWatcher.onDidDelete(() => steeringExplorer.refresh());

    context.subscriptions.push(globalClaudeMdWatcher, projectClaudeMdWatcher);
}

export async function deactivate() {
    // Cleanup
    if (permissionManager) {
        permissionManager.dispose();
    }

    // Dispose Codex Orchestrator (cleanup sessions and timers)
    if (codexOrchestrator) {
        await codexOrchestrator.dispose();
    }
}
