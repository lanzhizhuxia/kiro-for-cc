/**
 * Codex分析结果WebView (Task 30)
 *
 * 职责:
 * 1. 展示深度推理结果（问题分解、风险识别、方案对比、推荐决策）
 * 2. 实现可折叠树形结构展示
 * 3. 实现风险等级颜色标注（高/中/低）
 * 4. 实现用户交互（折叠/展开）
 *
 * 需求: 需求4.4
 */

import * as vscode from 'vscode';
import { ThinkingResult, ProblemNode, Risk, Solution, Decision, ExecutionMode } from '../types';
import { FeedbackCollector } from '../feedbackCollector';
import { AnalysisProgress } from '../deepThinkingEngine';

/**
 * 分析元数据
 */
export interface AnalysisMetadata {
  /** 会话ID */
  sessionId: string;

  /** 执行模式 */
  mode: ExecutionMode;

  /** 执行时间（毫秒） */
  executionTime: number;

  /** 时间戳 */
  timestamp: string;

  /** 场景 */
  scenario?: string;

  /** 任务类型 */
  taskType?: string;
}

/**
 * Codex分析结果WebView
 * 可视化展示深度推理结果
 */
export class CodexAnalysisWebview {
  /** WebView Panel */
  private panel: vscode.WebviewPanel | undefined;

  /** Disposables */
  private disposables: vscode.Disposable[] = [];

  /** 当前分析的元数据（用于反馈收集） */
  private currentMetadata?: AnalysisMetadata;

  /** 取消回调函数 */
  private cancelCallback?: () => void;

  /**
   * 构造函数
   *
   * @param context VSCode扩展上下文
   * @param outputChannel 输出通道
   * @param feedbackCollector 反馈收集器（可选）
   */
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
    private feedbackCollector?: FeedbackCollector
  ) {}

  /**
   * 显示分析结果
   *
   * @param thinkingResult 深度推理结果
   * @param metadata 分析元数据（可选）
   */
  async show(
    thinkingResult: ThinkingResult,
    metadata?: AnalysisMetadata
  ): Promise<void> {
    this.outputChannel.appendLine('[CodexAnalysisWebview] Showing analysis result');

    // 保存元数据用于反馈收集
    this.currentMetadata = metadata;

    // 创建或显示WebView panel
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'codexAnalysis',
        'Codex 深度分析',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // 监听panel关闭
      this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

      // 监听消息（用户交互）
      this.panel.webview.onDidReceiveMessage(
        message => this._handleMessage(message),
        null,
        this.disposables
      );
    }

    // 生成HTML内容
    this.panel.webview.html = this._generateHTML(thinkingResult, metadata);
  }

  /**
   * 显示进度
   *
   * 在分析过程中显示进度信息
   *
   * @param progress 进度信息
   * @param onCancel 取消回调函数
   */
  async showProgress(
    progress: AnalysisProgress,
    onCancel: () => void
  ): Promise<void> {
    this.outputChannel.appendLine(`[CodexAnalysisWebview] Showing progress: ${progress.phase} (${progress.percentage}%)`);

    // 保存取消回调
    this.cancelCallback = onCancel;

    // 创建panel（如果还不存在）
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'codexAnalysis',
        'Codex 深度分析',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // 监听panel关闭
      this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

      // 监听消息（用户交互）
      this.panel.webview.onDidReceiveMessage(
        message => this._handleMessage(message),
        null,
        this.disposables
      );

      // 生成初始HTML（仅显示进度）
      this.panel.webview.html = this._generateProgressOnlyHTML(progress);
    } else {
      // 更新进度
      this.panel.webview.postMessage({
        type: 'progress',
        progress
      });
    }
  }

  /**
   * 生成HTML内容
   *
   * @param thinking 深度推理结果
   * @param metadata 分析元数据（可选）
   * @returns HTML内容
   */
  private _generateHTML(
    thinking: ThinkingResult,
    metadata?: AnalysisMetadata
  ): string {
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>Codex 深度分析</title>
    <style nonce="${nonce}">
      ${this._getStyles()}
    </style>
</head>
<body>
    <div class="container">
      <header>
        <h1>🧠 Codex 深度分析结果</h1>
        ${metadata ? this._generateMetadataSection(metadata) : ''}
      </header>

      ${this._generateProgressSection()}

      <main>
        ${this._generateProblemDecompositionSection(thinking.problemDecomposition)}
        ${this._generateRiskSection(thinking.riskIdentification)}
        ${this._generateSolutionSection(thinking.solutionComparison)}
        ${this._generateDecisionSection(thinking.recommendedDecision)}
        ${metadata ? this._generateFeedbackSection(metadata.sessionId) : ''}
      </main>
    </div>

    <script nonce="${nonce}">
      ${this._getScript(metadata?.sessionId)}
    </script>
</body>
</html>`;
  }

  /**
   * 生成元数据部分
   */
  private _generateMetadataSection(metadata: AnalysisMetadata): string {
    return `
<div class="metadata">
  <div class="metadata-item">
    <span class="metadata-label">会话ID:</span>
    <span class="metadata-value">${this._escapeHtml(metadata.sessionId)}</span>
  </div>
  <div class="metadata-item">
    <span class="metadata-label">执行模式:</span>
    <span class="metadata-value mode-${metadata.mode}">${metadata.mode.toUpperCase()}</span>
  </div>
  <div class="metadata-item">
    <span class="metadata-label">执行时间:</span>
    <span class="metadata-value">${(metadata.executionTime / 1000).toFixed(2)}s</span>
  </div>
  <div class="metadata-item">
    <span class="metadata-label">分析时间:</span>
    <span class="metadata-value">${this._escapeHtml(metadata.timestamp)}</span>
  </div>
</div>`;
  }

  /**
   * 生成问题分解部分
   */
  private _generateProblemDecompositionSection(problems: ProblemNode[]): string {
    return `
<section class="analysis-section">
  <h2 class="section-title">
    <span class="toggle" onclick="toggleSection('problem-decomposition')">▼</span>
    📋 问题分解
  </h2>
  <div id="problem-decomposition" class="section-content">
    ${this._generateProblemTree(problems, 0)}
  </div>
</section>`;
  }

  /**
   * 生成问题树
   */
  private _generateProblemTree(problems: ProblemNode[], depth: number): string {
    if (!problems || problems.length === 0) {
      return '<p class="empty">暂无问题分解</p>';
    }

    return `
<ul class="problem-tree depth-${depth}">
  ${problems.map(problem => `
    <li class="problem-node">
      <div class="problem-header">
        ${problem.subProblems?.length ?
          `<span class="toggle" onclick="toggleNode('problem-${problem.id}')">▼</span>` :
          '<span class="spacer"></span>'
        }
        <span class="problem-description">${this._escapeHtml(problem.description)}</span>
        <span class="complexity-badge complexity-${this._getComplexityLevel(problem.complexity)}">
          复杂度: ${problem.complexity}/10
        </span>
      </div>
      ${problem.subProblems && problem.subProblems.length > 0 ? `
        <div id="problem-${problem.id}" class="sub-problems">
          ${this._generateProblemTree(problem.subProblems, depth + 1)}
        </div>
      ` : ''}
    </li>
  `).join('')}
</ul>`;
  }

  /**
   * 生成风险识别部分
   */
  private _generateRiskSection(risks: Risk[]): string {
    if (!risks || risks.length === 0) {
      return `
<section class="analysis-section">
  <h2 class="section-title">⚠️ 风险识别</h2>
  <p class="empty">未识别到明显风险</p>
</section>`;
    }

    // 按严重程度分组
    const highRisks = risks.filter(r => r.severity === 'high');
    const mediumRisks = risks.filter(r => r.severity === 'medium');
    const lowRisks = risks.filter(r => r.severity === 'low');

    return `
<section class="analysis-section">
  <h2 class="section-title">
    <span class="toggle" onclick="toggleSection('risk-identification')">▼</span>
    ⚠️ 风险识别
    <span class="risk-summary">
      ${highRisks.length > 0 ? `<span class="risk-count high">${highRisks.length} 高</span>` : ''}
      ${mediumRisks.length > 0 ? `<span class="risk-count medium">${mediumRisks.length} 中</span>` : ''}
      ${lowRisks.length > 0 ? `<span class="risk-count low">${lowRisks.length} 低</span>` : ''}
    </span>
  </h2>
  <div id="risk-identification" class="section-content">
    ${this._generateRiskList(highRisks, 'high')}
    ${this._generateRiskList(mediumRisks, 'medium')}
    ${this._generateRiskList(lowRisks, 'low')}
  </div>
</section>`;
  }

  /**
   * 生成风险列表
   */
  private _generateRiskList(risks: Risk[], severity: string): string {
    if (risks.length === 0) {
      return '';
    }

    const severityLabels: Record<string, string> = {
      high: '🔴 高风险',
      medium: '🟡 中风险',
      low: '🟢 低风险'
    };

    return `
<div class="risk-group">
  <h3 class="risk-group-title">${severityLabels[severity]}</h3>
  <div class="risk-list">
    ${risks.map(risk => `
      <div class="risk-card severity-${severity}">
        <div class="risk-header">
          <span class="risk-category">${this._getCategoryIcon(risk.category)} ${risk.category}</span>
          <span class="severity-badge ${severity}">${severity.toUpperCase()}</span>
        </div>
        <p class="risk-description">${this._escapeHtml(risk.description)}</p>
        <div class="risk-mitigation">
          <strong>缓解措施:</strong>
          <p>${this._escapeHtml(risk.mitigation)}</p>
        </div>
      </div>
    `).join('')}
  </div>
</div>`;
  }

  /**
   * 生成方案对比部分
   */
  private _generateSolutionSection(solutions: Solution[]): string {
    if (!solutions || solutions.length === 0) {
      return `
<section class="analysis-section">
  <h2 class="section-title">💡 方案对比</h2>
  <p class="empty">仅有一个方案或未进行方案对比</p>
</section>`;
    }

    return `
<section class="analysis-section">
  <h2 class="section-title">
    <span class="toggle" onclick="toggleSection('solution-comparison')">▼</span>
    💡 方案对比 (${solutions.length}个方案)
  </h2>
  <div id="solution-comparison" class="section-content">
    <div class="solutions-grid">
      ${solutions.map((solution, index) => `
        <div class="solution-card ${solution.score >= 8 ? 'recommended' : ''}">
          <div class="solution-header">
            <h3>方案 ${index + 1}: ${this._escapeHtml(solution.approach)}</h3>
            <div class="solution-scores">
              <span class="score-badge">评分: ${solution.score}/10</span>
              <span class="complexity-badge complexity-${this._getComplexityLevel(solution.complexity)}">
                复杂度: ${solution.complexity}/10
              </span>
            </div>
          </div>
          <div class="pros-cons">
            <div class="pros">
              <h4>✅ 优点</h4>
              <ul>
                ${solution.pros.map(pro => `<li>${this._escapeHtml(pro)}</li>`).join('')}
              </ul>
            </div>
            <div class="cons">
              <h4>❌ 缺点</h4>
              <ul>
                ${solution.cons.map(con => `<li>${this._escapeHtml(con)}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</section>`;
  }

  /**
   * 生成推荐决策部分
   */
  private _generateDecisionSection(decision: Decision): string {
    return `
<section class="analysis-section decision-section">
  <h2 class="section-title">
    <span class="toggle" onclick="toggleSection('decision')">▼</span>
    🎯 推荐决策
  </h2>
  <div id="decision" class="section-content">
    <div class="decision-card">
      <div class="selected-solution">
        <h3>✨ 推荐方案: ${this._escapeHtml(decision.selectedSolution)}</h3>
      </div>

      <div class="rationale">
        <h4>📝 理由</h4>
        <p>${this._escapeHtml(decision.rationale)}</p>
      </div>

      <div class="effort-estimate">
        <h4>⏱️ 工作量估计</h4>
        <p>${this._escapeHtml(decision.estimatedEffort)}</p>
      </div>

      <div class="next-steps">
        <h4>📋 后续步骤</h4>
        <ol>
          ${decision.nextSteps.map(step => `<li>${this._escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
    </div>
  </div>
</section>`;
  }

  /**
   * 生成反馈收集部分
   */
  private _generateFeedbackSection(sessionId: string): string {
    return `
<section class="analysis-section feedback-section">
  <h2 class="section-title">
    📝 您觉得这次分析如何？
  </h2>
  <div class="section-content">
    <div class="feedback-container">
      <div class="feedback-buttons">
        <button class="feedback-btn useful" onclick="selectFeedback('useful', '${sessionId}')">
          👍 有用
        </button>
        <button class="feedback-btn not-useful" onclick="selectFeedback('not-useful', '${sessionId}')">
          👎 无用
        </button>
        <button class="feedback-btn suggestion" onclick="selectFeedback('suggestion', '${sessionId}')">
          💬 建议
        </button>
      </div>

      <div id="feedback-details" class="feedback-details" style="display: none;">
        <div class="rating">
          <label>评分:</label>
          <div class="stars">
            ${[1, 2, 3, 4, 5].map(i =>
              `<span class="star" data-rating="${i}" onclick="setRating(${i})">☆</span>`
            ).join('')}
          </div>
        </div>
        <textarea id="feedback-comment" placeholder="请分享您的想法..."></textarea>
        <button class="submit-btn" onclick="submitFeedback('${sessionId}')">提交反馈</button>
      </div>

      <div id="feedback-thanks" class="feedback-thanks" style="display: none;">
        <p>✅ 感谢您的反馈！</p>
      </div>
    </div>
  </div>
</section>`;
  }

  /**
   * 生成进度部分
   */
  private _generateProgressSection(): string {
    return `
<div id="progress-section" class="progress-section" style="display: none;">
  <div class="progress-header">
    <h3>🔄 分析进行中...</h3>
    <button id="cancel-button" class="cancel-button">取消分析</button>
  </div>
  <div class="progress-bar-container">
    <div id="progress-bar" class="progress-bar" style="width: 0%"></div>
  </div>
  <p id="progress-message" class="progress-message">正在初始化...</p>
  <p id="progress-time" class="progress-time">已用时间: 0秒</p>
</div>`;
  }

  /**
   * 生成仅显示进度的HTML
   */
  private _generateProgressOnlyHTML(progress: AnalysisProgress): string {
    const nonce = this._getNonce();
    const seconds = Math.floor(progress.elapsedTime / 1000);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>Codex 深度分析 - 进行中</title>
    <style nonce="${nonce}">
      ${this._getStyles()}
    </style>
</head>
<body>
    <div class="container">
      <header>
        <h1>🧠 Codex 深度分析</h1>
      </header>

      <div id="progress-section" class="progress-section" style="display: block;">
        <div class="progress-header">
          <h3>🔄 分析进行中...</h3>
          <button id="cancel-button" class="cancel-button">取消分析</button>
        </div>
        <div class="progress-bar-container">
          <div id="progress-bar" class="progress-bar" style="width: ${progress.percentage}%"></div>
        </div>
        <p id="progress-message" class="progress-message">${this._escapeHtml(progress.message)}</p>
        <p id="progress-time" class="progress-time">已用时间: ${seconds}秒</p>
      </div>
    </div>

    <script nonce="${nonce}">
      ${this._getScript()}
    </script>
</body>
</html>`;
  }

  /**
   * 获取复杂度等级
   */
  private _getComplexityLevel(score: number): string {
    if (score >= 8) {
      return 'high';
    }
    if (score >= 5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 获取风险类别图标
   */
  private _getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      technical: '🔧',
      security: '🔒',
      performance: '⚡',
      maintainability: '🛠️'
    };
    return icons[category] || '📌';
  }

  /**
   * HTML转义
   */
  private _escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * 获取CSS样式
   */
  private _getStyles(): string {
    return `
      :root {
        --bg-primary: var(--vscode-editor-background);
        --bg-secondary: var(--vscode-sideBar-background);
        --fg-primary: var(--vscode-editor-foreground);
        --fg-secondary: var(--vscode-descriptionForeground);
        --border-color: var(--vscode-panel-border);
        --link-color: var(--vscode-textLink-foreground);
        --success-color: #4caf50;
        --warning-color: #ff9800;
        --error-color: #f44336;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--fg-primary);
        background-color: var(--bg-primary);
        padding: 0;
        margin: 0;
        line-height: 1.6;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }

      header {
        margin-bottom: 30px;
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 20px;
      }

      h1 {
        font-size: 2em;
        margin-bottom: 15px;
      }

      .metadata {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 15px;
      }

      .metadata-item {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .metadata-label {
        color: var(--fg-secondary);
        font-weight: 500;
      }

      .metadata-value {
        font-family: monospace;
        background: var(--bg-secondary);
        padding: 2px 8px;
        border-radius: 4px;
      }

      .mode-codex {
        color: #9c27b0;
      }

      .mode-local {
        color: #2196f3;
      }

      .analysis-section {
        margin-bottom: 30px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
      }

      .section-title {
        padding: 15px 20px;
        margin: 0;
        font-size: 1.5em;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }

      .section-title:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .toggle {
        cursor: pointer;
        user-select: none;
        font-size: 0.8em;
        transition: transform 0.2s;
      }

      .section-content {
        padding: 20px;
      }

      .section-content.collapsed {
        display: none;
      }

      .empty {
        color: var(--fg-secondary);
        font-style: italic;
        text-align: center;
        padding: 20px;
      }

      /* 问题分解树 */
      .problem-tree {
        list-style: none;
        padding-left: 0;
      }

      .problem-tree.depth-0 {
        padding-left: 0;
      }

      .problem-tree.depth-1 {
        padding-left: 30px;
      }

      .problem-tree.depth-2 {
        padding-left: 30px;
      }

      .problem-node {
        margin: 10px 0;
      }

      .problem-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
      }

      .problem-description {
        flex: 1;
      }

      .complexity-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 500;
        white-space: nowrap;
      }

      .complexity-low {
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-color);
      }

      .complexity-medium {
        background: rgba(255, 152, 0, 0.2);
        color: var(--warning-color);
      }

      .complexity-high {
        background: rgba(244, 67, 54, 0.2);
        color: var(--error-color);
      }

      .spacer {
        width: 20px;
        display: inline-block;
      }

      .sub-problems {
        margin-top: 10px;
      }

      .sub-problems.collapsed {
        display: none;
      }

      /* 风险识别 */
      .risk-summary {
        display: flex;
        gap: 10px;
        margin-left: auto;
      }

      .risk-count {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 500;
      }

      .risk-count.high {
        background: rgba(244, 67, 54, 0.2);
        color: var(--error-color);
      }

      .risk-count.medium {
        background: rgba(255, 152, 0, 0.2);
        color: var(--warning-color);
      }

      .risk-count.low {
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-color);
      }

      .risk-group {
        margin-bottom: 20px;
      }

      .risk-group:last-child {
        margin-bottom: 0;
      }

      .risk-group-title {
        font-size: 1.2em;
        margin-bottom: 15px;
      }

      .risk-list {
        display: grid;
        gap: 15px;
      }

      .risk-card {
        background: var(--bg-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        padding: 15px;
      }

      .risk-card.severity-high {
        border-left: 4px solid var(--error-color);
      }

      .risk-card.severity-medium {
        border-left: 4px solid var(--warning-color);
      }

      .risk-card.severity-low {
        border-left: 4px solid var(--success-color);
      }

      .risk-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .risk-category {
        font-weight: 600;
        text-transform: capitalize;
      }

      .severity-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 500;
      }

      .severity-badge.high {
        background: rgba(244, 67, 54, 0.2);
        color: var(--error-color);
      }

      .severity-badge.medium {
        background: rgba(255, 152, 0, 0.2);
        color: var(--warning-color);
      }

      .severity-badge.low {
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-color);
      }

      .risk-description {
        margin-bottom: 10px;
        line-height: 1.5;
      }

      .risk-mitigation {
        background: var(--bg-secondary);
        padding: 10px;
        border-radius: 6px;
        margin-top: 10px;
      }

      .risk-mitigation strong {
        display: block;
        margin-bottom: 5px;
        color: var(--fg-secondary);
      }

      /* 方案对比 */
      .solutions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
      }

      .solution-card {
        background: var(--bg-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
      }

      .solution-card.recommended {
        border-color: var(--success-color);
        box-shadow: 0 0 0 1px var(--success-color);
      }

      .solution-header {
        margin-bottom: 15px;
      }

      .solution-header h3 {
        margin-bottom: 10px;
      }

      .solution-scores {
        display: flex;
        gap: 10px;
      }

      .score-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 500;
        background: rgba(33, 150, 243, 0.2);
        color: #2196f3;
      }

      .pros-cons {
        display: grid;
        gap: 15px;
      }

      .pros h4,
      .cons h4 {
        margin-bottom: 8px;
        font-size: 1em;
      }

      .pros ul,
      .cons ul {
        margin-left: 20px;
      }

      .pros li,
      .cons li {
        margin-bottom: 5px;
      }

      /* 推荐决策 */
      .decision-card {
        background: var(--bg-primary);
        border: 2px solid var(--success-color);
        border-radius: 8px;
        padding: 20px;
      }

      .selected-solution {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .selected-solution h3 {
        color: var(--success-color);
        margin: 0;
      }

      .rationale,
      .effort-estimate,
      .next-steps {
        margin-bottom: 20px;
      }

      .rationale:last-child,
      .effort-estimate:last-child,
      .next-steps:last-child {
        margin-bottom: 0;
      }

      .rationale h4,
      .effort-estimate h4,
      .next-steps h4 {
        margin-bottom: 10px;
        color: var(--fg-secondary);
      }

      .next-steps ol {
        margin-left: 20px;
      }

      .next-steps li {
        margin-bottom: 8px;
        line-height: 1.5;
      }

      /* 反馈收集 */
      .feedback-container {
        max-width: 600px;
        margin: 0 auto;
      }

      .feedback-buttons {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-bottom: 20px;
      }

      .feedback-btn {
        flex: 1;
        padding: 12px 24px;
        font-size: 1em;
        font-weight: 500;
        border: 2px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--fg-primary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .feedback-btn:hover {
        background: var(--vscode-button-hoverBackground);
        border-color: var(--vscode-button-background);
      }

      .feedback-btn.selected {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-background);
      }

      .feedback-btn.useful.selected {
        background: rgba(76, 175, 80, 0.2);
        border-color: var(--success-color);
        color: var(--success-color);
      }

      .feedback-btn.not-useful.selected {
        background: rgba(244, 67, 54, 0.2);
        border-color: var(--error-color);
        color: var(--error-color);
      }

      .feedback-btn.suggestion.selected {
        background: rgba(33, 150, 243, 0.2);
        border-color: #2196f3;
        color: #2196f3;
      }

      .feedback-details {
        background: var(--bg-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        animation: fadeIn 0.3s;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .rating {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
      }

      .rating label {
        font-weight: 500;
        color: var(--fg-secondary);
      }

      .stars {
        display: flex;
        gap: 5px;
      }

      .star {
        font-size: 1.5em;
        cursor: pointer;
        user-select: none;
        transition: color 0.2s;
        color: var(--fg-secondary);
      }

      .star:hover,
      .star.selected {
        color: #ffd700;
      }

      #feedback-comment {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--bg-secondary);
        color: var(--fg-primary);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        resize: vertical;
        margin-bottom: 15px;
      }

      #feedback-comment:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      .submit-btn {
        width: 100%;
        padding: 12px 24px;
        font-size: 1em;
        font-weight: 500;
        border: none;
        border-radius: 6px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
        transition: background 0.2s;
      }

      .submit-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .submit-btn:active {
        transform: scale(0.98);
      }

      .feedback-thanks {
        text-align: center;
        padding: 30px;
        background: rgba(76, 175, 80, 0.1);
        border: 2px solid var(--success-color);
        border-radius: 8px;
        animation: fadeIn 0.3s;
      }

      .feedback-thanks p {
        font-size: 1.2em;
        color: var(--success-color);
        margin: 0;
      }

      /* 进度显示 */
      .progress-section {
        margin: 20px 0;
        padding: 20px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .progress-header h3 {
        margin: 0;
        font-size: 1.2em;
      }

      .cancel-button {
        padding: 8px 16px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        font-weight: 500;
        transition: background 0.2s;
      }

      .cancel-button:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .progress-bar-container {
        width: 100%;
        height: 8px;
        background: var(--vscode-progressBar-background);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .progress-bar {
        height: 100%;
        background: var(--vscode-progressBar-progressBackground);
        transition: width 0.3s ease;
      }

      .progress-message {
        font-size: 14px;
        color: var(--vscode-foreground);
        margin: 5px 0;
      }

      .progress-time {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin: 5px 0;
      }

      /* 响应式布局 */
      @media (max-width: 768px) {
        .solutions-grid {
          grid-template-columns: 1fr;
        }

        .metadata {
          flex-direction: column;
        }

        .feedback-buttons {
          flex-direction: column;
        }
      }
    `;
  }

  /**
   * 获取JavaScript代码
   */
  private _getScript(sessionId?: string): string {
    return `
const vscode = acquireVsCodeApi();

// 反馈状态
let selectedRating = 0;
let selectedType = '';

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
    const toggle = section.previousElementSibling.querySelector('.toggle');
    if (toggle) {
      toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
    }
  }
}

function toggleNode(nodeId) {
  const node = document.getElementById(nodeId);
  if (node) {
    node.classList.toggle('collapsed');
    const toggle = node.previousElementSibling.querySelector('.toggle');
    if (toggle) {
      toggle.textContent = node.classList.contains('collapsed') ? '▶' : '▼';
    }
  }
}

// 选择反馈类型
function selectFeedback(type, sessionId) {
  selectedType = type;

  // 高亮选中的按钮
  document.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');

  // 显示详情表单
  document.getElementById('feedback-details').style.display = 'block';
}

// 设置评分
function setRating(rating) {
  selectedRating = rating;

  // 更新星星显示
  document.querySelectorAll('.star').forEach((star, index) => {
    if (index < rating) {
      star.textContent = '★';
      star.classList.add('selected');
    } else {
      star.textContent = '☆';
      star.classList.remove('selected');
    }
  });
}

// 提交反馈
function submitFeedback(sessionId) {
  const comment = document.getElementById('feedback-comment').value;

  // 发送消息到扩展
  vscode.postMessage({
    type: 'feedback',
    sessionId: sessionId,
    feedbackType: selectedType,
    rating: selectedRating || undefined,
    comment: comment || undefined
  });

  // 隐藏反馈表单，显示感谢消息
  document.querySelector('.feedback-buttons').style.display = 'none';
  document.getElementById('feedback-details').style.display = 'none';
  document.getElementById('feedback-thanks').style.display = 'block';
}

// 监听来自扩展的消息（进度更新）
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'progress':
      updateProgress(message.progress);
      break;
  }
});

// 更新进度显示
function updateProgress(progress) {
  const section = document.getElementById('progress-section');
  const bar = document.getElementById('progress-bar');
  const messageEl = document.getElementById('progress-message');
  const timeEl = document.getElementById('progress-time');

  if (!section || !bar || !messageEl || !timeEl) {
    return;
  }

  // 显示进度区域
  section.style.display = 'block';

  // 更新进度条
  bar.style.width = progress.percentage + '%';

  // 更新消息
  messageEl.textContent = progress.message;

  // 更新时间
  const seconds = Math.floor(progress.elapsedTime / 1000);
  timeEl.textContent = '已用时间: ' + seconds + '秒';

  // 如果完成，隐藏进度区域
  if (progress.phase === 'completed') {
    setTimeout(() => {
      section.style.display = 'none';
    }, 2000);
  }
}

// 取消按钮点击
document.addEventListener('DOMContentLoaded', () => {
  console.log('Codex Analysis WebView loaded');

  const cancelButton = document.getElementById('cancel-button');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      if (confirm('确定要取消当前分析吗？中间结果将被保存。')) {
        vscode.postMessage({ type: 'cancel' });
      }
    });
  }
});`;
  }

  /**
   * 生成随机nonce
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * 处理来自WebView的消息
   *
   * @param message 消息对象
   */
  private async _handleMessage(message: any): Promise<void> {
    this.outputChannel.appendLine(`[CodexAnalysisWebview] Received message: ${JSON.stringify(message)}`);

    // 处理用户交互消息
    switch (message.type) {
      case 'feedback':
        await this._handleFeedback(message);
        break;
      case 'cancel':
        await this._handleCancel();
        break;
      default:
        this.outputChannel.appendLine(`[CodexAnalysisWebview] Unknown message type: ${message.type}`);
    }
  }

  /**
   * 处理取消消息
   */
  private async _handleCancel(): Promise<void> {
    this.outputChannel.appendLine('[CodexAnalysisWebview] Handling cancel request...');

    if (this.cancelCallback) {
      this.outputChannel.appendLine('[CodexAnalysisWebview] Executing cancel callback');
      this.cancelCallback();
    } else {
      this.outputChannel.appendLine('[CodexAnalysisWebview] No cancel callback available');
      vscode.window.showWarningMessage('无法取消：取消回调未设置');
    }
  }

  /**
   * 处理反馈消息
   *
   * @param message 反馈消息
   */
  private async _handleFeedback(message: any): Promise<void> {
    this.outputChannel.appendLine('[CodexAnalysisWebview] Handling feedback...');

    // 检查是否有反馈收集器
    if (!this.feedbackCollector) {
      this.outputChannel.appendLine('[CodexAnalysisWebview] Feedback collector not available');
      vscode.window.showWarningMessage('反馈收集器不可用');
      return;
    }

    // 确保反馈收集器已初始化
    await this.feedbackCollector.initialize();

    // 收集反馈
    try {
      await this.feedbackCollector.collectFeedback(
        message.sessionId,
        message.feedbackType,
        {
          scenario: this.currentMetadata?.scenario || 'deep-analysis',
          taskType: this.currentMetadata?.taskType || 'unknown',
          executionTime: this.currentMetadata?.executionTime || 0
        },
        {
          rating: message.rating,
          comment: message.comment
        }
      );

      this.outputChannel.appendLine('[CodexAnalysisWebview] Feedback collected successfully');

      // 显示成功消息
      vscode.window.showInformationMessage('感谢您的反馈！');

    } catch (error) {
      this.outputChannel.appendLine(`[CodexAnalysisWebview] Failed to collect feedback: ${error}`);
      vscode.window.showErrorMessage(`收集反馈失败: ${error}`);
    }
  }

  /**
   * 资源清理
   */
  dispose(): void {
    this.outputChannel.appendLine('[CodexAnalysisWebview] Disposing webview');

    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
