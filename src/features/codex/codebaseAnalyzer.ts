/**
 * 代码库分析器
 *
 * 提供代码库扫描、文件查找、依赖分析、TypeScript AST分析等功能
 * 支持 .claudeignore 文件过滤和增量缓存
 */

import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  TaskDescriptor,
  CodebaseSnapshot,
  DependencyGraph,
  ASTMetrics
} from './types';

/**
 * 文件分析缓存项
 */
interface FileCacheEntry {
  /** 文件路径 */
  filePath: string;

  /** 最后修改时间 */
  mtime: number;

  /** AST分析结果 */
  metrics: ASTMetrics;

  /** 缓存时间 */
  cachedAt: Date;
}

/**
 * 代码库分析器类
 */
export class CodebaseAnalyzer {
  private workspaceRoot: string;
  private ignorePatterns: string[] = [];
  private defaultIgnorePatterns: string[] = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/*.min.js',
    '**/*.map',
  ];

  /** 文件分析缓存 */
  private fileCache: Map<string, FileCacheEntry> = new Map();

  /** 缓存过期时间（24小时） */
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || this._getWorkspaceRoot();
    this._loadIgnorePatterns();
  }

  /**
   * 获取工作空间根目录
   */
  private _getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }
    return workspaceFolders[0].uri.fsPath;
  }

  /**
   * 加载 .claudeignore 文件的忽略规则
   */
  private _loadIgnorePatterns(): void {
    // 重置为默认规则
    this.ignorePatterns = [...this.defaultIgnorePatterns];

    // 尝试加载 .claudeignore 文件
    const claudeIgnorePath = path.join(this.workspaceRoot, '.claudeignore');

    if (fs.existsSync(claudeIgnorePath)) {
      try {
        const content = fs.readFileSync(claudeIgnorePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // 跳过空行和注释
          if (trimmed && !trimmed.startsWith('#')) {
            // 将 gitignore 格式转换为 glob 格式
            const globPattern = this._convertToGlobPattern(trimmed);
            this.ignorePatterns.push(globPattern);
          }
        }
      } catch (error) {
        console.warn('Failed to load .claudeignore file:', error);
      }
    }
  }

  /**
   * 将 gitignore 格式的规则转换为 glob 格式
   */
  private _convertToGlobPattern(pattern: string): string {
    // 如果以 / 开头，表示从根目录开始
    if (pattern.startsWith('/')) {
      return pattern.substring(1);
    }

    // 如果不包含 /，表示匹配任何目录下的文件
    if (!pattern.includes('/')) {
      return `**/${pattern}`;
    }

    // 如果以 / 结尾，表示目录
    if (pattern.endsWith('/')) {
      return `${pattern}**`;
    }

    return pattern;
  }

  /**
   * 检查文件是否应该被忽略
   */
  private _shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.workspaceRoot, filePath);

    for (const pattern of this.ignorePatterns) {
      // 使用简单的通配符匹配
      if (this._matchPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 简单的通配符匹配
   */
  private _matchPattern(filePath: string, pattern: string): boolean {
    // 将 glob 模式转换为正则表达式
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // 转义 .
      .replace(/\*\*/g, '.*')  // ** 匹配任意路径
      .replace(/\*/g, '[^/]*')  // * 匹配除 / 外的任意字符
      .replace(/\?/g, '.');     // ? 匹配单个字符

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * 查找与任务相关的文件
   *
   * @param task 任务描述符
   * @returns 相关文件路径列表
   */
  async findRelatedFiles(task: TaskDescriptor): Promise<string[]> {
    // 如果任务已经指定了相关文件，使用这些文件
    if (task.relatedFiles && task.relatedFiles.length > 0) {
      return task.relatedFiles.filter(file => {
        const fullPath = path.join(this.workspaceRoot, file);
        return fs.existsSync(fullPath) && !this._shouldIgnore(fullPath);
      });
    }

    // 否则，根据任务类型和描述查找相关文件
    return this._findFilesByTaskContext(task);
  }

  /**
   * 根据任务上下文查找相关文件
   */
  private async _findFilesByTaskContext(task: TaskDescriptor): Promise<string[]> {
    const patterns: string[] = [];

    // 根据任务类型添加搜索模式
    switch (task.type) {
      case 'requirements':
      case 'design':
      case 'tasks':
        // 对于文档类任务，查找 .claude 目录下的相关文件
        patterns.push('.claude/**/*.md');
        break;

      case 'implementation':
      case 'debug':
        // 对于实现和调试任务，查找源代码文件
        patterns.push('src/**/*.ts', 'src/**/*.js');
        break;

      case 'review':
        // 对于 review 任务，查找所有相关文件
        patterns.push('src/**/*.ts', 'src/**/*.js', '.claude/**/*.md');
        break;

      default:
        // 默认查找所有源代码文件
        patterns.push('src/**/*.ts', 'src/**/*.js');
    }

    const files: string[] = [];

    for (const pattern of patterns) {
      try {
        // 创建排除模式
        const exclude = `{${this.ignorePatterns.join(',')}}`;

        const uris = await vscode.workspace.findFiles(pattern, exclude);

        for (const uri of uris) {
          const filePath = uri.fsPath;
          if (!this._shouldIgnore(filePath)) {
            files.push(filePath);
          }
        }
      } catch (error) {
        console.warn(`Failed to find files with pattern ${pattern}:`, error);
      }
    }

    return [...new Set(files)]; // 去重
  }

  /**
   * 构建依赖图
   *
   * @param files 文件路径列表
   * @returns 依赖图
   */
  async buildDependencyGraph(files: string[]): Promise<DependencyGraph> {
    const nodes: DependencyGraph['nodes'] = [];
    const edges: DependencyGraph['edges'] = [];
    const processedFiles = new Set<string>();

    for (const file of files) {
      if (processedFiles.has(file)) {
        continue;
      }
      processedFiles.add(file);

      // 添加节点
      nodes.push({
        id: file,
        path: file,
        type: 'source'
      });

      // 分析文件的依赖关系
      const dependencies = await this._extractDependencies(file);

      for (const dep of dependencies) {
        // 添加边
        edges.push({
          from: file,
          to: dep.path,
          type: dep.importType
        });

        // 如果是外部依赖，添加外部节点
        if (dep.isExternal) {
          if (!processedFiles.has(dep.path)) {
            nodes.push({
              id: dep.path,
              path: dep.path,
              type: 'external'
            });
            processedFiles.add(dep.path);
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 提取文件的依赖关系
   */
  private async _extractDependencies(file: string): Promise<Array<{
    path: string;
    importType: 'import' | 'require' | 'dynamic';
    isExternal: boolean;
  }>> {
    const dependencies: Array<{
      path: string;
      importType: 'import' | 'require' | 'dynamic';
      isExternal: boolean;
    }> = [];

    try {
      const content = fs.readFileSync(file, 'utf-8');

      // 匹配 ES6 import 语句
      const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolved = this._resolveImportPath(file, importPath);
        if (resolved) {
          dependencies.push(resolved);
        }
      }

      // 匹配 CommonJS require 语句
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

      while ((match = requireRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolved = this._resolveImportPath(file, importPath);
        if (resolved) {
          dependencies.push({
            ...resolved,
            importType: 'require'
          });
        }
      }

      // 匹配动态 import
      const dynamicImportRegex = /import\s*\(['"]([^'"]+)['"]\)/g;

      while ((match = dynamicImportRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolved = this._resolveImportPath(file, importPath);
        if (resolved) {
          dependencies.push({
            ...resolved,
            importType: 'dynamic'
          });
        }
      }

    } catch (error) {
      console.warn(`Failed to extract dependencies from ${file}:`, error);
    }

    return dependencies;
  }

  /**
   * 解析 import 路径
   */
  private _resolveImportPath(
    fromFile: string,
    importPath: string
  ): {
    path: string;
    importType: 'import' | 'require' | 'dynamic';
    isExternal: boolean;
  } | null {
    // 判断是否是外部依赖（node_modules 或内置模块）
    const isExternal = !importPath.startsWith('.') && !importPath.startsWith('/');

    if (isExternal) {
      return {
        path: importPath,
        importType: 'import',
        isExternal: true
      };
    }

    // 解析相对路径
    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importPath);

    // 尝试添加常见的文件扩展名
    const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];

    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        return {
          path: testPath,
          importType: 'import',
          isExternal: false
        };
      }
    }

    // 尝试作为目录 + index 文件
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return {
          path: indexPath,
          importType: 'import',
          isExternal: false
        };
      }
    }

    return null;
  }

  /**
   * 扫描工作空间
   *
   * @returns 代码库快照
   */
  async scanWorkspace(): Promise<CodebaseSnapshot> {
    const startTime = Date.now();

    // 查找所有相关文件
    const patterns = ['src/**/*.ts', 'src/**/*.js', '.claude/**/*.md'];
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const exclude = `{${this.ignorePatterns.join(',')}}`;
        const uris = await vscode.workspace.findFiles(pattern, exclude);

        for (const uri of uris) {
          const filePath = uri.fsPath;
          if (!this._shouldIgnore(filePath)) {
            allFiles.push(filePath);
          }
        }
      } catch (error) {
        console.warn(`Failed to find files with pattern ${pattern}:`, error);
      }
    }

    // 去重
    const uniqueFiles = [...new Set(allFiles)];

    // 构建依赖图
    const dependencyGraph = await this.buildDependencyGraph(uniqueFiles);

    // 提取外部依赖
    const externalDependencies = dependencyGraph.nodes
      .filter(node => node.type === 'external')
      .map(node => node.path);

    // 检测循环依赖
    const circularDependencies = this._detectCircularDependencies(dependencyGraph);

    const snapshot: CodebaseSnapshot = {
      timestamp: new Date(),
      files: uniqueFiles,
      dependencyGraph,
      externalDependencies,
      circularDependencies
    };

    const duration = Date.now() - startTime;
    console.log(`Workspace scan completed in ${duration}ms. Found ${uniqueFiles.length} files.`);

    return snapshot;
  }

  /**
   * 检测循环依赖
   */
  private _detectCircularDependencies(graph: DependencyGraph): Array<{
    files: string[];
    description: string;
  }> {
    const circularDeps: Array<{
      files: string[];
      description: string;
    }> = [];

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // DFS 检测循环
    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // 查找当前节点的所有出边
      const outEdges = graph.edges.filter(edge => edge.from === nodeId);

      for (const edge of outEdges) {
        const target = edge.to;

        if (!visited.has(target)) {
          dfs(target, [...path]);
        } else if (recursionStack.has(target)) {
          // 发现循环依赖
          const cycleStartIndex = path.indexOf(target);
          const cycle = path.slice(cycleStartIndex);
          cycle.push(target); // 闭合循环

          circularDeps.push({
            files: cycle,
            description: `Circular dependency: ${cycle.join(' -> ')}`
          });
        }
      }

      recursionStack.delete(nodeId);
    };

    // 对所有源文件节点执行 DFS
    for (const node of graph.nodes) {
      if (node.type === 'source' && !visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circularDeps;
  }

  /**
   * 重新加载忽略规则（用于配置变更后）
   */
  reloadIgnorePatterns(): void {
    this._loadIgnorePatterns();
  }

  /**
   * 获取当前的忽略模式列表
   */
  getIgnorePatterns(): string[] {
    return [...this.ignorePatterns];
  }

  /**
   * 获取工作空间根目录
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * 分析TypeScript文件的AST指标
   *
   * @param filePath 文件路径
   * @returns AST分析指标
   */
  async analyzeTypeScriptFile(filePath: string): Promise<ASTMetrics> {
    // 检查缓存
    const cached = this._getCachedAnalysis(filePath);
    if (cached) {
      return cached;
    }

    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');

    // 创建源文件AST
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // 计算各项指标
    const cyclomaticComplexity = this._calculateCyclomaticComplexity(sourceFile);
    const cognitiveComplexity = this._calculateCognitiveComplexity(sourceFile);
    const functionCallChain = this._extractFunctionCallChain(sourceFile);
    const externalDependencies = this._extractExternalDeps(sourceFile);
    const typeReferences = this._extractTypeReferences(sourceFile);

    const metrics: ASTMetrics = {
      cyclomaticComplexity,
      cognitiveComplexity,
      functionCallChain,
      externalDependencies,
      typeReferences
    };

    // 缓存结果
    this._cacheAnalysis(filePath, metrics);

    return metrics;
  }

  /**
   * 获取缓存的分析结果
   */
  private _getCachedAnalysis(filePath: string): ASTMetrics | null {
    const cached = this.fileCache.get(filePath);
    if (!cached) {
      return null;
    }

    // 检查文件是否修改
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs !== cached.mtime) {
      // 文件已修改，清除缓存
      this.fileCache.delete(filePath);
      return null;
    }

    // 检查缓存是否过期
    const age = Date.now() - cached.cachedAt.getTime();
    if (age > this.CACHE_TTL) {
      this.fileCache.delete(filePath);
      return null;
    }

    return cached.metrics;
  }

  /**
   * 缓存分析结果
   */
  private _cacheAnalysis(filePath: string, metrics: ASTMetrics): void {
    const stats = fs.statSync(filePath);
    this.fileCache.set(filePath, {
      filePath,
      mtime: stats.mtimeMs,
      metrics,
      cachedAt: new Date()
    });
  }

  /**
   * 计算圈复杂度（McCabe复杂度）
   *
   * 圈复杂度 = 决策点数量 + 1
   * 决策点包括：if, while, for, case, catch, &&, ||, ?:
   */
  private _calculateCyclomaticComplexity(sourceFile: ts.SourceFile): number {
    let complexity = 1; // 基础复杂度

    const visit = (node: ts.Node) => {
      // 条件语句
      if (ts.isIfStatement(node)) {
        complexity++;
      }

      // 循环语句
      if (ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
        complexity++;
      }

      // switch case
      if (ts.isCaseClause(node)) {
        complexity++;
      }

      // catch
      if (ts.isCatchClause(node)) {
        complexity++;
      }

      // 条件表达式
      if (ts.isConditionalExpression(node)) {
        complexity++;
      }

      // 逻辑运算符
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
          complexity++;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return complexity;
  }

  /**
   * 计算认知复杂度
   *
   * 认知复杂度考虑嵌套深度和控制流的复杂性
   * 更符合人类理解代码的难度
   */
  private _calculateCognitiveComplexity(sourceFile: ts.SourceFile): number {
    let complexity = 0;
    let nestingLevel = 0;

    const visit = (node: ts.Node, isNested: boolean = false) => {
      let increaseNesting = false;

      // 条件语句（嵌套时增加复杂度）
      if (ts.isIfStatement(node)) {
        complexity += 1 + nestingLevel;
        increaseNesting = true;
      }

      // 循环语句（嵌套时增加复杂度）
      if (ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
        complexity += 1 + nestingLevel;
        increaseNesting = true;
      }

      // switch语句
      if (ts.isSwitchStatement(node)) {
        complexity += 1 + nestingLevel;
        increaseNesting = true;
      }

      // catch块
      if (ts.isCatchClause(node)) {
        complexity += 1 + nestingLevel;
        increaseNesting = true;
      }

      // 三元运算符
      if (ts.isConditionalExpression(node)) {
        complexity += 1 + nestingLevel;
      }

      // 逻辑运算符（连续的不增加）
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
          // 检查父节点是否也是同样的逻辑运算符
          const parent = node.parent;
          if (!ts.isBinaryExpression(parent) || parent.operatorToken.kind !== operator) {
            complexity += 1;
          }
        }
      }

      // 递归调用增加复杂度
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression)) {
          // 检查是否是递归调用
          const functionName = this._getFunctionName(node);
          if (functionName && expression.text === functionName) {
            complexity += 1 + nestingLevel;
          }
        }
      }

      // 如果需要增加嵌套级别
      if (increaseNesting) {
        nestingLevel++;
        ts.forEachChild(node, child => visit(child, true));
        nestingLevel--;
      } else {
        ts.forEachChild(node, child => visit(child, isNested));
      }
    };

    visit(sourceFile);

    return complexity;
  }

  /**
   * 获取当前节点所在的函数名
   */
  private _getFunctionName(node: ts.Node): string | null {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) {
        return current.name.text;
      }
      if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
        return current.name.text;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 提取函数调用链
   */
  private _extractFunctionCallChain(sourceFile: ts.SourceFile): string[] {
    const callChain: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        // 简单函数调用
        if (ts.isIdentifier(expression)) {
          callChain.push(expression.text);
        }

        // 属性访问调用 (e.g., obj.method())
        if (ts.isPropertyAccessExpression(expression)) {
          const chain = this._buildPropertyChain(expression);
          callChain.push(chain);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return [...new Set(callChain)]; // 去重
  }

  /**
   * 构建属性调用链
   */
  private _buildPropertyChain(expression: ts.PropertyAccessExpression): string {
    const parts: string[] = [];

    let current: ts.Expression = expression;
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }

    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
    }

    return parts.join('.');
  }

  /**
   * 提取外部依赖（使用TypeScript AST）
   */
  private _extractExternalDeps(sourceFile: ts.SourceFile): string[] {
    const externalDeps: string[] = [];

    const visit = (node: ts.Node) => {
      // import 语句
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = moduleSpecifier.text;
          // 外部依赖（不以 . 或 / 开头）
          if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            externalDeps.push(importPath);
          }
        }
      }

      // require 语句
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression) && expression.text === 'require') {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            const importPath = arg.text;
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
              externalDeps.push(importPath);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return [...new Set(externalDeps)]; // 去重
  }

  /**
   * 提取类型引用
   */
  private _extractTypeReferences(sourceFile: ts.SourceFile): string[] {
    const typeRefs: string[] = [];

    const visit = (node: ts.Node) => {
      // 类型引用
      if (ts.isTypeReferenceNode(node)) {
        const typeName = node.typeName;
        if (ts.isIdentifier(typeName)) {
          typeRefs.push(typeName.text);
        } else if (ts.isQualifiedName(typeName)) {
          typeRefs.push(this._getQualifiedName(typeName));
        }
      }

      // 接口声明
      if (ts.isInterfaceDeclaration(node) && node.name) {
        typeRefs.push(node.name.text);
      }

      // 类型别名
      if (ts.isTypeAliasDeclaration(node) && node.name) {
        typeRefs.push(node.name.text);
      }

      // 类声明
      if (ts.isClassDeclaration(node) && node.name) {
        typeRefs.push(node.name.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return [...new Set(typeRefs)]; // 去重
  }

  /**
   * 获取限定名称
   */
  private _getQualifiedName(name: ts.QualifiedName): string {
    const parts: string[] = [];

    let current: ts.EntityName = name;
    while (ts.isQualifiedName(current)) {
      parts.unshift(current.right.text);
      current = current.left;
    }

    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
    }

    return parts.join('.');
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * 清除特定文件的缓存
   */
  clearFileCache(filePath: string): void {
    this.fileCache.delete(filePath);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; files: string[] } {
    return {
      size: this.fileCache.size,
      files: Array.from(this.fileCache.keys())
    };
  }
}
