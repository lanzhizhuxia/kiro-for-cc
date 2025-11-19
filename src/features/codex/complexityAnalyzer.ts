/**
 * 复杂度分析器 - Codex工作流编排系统
 *
 * 分析任务复杂度,生成1-10分的复杂度评分,用于智能路由决策
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskDescriptor, ComplexityScore } from './types';

/**
 * 复杂度分析器类
 *
 * 基于加权评分模型分析任务复杂度:
 * - 代码规模: 30%
 * - 技术难度: 40%
 * - 业务影响: 30%
 */
export class ComplexityAnalyzer {
  /**
   * 分析任务复杂度
   *
   * @param task 任务描述符
   * @returns 复杂度评分结果
   */
  async analyze(task: TaskDescriptor): Promise<ComplexityScore> {
    // 1. 分析代码规模 (30%权重)
    const codeScale = await this._analyzeCodeScale(task);

    // 2. 分析技术难度 (40%权重)
    const technicalDifficulty = await this._analyzeTechnicalDifficulty(task);

    // 3. 分析业务影响 (30%权重)
    const businessImpact = await this._analyzeBusinessImpact(task);

    // 4. 计算加权总分
    const total = this._calculateWeightedScore(
      codeScale,
      technicalDifficulty,
      businessImpact
    );

    // 5. 生成详细分析结果
    const details = await this._generateDetails(task, codeScale, technicalDifficulty, businessImpact);

    return {
      total: Math.round(total * 10) / 10, // 保留一位小数
      codeScale,
      technicalDifficulty,
      businessImpact,
      details
    };
  }

  /**
   * 分析代码规模 (权重: 30%)
   *
   * 评估因素:
   * - 涉及的文件数量
   * - 文件总代码行数
   * - 项目整体规模
   *
   * 动态评分调整:
   * - 需求2.5: 跨文件重构自动提升至少1分
   *
   * @param task 任务描述符
   * @returns 代码规模评分 (1-10)
   */
  private async _analyzeCodeScale(task: TaskDescriptor): Promise<number> {
    let score = 1.0;

    // 获取涉及的文件列表
    const relatedFiles = task.relatedFiles || [];
    const fileCount = relatedFiles.length;

    // 如果没有明确的文件列表,基于任务描述和类型推测
    let estimatedFileCount = fileCount;
    if (fileCount === 0) {
      estimatedFileCount = this._estimateFileCount(task);
    }

    // 基于文件数量评分
    if (estimatedFileCount === 0) {
      score = 1.0; // 无文件修改 (如文档任务)
    } else if (estimatedFileCount === 1) {
      score = 2.0; // 单文件
    } else if (estimatedFileCount <= 3) {
      score = 4.0; // 少量文件 (2-3个)
    } else if (estimatedFileCount <= 5) {
      score = 6.0; // 中等数量 (4-5个)
    } else if (estimatedFileCount <= 10) {
      score = 8.0; // 较多文件 (6-10个)
    } else {
      score = 10.0; // 大量文件 (>10个)
    }

    // 如果有实际文件路径,分析代码行数进行微调
    if (relatedFiles.length > 0) {
      const totalLines = await this._countTotalLines(relatedFiles);

      // 每1000行代码增加0.5分
      const linesBonus = Math.min(2.0, (totalLines / 1000) * 0.5);
      score = Math.min(10.0, score + linesBonus);
    }

    // 动态评分调整 - 需求2.5: 跨文件重构自动提升至少1分
    const fullText = (task.description + ' ' + JSON.stringify(task.context || {})).toLowerCase();
    const refactoringScope = this._detectRefactoringScope(fullText);
    if (refactoringScope === 'multiple') {
      score = Math.min(10.0, score + 1.0);
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * 分析技术难度 (权重: 40%)
   *
   * 评估因素:
   * - 任务类型的固有难度
   * - 技术栈复杂度
   * - 架构变更程度
   * - 新技术引入
   *
   * @param task 任务描述符
   * @returns 技术难度评分 (1-10)
   */
  private async _analyzeTechnicalDifficulty(task: TaskDescriptor): Promise<number> {
    let score = 1.0;

    // 1. 基于任务类型的基础评分
    switch (task.type) {
      case 'requirements':
        score = 2.0; // 需求分析相对简单
        break;
      case 'design':
        score = 6.0; // 设计需要架构思考
        break;
      case 'tasks':
        score = 3.0; // 任务拆解需要理解但难度中等
        break;
      case 'implementation':
        score = 7.0; // 实现是核心技术工作
        break;
      case 'review':
        score = 5.0; // Review需要深入理解
        break;
      case 'debug':
        score = 8.0; // Debug通常最复杂
        break;
      default:
        score = 5.0; // 默认中等难度
    }

    // 2. 使用细化的检测方法调整评分
    const description = task.description.toLowerCase();
    const context = JSON.stringify(task.context || {}).toLowerCase();
    const fullText = description + ' ' + context;

    // 检测AST修改 (+2分) - 需求2.1
    if (this._involvesASTModification(fullText)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测异步/并发复杂度 (+2分) - 需求2.1
    if (this._involvesAsyncComplexity(fullText)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测新技术引入 (+2分) - 需求2.1
    if (this._involvesNewTechnology(fullText)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测数据库相关 (+1分)
    if (this._containsKeywords(fullText, [
      'database', 'migration', 'schema', 'sql',
      '数据库', '迁移', '模式'
    ])) {
      score = Math.min(10.0, score + 1.0);
    }

    // 检测性能优化 (+1分)
    if (this._containsKeywords(fullText, [
      'performance', 'optimization', 'cache', 'memory',
      '性能', '优化', '缓存', '内存'
    ])) {
      score = Math.min(10.0, score + 1.0);
    }

    // 检测安全相关 (+1分)
    if (this._containsKeywords(fullText, [
      'security', 'authentication', 'authorization', 'encryption',
      '安全', '认证', '授权', '加密'
    ])) {
      score = Math.min(10.0, score + 1.0);
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * 分析业务影响 (权重: 30%)
   *
   * 评估因素:
   * - 是否影响核心功能
   * - 是否影响多个子系统
   * - 用户体验影响程度
   *
   * 动态评分调整:
   * - 需求2.4: 涉及多个子系统交互自动提升至少2分
   * - 需求2.5: 跨文件重构自动提升至少1分
   *
   * @param task 任务描述符
   * @returns 业务影响评分 (1-10)
   */
  private async _analyzeBusinessImpact(task: TaskDescriptor): Promise<number> {
    let score = 5.0; // 默认中等影响

    const description = task.description.toLowerCase();
    const context = JSON.stringify(task.context || {}).toLowerCase();
    const fullText = description + ' ' + context;

    // 检测核心功能影响 (+3分)
    if (this._containsKeywords(fullText, [
      'core', 'critical', 'essential', 'main feature',
      '核心', '关键', '主要功能'
    ])) {
      score = Math.min(10.0, score + 3.0);
    }

    // 动态评分调整 - 需求2.4: 涉及多个子系统交互自动提升至少2分
    if (await this._affectsMultipleSubsystems(task)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测核心API影响 (+2分) - 需求2.2
    if (this._affectsCoreAPI(fullText)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测数据库迁移 (+2分) - 需求2.2
    if (this._requiresDatabaseMigration(fullText)) {
      score = Math.min(10.0, score + 2.0);
    }

    // 检测用户体验影响 (+1.5分)
    if (this._containsKeywords(fullText, [
      'user experience', 'ux', 'ui', 'frontend',
      '用户体验', '前端', '界面'
    ])) {
      score = Math.min(10.0, score + 1.5);
    }

    // 检测数据完整性 (+2分)
    if (this._containsKeywords(fullText, [
      'data integrity', 'data loss', 'backup',
      '数据完整性', '数据丢失', '备份'
    ])) {
      score = Math.min(10.0, score + 2.0);
    }

    // 如果是简单文档任务,降低影响 (-3分)
    if (task.type === 'requirements' || task.type === 'tasks') {
      if (!this._containsKeywords(fullText, ['core', 'critical', '核心', '关键'])) {
        score = Math.max(1.0, score - 3.0);
      }
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * 计算加权总分
   *
   * @param codeScale 代码规模评分
   * @param technicalDifficulty 技术难度评分
   * @param businessImpact 业务影响评分
   * @returns 加权总分 (1-10)
   */
  private _calculateWeightedScore(
    codeScale: number,
    technicalDifficulty: number,
    businessImpact: number
  ): number {
    const total =
      codeScale * 0.30 +          // 代码规模权重: 30%
      technicalDifficulty * 0.40 + // 技术难度权重: 40%
      businessImpact * 0.30;       // 业务影响权重: 30%

    // 确保结果在1-10范围内
    return Math.max(1.0, Math.min(10.0, total));
  }

  /**
   * 生成详细分析指标
   *
   * @param task 任务描述符
   * @param codeScale 代码规模评分
   * @param technicalDifficulty 技术难度评分
   * @param businessImpact 业务影响评分
   * @returns 详细分析结果
   */
  private async _generateDetails(
    task: TaskDescriptor,
    codeScale: number,
    technicalDifficulty: number,
    businessImpact: number
  ): Promise<ComplexityScore['details']> {
    const relatedFiles = task.relatedFiles || [];
    const description = task.description.toLowerCase();
    const context = JSON.stringify(task.context || {}).toLowerCase();
    const fullText = description + ' ' + context;

    return {
      fileCount: relatedFiles.length || this._estimateFileCount(task),
      functionDepth: this._estimateFunctionDepth(task),
      externalDeps: this._estimateExternalDeps(task),
      cyclomaticComplexity: 0, // 需要AST分析,暂时为0
      cognitiveComplexity: 0,  // 需要AST分析,暂时为0
      crossModuleImpact: await this._affectsMultipleSubsystems(task),
      refactoringScope: this._detectRefactoringScope(fullText),
      involvesASTModification: this._involvesASTModification(fullText),
      involvesAsyncComplexity: this._involvesAsyncComplexity(fullText),
      involvesNewTechnology: this._involvesNewTechnology(fullText),
      requiresDatabaseMigration: this._requiresDatabaseMigration(fullText),
      affectsCoreAPI: this._affectsCoreAPI(fullText)
    };
  }

  /**
   * 估算涉及的文件数量 (基于任务描述)
   */
  private _estimateFileCount(task: TaskDescriptor): number {
    const description = task.description.toLowerCase();

    // 关键词匹配
    if (description.includes('single file') || description.includes('单文件')) {
      return 1;
    }
    if (description.includes('few files') || description.includes('少量文件')) {
      return 3;
    }
    if (description.includes('multiple files') || description.includes('多文件')) {
      return 6;
    }
    if (description.includes('many files') || description.includes('大量文件')) {
      return 12;
    }

    // 基于任务类型推测
    switch (task.type) {
      case 'requirements':
      case 'tasks':
        return 0; // 文档任务通常不涉及代码文件
      case 'design':
        return 1; // 设计文档
      case 'implementation':
        return 5; // 实现通常涉及多个文件
      case 'debug':
        return 3; // Debug可能涉及多个相关文件
      case 'review':
        return 2; // Review通常针对特定文件
      default:
        return 2;
    }
  }

  /**
   * 估算函数调用链深度
   */
  private _estimateFunctionDepth(task: TaskDescriptor): number {
    // 基于任务类型和复杂度推测
    switch (task.type) {
      case 'implementation':
      case 'debug':
        return 5; // 实现和Debug通常有较深的调用链
      case 'design':
      case 'review':
        return 3; // 中等深度
      default:
        return 1; // 文档任务调用链浅
    }
  }

  /**
   * 估算外部依赖数量
   */
  private _estimateExternalDeps(task: TaskDescriptor): number {
    const fullText = (task.description + ' ' + JSON.stringify(task.context || {})).toLowerCase();

    let count = 0;

    // 检测常见依赖关键词
    const depKeywords = [
      'npm', 'package', 'library', 'framework', 'api',
      '依赖', '库', '框架'
    ];

    for (const keyword of depKeywords) {
      if (fullText.includes(keyword)) {
        count += 2;
      }
    }

    return Math.min(10, count); // 最多10个
  }

  /**
   * 检测重构范围
   */
  private _detectRefactoringScope(fullText: string): 'none' | 'single' | 'multiple' {
    if (!this._containsKeywords(fullText, ['refactor', 'restructure', '重构'])) {
      return 'none';
    }

    if (this._containsKeywords(fullText, ['multiple', 'cross', '多个', '跨'])) {
      return 'multiple';
    }

    return 'single';
  }

  /**
   * 统计文件总代码行数
   */
  private async _countTotalLines(filePaths: string[]): Promise<number> {
    let totalLines = 0;

    for (const filePath of filePaths) {
      try {
        // 获取工作空间根路径
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          continue;
        }

        // 构建完整路径
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(workspaceRoot, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
          continue;
        }

        // 读取文件内容
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        totalLines += lines;
      } catch (error) {
        // 忽略读取失败的文件
        console.warn(`Failed to read file ${filePath}:`, error);
      }
    }

    return totalLines;
  }

  /**
   * 检查文本是否包含关键词 (不区分大小写)
   */
  private _containsKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  // ========== 细化的检测方法 (需求2.1-2.6) ==========

  /**
   * 检测是否涉及AST修改/重构任务 (需求2.1, 2.5)
   *
   * 识别关键词:
   * - refactor, restructure, ast
   * - 重构, 重组, 语法树
   *
   * @param fullText 任务描述和上下文的完整文本
   * @returns 是否涉及AST修改
   */
  private _involvesASTModification(fullText: string): boolean {
    return this._containsKeywords(fullText, [
      'refactor', 'restructure', 'ast', 'syntax tree',
      'code transformation', 'parser', 'transpile',
      '重构', '重组', '语法树', '代码转换', '解析器'
    ]);
  }

  /**
   * 检测是否涉及异步/并发复杂度 (需求2.1, 2.3)
   *
   * 识别关键词:
   * - async, promise, concurrent, parallel
   * - 异步, 并发, 并行, 竞态
   *
   * @param fullText 任务描述和上下文的完整文本
   * @returns 是否涉及异步复杂度
   */
  private _involvesAsyncComplexity(fullText: string): boolean {
    return this._containsKeywords(fullText, [
      'async', 'await', 'promise', 'concurrent', 'parallel',
      'race', 'condition', 'deadlock', 'thread', 'event loop',
      '异步', '并发', '并行', '竞态', '死锁', '线程', '事件循环'
    ]);
  }

  /**
   * 检测是否涉及新技术引入 (需求2.1)
   *
   * 识别关键词:
   * - new technology, new framework, new library
   * - introduce, integrate, migration
   * - 新技术, 新框架, 引入, 集成
   *
   * @param fullText 任务描述和上下文的完整文本
   * @returns 是否涉及新技术
   */
  private _involvesNewTechnology(fullText: string): boolean {
    return this._containsKeywords(fullText, [
      'new', 'technology', 'framework', 'library', 'tool',
      'introduce', 'integrate', 'adopt', 'migration',
      '新技术', '新框架', '新库', '新工具', '引入', '集成', '采用', '迁移'
    ]);
  }

  /**
   * 检测是否影响多个子系统 (需求2.2, 2.4)
   *
   * 关键检测:
   * - 涉及文件是否分布在多个模块/子系统
   * - 关键词: multiple modules, cross-module, subsystem
   *
   * 动态评分调整: 如果检测到多子系统影响,在业务影响评分中自动+2分
   *
   * @param task 任务描述符
   * @returns 是否影响多个子系统
   */
  private async _affectsMultipleSubsystems(task: TaskDescriptor): Promise<boolean> {
    const relatedFiles = task.relatedFiles || [];
    const fullText = (task.description + ' ' + JSON.stringify(task.context || {})).toLowerCase();

    // 1. 关键词检测
    if (this._containsKeywords(fullText, [
      'multiple modules', 'cross-module', 'subsystem', 'multi-system',
      '多模块', '跨模块', '子系统', '多系统'
    ])) {
      return true;
    }

    // 2. 如果有文件列表,分析文件分布
    if (relatedFiles.length > 0) {
      const subsystems = new Set<string>();

      for (const filePath of relatedFiles) {
        const subsystem = this._extractSubsystem(filePath);
        subsystems.add(subsystem);
      }

      // 涉及3个或以上子系统视为多子系统影响
      return subsystems.size >= 3;
    }

    return false;
  }

  /**
   * 从文件路径提取子系统名称
   *
   * 例如:
   * - src/features/codex/xxx.ts -> features/codex
   * - src/providers/xxx.ts -> providers
   *
   * @param filePath 文件路径
   * @returns 子系统名称
   */
  private _extractSubsystem(filePath: string): string {
    const parts = filePath.split('/').filter(p => p.length > 0);

    // 去除src前缀
    const startIndex = parts.findIndex(p => p === 'src');
    if (startIndex >= 0 && parts.length > startIndex + 1) {
      return parts.slice(startIndex + 1, startIndex + 3).join('/');
    }

    // 如果没有src,取前两个路径部分
    return parts.slice(0, 2).join('/');
  }

  /**
   * 检测是否需要数据库迁移 (需求2.2)
   *
   * 识别关键词:
   * - database, migration, schema, sql
   * - 数据库, 迁移, 模式, 表结构
   *
   * @param fullText 任务描述和上下文的完整文本
   * @returns 是否需要数据库迁移
   */
  private _requiresDatabaseMigration(fullText: string): boolean {
    return this._containsKeywords(fullText, [
      'database migration', 'schema change', 'sql migration',
      'alter table', 'create table', 'drop table',
      '数据库迁移', '模式变更', '表结构', '建表', '删表'
    ]);
  }

  /**
   * 检测是否影响核心API (需求2.2)
   *
   * 识别关键词:
   * - core api, breaking change, public interface
   * - 核心API, 破坏性变更, 公共接口
   *
   * @param fullText 任务描述和上下文的完整文本
   * @returns 是否影响核心API
   */
  private _affectsCoreAPI(fullText: string): boolean {
    return this._containsKeywords(fullText, [
      'core api', 'public api', 'breaking change',
      'api change', 'interface change', 'contract',
      '核心API', '公共API', '破坏性变更',
      'API变更', '接口变更', '契约'
    ]);
  }
}
