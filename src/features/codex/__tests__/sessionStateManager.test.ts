/**
 * 会话状态管理器单元测试
 *
 * 测试覆盖:
 * 1. 会话创建和ID生成
 * 2. 会话状态保存和持久化
 * 3. 会话恢复
 * 4. 检查点创建和恢复
 * 5. 会话超时和清理
 * 6. 会话CRUD操作
 * 7. 会话统计信息
 * 8. 错误处理
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionStateManager } from '../sessionStateManager';
import {
  Session,
  TaskDescriptor,
  ExecutionOptions,
  ComplexityScore,
  CodebaseSnapshot
} from '../types';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('vscode');

describe('SessionStateManager', () => {
  let manager: SessionStateManager;
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;

  // Sample task descriptor
  const createTask = (id: string = 'test-task-1'): TaskDescriptor => ({
    id,
    type: 'design',
    description: 'Test task for session management'
  });

  // Sample execution options
  const createOptions = (): ExecutionOptions => ({
    forceMode: 'codex',
    enableDeepThinking: true,
    enableCodebaseScan: true,
    timeout: 300000
  });

  // Sample complexity score
  const createComplexityScore = (): ComplexityScore => ({
    total: 7,
    codeScale: 6,
    technicalDifficulty: 8,
    businessImpact: 7,
    details: {
      fileCount: 10,
      functionDepth: 3,
      externalDeps: 2,
      cyclomaticComplexity: 15,
      cognitiveComplexity: 12,
      crossModuleImpact: true,
      refactoringScope: 'multiple'
    }
  });

  // Sample codebase snapshot
  const createCodebaseSnapshot = (): CodebaseSnapshot => ({
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

    // Mock workspace folder
    mockWorkspaceFolder = {
      uri: { fsPath: '/test/workspace' } as vscode.Uri,
      name: 'test-workspace',
      index: 0
    };

    (vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder];

    // Mock fs.promises
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
    (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

    // Create manager instance
    manager = new SessionStateManager(mockContext, mockOutputChannel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with correct ID format', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      expect(session.id).toMatch(/^codex-\d+-[a-f0-9]+$/);
      expect(session.task).toBe(task);
      expect(session.status).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActiveAt).toBeInstanceOf(Date);
    });

    it('should create session with execution options', async () => {
      const task = createTask();
      const options = createOptions();
      const session = await manager.createSession(task, options);

      expect(session.context?.options).toBe(options);
    });

    it('should initialize empty checkpoints array', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      expect(session.checkpoints).toEqual([]);
    });

    it('should persist session to file', async () => {
      const task = createTask();
      await manager.createSession(task);

      expect(fs.mkdir).toHaveBeenCalledWith(
        '/test/workspace/.claude/codex',
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should log session creation', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining(`Created session: ${session.id}`)
      );
    });
  });

  describe('saveState', () => {
    it('should update session lastActiveAt timestamp', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const originalLastActiveAt = session.lastActiveAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.saveState(session);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(
        originalLastActiveAt.getTime()
      );
    });

    it('should save result to session metadata', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const result = { output: 'test output', success: true };

      await manager.saveState(session, result);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.metadata?.lastResult).toEqual(result);
    });

    it('should persist changes to file', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      // Clear previous calls
      jest.clearAllMocks();

      await manager.saveState(session);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('updateContext', () => {
    it('should update complexity score in session context', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const complexityScore = createComplexityScore();

      await manager.updateContext(session.id, complexityScore);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.context?.complexityScore).toEqual(complexityScore);
    });

    it('should update codebase snapshot in session context', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const codebaseSnapshot = createCodebaseSnapshot();

      await manager.updateContext(session.id, undefined, codebaseSnapshot);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.context?.codebaseSnapshot).toEqual(codebaseSnapshot);
    });

    it('should update both complexity score and codebase snapshot', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const complexityScore = createComplexityScore();
      const codebaseSnapshot = createCodebaseSnapshot();

      await manager.updateContext(session.id, complexityScore, codebaseSnapshot);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.context?.complexityScore).toEqual(complexityScore);
      expect(updatedSession!.context?.codebaseSnapshot).toEqual(codebaseSnapshot);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        manager.updateContext('invalid-session-id', createComplexityScore())
      ).rejects.toThrow('Session not found');
    });
  });

  describe('createCheckpoint', () => {
    it('should create checkpoint with correct structure', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const state = { step: 'analysis', progress: 50 };
      const description = 'Completed initial analysis';

      await manager.createCheckpoint(session.id, state, description);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.checkpoints).toHaveLength(1);
      expect(updatedSession!.checkpoints![0]).toMatchObject({
        description,
        state
      });
      expect(updatedSession!.checkpoints![0].id).toBeDefined();
      expect(updatedSession!.checkpoints![0].timestamp).toBeInstanceOf(Date);
    });

    it('should append multiple checkpoints', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      await manager.createCheckpoint(session.id, { step: 1 }, 'Checkpoint 1');
      await manager.createCheckpoint(session.id, { step: 2 }, 'Checkpoint 2');
      await manager.createCheckpoint(session.id, { step: 3 }, 'Checkpoint 3');

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.checkpoints).toHaveLength(3);
      expect(updatedSession!.checkpoints![0].description).toBe('Checkpoint 1');
      expect(updatedSession!.checkpoints![2].description).toBe('Checkpoint 3');
    });

    it('should update lastActiveAt when creating checkpoint', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const originalLastActiveAt = session.lastActiveAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.createCheckpoint(session.id, {}, 'Test checkpoint');

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(
        originalLastActiveAt.getTime()
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        manager.createCheckpoint('invalid-session-id', {}, 'Test')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('restoreSession', () => {
    it('should restore existing session from memory', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      const restoredSession = await manager.restoreSession(session.id);

      expect(restoredSession).toBeDefined();
      expect(restoredSession!.id).toBe(session.id);
      expect(restoredSession!.task).toEqual(task);
    });

    it('should return null for non-existent session', async () => {
      const restoredSession = await manager.restoreSession('invalid-session-id');

      expect(restoredSession).toBeNull();
    });

    it('should update lastActiveAt when restoring session', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const originalLastActiveAt = session.lastActiveAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.restoreSession(session.id);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(
        originalLastActiveAt.getTime()
      );
    });

    it('should attempt to load from file if not in memory', async () => {
      // Mock file read with valid session data
      const mockSessionData = {
        sessions: [
          {
            id: 'codex-12345-abc',
            task: createTask(),
            status: 'active',
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            checkpoints: []
          }
        ],
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));

      // Create new manager instance to test file loading
      const newManager = new SessionStateManager(mockContext, mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async load

      const restoredSession = await newManager.restoreSession('codex-12345-abc');

      expect(restoredSession).toBeDefined();
      expect(restoredSession!.id).toBe('codex-12345-abc');
    });
  });

  describe('getSession', () => {
    it('should return session from memory', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      const retrievedSession = manager.getSession(session.id);

      expect(retrievedSession).toBe(session);
    });

    it('should return null for non-existent session', () => {
      const retrievedSession = manager.getSession('invalid-session-id');

      expect(retrievedSession).toBeNull();
    });
  });

  describe('updateSessionStatus', () => {
    it('should update session status', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      await manager.updateSessionStatus(session.id, 'completed');

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.status).toBe('completed');
    });

    it('should update lastActiveAt when updating status', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      const originalLastActiveAt = session.lastActiveAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.updateSessionStatus(session.id, 'completed');

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(
        originalLastActiveAt.getTime()
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        manager.updateSessionStatus('invalid-session-id', 'completed')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');

      const session1 = await manager.createSession(task1);
      const session2 = await manager.createSession(task2);
      const session3 = await manager.createSession(task3);

      await manager.updateSessionStatus(session2.id, 'completed');
      await manager.updateSessionStatus(session3.id, 'failed');

      const activeSessions = manager.getActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session1.id);
    });

    it('should return empty array when no active sessions', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      await manager.updateSessionStatus(session.id, 'completed');

      const activeSessions = manager.getActiveSessions();

      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should timeout sessions older than maxAge', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      // Manually set lastActiveAt to 31 minutes ago
      session.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);

      const cleanedCount = await manager.cleanupOldSessions(30 * 60 * 1000);

      expect(cleanedCount).toBe(1);
      expect(session.status).toBe('timeout');
    });

    it('should not timeout recent sessions', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      // Session just created, should not timeout
      const cleanedCount = await manager.cleanupOldSessions(30 * 60 * 1000);

      expect(cleanedCount).toBe(0);
      expect(session.status).toBe('active');
    });

    it('should only timeout active sessions', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');

      const session1 = await manager.createSession(task1);
      const session2 = await manager.createSession(task2);

      // Both sessions old
      session1.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);
      session2.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);

      // session2 already completed
      await manager.updateSessionStatus(session2.id, 'completed');

      const cleanedCount = await manager.cleanupOldSessions(30 * 60 * 1000);

      expect(cleanedCount).toBe(1);
      expect(session1.status).toBe('timeout');
      expect(session2.status).toBe('completed'); // Should not change
    });

    it('should persist changes after cleanup', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      session.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);

      jest.clearAllMocks();

      await manager.cleanupOldSessions(30 * 60 * 1000);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      await manager.deleteSession(session.id);

      expect(manager.getSession(session.id)).toBeNull();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        manager.deleteSession('invalid-session-id')
      ).rejects.toThrow('Session not found');
    });

    it('should persist changes after deletion', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      jest.clearAllMocks();

      await manager.deleteSession(session.id);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('shutdownAllActiveSessions', () => {
    it('should cancel all active sessions', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');

      const session1 = await manager.createSession(task1);
      const session2 = await manager.createSession(task2);
      const session3 = await manager.createSession(task3);

      await manager.updateSessionStatus(session3.id, 'completed');

      await manager.shutdownAllActiveSessions();

      expect(session1.status).toBe('cancelled');
      expect(session2.status).toBe('cancelled');
      expect(session3.status).toBe('completed'); // Should not change
    });

    it('should log shutdown message', async () => {
      const task = createTask();
      await manager.createSession(task);

      await manager.shutdownAllActiveSessions();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('All active sessions shut down')
      );
    });
  });

  describe('cleanup timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start cleanup timer on initialization', () => {
      // Timer should be started in constructor
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup timer started')
      );
    });

    it('should automatically cleanup old sessions on timer', async () => {
      const task = createTask();
      const session = await manager.createSession(task);

      // Set session to be old (31 minutes ago)
      session.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);

      // Clear previous logs
      jest.clearAllMocks();

      // Fast-forward timer by 5 minutes (cleanup interval)
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Check that cleanup log was written
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Auto cleanup')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const task = createTask();
      const session = await manager.createSession(task);
      session.lastActiveAt = new Date(Date.now() - 31 * 60 * 1000);

      // Reset mocks and make writeFile fail on next call
      jest.clearAllMocks();
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));

      // Fast-forward timer
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should log error but not throw
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Auto cleanup failed')
      );
    });
  });

  describe('dispose', () => {
    it('should stop cleanup timer on dispose', async () => {
      await manager.dispose();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup timer stopped')
      );
    });

    it('should shutdown all active sessions on dispose', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');

      const session1 = await manager.createSession(task1);
      const session2 = await manager.createSession(task2);

      await manager.dispose();

      expect(session1.status).toBe('cancelled');
      expect(session2.status).toBe('cancelled');
    });

    it('should log disposal messages', async () => {
      await manager.dispose();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Disposing session state manager')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Session state manager disposed')
      );
    });

    it('should persist final state before disposal', async () => {
      const task = createTask();
      await manager.createSession(task);

      jest.clearAllMocks();

      await manager.dispose();

      // Should have written sessions file during shutdown
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');
      const task4 = createTask('task-4');

      const session1 = await manager.createSession(task1);
      const session2 = await manager.createSession(task2);
      const session3 = await manager.createSession(task3);
      const session4 = await manager.createSession(task4);

      await manager.updateSessionStatus(session2.id, 'completed');
      await manager.updateSessionStatus(session3.id, 'failed');
      await manager.updateSessionStatus(session4.id, 'timeout');

      const stats = manager.getStatistics();

      expect(stats).toEqual({
        total: 4,
        active: 1,
        completed: 1,
        failed: 1,
        timeout: 1,
        cancelled: 0
      });
    });

    it('should return zero stats for empty manager', () => {
      const stats = manager.getStatistics();

      expect(stats).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        timeout: 0,
        cancelled: 0
      });
    });
  });

  describe('persistence', () => {
    it('should handle file write errors gracefully', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      const task = createTask();

      await expect(manager.createSession(task)).rejects.toThrow('Write failed');
    });

    it('should create directory if it does not exist', async () => {
      const task = createTask();
      await manager.createSession(task);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude/codex'),
        { recursive: true }
      );
    });

    it('should write sessions in correct JSON format', async () => {
      const task = createTask();
      await manager.createSession(task);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('sessions.json'),
        expect.stringContaining('"sessions"'),
        'utf-8'
      );
    });
  });
});
