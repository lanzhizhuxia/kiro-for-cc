import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import { ConfigManager } from '../../utils/configManager';

export type SpecDocumentType = 'requirements' | 'design' | 'tasks';

export class SpecManager {
    private configManager: ConfigManager;

    constructor(
        private context: vscode.ExtensionContext,
        private claudeProvider: ClaudeCodeProvider,
        private outputChannel: vscode.OutputChannel
    ) {
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    public getSpecBasePath(): string {
        return this.configManager.getPath('specs');
    }

    async createNewSpec() {
        // Logging moved to outputChannel

        // 添加到 Output Channel
        this.outputChannel.appendLine('\n=== createNewSpec CALLED ===');
        this.outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);

        // Get feature description only
        const description = await vscode.window.showInputBox({
            title: '✨ Create New Spec ✨',
            prompt: 'Specs are a structured way to build features so you can plan before building',
            placeHolder: 'Enter your idea to generate requirement, design, and task specs...',
            ignoreFocusOut: false
        });

        if (!description) {
            this.outputChannel.appendLine('No description provided, exiting');
            return;
        }

        this.outputChannel.appendLine(`Description: ${description}`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Let Claude handle everything - directory creation, naming, and file creation
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Claude is creating your spec...',
            cancellable: true
        }, async (progress, token) => {
            await this.claudeProvider.generateSpecContent(
                'requirements',
                {
                    description,
                    workspacePath: workspaceFolder.uri.fsPath,
                    specBasePath: this.getSpecBasePath()
                }
            );
        });

        vscode.window.showInformationMessage(`Claude is creating your spec. Check the terminal for progress.`);
    }

    async refreshSpec(uri: vscode.Uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        const type = this.getDocumentType(uri.fsPath);

        if (!type) {
            vscode.window.showErrorMessage('Not a valid spec document');
            return;
        }

        // Get the spec context
        const specPath = path.dirname(uri.fsPath);
        const context: any = {};

        if (type === 'design') {
            // Read requirements
            const reqPath = path.join(specPath, 'requirements.md');
            try {
                const reqDoc = await vscode.workspace.openTextDocument(reqPath);
                context.requirements = reqDoc.getText();
            } catch (error) {
                vscode.window.showErrorMessage('Requirements document not found');
                return;
            }
        } else if (type === 'tasks') {
            // Read design
            const designPath = path.join(specPath, 'design.md');
            try {
                const designDoc = await vscode.workspace.openTextDocument(designPath);
                context.design = designDoc.getText();
            } catch (error) {
                vscode.window.showErrorMessage('Design document not found');
                return;
            }
        }

        // Generate new content with Claude
        const newContent = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Claude is refreshing ${type}...`,
            cancellable: true
        }, async (progress, token) => {
            // Add current content to context for refinement
            context.currentContent = document.getText();
            return await this.claudeProvider.generateSpecContent(type, context);
        });

        if (newContent) {
            // Replace document content
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(uri, fullRange, newContent);
            await vscode.workspace.applyEdit(edit);
        }
    }

    async navigateToDocument(specName: string, type: SpecDocumentType) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const docPath = path.join(
            workspaceFolder.uri.fsPath,
            this.getSpecBasePath(),
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

    private getDocumentType(filePath: string): SpecDocumentType | null {
        const basename = path.basename(filePath, '.md');
        if (['requirements', 'design', 'tasks'].includes(basename)) {
            return basename as SpecDocumentType;
        }
        return null;
    }

    async getSpecList(): Promise<string[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const specsPath = path.join(workspaceFolder.uri.fsPath, this.getSpecBasePath());

        // Check if directory exists first before creating
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(specsPath));
        } catch {
            // Directory doesn't exist, create it
            try {
                this.outputChannel.appendLine('[SpecManager] Creating .claude/specs directory');
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(specsPath)));
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(specsPath));
            } catch {
                // Ignore errors
            }
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsPath));
            return entries
                .filter(([name, type]) => type === vscode.FileType.Directory)
                .map(([name]) => name);
        } catch (error) {
            // Directory doesn't exist yet
            return [];
        }
    }
}