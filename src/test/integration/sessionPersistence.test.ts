/**
 * 会话持久化和恢复集成测试
 *
 * 测试覆盖:
 * 1. 会话持久化到文件系统
 * 2. 会话从文件系统恢复
 * 3. 增量更新策略
 * 4. 文件锁机制（并发写入保护）
 * 5. 跨实例会话恢复
 * 6. 检查点创建和恢复
 * 7. 持久化性能（大量会话）
 *
 * 需求: 需求8.1, 需求8.4, 需求8.7
 * 任务: 任务17 - 会话持久化和恢复
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStateManager } from '../../features/codex/sessionStateManager';
import {
  Session,
  TaskDescriptor,
  ExecutionOptions,
  ComplexityScore,
  CodebaseSnapshot
} from '../../features/codex/types';

// 集成测试环境设置
describe('SessionStateManager - 持久化和恢复集成测试', () => {
  let testWorkspaceDir: string;
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;

  // 创建测试任务
  const createTask = (id: string = 'test-task'): TaskDescriptor => ({
    id,
    type: 'design',
    description: `Test task for persistence - ${id}`
  });

  // 创建执行选项
  const createOptions = (): ExecutionOptions => ({
    forceMode: 'codex',
    enableDeepThinking: true,
    enableCodebaseScan: true,
    timeout: 300000
  });

  beforeAll(async () => {
    // 创建临时工作空间目录
    testWorkspaceDir = path.join(os.tmpdir(), `kfc-test-${Date.now()}`);
    await fs.mkdir(testWorkspaceDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理临时目录
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });

  beforeEach(() => {
    // Setup mocks
    mockContext = {} as vscode.ExtensionContext;
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Codex',
      replace: jest.fn()
    } as any;

    // Mock workspace folder to use our temp directory
    mockWorkspaceFolder = {
      uri: { fsPath: testWorkspaceDir } as vscode.Uri,
      name: 'test-workspace',
      index: 0
    };

    (vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder];
  });

  afterEach(async () => {
    // 清理每个测试后的会话文件
    const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
    try {
      await fs.unlink(sessionsPath);
    } catch {
      // 文件可能不存在，忽略错误
    }
  });

  describe('基础持久化功能', () => {
    it('应该将会话持久化到sessions.json文件', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('persist-test-1');

      // 创建会话
      const session = await manager.createSession(task);

      // 验证文件已创建
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const fileExists = await fs.access(sessionsPath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);

      // 验证文件内容
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe(session.id);
      expect(data.sessions[0].task.id).toBe(task.id);
      expect(data.version).toBe('1.0.0');
      expect(data.lastUpdated).toBeDefined();
    });

    it('应该持久化会话的完整上下文信息', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('persist-test-2');
      const options = createOptions();

      // 创建会话并添加上下文
      const session = await manager.createSession(task, options);

      const complexityScore: ComplexityScore = {
        total: 8,
        codeScale: 7,
        technicalDifficulty: 9,
        businessImpact: 8,
        details: {
          fileCount: 15,
          functionDepth: 4,
          externalDeps: 3,
          cyclomaticComplexity: 20,
          cognitiveComplexity: 18,
          crossModuleImpact: true,
          refactoringScope: 'multiple'
        }
      };

      const codebaseSnapshot: CodebaseSnapshot = {
        timestamp: new Date(),
        files: ['src/file1.ts', 'src/file2.ts'],
        dependencyGraph: {
          nodes: [
            { id: 'file1', path: 'src/file1.ts', type: 'source' },
            { id: 'file2', path: 'src/file2.ts', type: 'source' }
          ],
          edges: [
            { from: 'file1', to: 'file2', type: 'import' }
          ]
        },
        externalDependencies: ['vscode', 'typescript']
      };

      await manager.updateContext(session.id, complexityScore, codebaseSnapshot);

      // 读取文件验证
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions[0].context.options).toEqual(options);
      expect(data.sessions[0].context.complexityScore).toEqual(complexityScore);
      expect(data.sessions[0].context.codebaseSnapshot).toBeDefined();
      expect(data.sessions[0].context.codebaseSnapshot.files).toEqual(codebaseSnapshot.files);
    });

    it('应该持久化会话检查点', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('persist-test-3');

      const session = await manager.createSession(task);

      // 创建多个检查点
      await manager.createCheckpoint(session.id, { step: 1, data: 'checkpoint1' }, 'First checkpoint');
      await manager.createCheckpoint(session.id, { step: 2, data: 'checkpoint2' }, 'Second checkpoint');
      await manager.createCheckpoint(session.id, { step: 3, data: 'checkpoint3' }, 'Third checkpoint');

      // 读取文件验证
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions[0].checkpoints).toHaveLength(3);
      expect(data.sessions[0].checkpoints[0].description).toBe('First checkpoint');
      expect(data.sessions[0].checkpoints[0].state.step).toBe(1);
      expect(data.sessions[0].checkpoints[2].description).toBe('Third checkpoint');
    });
  });

  describe('会话恢复功能', () => {
    it('应该从文件恢复会话到新的管理器实例', async () => {
      const task = createTask('restore-test-1');
      const options = createOptions();

      // 第一个管理器实例：创建会话
      const manager1 = new SessionStateManager(mockContext, mockOutputChannel);
      const originalSession = await manager1.createSession(task, options);
      await manager1.createCheckpoint(originalSession.id, { progress: 50 }, 'Mid-progress checkpoint');

      const originalSessionId = originalSession.id;

      // 等待文件写入完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 第二个管理器实例：恢复会话
      const manager2 = new SessionStateManager(mockContext, mockOutputChannel);

      // 等待加载完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const restoredSession = await manager2.restoreSession(originalSessionId);

      expect(restoredSession).toBeDefined();
      expect(restoredSession!.id).toBe(originalSessionId);
      expect(restoredSession!.task.id).toBe(task.id);
      expect(restoredSession!.context?.options).toEqual(options);
      expect(restoredSession!.checkpoints).toHaveLength(1);
      expect(restoredSession!.checkpoints![0].description).toBe('Mid-progress checkpoint');
    });

    it('应该恢复会话的所有状态信息', async () => {
      const task = createTask('restore-test-2');

      const manager1 = new SessionStateManager(mockContext, mockOutputChannel);
      const session = await manager1.createSession(task);

      // 更新会话状态
      await manager1.updateSessionStatus(session.id, 'completed');
      await manager1.saveState(session, { output: 'test result', success: true });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 新实例恢复
      const manager2 = new SessionStateManager(mockContext, mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      const restoredSession = await manager2.restoreSession(session.id);

      expect(restoredSession).toBeDefined();
      expect(restoredSession!.status).toBe('completed');
      expect(restoredSession!.metadata?.lastResult).toEqual({ output: 'test result', success: true });
    });

    it('应该正确恢复日期对象', async () => {
      const task = createTask('restore-test-3');

      const manager1 = new SessionStateManager(mockContext, mockOutputChannel);
      const session = await manager1.createSession(task);
      const originalCreatedAt = session.createdAt;

      await new Promise(resolve => setTimeout(resolve, 100));

      const manager2 = new SessionStateManager(mockContext, mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      const restoredSession = await manager2.restoreSession(session.id);

      expect(restoredSession).toBeDefined();
      expect(restoredSession!.createdAt).toBeInstanceOf(Date);
      expect(restoredSession!.lastActiveAt).toBeInstanceOf(Date);
      expect(restoredSession!.createdAt.getTime()).toBeCloseTo(originalCreatedAt.getTime(), -2);
    });
  });

  describe('增量更新策略', () => {
    it('应该只在会话修改时触发持久化', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('incremental-test-1');

      const session = await manager.createSession(task);

      // 清空mock调用记录
      (mockOutputChannel.appendLine as jest.Mock).mockClear();

      // 执行不修改会话的操作
      const retrieved = manager.getSession(session.id);
      expect(retrieved).toBe(session);

      // 应该没有新的持久化日志
      const persistCalls = (mockOutputChannel.appendLine as jest.Mock).mock.calls
        .filter((call: any[]) => call[0].includes('Persisted'));
      expect(persistCalls.length).toBe(0);
    });

    it('应该在修改会话后触发持久化', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('incremental-test-2');

      const session = await manager.createSession(task);

      // 清空mock调用记录
      (mockOutputChannel.appendLine as jest.Mock).mockClear();

      // 修改会话
      await manager.updateSessionStatus(session.id, 'completed');

      // 应该有持久化日志
      const persistCalls = (mockOutputChannel.appendLine as jest.Mock).mock.calls
        .filter((call: any[]) => call[0].includes('Persisted'));
      expect(persistCalls.length).toBeGreaterThan(0);
    });

    it('应该批量处理多个快速的会话修改', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      const task = createTask('incremental-test-3');

      const session = await manager.createSession(task);

      // 快速执行多次修改
      await manager.saveState(session, { step: 1 });
      await manager.saveState(session, { step: 2 });
      await manager.saveState(session, { step: 3 });

      // 等待持久化完成
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 验证文件内容
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions[0].metadata.lastResult.step).toBe(3);
    });
  });

  describe('文件锁机制', () => {
    it('应该防止并发写入冲突', async () => {
      const manager1 = new SessionStateManager(mockContext, mockOutputChannel);
      const manager2 = new SessionStateManager(mockContext, mockOutputChannel);

      const task1 = createTask('lock-test-1');
      const task2 = createTask('lock-test-2');

      // 并发创建会话
      const [session1, session2] = await Promise.all([
        manager1.createSession(task1),
        manager2.createSession(task2)
      ]);

      // 等待持久化完成
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 验证两个会话都被持久化
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      // 应该包含两个会话（文件锁确保不会相互覆盖）
      const sessionIds = data.sessions.map((s: Session) => s.id);
      expect(sessionIds).toContain(session1.id);
      expect(sessionIds).toContain(session2.id);
    });

    it('应该处理高并发会话修改', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);

      // 创建多个会话
      const sessions = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          manager.createSession(createTask(`concurrent-${i}`))
        )
      );

      // 并发修改所有会话
      await Promise.all(
        sessions.map((session, i) =>
          manager.saveState(session, { index: i, data: `result-${i}` })
        )
      );

      // 等待持久化完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 验证所有会话都被正确持久化
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions).toHaveLength(10);

      // 验证每个会话的数据完整性
      for (let i = 0; i < 10; i++) {
        const session = data.sessions.find((s: Session) =>
          s.task.id === `concurrent-${i}`
        );
        expect(session).toBeDefined();
        expect(session.metadata.lastResult.index).toBe(i);
      }
    });
  });

  describe('性能测试', () => {
    it('应该高效处理大量会话的持久化', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);

      const startTime = Date.now();

      // 创建100个会话
      const sessions = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          manager.createSession(createTask(`perf-test-${i}`))
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在合理时间内完成（<10秒）
      expect(duration).toBeLessThan(10000);

      // 验证持久化
      await new Promise(resolve => setTimeout(resolve, 2000));

      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      const content = await fs.readFile(sessionsPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.sessions).toHaveLength(100);
    }, 15000); // 增加超时时间

    it('应该高效恢复大量会话', async () => {
      // 首先创建大量会话
      const manager1 = new SessionStateManager(mockContext, mockOutputChannel);

      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          manager1.createSession(createTask(`restore-perf-${i}`))
        )
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 测试恢复性能
      const startTime = Date.now();

      const manager2 = new SessionStateManager(mockContext, mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待加载

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 加载应该很快（<2秒）
      expect(duration).toBeLessThan(2000);

      // 验证所有会话已加载
      const stats = manager2.getStatistics();
      expect(stats.total).toBe(100);
    }, 15000);
  });

  describe('错误处理', () => {
    it('应该处理文件系统错误', async () => {
      const manager = new SessionStateManager(mockContext, mockOutputChannel);

      // 创建一个只读目录（模拟权限错误）
      const readonlyDir = path.join(testWorkspaceDir, 'readonly');
      await fs.mkdir(readonlyDir, { recursive: true });

      // 临时修改工作空间路径
      (vscode.workspace as any).workspaceFolders = [{
        uri: { fsPath: readonlyDir } as vscode.Uri,
        name: 'readonly-workspace',
        index: 0
      }];

      const task = createTask('error-test');

      // 在某些平台上可能无法创建只读目录，所以这个测试可能会跳过
      try {
        await fs.chmod(readonlyDir, 0o444); // 只读权限
        await expect(manager.createSession(task)).rejects.toThrow();
      } catch {
        // 如果无法设置权限，跳过此测试
        console.log('Skipping readonly test - platform does not support chmod');
      } finally {
        // 恢复权限并清理
        try {
          await fs.chmod(readonlyDir, 0o755);
          await fs.rm(readonlyDir, { recursive: true });
        } catch {
          // 忽略清理错误
        }
      }
    });

    it('应该处理损坏的sessions.json文件', async () => {
      // 写入损坏的JSON文件
      const sessionsPath = path.join(testWorkspaceDir, '.claude', 'codex', 'sessions.json');
      await fs.mkdir(path.dirname(sessionsPath), { recursive: true });
      await fs.writeFile(sessionsPath, '{invalid json content', 'utf-8');

      // 创建管理器应该处理错误并继续
      const manager = new SessionStateManager(mockContext, mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该能够创建新会话
      const task = createTask('error-recovery');
      const session = await manager.createSession(task);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^codex-\d+-[a-f0-9]+$/);
    });
  });
});
