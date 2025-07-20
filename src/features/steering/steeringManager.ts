import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import { STEERING_SYSTEM_PROMPT, STEERING_REFINE_PROMPT, STEERING_INITIAL_PROMPTS, formatSteeringContext } from '../../prompts/steeringPrompts';
import { ConfigManager } from '../../utils/configManager';

export class SteeringManager {
    private configManager: ConfigManager;

    constructor(
        private context: vscode.ExtensionContext,
        private claudeProvider: ClaudeCodeProvider,
        private outputChannel: vscode.OutputChannel
    ) {
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    public getSteeringBasePath(): string {
        return this.configManager.getPath('steering');
    }

    async createSteeringDocument() {
        // Get project context and guidance needs
        const description = await vscode.window.showInputBox({
            title: '📝 Create Steering Document 📝',
            prompt: 'Describe what guidance you need for your project',
            placeHolder: 'e.g., API design patterns for REST endpoints, testing strategy for React components',
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

        // Create steering directory if it doesn't exist
        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());

        try {
            // Ensure directory exists
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(steeringPath));

            // Let Claude create the steering document
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Claude is creating steering document...',
                cancellable: true
            }, async (progress, token) => {
                // Let Claude decide the filename based on the description
                const prompt = `Based on this guidance need: "${description}"
                
Please:
1. Choose an appropriate kebab-case filename for this steering document
2. Create the document in the ${this.getSteeringBasePath()} directory
3. Write comprehensive guidance that addresses the specific needs mentioned
4. If a project CLAUDE.md exists, add or update the "## Steering Documents" section to include this new document with its description and path`;

                return await this.claudeProvider.processSteeringDocument(
                    prompt,
                    'create',
                    { description, steeringPath: this.getSteeringBasePath() }
                );
            });

            vscode.window.showInformationMessage(`Claude is creating a steering document based on your needs...`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create steering document: ${error}`);
        }
    }

    async refineSteeringDocument(uri: vscode.Uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        const currentContent = document.getText();
        const fileName = path.basename(uri.fsPath);

        // Let Claude refine the document directly
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Claude is refining steering document...',
            cancellable: true
        }, async (progress, token) => {
            // Create a prompt that tells Claude to refine and overwrite the file
            const prompt = `Please refine the steering document at ${uri.fsPath}

Current content:
${currentContent}

Refine this document to:
1. Make instructions more specific to this project's patterns
2. Add concrete examples from the actual codebase
3. Remove any generic programming advice
4. Organize rules in order of importance
5. Keep the refined content focused on actionable guidance

After refining, overwrite the original file with the improved content.`;

            await this.claudeProvider.processSteeringDocument(
                prompt,
                'refine',
                { 
                    filePath: uri.fsPath,
                    fileName: fileName
                }
            );
        });

        vscode.window.showInformationMessage('Claude is refining the steering document...');
    }

    async getSteeringDocuments(): Promise<Array<{ name: string, path: string }>> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(steeringPath));
            return entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name]) => ({
                    name: name.replace('.md', ''),
                    path: path.join(steeringPath, name)
                }));
        } catch (error) {
            // Directory doesn't exist yet
            return [];
        }
    }

    /**
     * Load all steering documents for context
     */
    async loadSteeringContext(): Promise<string> {
        const documents = await this.getSteeringDocuments();
        const contents: string[] = [];

        for (const doc of documents) {
            try {
                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(doc.path));
                contents.push(`## ${doc.name}\n\n${content.toString()}`);
            } catch (error) {
                this.outputChannel.appendLine(`ERROR: Failed to load steering document: ${doc.name} - ${error}`);
            }
        }

        return contents.join('\n\n---\n\n');
    }

    /**
     * Create CLAUDE.md file (global or project level)
     */
    async createClaudeMd(level: 'global' | 'project') {
        const isGlobal = level === 'global';
        
        if (!isGlobal) {
            // For project CLAUDE.md, run claude after venv activation completes
            const terminal = vscode.window.createTerminal({
                name: 'Claude Code - Init',
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });
            terminal.show();
            
            // Wait for Python extension to finish venv activation
            const delay = this.configManager.getTerminalDelay();
            setTimeout(() => {
                terminal.sendText('claude "/init"');
            }, delay);
            
            return;
        }

        // Global CLAUDE.md in ~/.claude/
        const claudeDir = path.join(process.env.HOME || '', '.claude');
        const filePath = path.join(claudeDir, 'CLAUDE.md');

        // Ensure directory exists
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(claudeDir));
        } catch (error) {
            // Directory might already exist
        }

        // Check if file already exists
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            const overwrite = await vscode.window.showWarningMessage(
                'Global CLAUDE.md already exists. Overwrite?',
                'Overwrite',
                'Cancel'
            );
            if (overwrite !== 'Overwrite') {
                return;
            }
        } catch {
            // File doesn't exist, continue
        }

        // Create empty file for global CLAUDE.md
        const initialContent = '';

        // Write the file
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(initialContent)
        );

        // Open the file
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage(
            'Created global CLAUDE.md file'
        );
    }


    /**
     * Generate initial steering documents by analyzing the project
     */
    async generateInitialSteeringDocs() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Check if steering documents already exist
        const existingDocs = await this.getSteeringDocuments();
        if (existingDocs.length > 0) {
            const existingNames = existingDocs.map(doc => doc.name).join(', ');
            const confirm = await vscode.window.showWarningMessage(
                `Steering documents already exist (${existingNames}). Init steering will analyze the project again but won't overwrite existing files.`,
                'Continue',
                'Cancel'
            );
            if (confirm !== 'Continue') {
                return;
            }
        }

        // Create steering directory if it doesn't exist
        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(steeringPath));

        // Generate steering documents using Claude
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing project and generating steering documents...',
            cancellable: false
        }, async (progress) => {
            const prompt = `Analyze this repository and create basic steering rules that would help guide an AI assistant.

Steering documents are markdown files that should be created in the '${this.getSteeringBasePath()}' directory.

Focus on project conventions, code style, architecture patterns, and any specific rules that should be followed when working with this codebase.

For the initial setup, please create the following files:
- product.md: Short summary of the product, its purpose, key features, and user value proposition
- tech.md: Build system used, tech stack, libraries, frameworks etc. Include a section for common commands (building, testing, running, etc.)
- structure.md: Project organization, folder structure, and key file locations

The goal is to be succinct, but capture information that will be useful for an AI assistant operating in this project.

IMPORTANT: 
1. Write each file directly to the filesystem at the appropriate path in ${this.getSteeringBasePath()}/
2. Check if any of these files already exist before creating them. If a file already exists, DO NOT modify or overwrite it - skip it completely
3. Only create files that don't exist
4. If a project CLAUDE.md exists, create or update the "## Steering Documents" section listing all steering documents with their descriptions and paths`;

            // Use a custom system prompt for generating initial docs
            const generateSystemPrompt = `You are analyzing a codebase to generate steering documents. Create clear, concise markdown files that will help guide AI assistants working on this project.

When creating the files:
1. Write each file directly to the filesystem
2. Use the exact paths: ${this.getSteeringBasePath()}/product.md, ${this.getSteeringBasePath()}/tech.md, ${this.getSteeringBasePath()}/structure.md
3. Focus on project-specific information, not generic advice
4. Be concise but comprehensive`;

            await this.claudeProvider.processSteeringDocument(
                prompt,
                'create',
                {
                    type: 'initial',
                    systemPrompt: generateSystemPrompt,
                    terminalName: 'Claude Code - Generate Steering Docs'
                }
            );

            vscode.window.showInformationMessage('Steering documents generation started. Check the terminal for progress.');
        });
    }
}