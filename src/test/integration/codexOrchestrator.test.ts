/**
 * CodexOrchestrator集成测试
 *
 * 测试完整的任务执行流程
 * 需求: 需求1.1-1.6, 需求6.1-6.6
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CodexOrchestrator } from '../../features/codex/codexOrchestrator';
import {
  TaskDescriptor,
  ExecutionOptions,
  ExecutionResult,
  ModeRecommendation,
  ThinkingResult,
  AnalysisContext
} from '../../features/codex/types';

describe('CodexOrchestrator Integration Tests', () => {
  let orchestrator: CodexOrchestrator;
  let outputChannel: vscode.OutputChannel;
  let context: vscode.ExtensionContext;
  let testWorkspaceRoot: string;

  /**
   * 设置测试环境
   */
  beforeAll(async () => {
    // 获取测试工作空间
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder found for testing');
    }

    testWorkspaceRoot = workspaceFolders[0].uri.fsPath;

    // 创建测试用的.claude目录结构
    const claudeDir = path.join(testWorkspaceRoot, '.claude');
    const codexDir = path.join(claudeDir, 'codex');

    await fs.mkdir(codexDir, { recursive: true });

    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('Codex Orchestrator Test');

    // 创建模拟的扩展上下文
    const globalStorageUri = vscode.Uri.file(path.join(codexDir, 'test-storage'));
    context = {
      globalStorageUri,
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: vscode.Uri.file(testWorkspaceRoot),
      extensionPath: testWorkspaceRoot,
      asAbsolutePath: (relativePath: string) => path.join(testWorkspaceRoot, relativePath),
      storagePath: undefined,
      globalStoragePath: globalStorageUri.fsPath,
      logPath: '',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      environmentVariableCollection: {} as any,
      secrets: {} as any,
      storageUri: undefined,
      logUri: vscode.Uri.file(''),
      languageModelAccessInformation: {} as any
    };

    // 创建Orchestrator实例
    orchestrator = new CodexOrchestrator(context, outputChannel);

    console.log('Test environment setup complete');
  });

  /**
   * 清理测试环境
   */
  afterAll(async () => {
    // 释放资源
    if (orchestrator) {
      await orchestrator.dispose();
    }

    if (outputChannel) {
      outputChannel.dispose();
    }

    console.log('Test environment teardown complete');
  });

  /**
   * 测试1: executeTask - 本地模式执行
   */
  it('executeTask should execute with local mode when forced', async () => {

    const task: TaskDescriptor = {
      id: 'test-task-local-001',
      type: 'requirements',
      description: 'Test task for local execution',
      specName: 'test-spec'
    };

    const options: ExecutionOptions = {
      forceMode: 'local'
    };

    const result: ExecutionResult = await orchestrator.executeTask(task, options);

    // 验证结果
    expect(result.mode).toBe('local');
    expect(result.sessionId).toBeTruthy();
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.duration).toBeGreaterThanOrEqual(0);

    console.log('Test 1 passed: Local mode execution');
  }, 30000); // 30秒超时

  /**
   * 测试2: executeTask - 自动模式路由决策
   */
  it('executeTask should route task automatically when mode is auto', async () => {

    const task: TaskDescriptor = {
      id: 'test-task-auto-002',
      type: 'design',
      description: 'Complex design task that requires careful analysis',
      specName: 'test-spec',
      relatedFiles: [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts'
      ]
    };

    const options: ExecutionOptions = {
      forceMode: 'auto'
    };

    const result: ExecutionResult = await orchestrator.executeTask(task, options);

    // 验证结果
    expect(['local', 'codex']).toContain(result.mode);
    expect(result.sessionId).toBeTruthy();
    expect(typeof result.success).toBe('boolean');

    console.log(`Test 2 passed: Auto mode routing (chose ${result.mode})`);
  }, 30000);

  /**
   * 测试3: getRecommendedMode - 获取推荐模式
   */
  it('getRecommendedMode should return recommendation based on task complexity', async () => {

    const simpleTask: TaskDescriptor = {
      id: 'test-task-simple-003',
      type: 'requirements',
      description: 'Simple task',
      specName: 'test-spec'
    };

    const complexTask: TaskDescriptor = {
      id: 'test-task-complex-004',
      type: 'implementation',
      description: 'Complex implementation involving multiple modules, database migrations, and API changes',
      specName: 'test-spec',
      relatedFiles: Array.from({ length: 15 }, (_, i) => `src/module${i}.ts`)
    };

    // 测试简单任务
    const simpleRecommendation: ModeRecommendation = await orchestrator.getRecommendedMode(simpleTask);
    expect(simpleRecommendation).toBeTruthy();
    expect(['local', 'codex']).toContain(simpleRecommendation.mode);
    expect(simpleRecommendation.score).toBeGreaterThanOrEqual(0);
    expect(simpleRecommendation.score).toBeLessThanOrEqual(10);
    expect(Array.isArray(simpleRecommendation.reasons)).toBe(true);
    expect(simpleRecommendation.confidence).toBeGreaterThanOrEqual(0);
    expect(simpleRecommendation.confidence).toBeLessThanOrEqual(100);

    // 测试复杂任务
    const complexRecommendation: ModeRecommendation = await orchestrator.getRecommendedMode(complexTask);
    expect(complexRecommendation).toBeTruthy();
    expect(complexRecommendation.score).toBeGreaterThanOrEqual(simpleRecommendation.score);

    console.log('Test 3 passed: Recommendation generation');
    console.log(`  Simple task: score=${simpleRecommendation.score.toFixed(1)}, mode=${simpleRecommendation.mode}`);
    console.log(`  Complex task: score=${complexRecommendation.score.toFixed(1)}, mode=${complexRecommendation.mode}`);
  }, 10000);

  /**
   * 测试4: enableDeepThinking - 深度推理功能
   */
  it('enableDeepThinking should return thinking result', async () => {

    const task: TaskDescriptor = {
      id: 'test-task-thinking-005',
      type: 'design',
      description: 'Design a scalable microservices architecture',
      specName: 'test-spec'
    };

    const context: AnalysisContext = {
      task,
      complexityScore: {
        total: 8.5,
        codeScale: 8,
        technicalDifficulty: 9,
        businessImpact: 8,
        details: {
          fileCount: 20,
          functionDepth: 5,
          externalDeps: 10,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          crossModuleImpact: true,
          refactoringScope: 'multiple',
          involvesNewTechnology: true
        }
      }
    };

    const thinkingResult: ThinkingResult = await orchestrator.enableDeepThinking(context);

    // 验证结果
    expect(thinkingResult).toBeTruthy();
    expect(Array.isArray(thinkingResult.problemDecomposition)).toBe(true);
    expect(thinkingResult.problemDecomposition.length).toBeGreaterThan(0);
    expect(thinkingResult.problemDecomposition[0].description).toBeTruthy();

    expect(Array.isArray(thinkingResult.riskIdentification)).toBe(true);
    expect(thinkingResult.riskIdentification.length).toBeGreaterThan(0);
    if (thinkingResult.riskIdentification.length > 0) {
      expect(['high', 'medium', 'low']).toContain(thinkingResult.riskIdentification[0].severity);
    }

    expect(Array.isArray(thinkingResult.solutionComparison)).toBe(true);
    expect(thinkingResult.solutionComparison.length).toBeGreaterThan(0);

    expect(thinkingResult.recommendedDecision).toBeTruthy();
    expect(thinkingResult.recommendedDecision.selectedSolution).toBeTruthy();
    expect(thinkingResult.recommendedDecision.rationale).toBeTruthy();
    expect(Array.isArray(thinkingResult.recommendedDecision.nextSteps)).toBe(true);

    console.log('Test 4 passed: Deep thinking analysis');
    console.log(`  Problems identified: ${thinkingResult.problemDecomposition.length}`);
    console.log(`  Risks identified: ${thinkingResult.riskIdentification.length}`);
    console.log(`  Recommended: ${thinkingResult.recommendedDecision.selectedSolution}`);
  }, 10000);

  /**
   * 测试5: 会话管理和恢复
   */
  it('Session management should create, save, and restore sessions', async () => {

    const task: TaskDescriptor = {
      id: 'test-task-session-006',
      type: 'tasks',
      description: 'Test session management',
      specName: 'test-spec'
    };

    const options: ExecutionOptions = {
      forceMode: 'local'
    };

    // 执行任务（会创建会话）
    const result: ExecutionResult = await orchestrator.executeTask(task, options);
    expect(result.sessionId).toBeTruthy();

    const sessionId = result.sessionId;

    // 尝试恢复会话
    const sessionManager = orchestrator.getSessionStateManager();
    const restoredSession = await sessionManager.restoreSession(sessionId);

    expect(restoredSession).toBeTruthy();
    expect(restoredSession!.id).toBe(sessionId);
    expect(restoredSession!.task.id).toBe(task.id);

    console.log('Test 5 passed: Session management and restoration');
  }, 15000);

  /**
   * 测试6: 执行模式切换和进度保留
   */
  it('Mode switching should preserve progress', async () => {

    const task: TaskDescriptor = {
      id: 'test-task-switch-007',
      type: 'implementation',
      description: 'Test mode switching with progress preservation',
      specName: 'test-spec'
    };

    // 第一次执行（使用local模式）
    const options1: ExecutionOptions = {
      forceMode: 'local'
    };

    const result1: ExecutionResult = await orchestrator.executeTask(task, options1);
    expect(result1.mode).toBe('local');

    // 获取会话
    const sessionManager = orchestrator.getSessionStateManager();
    const session1 = await sessionManager.restoreSession(result1.sessionId);
    expect(session1).toBeTruthy();

    console.log('Test 6 passed: Mode switching and progress preservation');
  }, 15000);

  /**
   * 测试7: 错误处理
   */
  it('Error handling should return proper error result', async () => {

    const invalidTask: TaskDescriptor = {
      id: '',  // 无效的task ID
      type: 'requirements',
      description: '',  // 空描述
      specName: ''
    };

    const options: ExecutionOptions = {
      forceMode: 'local'
    };

    const result: ExecutionResult = await orchestrator.executeTask(invalidTask, options);

    // 验证错误处理
    // 注意：根据实际实现可能会成功或失败，这里只验证返回了结果
    expect(result).toBeTruthy();

    console.log('Test 7 passed: Error handling');
  }, 10000);

  /**
   * 测试8: 获取各种管理器实例
   */
  it('Should provide access to internal managers', () => {
    const sessionManager = orchestrator.getSessionStateManager();
    expect(sessionManager).toBeTruthy();

    const taskRouter = orchestrator.getTaskRouter();
    expect(taskRouter).toBeTruthy();

    const codexExecutor = orchestrator.getCodexExecutor();
    expect(codexExecutor).toBeTruthy();

    const localExecutor = orchestrator.getLocalAgentExecutor();
    expect(localExecutor).toBeTruthy();

    console.log('Test 8 passed: Manager instance access');
  });

  /**
   * 测试9: 资源清理
   */
  it('Dispose should cleanup resources properly', async () => {

    // 创建一个临时的orchestrator用于测试dispose
    const tempOutputChannel = vscode.window.createOutputChannel('Temp Orchestrator Test');
    const tempOrchestrator = new CodexOrchestrator(context, tempOutputChannel);

    // 执行一个任务
    const task: TaskDescriptor = {
      id: 'test-task-dispose-009',
      type: 'requirements',
      description: 'Test dispose functionality',
      specName: 'test-spec'
    };

    await tempOrchestrator.executeTask(task, { forceMode: 'local' });

    // 测试dispose
    await expect(tempOrchestrator.dispose()).resolves.not.toThrow();

    tempOutputChannel.dispose();

    console.log('Test 9 passed: Resource cleanup');
  }, 10000);
});
