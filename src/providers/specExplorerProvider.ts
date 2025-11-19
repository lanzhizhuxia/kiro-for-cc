import * as vscode from 'vscode';
import * as path from 'path';
import { SpecManager } from '../features/spec/specManager';
import { ProgressTracker, SamProgress } from '../features/sam/progressTracker';

export class SpecExplorerProvider implements vscode.TreeDataProvider<SpecItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecItem | undefined | null | void> = new vscode.EventEmitter<SpecItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private specManager!: SpecManager;
    private progressTracker: ProgressTracker;
    private outputChannel: vscode.OutputChannel;
    private isLoading: boolean = false;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        // We'll set the spec manager later from extension.ts
        this.outputChannel = outputChannel;

        // Initialize ProgressTracker
        this.progressTracker = new ProgressTracker(outputChannel);

        // Listen for progress changes and refresh the tree
        this.progressTracker.onProgressChanged(() => {
            this.outputChannel.appendLine('[SpecExplorer] Progress changed, refreshing tree');
            this.refresh();
        });

        // Start watching if workspace is available
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            this.progressTracker.startWatching(workspaceRoot);
        }
    }

    setSpecManager(specManager: SpecManager) {
        this.specManager = specManager;
    }

    getProgressTracker(): ProgressTracker {
        return this.progressTracker;
    }
    
    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire(); // Show loading state immediately
        
        // Simulate async loading
        setTimeout(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire(); // Show actual content
        }, 100);
    }
    
    getTreeItem(element: SpecItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: SpecItem): Promise<SpecItem[]> {

        if (!vscode.workspace.workspaceFolders || !this.specManager) {
            return [];
        }

        if (!element) {
            // Root level - show loading state or specs
            const items: SpecItem[] = [];

            if (this.isLoading) {
                // Show loading state
                items.push(new SpecItem(
                    'Loading specs...',
                    vscode.TreeItemCollapsibleState.None,
                    'spec-loading',
                    this.context
                ));
                return items;
            }

            // Show all specs with progress info
            const specs = await this.specManager.getSpecList();
            const specItems = specs.map(specName => {
                // Check if this spec has progress
                const progress = this.progressTracker.getProgress(specName);

                return new SpecItem(
                    specName,
                    vscode.TreeItemCollapsibleState.Expanded,
                    progress ? 'spec-with-progress' : 'spec',
                    this.context,
                    specName,
                    undefined,
                    undefined,
                    undefined,
                    progress
                );
            });

            return specItems;
        } else if (element.contextValue === 'spec' || element.contextValue === 'spec-with-progress') {
            // Show spec documents
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return [];
            }

            const specsPath = await this.specManager.getSpecBasePath();
            const specPath = path.join(workspaceFolder.uri.fsPath, specsPath, element.specName!);
            const codexAvailable = this.isCodexAvailable();

            return [
                new SpecItem(
                    'requirements',
                    vscode.TreeItemCollapsibleState.None,
                    codexAvailable ? 'spec-document-requirements-with-codex' : 'spec-document',
                    this.context,
                    element.specName!,
                    'requirements',
                    {
                        command: 'kfc.spec.navigate.requirements',
                        title: 'Open Requirements',
                        arguments: [element.specName]
                    },
                    `${specPath}/requirements.md`
                ),
                new SpecItem(
                    'design',
                    vscode.TreeItemCollapsibleState.None,
                    codexAvailable ? 'spec-document-design-with-codex' : 'spec-document',
                    this.context,
                    element.specName!,
                    'design',
                    {
                        command: 'kfc.spec.navigate.design',
                        title: 'Open Design',
                        arguments: [element.specName]
                    },
                    `${specPath}/design.md`
                ),
                new SpecItem(
                    'tasks',
                    vscode.TreeItemCollapsibleState.None,
                    'spec-document',
                    this.context,
                    element.specName!,
                    'tasks',
                    {
                        command: 'kfc.spec.navigate.tasks',
                        title: 'Open Tasks',
                        arguments: [element.specName]
                    },
                    `${specPath}/tasks.md`
                )
            ];
        }

        return [];
    }

    private isCodexAvailable(): boolean {
        return this.specManager?.isCodexAvailable() || false;
    }
}

class SpecItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        private readonly context: vscode.ExtensionContext,
        public readonly specName?: string,
        public readonly documentType?: string,
        public readonly command?: vscode.Command,
        public readonly filePath?: string,  // Changed from private to public
        public readonly progress?: SamProgress
    ) {
        super(label, collapsibleState);

        // Set resourceUri for VSCode commands that expect Uri
        if (filePath) {
            this.resourceUri = vscode.Uri.file(filePath);
        }

        if (contextValue === 'spec-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading specs...';
        } else if (contextValue === 'spec-with-progress' && progress) {
            // Spec with progress - show status icon
            this.iconPath = this.getProgressIcon(progress);
            this.tooltip = this.getProgressTooltip(progress);
            this.description = this.getProgressDescription(progress);
        } else if (contextValue === 'spec') {
            this.iconPath = new vscode.ThemeIcon('package');
            this.tooltip = `Spec: ${label}`;
        } else if (contextValue === 'spec-document') {
            // Different icons for different document types
            if (documentType === 'requirements') {
                this.iconPath = new vscode.ThemeIcon('chip');
                this.tooltip = `Requirements: ${specName}/${label}`;
            } else if (documentType === 'design') {
                this.iconPath = new vscode.ThemeIcon('layers');
                this.tooltip = `Design: ${specName}/${label}`;
            } else if (documentType === 'tasks') {
                this.iconPath = new vscode.ThemeIcon('tasklist');
                this.tooltip = `Tasks: ${specName}/${label}`;
            } else {
                this.iconPath = new vscode.ThemeIcon('file');
                this.tooltip = `${documentType}: ${specName}/${label}`;
            }
            
            // Set description to file path
            if (filePath) {
                this.description = filePath;
            }
            
            // Add context menu items
            if (documentType === 'requirements' || documentType === 'design' || documentType === 'tasks') {
                this.contextValue = `spec-document-${documentType}`;
            }
        }
    }

    private getProgressIcon(progress: SamProgress): vscode.ThemeIcon {
        // Show warning icon if there are blockers
        if (progress.blockers.length > 0) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
        }

        // Show check icon if completed
        if (progress.currentPhase === 'completed') {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        }

        // Show spinning sync icon for in-progress
        return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('progressBar.background'));
    }

    private getProgressDescription(progress: SamProgress): string {
        const phaseEmoji = this.getPhaseEmoji(progress.currentPhase);
        return `${phaseEmoji} ${progress.currentPhase}`;
    }

    private getProgressTooltip(progress: SamProgress): string {
        const lines: string[] = [
            `Spec: ${progress.featureName}`,
            progress.reqId ? `REQ: ${progress.reqId}` : '',
            `Phase: ${progress.currentPhase}`,
            ''
        ];

        if (progress.completedPhases.length > 0) {
            lines.push('Completed:');
            progress.completedPhases.forEach(phase => {
                lines.push(`  ✓ ${phase}`);
            });
            lines.push('');
        }

        if (progress.inProgressTasks.length > 0) {
            lines.push('In Progress:');
            progress.inProgressTasks.slice(0, 3).forEach(task => {
                lines.push(`  ⚙ ${task}`);
            });
            if (progress.inProgressTasks.length > 3) {
                lines.push(`  ... and ${progress.inProgressTasks.length - 3} more`);
            }
            lines.push('');
        }

        if (progress.blockers.length > 0) {
            lines.push('⚠️ Blockers:');
            progress.blockers.forEach(blocker => {
                lines.push(`  ! ${blocker}`);
            });
            lines.push('');
        }

        if (progress.decisions.length > 0) {
            lines.push('Decisions:');
            progress.decisions.slice(0, 2).forEach(decision => {
                lines.push(`  • ${decision}`);
            });
            if (progress.decisions.length > 2) {
                lines.push(`  ... and ${progress.decisions.length - 2} more`);
            }
        }

        return lines.filter(line => line !== '').join('\n');
    }

    private getPhaseEmoji(phase: string): string {
        const emojiMap: Record<string, string> = {
            'requirements': '📝',
            'design': '🎨',
            'tasks': '📋',
            'implementation': '⚙️',
            'completed': '✅'
        };
        return emojiMap[phase] || '🚧';
    }
}