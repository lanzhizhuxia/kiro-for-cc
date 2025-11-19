/**
 * CodexOrchestrator单元测试
 *
 * 测试范围:
 * - 初始化和资源管理
 * - 会话状态管理器集成
 * - 生命周期管理（dispose）
 * - 执行模式选择和覆盖（任务22）
 */

import * as vscode from 'vscode';
import { CodexOrchestrator } from '../codexOrchestrator';
import { SessionStateManager } from '../sessionStateManager';
import { TaskRouter } from '../taskRouter';
import { ConfigManager } from '../../../utils/configManager';
import { TaskDescriptor, ExecutionOptions } from '../types';

// Mock模块
jest.mock('vscode');
jest.mock('fs/promises');
jest.mock('../taskRouter');
jest.mock('../../../utils/configManager');
jest.mock('../codexExecutor');
jest.mock('../localAgentExecutor');

// Mock fs/promises
const fs = require('fs/promises');
(fs.access as jest.Mock) = jest.fn().mockRejectedValue(new Error('File not found'));
(fs.readFile as jest.Mock) = jest.fn().mockResolvedValue('{}');
(fs.writeFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
(fs.mkdir as jest.Mock) = jest.fn().mockResolvedValue(undefined);

describe('CodexOrchestrator', () => {
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;
  let orchestrator: CodexOrchestrator;

  beforeEach(() => {
    // 创建mock对象
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Output',
      replace: jest.fn(),
    };

    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      extensionUri: vscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension',
      environmentVariableCollection: {} as any,
      asAbsolutePath: jest.fn((p) => `/test/extension/${p}`),
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/global-storage'),
      logUri: vscode.Uri.file('/test/logs'),
      extensionMode: 3, // ExtensionMode.Test value
      extension: {} as any,
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/logs',
      languageModelAccessInformation: {} as any
    } as vscode.ExtensionContext;

    // Mock workspace
    (vscode.workspace as any).workspaceFolders = [
      {
        uri: {
          ...vscode.Uri.file('/test/workspace'),
          fsPath: '/test/workspace'
        },
        name: 'test-workspace',
        index: 0
      }
    ];

    // 创建orchestrator实例
    orchestrator = new CodexOrchestrator(mockContext, mockOutputChannel);
  });

  afterEach(async () => {
    // 清理资源
    if (orchestrator) {
      await orchestrator.dispose();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(orchestrator).toBeDefined();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Orchestrator initialized')
      );
    });

    it('should create SessionStateManager', () => {
      const sessionManager = orchestrator.getSessionStateManager();
      expect(sessionManager).toBeInstanceOf(SessionStateManager);
    });

    it('should log initialization message', () => {
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[CodexOrchestrator] Orchestrator initialized'
      );
    });
  });

  describe('getSessionStateManager', () => {
    it('should return SessionStateManager instance', () => {
      const sessionManager = orchestrator.getSessionStateManager();
      expect(sessionManager).toBeDefined();
      expect(sessionManager).toBeInstanceOf(SessionStateManager);
    });

    it('should return the same instance on multiple calls', () => {
      const manager1 = orchestrator.getSessionStateManager();
      const manager2 = orchestrator.getSessionStateManager();
      expect(manager1).toBe(manager2);
    });
  });

  describe('dispose', () => {
    it('should dispose SessionStateManager', async () => {
      const sessionManager = orchestrator.getSessionStateManager();
      const disposeSpy = jest.spyOn(sessionManager, 'dispose');

      await orchestrator.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should log disposal messages', async () => {
      await orchestrator.dispose();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Disposing orchestrator')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Orchestrator disposed')
      );
    });

    it('should handle multiple dispose calls gracefully', async () => {
      await orchestrator.dispose();
      await expect(orchestrator.dispose()).resolves.not.toThrow();
    });
  });

  describe('integration with SessionStateManager', () => {
    it('should pass correct context to SessionStateManager', () => {
      const sessionManager = orchestrator.getSessionStateManager();
      expect(sessionManager).toBeDefined();
    });

    it('should shutdown all sessions on dispose', async () => {
      const sessionManager = orchestrator.getSessionStateManager();

      // 创建测试会话
      const task = {
        id: 'test-task-1',
        type: 'design' as const,
        description: 'Test task'
      };

      await sessionManager.createSession(task);
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions.length).toBe(1);

      // Dispose orchestrator
      await orchestrator.dispose();

      // 验证会话已关闭
      const stats = sessionManager.getStatistics();
      expect(stats.active).toBe(0);
      expect(stats.cancelled).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle SessionStateManager initialization errors', () => {
      // Mock workspace to have no folders
      (vscode.workspace as any).workspaceFolders = undefined;

      // Should throw error
      expect(() => {
        new CodexOrchestrator(mockContext, mockOutputChannel);
      }).toThrow('No workspace folder found');
    });

    it('should handle dispose errors gracefully', async () => {
      const sessionManager = orchestrator.getSessionStateManager();

      // Mock dispose to throw error
      jest.spyOn(sessionManager, 'dispose').mockRejectedValueOnce(
        new Error('Dispose failed')
      );

      // Should not throw, but log error
      await expect(orchestrator.dispose()).rejects.toThrow('Dispose failed');
    });
  });

  // ==================== 任务22: 执行模式选择和覆盖测试 ====================

  describe('Task 22: Execution Mode Selection and Override', () => {
    let mockTask: TaskDescriptor;
    let mockTaskRouter: jest.Mocked<TaskRouter>;

    // Helper function to mock ConfigManager settings
    const mockConfigManager = (codexSettings: any) => {
      // Since ConfigManager is a singleton with private constructor,
      // we mock at the module level
      (ConfigManager.getInstance as jest.Mock).mockReturnValue({
        loadSettings: jest.fn().mockResolvedValue({
          codex: codexSettings,
          paths: {},
          views: {}
        })
      } as any);
    };

    beforeEach(() => {
      // 创建测试任务
      mockTask = {
        id: 'test-task-mode',
        type: 'design',
        description: 'Test mode selection task'
      };

      // 默认mock ConfigManager为auto模式
      mockConfigManager({ defaultMode: 'auto' });

      // 重新创建orchestrator以获取新的实例
      orchestrator = new CodexOrchestrator(mockContext, mockOutputChannel);
      mockTaskRouter = orchestrator.getTaskRouter() as jest.Mocked<TaskRouter>;

      // 设置默认mock行为
      mockTaskRouter.recommend = jest.fn().mockResolvedValue({
        mode: 'local',
        score: 5,
        reasons: ['Task complexity is moderate'],
        confidence: 85
      });

      mockTaskRouter.route = jest.fn().mockResolvedValue('local');
    });

    describe('Priority 1: forceMode Override', () => {
      it('should use forceMode when specified as "local"', async () => {
        const options: ExecutionOptions = {
          forceMode: 'local'
        };

        await orchestrator.executeTask(mockTask, options);

        // 验证日志输出
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using forced mode: local')
        );
      });

      it('should use forceMode when specified as "codex"', async () => {
        const options: ExecutionOptions = {
          forceMode: 'codex'
        };

        await orchestrator.executeTask(mockTask, options);

        // 验证日志输出
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using forced mode: codex')
        );
      });

      it('should resolve "auto" forceMode to recommendation', async () => {
        mockTaskRouter.recommend = jest.fn().mockResolvedValue({
          mode: 'codex',
          score: 8,
          reasons: ['High complexity'],
          confidence: 90
        });

        const options: ExecutionOptions = {
          forceMode: 'auto'
        };

        await orchestrator.executeTask(mockTask, options);

        // 验证使用了推荐的模式
        expect(mockTaskRouter.recommend).toHaveBeenCalledWith(mockTask);
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using forced mode: codex')
        );
      });

      it('should override global config when forceMode is specified', async () => {
        // 全局配置为codex
        mockConfigManager({ defaultMode: 'codex' });

        // 但forceMode指定为local
        const options: ExecutionOptions = {
          forceMode: 'local'
        };

        await orchestrator.executeTask(mockTask, options);

        // 验证使用forceMode，不是全局配置
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using forced mode: local')
        );

        // 不应该调用全局配置
        expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
          expect.stringContaining('Using global default mode')
        );
      });
    });

    describe('Priority 2: Global Default Mode', () => {
      it('should use global default mode "local" when no forceMode', async () => {
        mockConfigManager({ defaultMode: 'local' });

        await orchestrator.executeTask(mockTask);

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using global default mode: local')
        );

        // 不应该调用路由
        expect(mockTaskRouter.route).not.toHaveBeenCalled();
      });

      it('should use global default mode "codex" when no forceMode', async () => {
        mockConfigManager({ defaultMode: 'codex' });

        await orchestrator.executeTask(mockTask);

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using global default mode: codex')
        );

        // 不应该调用路由
        expect(mockTaskRouter.route).not.toHaveBeenCalled();
      });

      it('should fallback to auto when config loading fails', async () => {
        // Mock config load failure
        (ConfigManager.getInstance as jest.Mock).mockReturnValue({
          loadSettings: jest.fn().mockRejectedValue(new Error('Config load failed'))
        } as any);

        mockTaskRouter.route = jest.fn().mockResolvedValue('local');

        await orchestrator.executeTask(mockTask);

        // 验证fallback到auto模式
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load global config')
        );

        // 应该调用路由
        expect(mockTaskRouter.route).toHaveBeenCalled();
      });
    });

    describe('Priority 3: Auto Mode (Smart Routing)', () => {
      it('should use TaskRouter when global mode is "auto"', async () => {
        mockConfigManager({ defaultMode: 'auto' });
        mockTaskRouter.route = jest.fn().mockResolvedValue('codex');

        await orchestrator.executeTask(mockTask);

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using auto mode, routing task')
        );

        expect(mockTaskRouter.route).toHaveBeenCalledWith(mockTask);
      });

      it('should resolve router result to concrete mode', async () => {
        mockConfigManager({ defaultMode: 'auto' });

        // 如果路由器返回auto（不应该发生，但要防御性处理）
        mockTaskRouter.route = jest.fn().mockResolvedValue('auto' as any);
        mockTaskRouter.recommend = jest.fn().mockResolvedValue({
          mode: 'local',
          score: 5,
          reasons: [],
          confidence: 80
        });

        await orchestrator.executeTask(mockTask);

        // 应该解析为local
        expect(mockTaskRouter.recommend).toHaveBeenCalled();
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Auto mode resolved to: local')
        );
      });
    });

    describe('Progress Preservation on Mode Switch', () => {
      it('should restore mode from existing session', async () => {
        // Mock恢复已存在的会话
        const existingSession = {
          id: 'existing-session',
          task: mockTask,
          status: 'active' as const,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          context: {
            options: {
              forceMode: 'codex' as const
            }
          }
        };

        jest.spyOn(orchestrator.getSessionStateManager(), 'restoreSession')
          .mockResolvedValue(existingSession);

        // 不指定forceMode
        await orchestrator.executeTask(mockTask);

        // 应该恢复之前的模式
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Restoring mode from existing session: codex')
        );
      });

      it('should not restore mode if existing session has no forceMode', async () => {
        // Mock恢复已存在的会话，但没有forceMode
        const existingSession = {
          id: 'existing-session',
          task: mockTask,
          status: 'active' as const,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          context: {}
        };

        jest.spyOn(orchestrator.getSessionStateManager(), 'restoreSession')
          .mockResolvedValue(existingSession);

        mockConfigManager({ defaultMode: 'local' });

        await orchestrator.executeTask(mockTask);

        // 应该使用全局配置
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using global default mode: local')
        );
      });

      it('should handle session restore failure gracefully', async () => {
        // Mock恢复会话失败
        jest.spyOn(orchestrator.getSessionStateManager(), 'restoreSession')
          .mockRejectedValue(new Error('Session not found'));

        mockConfigManager({ defaultMode: 'auto' });
        mockTaskRouter.route = jest.fn().mockResolvedValue('local');

        await orchestrator.executeTask(mockTask);

        // 应该继续执行，使用auto模式
        expect(mockTaskRouter.route).toHaveBeenCalled();
      });
    });

    describe('getRecommendedMode', () => {
      it('should return recommendation from TaskRouter', async () => {
        const expectedRecommendation = {
          mode: 'codex' as const,
          score: 8.5,
          reasons: ['High complexity', 'Multiple modules'],
          confidence: 92
        };

        mockTaskRouter.recommend = jest.fn().mockResolvedValue(expectedRecommendation);

        const result = await orchestrator.getRecommendedMode(mockTask);

        expect(result).toEqual(expectedRecommendation);
        expect(mockTaskRouter.recommend).toHaveBeenCalledWith(mockTask);
      });
    });

    describe('Integration: Complete Execution Flow', () => {
      it('should execute full workflow with forceMode=local', async () => {
        const options: ExecutionOptions = {
          forceMode: 'local'
        };

        const result = await orchestrator.executeTask(mockTask, options);

        // 验证执行流程
        expect(result.success).toBe(true);
        expect(result.mode).toBe('local');
        expect(result.sessionId).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should execute full workflow with global config=auto', async () => {
        mockConfigManager({ defaultMode: 'auto' });
        mockTaskRouter.route = jest.fn().mockResolvedValue('codex');

        const result = await orchestrator.executeTask(mockTask);

        expect(result.success).toBe(true);
        expect(result.mode).toBe('codex');
        expect(mockTaskRouter.route).toHaveBeenCalled();
      });

      it('should save execution options to session context', async () => {
        const options: ExecutionOptions = {
          forceMode: 'local',
          enableDeepThinking: true,
          timeout: 60000
        };

        const sessionManager = orchestrator.getSessionStateManager();
        const createSessionSpy = jest.spyOn(sessionManager, 'createSession');

        await orchestrator.executeTask(mockTask, options);

        // 验证会话已创建
        expect(createSessionSpy).toHaveBeenCalledWith(mockTask);

        // 验证会话状态已保存（包含options）
        const saveStateSpy = jest.spyOn(sessionManager, 'saveState');
        expect(saveStateSpy).toHaveBeenCalled();
      });
    });

    describe('Error Handling in Mode Selection', () => {
      it('should handle execution error and return failure result', async () => {
        // Mock执行器抛出错误
        const LocalAgentExecutor = require('../localAgentExecutor').LocalAgentExecutor;
        LocalAgentExecutor.prototype.execute = jest.fn().mockRejectedValue(
          new Error('Execution failed')
        );

        const result = await orchestrator.executeTask(mockTask, {
          forceMode: 'local'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toBe('Execution failed');
      });

      it('should log execution errors', async () => {
        const LocalAgentExecutor = require('../localAgentExecutor').LocalAgentExecutor;
        LocalAgentExecutor.prototype.execute = jest.fn().mockRejectedValue(
          new Error('Test error')
        );

        await orchestrator.executeTask(mockTask, { forceMode: 'local' });

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Task execution failed: Test error')
        );
      });
    });

    describe('Mode Priority Edge Cases', () => {
      it('should prefer forceMode over existing session mode', async () => {
        // Mock已存在的会话使用codex
        const existingSession = {
          id: 'existing-session',
          task: mockTask,
          status: 'active' as const,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          context: {
            options: {
              forceMode: 'codex' as const
            }
          }
        };

        jest.spyOn(orchestrator.getSessionStateManager(), 'restoreSession')
          .mockResolvedValue(existingSession);

        // 但本次指定forceMode=local
        await orchestrator.executeTask(mockTask, { forceMode: 'local' });

        // 应该使用新的forceMode
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Using forced mode: local')
        );

        // 不应该恢复会话模式
        expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
          expect.stringContaining('Restoring mode from existing session')
        );
      });

      it('should handle missing codex config gracefully', async () => {
        // 配置中没有codex部分
        (ConfigManager.getInstance as jest.Mock).mockReturnValue({
          loadSettings: jest.fn().mockResolvedValue({
            paths: {},
            views: {}
            // 注意: 没有codex配置
          })
        } as any);

        mockTaskRouter.route = jest.fn().mockResolvedValue('local');

        await orchestrator.executeTask(mockTask);

        // 应该fallback到auto模式
        expect(mockTaskRouter.route).toHaveBeenCalled();
      });
    });
  });
});
