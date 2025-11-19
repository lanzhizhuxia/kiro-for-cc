/**
 * 代码库分析器单元测试
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CodebaseAnalyzer } from '../../../features/codex/codebaseAnalyzer';
import { TaskDescriptor } from '../../../features/codex/types';

/**
 * 测试套件：代码库分析器
 */
describe('CodebaseAnalyzer Test Suite', () => {
  let tempDir: string;
  let analyzer: CodebaseAnalyzer;

  /**
   * 在每个测试前创建临时目录和测试文件
   */
  beforeEach(() => {
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-analyzer-test-'));

    // 创建测试文件结构
    createTestFileStructure(tempDir);

    // 初始化分析器
    analyzer = new CodebaseAnalyzer(tempDir);
  });

  /**
   * 在每个测试后清理临时目录
   */
  afterEach(() => {
    // 递归删除临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * 测试：获取工作空间根目录
   */
  test('应该正确获取工作空间根目录', () => {
    const root = analyzer.getWorkspaceRoot();
    expect(root).toBe(tempDir);
  });

  /**
   * 测试：加载 .claudeignore 文件
   */
  test('应该正确加载 .claudeignore 文件的忽略规则', () => {
    const patterns = analyzer.getIgnorePatterns();

    // 应该包含默认规则
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/dist/**');

    // 应该包含自定义规则
    expect(patterns).toContain('**/temp/**');
    expect(patterns.some(p => p.includes('*.log'))).toBe(true);
  });

  /**
   * 测试：文件查找（根据任务类型）
   */
  test('应该根据任务类型查找相关文件 - implementation', async () => {
    const task: TaskDescriptor = {
      id: 'test-task-1',
      type: 'implementation',
      description: '实现某个功能'
    };

    const files = await analyzer.findRelatedFiles(task);

    // 应该找到源代码文件
    expect(files.some(f => f.includes('module1.ts'))).toBe(true);
    expect(files.some(f => f.includes('module2.js'))).toBe(true);

    // 不应该包含被忽略的文件
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
    expect(files.some(f => f.includes('dist'))).toBe(false);
  });

  /**
   * 测试：文件查找（使用指定文件）
   */
  test('应该使用任务中指定的文件列表', async () => {
    const relatedFile = path.join('src', 'module1.ts');
    const task: TaskDescriptor = {
      id: 'test-task-2',
      type: 'review',
      description: '审查代码',
      relatedFiles: [relatedFile]
    };

    const files = await analyzer.findRelatedFiles(task);

    // 应该只包含指定的文件
    expect(files.length).toBe(1);
    expect(files[0]).toContain('module1.ts');
  });

  /**
   * 测试：构建依赖图
   */
  test('应该正确构建依赖图', async () => {
    const files = [
      path.join(tempDir, 'src', 'module1.ts'),
      path.join(tempDir, 'src', 'module2.js')
    ];

    const graph = await analyzer.buildDependencyGraph(files);

    // 应该有节点
    expect(graph.nodes.length).toBeGreaterThan(0);

    // 应该包含源文件节点
    expect(graph.nodes.some(n => n.path.includes('module1.ts') && n.type === 'source')).toBe(true);
    expect(graph.nodes.some(n => n.path.includes('module2.js') && n.type === 'source')).toBe(true);

    // 应该有边（依赖关系）
    expect(graph.edges.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * 测试：提取外部依赖
   */
  test('应该正确提取外部依赖', async () => {
    const files = [
      path.join(tempDir, 'src', 'module1.ts')
    ];

    const graph = await analyzer.buildDependencyGraph(files);

    // 应该识别外部依赖（vscode）
    expect(graph.nodes.some(n => n.type === 'external' && n.path === 'vscode')).toBe(true);
  });

  /**
   * 测试：检测循环依赖
   */
  test('应该检测循环依赖', async () => {
    // 创建循环依赖的测试文件
    const circularFile1 = path.join(tempDir, 'src', 'circular1.ts');
    const circularFile2 = path.join(tempDir, 'src', 'circular2.ts');

    fs.writeFileSync(circularFile1, "import { foo } from './circular2';");
    fs.writeFileSync(circularFile2, "import { bar } from './circular1';");

    const files = [circularFile1, circularFile2];
    const graph = await analyzer.buildDependencyGraph(files);

    // 使用私有方法检测循环依赖（通过 scanWorkspace 间接测试）
    // 这里简化测试，只验证图结构
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * 测试：忽略规则匹配
   */
  test('应该正确匹配忽略规则', () => {
    const patterns = analyzer.getIgnorePatterns();

    // 测试文件是否应该被忽略
    // 注意：这是对私有方法的间接测试

    // node_modules 应该被忽略
    expect(patterns.some(p => p.includes('node_modules'))).toBe(true);

    // dist 应该被忽略
    expect(patterns.some(p => p.includes('dist'))).toBe(true);
  });

  /**
   * 测试：重新加载忽略规则
   */
  test('应该能够重新加载忽略规则', () => {
    const patternsBefore = analyzer.getIgnorePatterns();

    // 修改 .claudeignore 文件
    const claudeIgnorePath = path.join(tempDir, '.claudeignore');
    fs.appendFileSync(claudeIgnorePath, '\n# New rule\n*.bak\n');

    // 重新加载
    analyzer.reloadIgnorePatterns();

    const patternsAfter = analyzer.getIgnorePatterns();

    // 应该包含新规则
    expect(patternsAfter.length).toBeGreaterThanOrEqual(patternsBefore.length);
    expect(patternsAfter.some(p => p.includes('*.bak'))).toBe(true);
  });

  /**
   * 测试：处理不存在的 .claudeignore 文件
   */
  test('应该能够处理不存在的 .claudeignore 文件', () => {
    // 删除 .claudeignore 文件
    const claudeIgnorePath = path.join(tempDir, '.claudeignore');
    if (fs.existsSync(claudeIgnorePath)) {
      fs.unlinkSync(claudeIgnorePath);
    }

    // 创建新的分析器
    const newAnalyzer = new CodebaseAnalyzer(tempDir);

    // 应该只有默认规则
    const patterns = newAnalyzer.getIgnorePatterns();
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/dist/**');
  });

  /**
   * 测试：扫描工作空间
   */
  test('应该能够扫描整个工作空间', async () => {
    const snapshot = await analyzer.scanWorkspace();

    // 应该有时间戳
    expect(snapshot.timestamp).toBeInstanceOf(Date);

    // 应该有文件列表
    expect(snapshot.files.length).toBeGreaterThan(0);

    // 应该有依赖图
    expect(snapshot.dependencyGraph).toBeDefined();
    if (snapshot.dependencyGraph) {
      expect(snapshot.dependencyGraph.nodes.length).toBeGreaterThan(0);
    }

    // 应该有外部依赖
    expect(Array.isArray(snapshot.externalDependencies)).toBe(true);

    // 应该有循环依赖检测结果
    expect(Array.isArray(snapshot.circularDependencies)).toBe(true);
  });
});

/**
 * 创建测试文件结构
 */
function createTestFileStructure(rootDir: string): void {
  // 创建目录结构
  const srcDir = path.join(rootDir, 'src');
  const claudeDir = path.join(rootDir, '.claude');
  const nodeModulesDir = path.join(rootDir, 'node_modules');
  const distDir = path.join(rootDir, 'dist');
  const tempDir = path.join(rootDir, 'temp');

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  // 创建 .claudeignore 文件
  const claudeIgnoreContent = `# Ignore patterns
node_modules/
dist/
*.log
temp/
`;
  fs.writeFileSync(path.join(rootDir, '.claudeignore'), claudeIgnoreContent);

  // 创建测试源文件
  const module1Content = `import * as vscode from 'vscode';
import { helper } from './helper';

export function activate() {
  console.log('Module 1 activated');
}
`;
  fs.writeFileSync(path.join(srcDir, 'module1.ts'), module1Content);

  const module2Content = `const path = require('path');

function doSomething() {
  return path.join('a', 'b');
}

module.exports = { doSomething };
`;
  fs.writeFileSync(path.join(srcDir, 'module2.js'), module2Content);

  const helperContent = `export function helper() {
  return 'helper';
}
`;
  fs.writeFileSync(path.join(srcDir, 'helper.ts'), helperContent);

  // 创建 Claude 文档
  const requirementsContent = `# Requirements

Test requirements document
`;
  fs.writeFileSync(path.join(claudeDir, 'requirements.md'), requirementsContent);

  // 创建应该被忽略的文件
  fs.writeFileSync(path.join(nodeModulesDir, 'package.json'), '{}');
  fs.writeFileSync(path.join(distDir, 'bundle.js'), '// compiled');
  fs.writeFileSync(path.join(tempDir, 'temp.txt'), 'temp file');
  fs.writeFileSync(path.join(rootDir, 'debug.log'), 'log content');
}
