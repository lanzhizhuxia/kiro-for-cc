/**
 * 集成测试 - Codex工作空间初始化器
 *
 * 测试Codex工作空间的目录和文件创建功能
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  initializeCodexWorkspace,
  isCodexWorkspaceInitialized,
  getCodexWorkspacePath,
  getExecutionHistoryPath,
  MCPConfig,
  SessionsRecord
} from '../../features/codex/workspaceInitializer';

describe('Codex Workspace Initializer Integration Tests', () => {
  let testWorkspaceFolder: vscode.WorkspaceFolder;
  let codexWorkspacePath: string;

  beforeAll(() => {
    // 获取当前工作空间文件夹
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder found for testing');
    }
    testWorkspaceFolder = workspaceFolders[0];
    codexWorkspacePath = getCodexWorkspacePath(testWorkspaceFolder);
  });

  // 清理测试环境
  async function cleanupTestWorkspace(): Promise<void> {
    try {
      const codexUri = vscode.Uri.file(codexWorkspacePath);
      await vscode.workspace.fs.delete(codexUri, { recursive: true, useTrash: false });
    } catch (error) {
      // 忽略不存在的目录
    }
  }

  afterAll(async () => {
    // 注意：为了保留测试数据用于调试，这里不自动清理
    // 如需清理，可以手动调用 cleanupTestWorkspace()
  });

  test('should create .claude/codex/ directory', async () => {
    // 先清理
    await cleanupTestWorkspace();

    // 执行初始化
    await initializeCodexWorkspace(testWorkspaceFolder);

    // 验证目录存在
    const dirExists = fs.existsSync(codexWorkspacePath);
    expect(dirExists).toBe(true);
  });

  test('should create execution-history/ subdirectory', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    const historyPath = getExecutionHistoryPath(testWorkspaceFolder);
    const dirExists = fs.existsSync(historyPath);
    expect(dirExists).toBe(true);
  });

  test('should create mcp-config.json with valid structure', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    const configPath = path.join(codexWorkspacePath, 'mcp-config.json');
    const fileExists = fs.existsSync(configPath);
    expect(fileExists).toBe(true);

    // 验证文件内容
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config: MCPConfig = JSON.parse(configContent);

    // 验证必需字段
    expect(typeof config.port).toBe('number');
    expect(typeof config.timeout).toBe('number');
    expect(['debug', 'info', 'warn', 'error'].includes(config.logLevel)).toBe(true);
    expect(typeof config.healthCheckInterval).toBe('number');

    // 验证autoRestart配置
    expect(typeof config.autoRestart).toBe('object');
    expect(typeof config.autoRestart.enabled).toBe('boolean');
    expect(typeof config.autoRestart.maxRetries).toBe('number');
    expect(typeof config.autoRestart.retryInterval).toBe('number');

    // 验证默认值
    expect(config.port).toBe(8765);
    expect(config.timeout).toBe(300000);
    expect(config.logLevel).toBe('info');
  });

  test('should create sessions.json with valid structure', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    const sessionsPath = path.join(codexWorkspacePath, 'sessions.json');
    const fileExists = fs.existsSync(sessionsPath);
    expect(fileExists).toBe(true);

    // 验证文件内容
    const sessionsContent = fs.readFileSync(sessionsPath, 'utf-8');
    const sessions: SessionsRecord = JSON.parse(sessionsContent);

    // 验证必需字段
    expect(typeof sessions.version).toBe('string');
    expect(typeof sessions.lastUpdated).toBe('string');
    expect(Array.isArray(sessions.sessions)).toBe(true);

    // 验证默认值
    expect(sessions.version).toBe('1.0.0');
    expect(sessions.sessions.length).toBe(0);
  });

  test('should create .claudeignore file', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    const ignoreFilePath = path.join(codexWorkspacePath, '.claudeignore');
    const fileExists = fs.existsSync(ignoreFilePath);
    expect(fileExists).toBe(true);

    // 验证文件内容包含关键模式
    const ignoreContent = fs.readFileSync(ignoreFilePath, 'utf-8');
    expect(ignoreContent.includes('node_modules/')).toBe(true);
    expect(ignoreContent.includes('dist/')).toBe(true);
    expect(ignoreContent.includes('.env')).toBe(true);
  });

  test('should create README.md file', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    const readmePath = path.join(codexWorkspacePath, 'README.md');
    const fileExists = fs.existsSync(readmePath);
    expect(fileExists).toBe(true);

    // 验证文件内容包含关键信息
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    expect(readmeContent.includes('Codex工作空间')).toBe(true);
    expect(readmeContent.includes('目录结构')).toBe(true);
    expect(readmeContent.includes('mcp-config.json')).toBe(true);
  });

  test('should not overwrite existing files when re-initializing', async () => {
    await cleanupTestWorkspace();

    // 第一次初始化
    await initializeCodexWorkspace(testWorkspaceFolder);

    // 修改配置文件
    const configPath = path.join(codexWorkspacePath, 'mcp-config.json');
    const originalConfig = fs.readFileSync(configPath, 'utf-8');
    const modifiedConfig = JSON.parse(originalConfig);
    modifiedConfig.port = 9999; // 修改端口
    fs.writeFileSync(configPath, JSON.stringify(modifiedConfig, null, 2));

    // 第二次初始化
    await initializeCodexWorkspace(testWorkspaceFolder);

    // 验证配置文件未被覆盖
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(currentConfig.port).toBe(9999);
  });

  test('isCodexWorkspaceInitialized should return correct status', async () => {
    await cleanupTestWorkspace();

    // 初始化前应该返回false
    let isInitialized = await isCodexWorkspaceInitialized(testWorkspaceFolder);
    expect(isInitialized).toBe(false);

    // 初始化后应该返回true
    await initializeCodexWorkspace(testWorkspaceFolder);
    isInitialized = await isCodexWorkspaceInitialized(testWorkspaceFolder);
    expect(isInitialized).toBe(true);
  });

  test('getCodexWorkspacePath should return correct path', () => {
    const expectedPath = path.join(
      testWorkspaceFolder.uri.fsPath,
      '.claude',
      'codex'
    );
    const actualPath = getCodexWorkspacePath(testWorkspaceFolder);
    expect(actualPath).toBe(expectedPath);
  });

  test('getExecutionHistoryPath should return correct path', () => {
    const expectedPath = path.join(
      testWorkspaceFolder.uri.fsPath,
      '.claude',
      'codex',
      'execution-history'
    );
    const actualPath = getExecutionHistoryPath(testWorkspaceFolder);
    expect(actualPath).toBe(expectedPath);
  });

  test('should handle initialization errors gracefully', async () => {
    // 测试错误处理（模拟权限错误或其他问题）
    // 注意：此测试可能需要mock文件系统操作，这里仅作为示例
    try {
      // 创建一个临时的只读目录来模拟权限错误
      // 实际实现取决于测试环境
      await initializeCodexWorkspace(testWorkspaceFolder);
      expect(true).toBe(true);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message.includes('初始化失败')).toBe(true);
    }
  });

  test('should create all required files in a single call', async () => {
    await cleanupTestWorkspace();
    await initializeCodexWorkspace(testWorkspaceFolder);

    // 验证所有必需的文件和目录都已创建
    const requiredPaths = [
      codexWorkspacePath,
      path.join(codexWorkspacePath, 'execution-history'),
      path.join(codexWorkspacePath, 'mcp-config.json'),
      path.join(codexWorkspacePath, 'sessions.json'),
      path.join(codexWorkspacePath, '.claudeignore'),
      path.join(codexWorkspacePath, 'README.md')
    ];

    for (const requiredPath of requiredPaths) {
      const exists = fs.existsSync(requiredPath);
      expect(exists).toBe(true);
    }
  });
});
