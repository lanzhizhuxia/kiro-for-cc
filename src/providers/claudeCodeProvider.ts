import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSpecAgentSystemPrompt, SPEC_REFINE_PROMPTS } from '../prompts/specPrompts';
import { STEERING_SYSTEM_PROMPT, STEERING_REFINE_PROMPT, STEERING_INITIAL_PROMPTS } from '../prompts/steeringPrompts';
import { ConfigManager } from '../utils/configManager';
import { VSC_CONFIG_NAMESPACE } from '../constants';

export class ClaudeCodeProvider {
    private context: vscode.ExtensionContext;
    private claudePath: string = 'claude';
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel) {
        this.context = context;
        // Use provided output channel or create a new one
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Kiro for Claude Code - Provider');
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
        this.loadConfiguration();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(VSC_CONFIG_NAMESPACE)) {
                this.loadConfiguration();
            }
        });
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
        this.claudePath = config.get<string>('claudePath') || 'claude';
    }

    /**
     * Create a temporary file with content
     */
    private async createTempFile(content: string, prefix: string = 'prompt'): Promise<string> {
        const tempDir = this.context.globalStorageUri.fsPath;
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

        const tempFile = path.join(tempDir, `${prefix}-${Date.now()}.md`);
        await fs.promises.writeFile(tempFile, content);

        return tempFile;
    }

    /**
     * Convert Windows path to WSL path if needed
     * Example: C:\Users\username\file.txt -> /mnt/c/Users/username/file.txt
     */
    private convertToWSLPath(filePath: string): string {
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
     * Send a message to Claude Code using terminal
     */
    private async sendToClaudeCode(prompt: string, options?: {
        systemPrompt?: string;
        terminalName?: string;
    }): Promise<void> {
        // 添加日志到 Output Channel
        this.outputChannel.appendLine('\n=== sendToClaudeCode CALLED ===');
        this.outputChannel.appendLine(`Prompt length: ${prompt.length}`);
        this.outputChannel.appendLine(`Has system prompt: ${!!options?.systemPrompt}`);
        this.outputChannel.appendLine(`Terminal name: ${options?.terminalName || 'default'}`);

        try {
            this.outputChannel.appendLine('Creating prompt file...');

            // Read user's CLAUDE.md if it exists
            let fullPrompt = prompt;
            if (options?.systemPrompt) {
                let claudeMdContent = '';
                try {
                    const claudeMdPath = path.join(process.env.HOME || '', '.claude', 'CLAUDE.md');
                    claudeMdContent = await fs.promises.readFile(claudeMdPath, 'utf-8');
                    this.outputChannel.appendLine('Found user CLAUDE.md, will append our system prompt');
                } catch (e) {
                    // No CLAUDE.md file, that's okay
                    this.outputChannel.appendLine('No user CLAUDE.md found');
                }

                // Combine CLAUDE.md content with our system prompt
                fullPrompt = `<system>
${claudeMdContent}

## Additional Instructions for this Task

${options.systemPrompt}
</system>

${prompt}`;
                this.outputChannel.appendLine('Combined user CLAUDE.md with spec system prompt');
            }

            // Create temp file with the combined prompt
            const promptFile = await this.createTempFile(fullPrompt, 'prompt');
            this.outputChannel.appendLine(`Created prompt file: ${promptFile}`);

            // Convert to WSL path if running on Windows with WSL terminal
            const terminalPath = this.convertToWSLPath(promptFile);
            if (terminalPath !== promptFile) {
                this.outputChannel.appendLine(`Converted Windows path to WSL format: ${terminalPath}`);
            }

            // Build the command - simple now, just claude with input redirection
            let command = `${this.claudePath} < "${terminalPath}"`;

            this.outputChannel.appendLine(`Final command: ${command}`);

            // Use the class output channel
            this.outputChannel.appendLine(`\n=== EXECUTING COMMAND ===`);
            this.outputChannel.appendLine(`Command: ${command}`);
            this.outputChannel.appendLine(`Prompt file: ${promptFile}`);

            // Create a new terminal in the editor area (right side)
            const terminalName = options?.terminalName || 'Claude Code - Kiro';
            const terminal = vscode.window.createTerminal({
                name: terminalName,
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
                this.outputChannel.appendLine(`Sending command to terminal: ${command}`);
                terminal.sendText(command, true); // true = add newline to execute
                this.outputChannel.appendLine('Command sent to terminal!');
            }, delay); // Configurable delay to allow venv activation

            // Clean up temp files after a delay
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(promptFile);
                    this.outputChannel.appendLine(`Cleaned up prompt file: ${promptFile}`);
                } catch (e) {
                    // Ignore cleanup errors
                    this.outputChannel.appendLine(`Failed to cleanup temp file: ${e}`);
                }
            }, 30000); // 30 seconds delay to give Claude time to read the file

        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to send to Claude Code: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Claude Code: ${error}`);
        }
    }


    /**
     * Generate spec document content
     */
    async generateSpecContent(
        type: 'requirements' | 'design' | 'tasks',
        context: any
    ): Promise<string> {
        this.outputChannel.appendLine(`\n=== generateSpecContent called for ${type} ===`);

        let prompt = '';

        switch (type) {
            case 'requirements':
                prompt = `User Request: Create a requirements document for a new feature.

Feature Description: ${context.description}

Workspace path: ${context.workspacePath}
Spec base path: ${context.specBasePath}

Please:
1. Choose an appropriate kebab-case name for this spec based on the description
2. Create the directory structure: ${context.specBasePath}/{your-chosen-name}/
3. Create the requirements.md file in that directory
4. Write the requirements document following the spec workflow in EARS format

You have full control over the naming and file creation.`;
                break;

            case 'design':
                prompt = `User Request: Create a design document based on the approved requirements.

Current Requirements:
${context.requirements}

Please follow the spec workflow and create the design document with all required sections.`;
                break;

            case 'tasks':
                prompt = `User Request: Create an implementation task list based on the approved design.

Current Design:
${context.design}

Requirements for reference:
${context.requirements || 'Not provided'}

Please follow the spec workflow and create the tasks document as specified.`;
                break;
        }

        // If refreshing, add current content
        if (context.currentContent) {
            prompt += `\n\nCurrent Document Content to Refresh:\n${context.currentContent}\n\n${SPEC_REFINE_PROMPTS[type]}`;
        }

        // Get specs path from config
        const specsPath = this.configManager.getPath('specs');

        // Send to Claude Code with system prompt
        await this.sendToClaudeCode(prompt, {
            systemPrompt: getSpecAgentSystemPrompt(specsPath),
            terminalName: `Claude Code - Spec ${type.charAt(0).toUpperCase() + type.slice(1)}`
        });

        // Return empty string - Claude will write the file directly
        return '';
    }

    /**
     * Process steering document
     */
    async processSteeringDocument(
        content: string,
        action: 'create' | 'refine' | 'delete',
        context?: any
    ): Promise<string> {
        let prompt = '';
        let systemPrompt = context?.systemPrompt || STEERING_SYSTEM_PROMPT;
        let terminalName = context?.terminalName || 'Claude Code - Steering';

        if (action === 'create') {
            const type = context?.type || 'custom';

            // Special handling for 'initial' type (generating multiple docs)
            if (type === 'initial') {
                prompt = content;
            } else {
                const basePrompt = STEERING_INITIAL_PROMPTS[type as keyof typeof STEERING_INITIAL_PROMPTS] || STEERING_INITIAL_PROMPTS.custom;
                prompt = `${basePrompt}

Project Context: ${content}

Create a comprehensive steering document that will help guide AI assistants working on this codebase.`;
            }
        } else if (action === 'refine') {
            systemPrompt = STEERING_REFINE_PROMPT;
            prompt = `Current Steering Document:
${content}

Please refine this steering document to make it more effective.`;
        } else if (action === 'delete') {
            // For delete action, the content is actually the prompt
            prompt = content;
            systemPrompt = `You are helping to maintain the CLAUDE.md file by updating references to steering documents.`;
        }

        // Send to Claude Code
        await this.sendToClaudeCode(prompt, {
            systemPrompt,
            terminalName
        });

        // Return empty string - Claude will write the file directly
        return '';
    }

    /**
     * Load steering context from all steering documents
     */
    async loadSteeringContext(): Promise<string | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        // Get steering path from configuration
        const steeringPath = this.configManager.getAbsolutePath('steering');

        try {
            const files = await fs.promises.readdir(steeringPath);
            const mdFiles = files.filter(f => f.endsWith('.md'));

            if (mdFiles.length === 0) {
                return null;
            }

            const steeringDocs = [];
            for (const file of mdFiles) {
                const content = await fs.promises.readFile(path.join(steeringPath, file), 'utf8');
                const name = path.basename(file, '.md');
                steeringDocs.push({
                    id: name,
                    content,
                    inclusion: 'always' // For now, always include all steering docs
                });
            }

            // Format using the Kiro format
            const { formatSteeringContext } = await import('../prompts/steeringPrompts');
            return formatSteeringContext(steeringDocs);
        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to load steering context: ${error}`);
            return null;
        }
    }

    /**
     * Open Claude Code terminal with context
     */
    async openClaudeWithContext(context?: string): Promise<void> {
        if (context) {
            await this.sendToClaudeCode(context, {
                terminalName: 'Claude Code'
            });
        } else {
            // Just open a terminal with claude
            const terminal = vscode.window.createTerminal({
                name: 'Claude Code',
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });
            terminal.show();
            terminal.sendText(this.claudePath);
        }
    }

    /**
     * Execute a specific task with Claude
     */
    async executeTask(taskDescription: string, specContext?: any): Promise<void> {
        let prompt = `Execute the following task:

${taskDescription}`;

        // Add spec context if available
        if (specContext) {
            if (specContext.requirements) {
                prompt += `\n\nRequirements Document:\n${specContext.requirements}`;
            }
            if (specContext.design) {
                prompt += `\n\nDesign Document:\n${specContext.design}`;
            }
            if (specContext.tasks) {
                prompt += `\n\nTasks Document:\n${specContext.tasks}`;
            }
        }

        // Add steering context as system prompt
        const steeringContext = await this.loadSteeringContext();

        await this.sendToClaudeCode(prompt, {
            systemPrompt: steeringContext || undefined,
            terminalName: 'Claude Code - Task Execution'
        });
    }
}