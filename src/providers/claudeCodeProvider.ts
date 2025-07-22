import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { ConfigManager } from '../utils/configManager';
import { VSC_CONFIG_NAMESPACE } from '../constants';
import { PermissionWebviewProvider } from '../webview/permissionWebview';
import { NotificationUtils } from '../utils/notificationUtils';

export class ClaudeCodeProvider {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;
    private static PERMISSION_KEY = 'kiroForClaudeCode.hasRunInitialPermission';

    constructor(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel) {
        this.context = context;
        // Use provided output channel or create a new one
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Kiro for Claude Code - Provider');
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(VSC_CONFIG_NAMESPACE)) {
                this.configManager.loadSettings();
            }
        });
    }

    /**
     * Create a temporary file with content
     */
    private async createTempFile(content: string, prefix: string = 'prompt'): Promise<string> {
        const tempDir = this.context.globalStorageUri.fsPath;
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

        const tempFile = path.join(tempDir, `${prefix}-${Date.now()}.md`);
        await fs.promises.writeFile(tempFile, content);

        return this.convertPathIfWSL(tempFile);
    }


    /**
     * Initialize Claude Code permissions on first run
     */
    static async initializePermissions(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): Promise<void> {
        // Check if permission has already been granted globally
        const hasPermission = context.globalState.get<boolean>(ClaudeCodeProvider.PERMISSION_KEY, false);

        if (hasPermission) {
            outputChannel?.appendLine('[ClaudeCodeProvider] Permission already granted, skipping initialization');
            return;
        }

        outputChannel?.appendLine('[ClaudeCodeProvider] First time setup, showing permission prompt');

        // Not trusted yet, need to show permission setup
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Create a terminal for initial permission
        const initTerminal = vscode.window.createTerminal({
            name: 'Claude Code - Permission Setup',
            cwd: workspaceFolder,
            location: {
                viewColumn: vscode.ViewColumn.Two
            }
        });

        initTerminal.show();

        // Run simple claude command to trigger permission prompt
        const initCommand = `claude --permission-mode bypassPermissions "Setting up Claude Code permissions..."`;
        initTerminal.sendText(initCommand, true);

        // Show the permission webview
        const userAccepted = await PermissionWebviewProvider.createOrShow(context);

        // Handle user response
        if (userAccepted) {
            outputChannel?.appendLine('[ClaudeCodeProvider] User confirmed permission granted');
            await context.globalState.update(ClaudeCodeProvider.PERMISSION_KEY, true);

            // Show success notification
            NotificationUtils.showAutoDismissNotification('✅ Claude Code permissions setup completed successfully!');

            // Close the terminal
            initTerminal.dispose();
        } else {
            outputChannel?.appendLine('[ClaudeCodeProvider] User cancelled permission setup');
            initTerminal.dispose();

            // Show warning
            vscode.window.showWarningMessage(
                'Claude Code permissions not granted. Some features may not work properly.',
                'Try Again'
            ).then(selection => {
                if (selection === 'Try Again') {
                    // Restart the permission process
                    ClaudeCodeProvider.initializePermissions(context, outputChannel);
                }
            });

        }
    }

    /**
     * Convert Windows path to WSL path if needed
     * Example: C:\Users\username\file.txt -> /mnt/c/Users/username/file.txt
     */
    private convertPathIfWSL(filePath: string): string {
        // Check if running on Windows and path is a Windows path
        if (process.platform === 'win32' && filePath.match(/^[A-Za-z]:\\/)) {
            // Replace backslashes with forward slashes
            let wslPath = filePath.replace(/\\/g, '/');
            // Convert drive letter to WSL format (C: -> /mnt/c)
            wslPath = wslPath.replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`);
            return wslPath;
        }

        // Return original path if not on Windows or not a Windows path
        return filePath;
    }

    /**
     * Invokes Claude Code in a new terminal on the right side (split view) with the given prompt
     * Returns the terminal instance for potential renaming
     */
    async invokeClaudeSplitView(prompt: string, title: string = 'Kiro for Claude Code'): Promise<vscode.Terminal> {
        try {
            // Create temp file with the prompt
            const promptFilePath = await this.createTempFile(prompt, 'prompt');

            // Build the command - simple now, just claude with input redirection
            let command = `claude --permission-mode bypassPermissions < "${promptFilePath}"`;

            // Create a new terminal in the editor area (right side)
            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two  // Open in the second column (right side)
                }
            });

            // Show the terminal
            terminal.show();

            // Send the command directly without echo messages
            const delay = this.configManager.getTerminalDelay();
            setTimeout(() => {
                terminal.sendText(command, true); // true = add newline to execute
            }, delay); // Configurable delay to allow venv activation

            // Clean up temp files after a delay
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(promptFilePath);
                    this.outputChannel.appendLine(`Cleaned up prompt file: ${promptFilePath}`);
                } catch (e) {
                    // Ignore cleanup errors
                    this.outputChannel.appendLine(`Failed to cleanup temp file: ${e}`);
                }
            }, 30000); // 30 seconds delay to give Claude time to read the file

            // Return the terminal for potential renaming
            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to send to Claude Code: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Claude Code: ${error}`);
            throw error;
        }
    }

    /**
     * Rename a terminal
     */
    async renameTerminal(terminal: vscode.Terminal, newName: string): Promise<void> {
        // Make sure the terminal is active
        terminal.show();

        // Small delay to ensure terminal is focused
        await new Promise(resolve => setTimeout(resolve, 100));
        this.outputChannel.appendLine(`[ClaudeCodeProvider] ${terminal.name} Terminal renamed to: ${newName}`);

        // Execute the rename command
        await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', {
            name: newName
        });
    }

    /**
     * Execute Claude command with specific tools in background
     * Returns a promise that resolves when the command completes
     */
    async invokeClaudeHeadless(
        prompt: string
    ): Promise<{ exitCode: number | undefined; output?: string }> {

        this.outputChannel.appendLine(`[ClaudeCodeProvider] Invoking Claude Code in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;

        // Create temp file with the prompt
        const promptFilePath = await this.createTempFile(prompt, 'background-prompt');

        // Build command using file redirection
        let commandLine = `claude --permission-mode bypassPermissions < "${promptFilePath}"`;

        // Create hidden terminal for background execution
        const terminal = vscode.window.createTerminal({
            name: 'Claude Code Background',
            cwd,
            hideFromUser: true
        });

        return new Promise((resolve) => {
            let shellIntegrationChecks = 0;
            // Wait for shell integration to be available
            const checkShellIntegration = setInterval(() => {
                shellIntegrationChecks++;

                if (terminal.shellIntegration) {
                    clearInterval(checkShellIntegration);

                    // Execute command with shell integration
                    const execution = terminal.shellIntegration.executeCommand(commandLine);

                    // Listen for command completion
                    const disposable = vscode.window.onDidEndTerminalShellExecution(event => {
                        if (event.terminal === terminal && event.execution === execution) {
                            disposable.dispose();

                            // Only log errors
                            if (event.exitCode !== 0) {
                                this.outputChannel.appendLine(`[Claude] Command failed with exit code: ${event.exitCode}`);
                                this.outputChannel.appendLine(`[Claude] Command was: ${commandLine}`);
                            }

                            resolve({
                                exitCode: event.exitCode,
                                output: undefined
                            });

                            // Clean up terminal and temp file after a short delay
                            setTimeout(async () => {
                                terminal.dispose();
                                try {
                                    await fs.promises.unlink(promptFilePath);
                                    this.outputChannel.appendLine(`[Claude] Cleaned up temp file: ${promptFilePath}`);
                                } catch (e) {
                                    // Ignore cleanup errors
                                    this.outputChannel.appendLine(`[Claude] Failed to cleanup temp file: ${e}`);
                                }
                            }, 1000);
                        }
                    });
                } else if (shellIntegrationChecks > 20) { // After 2 seconds
                    // Fallback: execute without shell integration
                    clearInterval(checkShellIntegration);
                    this.outputChannel.appendLine(`[Claude] Shell integration not available, using fallback mode`);
                    terminal.sendText(commandLine);

                    // Resolve after a reasonable delay since we can't track completion
                    setTimeout(async () => {
                        resolve({ exitCode: undefined });
                        terminal.dispose();
                        // Clean up temp file
                        try {
                            await fs.promises.unlink(promptFilePath);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }, 5000);
                }
            }, 100);
        });
    }
}