import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeCodeProvider } from './providers/claudeCodeProvider';
import { SpecManager } from './features/spec/specManager';
import { SteeringManager } from './features/steering/steeringManager';
import { SpecExplorerProvider } from './providers/specExplorerProvider';
import { SteeringExplorerProvider } from './providers/steeringExplorerProvider';
import { HooksExplorerProvider } from './providers/hooksExplorerProvider';
import { MCPExplorerProvider } from './providers/mcpExplorerProvider';
import { OverviewProvider } from './providers/overviewProvider';
import { ConfigManager } from './utils/configManager';
import { CONFIG_FILE_NAME, DEFAULT_PATHS, VSC_CONFIG_NAMESPACE } from './constants';

let claudeProvider: ClaudeCodeProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
export let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('Kiro for Claude Code');

    // 检查工作区状态
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        outputChannel.appendLine('WARNING: No workspace folder found!');
    }


    // Initialize Claude Code SDK provider with output channel
    claudeProvider = new ClaudeCodeProvider(context, outputChannel);

    // Initialize feature managers with output channel
    specManager = new SpecManager(context, claudeProvider, outputChannel);
    steeringManager = new SteeringManager(context, claudeProvider, outputChannel);

    // Register tree data providers
    const overviewProvider = new OverviewProvider(context);
    const specExplorer = new SpecExplorerProvider(context, outputChannel);
    const steeringExplorer = new SteeringExplorerProvider(context);
    const hooksExplorer = new HooksExplorerProvider(context);
    const mcpExplorer = new MCPExplorerProvider(context, outputChannel);

    // Set managers
    specExplorer.setSpecManager(specManager);
    steeringExplorer.setSteeringManager(steeringManager);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kfc.views.overview', overviewProvider),
        vscode.window.registerTreeDataProvider('kfc.views.specExplorer', specExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.steeringExplorer', steeringExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.hooksStatus', hooksExplorer),
        vscode.window.registerTreeDataProvider('kfc.views.mcpServerStatus', mcpExplorer)
    );

    // Register commands
    registerCommands(context, hooksExplorer, mcpExplorer);

    // Initialize default settings file if not exists
    await initializeDefaultSettings();

    // Set up file watchers
    setupFileWatchers(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer);


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


function registerCommands(context: vscode.ExtensionContext, hooksExplorer: HooksExplorerProvider, mcpExplorer: MCPExplorerProvider) {
    // Spec commands
    const createSpecCommand = vscode.commands.registerCommand('kfc.spec.create', async () => {
        outputChannel.appendLine('\n=== COMMAND kfc.spec.create TRIGGERED ===');
        outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);

        // 移除这个多余的信息提示，避免和输入框冲突
        // vscode.window.showInformationMessage('Creating new spec...');

        try {
            await specManager.createNewSpec();
        } catch (error) {
            outputChannel.appendLine(`Error in createNewSpec: ${error}`);
            vscode.window.showErrorMessage(`Failed to create spec: ${error}`);
        }
    });

    context.subscriptions.push(createSpecCommand);


    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.spec.refresh', async (item: any) => {
            // Coming soon - show a friendly message instead of error
            vscode.window.showInformationMessage('Spec refinement feature coming soon!', 'OK');
            // TODO: Fix implementation to handle tree item properly
            // const uri = vscode.Uri.file(item.resourcePath || '');
            // await specManager.refreshSpec(uri);
        }),

        vscode.commands.registerCommand('kfc.spec.navigate.requirements', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'requirements');
        }),

        vscode.commands.registerCommand('kfc.spec.navigate.design', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'design');
        }),

        vscode.commands.registerCommand('kfc.spec.navigate.tasks', async (specName: string) => {
            await specManager.navigateToDocument(specName, 'tasks');
        }),

        vscode.commands.registerCommand('kfc.spec.implementTask', async () => {
            // Coming soon - show a friendly message instead of error
            vscode.window.showInformationMessage('Task implementation feature coming soon!', 'OK');
        })
    );

    // Steering commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.steering.create', async () => {
            await steeringManager.createSteeringDocument();
        }),

        vscode.commands.registerCommand('kfc.steering.generateInitial', async () => {
            await steeringManager.generateInitialSteeringDocs();
        }),

        vscode.commands.registerCommand('kfc.steering.refine', async (item: any) => {
            // Item is always from tree view
            const uri = vscode.Uri.file(item.resourcePath);
            await steeringManager.refineSteeringDocument(uri);
        }),

        vscode.commands.registerCommand('kfc.steering.delete', async (item: any) => {
            outputChannel.appendLine(`[Steering] Deleting: ${item.label}`);
            
            await vscode.workspace.fs.delete(vscode.Uri.file(item.resourcePath));

            // Ask Claude to update CLAUDE.md to remove this document from the index
            const prompt = `The steering document "${item.label}" has been deleted from ${steeringManager.getSteeringBasePath()}.
            
If a project CLAUDE.md exists and contains a "## Steering Documents" section, please update it to remove the reference to this deleted document.`;

            // Show progress notification with auto-dismiss
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Deleting "${item.label}" and updating CLAUDE.md...`,
                cancellable: false
            }, async () => {
                await new Promise(resolve => setTimeout(resolve, 3000));
            });

            // Use the provider's executeClaudeCommand method
            const result = await claudeProvider.executeClaudeCommand(prompt, 'Edit');
            
            // Show result notification
            if (result.exitCode === 0) {
                // Use withProgress for auto-dismissing notification (2 seconds)
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Steering document "${item.label}" deleted and CLAUDE.md updated successfully.`,
                    cancellable: false
                }, async () => {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                });
            } else if (result.exitCode !== undefined) {
                outputChannel.appendLine(`[Steering] Failed to update CLAUDE.md. Exit code: ${result.exitCode}`);
                vscode.window.showErrorMessage(
                    `Failed to update CLAUDE.md after deleting "${item.label}". Exit code: ${result.exitCode}`
                );
            }
        }),

        // CLAUDE.md commands
        vscode.commands.registerCommand('kfc.steering.createGlobalClaude', async () => {
            await steeringManager.createClaudeMd('global');
        }),

        vscode.commands.registerCommand('kfc.steering.createProjectClaude', async () => {
            await steeringManager.createClaudeMd('project');
        })
    );

    // Spec delete command
    context.subscriptions.push(
        vscode.commands.registerCommand('kfc.spec.delete', async (item: any) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                // Get specs path from configuration
                const configManager = ConfigManager.getInstance();
                const specsPath = configManager.getPath('specs');

                const specPath = vscode.Uri.file(
                    path.join(workspaceFolder.uri.fsPath, specsPath, item.label)
                );
                await vscode.workspace.fs.delete(specPath, { recursive: true });
            }
        })
    );

    // Claude Code integration commands
    context.subscriptions.push(

        vscode.commands.registerCommand('kfc.claude.implementTask', async (taskText: string) => {
            // Get all steering documents for context
            const steeringContext = await steeringManager.loadSteeringContext();

            const terminal = vscode.window.createTerminal('Claude Code');
            if (steeringContext) {
                // Create a temporary file with steering context
                const tempFile = `/tmp/steering-context-${Date.now()}.md`;
                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(tempFile),
                    Buffer.from(steeringContext)
                );
                terminal.sendText(`claude -p "Implement this task following the guidelines in ${tempFile}: ${taskText}"`);
            } else {
                terminal.sendText(`claude -p "Implement this task: ${taskText}"`);
            }
            terminal.show();
        })
    );

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
        })
    );
}

function setupFileWatchers(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider
) {
    // Watch for changes in .claude directory with debouncing
    const kiroWatcher = vscode.workspace.createFileSystemWatcher('**/.claude/**/*');

    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = (event: string, uri: vscode.Uri) => {
        outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath}`);

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            outputChannel.appendLine('[FileWatcher] Executing refresh after debounce');
            specExplorer.refresh();
            steeringExplorer.refresh();
            hooksExplorer.refresh();
            mcpExplorer.refresh();
        }, 1000); // Increase debounce time to 1 second
    };

    kiroWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
    kiroWatcher.onDidDelete((uri) => debouncedRefresh('Delete', uri));
    kiroWatcher.onDidChange((uri) => debouncedRefresh('Change', uri));

    context.subscriptions.push(kiroWatcher);

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

export function deactivate() {
    // Cleanup
}