/**
 * MCPLifecycleManager单元测试
 *
 * 测试覆盖：
 * - 状态机转换逻辑
 * - 启动和停止流程
 * - 健康检查机制
 * - 错误处理
 * - 自动重启
 */

import { MCPLifecycleManager, MCPServerState } from '../mcpLifecycleManager';
import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })
  },
  env: {
    openExternal: jest.fn()
  },
  Uri: {
    parse: jest.fn((url: string) => ({ toString: () => url }))
  },
  workspace: {
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }]
  }
}));

// Mock child_process
jest.mock('child_process');

// Mock ConfigManager
jest.mock('../../../utils/configManager', () => ({
  ConfigManager: {
    getInstance: jest.fn().mockReturnValue({
      getSettings: jest.fn().mockResolvedValue({
        codex: {
          mcp: {
            port: 8765,
            timeout: 300000,
            logLevel: 'info'
          }
        }
      })
    })
  }
}));

describe('MCPLifecycleManager', () => {
  let manager: MCPLifecycleManager;
  let outputChannel: vscode.OutputChannel;
  let mockProcess: any;

  beforeEach(() => {
    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('Test');

    // 创建管理器实例
    manager = new MCPLifecycleManager(outputChannel);

    // 创建模拟进程
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(),
      on: jest.fn(),
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      }
    };

    // 清理所有mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 清理定时器
    jest.clearAllTimers();
  });

  describe('初始状态', () => {
    it('应该初始化为STOPPED状态', () => {
      const status = manager.getStatus();
      expect(status.status).toBe(MCPServerState.STOPPED);
      expect(status.pid).toBeUndefined();
      expect(status.port).toBeUndefined();
    });
  });

  describe('ensureStarted', () => {
    it('状态为STOPPED时应该启动服务器', async () => {
      // Mock exec (检查CLI)
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });

      // Mock spawn
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      // Mock健康检查
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      const status = await manager.ensureStarted();

      expect(status.status).toBe(MCPServerState.RUNNING);
      expect(status.pid).toBe(12345);
      expect(status.port).toBe(8765);
    });

    it('状态为RUNNING时应该直接返回状态', async () => {
      // 先启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 再次调用ensureStarted
      const execCallCount = (exec as unknown as jest.Mock).mock.calls.length;
      const status = await manager.ensureStarted();

      // exec不应该被再次调用
      expect((exec as unknown as jest.Mock).mock.calls.length).toBe(execCallCount);
      expect(status.status).toBe(MCPServerState.RUNNING);
    });

    it('Codex CLI未安装时应该抛出错误', async () => {
      // Mock exec失败
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Command not found'), '', '');
      });

      await expect(manager.ensureStarted()).rejects.toThrow('Codex CLI is not installed');
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('启动超时应该抛出错误', async () => {
      jest.useFakeTimers();

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      // Mock健康检查始终返回false
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: false });

      const startPromise = manager.ensureStarted();

      // 快进5秒（超时时间）
      jest.advanceTimersByTime(5000);

      await expect(startPromise).rejects.toThrow('MCP server start timeout');

      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();
    });

    it('应该优雅关闭进程（SIGTERM）', async () => {
      jest.useFakeTimers();

      // 模拟进程在1秒后退出
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setTimeout(() => callback(0, null), 1000);
        }
      });

      const stopPromise = manager.stop();

      // 快进1秒，进程退出
      jest.advanceTimersByTime(1000);

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);

      jest.useRealTimers();
    });

    it('应该强制终止未响应的进程（SIGKILL）', async () => {
      jest.useFakeTimers();

      // 模拟进程不响应SIGTERM
      mockProcess.on.mockImplementation(() => {});

      const stopPromise = manager.stop();

      // 快进5秒，触发SIGKILL
      jest.advanceTimersByTime(5000);

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      jest.useRealTimers();
    });

    it('状态为STOPPED时应该无操作', async () => {
      await manager.stop();

      // 再次调用stop
      const killCallCount = mockProcess.kill.mock.calls.length;
      await manager.stop();

      // kill不应该被再次调用
      expect(mockProcess.kill.mock.calls.length).toBe(killCallCount);
    });

    it('应该清理健康检查定时器', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await manager.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('状态为STOPPED时应该返回false', async () => {
      const result = await manager.healthCheck();
      expect(result).toBe(false);
    });

    it('状态为RUNNING但进程已killed时应该返回false', async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟进程被killed
      mockProcess.killed = true;

      const result = await manager.healthCheck();
      expect(result).toBe(false);
    });

    it('健康检查请求成功时应该返回true', async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      const result = await manager.healthCheck();
      expect(result).toBe(true);
    });

    it('健康检查请求失败时应该返回false', async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest')
        .mockResolvedValueOnce({ ok: true })  // 启动时成功
        .mockRejectedValueOnce(new Error('Connection refused'));  // 健康检查失败

      await manager.ensureStarted();

      const result = await manager.healthCheck();
      expect(result).toBe(false);
    });

    it('应该更新lastHealthCheck时间戳', async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      const beforeCheck = Date.now();
      await manager.healthCheck();
      const status = manager.getStatus();

      expect(status.lastHealthCheck).toBeDefined();
      expect(status.lastHealthCheck!.getTime()).toBeGreaterThanOrEqual(beforeCheck);
    });
  });

  describe('getStatus', () => {
    it('应该返回完整的状态信息', async () => {
      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      const status = manager.getStatus();

      expect(status).toMatchObject({
        status: MCPServerState.RUNNING,
        pid: 12345,
        port: 8765,
        isHealthy: true
      });
      expect(status.startedAt).toBeDefined();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('ERROR状态应该包含错误信息', async () => {
      // Mock启动失败
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('CLI not found'), '', '');
      });

      try {
        await manager.ensureStarted();
      } catch (error) {
        // 期望抛出错误
      }

      const status = manager.getStatus();

      expect(status.status).toBe(MCPServerState.ERROR);
      expect(status.error).toBeDefined();
      expect(status.error?.message).toContain('Codex CLI');
    });
  });

  describe('状态机转换', () => {
    it('STOPPED → STARTING → RUNNING', async () => {
      // 初始状态
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);

      // Mock启动
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      // 异步启动，不等待完成
      const startPromise = manager.ensureStarted();

      // 状态应该变为STARTING（需要短暂等待）
      await new Promise(resolve => setTimeout(resolve, 10));

      // 等待启动完成
      await startPromise;

      // 最终状态应该是RUNNING
      expect(manager.getStatus().status).toBe(MCPServerState.RUNNING);
    });

    it('STOPPED → STARTING → ERROR', async () => {
      // Mock启动失败
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Test error'), '', '');
      });

      try {
        await manager.ensureStarted();
      } catch (error) {
        // 期望抛出错误
      }

      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
    });

    it('RUNNING → STOPPED', async () => {
      // 先启动
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();
      expect(manager.getStatus().status).toBe(MCPServerState.RUNNING);

      // 停止
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      await manager.stop();
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
    });
  });

  describe('自动重启', () => {
    it('健康检查失败时应该尝试重启', async () => {
      jest.useFakeTimers();

      // 启动服务器
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      const healthCheckMock = jest.spyOn(manager as any, '_sendHealthCheckRequest')
        .mockResolvedValueOnce({ ok: true })  // 启动时成功
        .mockResolvedValueOnce({ ok: false }) // 第一次健康检查失败
        .mockResolvedValue({ ok: true });     // 重启后成功

      await manager.ensureStarted();

      // 快进30秒，触发健康检查
      jest.advanceTimersByTime(30000);

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该尝试了重启
      expect(healthCheckMock).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('进程事件处理', () => {
    it('进程exit事件应该更新状态', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });

      let exitCallback: Function;
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          exitCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 触发exit事件
      exitCallback!(0, null);

      // 状态应该变为STOPPED
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
    });

    it('进程error事件应该更新状态', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });

      let errorCallback: Function;
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 触发error事件
      errorCallback!(new Error('Process error'));

      // 状态应该变为ERROR
      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
    });
  });

  describe('配置加载', () => {
    it('应该从ConfigManager加载配置', async () => {
      const ConfigManager = require('../../../utils/configManager').ConfigManager;
      const mockGetSettings = ConfigManager.getInstance().getSettings;

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      expect(mockGetSettings).toHaveBeenCalled();
    });

    it('未配置时应该使用默认值', async () => {
      const ConfigManager = require('../../../utils/configManager').ConfigManager;
      ConfigManager.getInstance().getSettings.mockResolvedValueOnce({});

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, 'codex version 1.0.0', '');
      });
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      const status = manager.getStatus();
      expect(status.port).toBe(8765); // 默认端口
    });
  });
});
