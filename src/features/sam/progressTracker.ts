import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SamProgress {
  featureName: string;
  reqId?: string;
  currentPhase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';
  completedPhases: string[];
  pendingTasks: string[];
  inProgressTasks: string[];
  blockers: string[];
  decisions: string[];
  lastUpdate: Date;
}

/**
 * ProgressTracker - Monitors and parses PROGRESS.md files
 */
export class ProgressTracker {
  private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private progressCache: Map<string, SamProgress> = new Map();
  private onProgressChangedEmitter = new vscode.EventEmitter<SamProgress>();

  public readonly onProgressChanged = this.onProgressChangedEmitter.event;

  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Start watching .claude/specs directory for PROGRESS.md files
   */
  public startWatching(workspaceRoot: string): void {
    const claudeSpecsDir = path.join(workspaceRoot, '.claude/specs');

    if (!fs.existsSync(claudeSpecsDir)) {
      fs.mkdirSync(claudeSpecsDir, { recursive: true });
      this.outputChannel.appendLine(`[ProgressTracker] Created directory: ${claudeSpecsDir}`);
    }

    // Watch for PROGRESS.md files in all subdirectories
    const pattern = new vscode.RelativePattern(claudeSpecsDir, '**/PROGRESS.md');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Handle file creation
    watcher.onDidCreate(uri => {
      this.outputChannel.appendLine(`[ProgressTracker] PROGRESS.md created: ${uri.fsPath}`);
      this.handleProgressChange(uri);
    });

    // Handle file modification
    watcher.onDidChange(uri => {
      this.outputChannel.appendLine(`[ProgressTracker] PROGRESS.md changed: ${uri.fsPath}`);
      this.handleProgressChange(uri);
    });

    // Handle file deletion
    watcher.onDidDelete(uri => {
      const featureName = this.extractFeatureName(uri);
      this.progressCache.delete(featureName);
      this.outputChannel.appendLine(`[ProgressTracker] Progress deleted: ${featureName}`);

      // Fire event with undefined to signal deletion
      this.onProgressChangedEmitter.fire({
        featureName,
        currentPhase: 'requirements',
        completedPhases: [],
        pendingTasks: [],
        inProgressTasks: [],
        blockers: [],
        decisions: [],
        lastUpdate: new Date()
      });
    });

    this.watchers.set(workspaceRoot, watcher);
    this.outputChannel.appendLine(`[ProgressTracker] Started watching: ${claudeSpecsDir}`);

    // Initial scan of existing PROGRESS.md files
    this.scanExistingProgress(claudeSpecsDir);
  }

  /**
   * Stop watching
   */
  public stopWatching(workspaceRoot: string): void {
    const watcher = this.watchers.get(workspaceRoot);
    if (watcher) {
      watcher.dispose();
      this.watchers.delete(workspaceRoot);
      this.outputChannel.appendLine(`[ProgressTracker] Stopped watching: ${workspaceRoot}`);
    }
  }

  /**
   * Get all features with progress
   */
  public getInProgressFeatures(): SamProgress[] {
    return Array.from(this.progressCache.values());
  }

  /**
   * Get progress for a specific feature
   */
  public getProgress(featureName: string): SamProgress | undefined {
    return this.progressCache.get(featureName);
  }

  /**
   * Handle PROGRESS.md file change
   */
  private async handleProgressChange(uri: vscode.Uri): Promise<void> {
    try {
      const content = fs.readFileSync(uri.fsPath, 'utf-8');
      const progress = this.parseProgress(uri, content);

      this.progressCache.set(progress.featureName, progress);
      this.outputChannel.appendLine(
        `[ProgressTracker] Updated: ${progress.featureName} - Phase: ${progress.currentPhase}`
      );

      // Fire event to update UI
      this.onProgressChangedEmitter.fire(progress);
    } catch (error) {
      this.outputChannel.appendLine(`[ProgressTracker] Failed to parse progress: ${error}`);
    }
  }

  /**
   * Parse PROGRESS.md content
   */
  private parseProgress(uri: vscode.Uri, content: string): SamProgress {
    const featureName = this.extractFeatureName(uri);

    const progress: SamProgress = {
      featureName,
      currentPhase: this.extractCurrentPhase(content),
      completedPhases: this.extractCompletedPhases(content),
      pendingTasks: this.extractPendingTasks(content),
      inProgressTasks: this.extractInProgressTasks(content),
      blockers: this.extractBlockers(content),
      decisions: this.extractDecisions(content),
      lastUpdate: new Date()
    };

    // Extract REQ ID
    const reqMatch = content.match(/REQ-\d+/);
    if (reqMatch) {
      progress.reqId = reqMatch[0];
    }

    return progress;
  }

  /**
   * Extract feature name from URI
   */
  private extractFeatureName(uri: vscode.Uri): string {
    // .claude/specs/{feature_name}/PROGRESS.md
    const parts = uri.fsPath.split(path.sep);
    const progressIndex = parts.lastIndexOf('PROGRESS.md');
    return parts[progressIndex - 1];
  }

  /**
   * Extract current phase
   */
  private extractCurrentPhase(content: string): SamProgress['currentPhase'] {
    // Look for patterns like "## 当前阶段: Phase X" or "## Current Phase: Phase X"
    const match = content.match(/##\s*(?:当前阶段|Current Phase)[:：]\s*(.+)/i);

    if (!match) return 'requirements';

    const phase = match[1].toLowerCase();
    if (phase.includes('requirement')) return 'requirements';
    if (phase.includes('design')) return 'design';
    if (phase.includes('task')) return 'tasks';
    if (phase.includes('implement')) return 'implementation';
    if (phase.includes('complete')) return 'completed';

    return 'requirements';
  }

  /**
   * Extract completed phases
   */
  private extractCompletedPhases(content: string): string[] {
    const completed: string[] = [];
    const lines = content.split('\n');

    let inCompletedSection = false;
    for (const line of lines) {
      // Detect section start
      if (line.match(/###\s*(?:✅|已完成|Completed)/i)) {
        inCompletedSection = true;
        continue;
      }
      // Detect section end (new section)
      if (line.match(/###\s*/)) {
        inCompletedSection = false;
      }
      // Extract checked items
      if (inCompletedSection && line.match(/- \[x\]/i)) {
        const task = line.replace(/- \[x\]\s*/i, '').trim();
        if (task) {
          completed.push(task);
        }
      }
    }

    return completed;
  }

  /**
   * Extract pending tasks
   */
  private extractPendingTasks(content: string): string[] {
    const tasks: string[] = [];
    const lines = content.split('\n');

    let inPendingSection = false;
    for (const line of lines) {
      if (line.match(/###\s*(?:📋|待处理|Pending)/i)) {
        inPendingSection = true;
        continue;
      }
      if (line.match(/###\s*/)) {
        inPendingSection = false;
      }
      if (inPendingSection && line.match(/- \[ \]/i)) {
        const task = line.replace(/- \[ \]\s*/i, '').trim();
        if (task) {
          tasks.push(task);
        }
      }
    }

    return tasks;
  }

  /**
   * Extract in-progress tasks
   */
  private extractInProgressTasks(content: string): string[] {
    const tasks: string[] = [];
    const lines = content.split('\n');

    let inProgressSection = false;
    for (const line of lines) {
      if (line.match(/###\s*(?:🚧|进行中|In Progress)/i)) {
        inProgressSection = true;
        continue;
      }
      if (line.match(/###\s*/)) {
        inProgressSection = false;
      }
      if (inProgressSection && line.match(/- \[ \]/i)) {
        const task = line.replace(/- \[ \]\s*/i, '').trim();
        if (task) {
          tasks.push(task);
        }
      }
    }

    return tasks;
  }

  /**
   * Extract blockers
   */
  private extractBlockers(content: string): string[] {
    const blockers: string[] = [];
    const lines = content.split('\n');

    let inBlockerSection = false;
    for (const line of lines) {
      if (line.match(/###\s*(?:⚠️|阻塞点|Blocker)/i)) {
        inBlockerSection = true;
        continue;
      }
      if (line.match(/###\s*/)) {
        inBlockerSection = false;
      }
      if (inBlockerSection && line.trim() && !line.match(/^#/)) {
        const blocker = line.replace(/^-\s*/, '').trim();
        // Skip "None" or "无"
        if (blocker && blocker !== '无' && blocker.toLowerCase() !== 'none') {
          blockers.push(blocker);
        }
      }
    }

    return blockers;
  }

  /**
   * Extract decisions
   */
  private extractDecisions(content: string): string[] {
    const decisions: string[] = [];
    const lines = content.split('\n');

    let inDecisionSection = false;
    for (const line of lines) {
      if (line.match(/###\s*(?:🔍|决策记录|Decision)/i)) {
        inDecisionSection = true;
        continue;
      }
      if (line.match(/###\s*/)) {
        inDecisionSection = false;
      }
      if (inDecisionSection && line.match(/^-\s*/)) {
        const decision = line.replace(/^-\s*/, '').trim();
        if (decision) {
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  /**
   * Scan existing PROGRESS.md files
   */
  private scanExistingProgress(claudeSpecsDir: string): void {
    if (!fs.existsSync(claudeSpecsDir)) return;

    try {
      const entries = fs.readdirSync(claudeSpecsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const progressPath = path.join(claudeSpecsDir, entry.name, 'PROGRESS.md');
          if (fs.existsSync(progressPath)) {
            this.handleProgressChange(vscode.Uri.file(progressPath));
          }
        }
      }

      this.outputChannel.appendLine(
        `[ProgressTracker] Scanned ${this.progressCache.size} existing progress files`
      );
    } catch (error) {
      this.outputChannel.appendLine(`[ProgressTracker] Error scanning existing progress: ${error}`);
    }
  }

  public dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.progressCache.clear();
    this.onProgressChangedEmitter.dispose();
    this.outputChannel.appendLine('[ProgressTracker] Disposed');
  }
}
