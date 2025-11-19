/**
 * MCP生命周期管理器健康检查单元测试
 *
 * 测试重点：
 * 1. 健康检查请求发送（TCP连接）
 * 2. 健康检查失败计数
 * 3. 自动重启逻辑
 * 4. 定时检查执行
 * 5. 资源清理
 */

import { MCPLifecycleManager, MCPServerState } from '../../features/codex/mcpLifecycleManager';
import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';

// Mock child_process
jest.mock('child_process');

// Mock ConfigManager
jest.mock('../../utils/configManager', () => ({
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

describe('MCPLifecycleManager - 健康检查机制', () => {
  let manager: MCPLifecycleManager;
  let outputChannel: vscode.OutputChannel;
  let mockProcess: any;
  const capturedOutput: string[] = [];

  const mockExecSuccess = () => {
    (exec as unknown as jest.Mock).mockImplementation((cmd: string, options: any, callback?: any) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(null, 'codex version 1.0.0', '');
    });
  };

  beforeEach(() => {
    capturedOutput.length = 0;

    // 创建mock输出通道
    outputChannel = {
      appendLine: (line: string) => {
        capturedOutput.push(line);
      },
      show: jest.fn(),
      dispose: jest.fn()
    } as any;

    manager = new MCPLifecycleManager(outputChannel);

    // 创建mock进程
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn((signal) => {
        if (signal === 'SIGKILL') {
          mockProcess.killed = true;
        }
      }),
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    };

    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (manager && manager.getStatus().status !== 'stopped') {
        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'exit') {
            setImmediate(() => callback(0, null));
          }
        });
        await manager.stop();
      }
    } catch (error) {
      // 忽略
    }
  }, 10000);

  describe('_sendHealthCheckRequest() - TCP健康检查', () => {
    it('应该在进程不存在时返回失败', async () => {
      // 不启动进程，直接检查
      const result = await (manager as any)._sendHealthCheckRequest(8765);

      expect(result.ok).toBe(false);
      expect(capturedOutput.some(line => line.includes('process not running'))).toBe(true);
    });

    it('应该检查进程状态并尝试TCP连接', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 执行健康检查（会尝试TCP连接）
      const result = await (manager as any)._sendHealthCheckRequest(8765);

      // 由于没有真实的服务器，连接会失败
      expect(result.ok).toBe(false);
    });
  });

  describe('_handleHealthCheckFailure() - 失败处理', () => {
    it('应该在首次失败时增加计数', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 触发失败处理
      await (manager as any)._handleHealthCheckFailure();

      const status = manager.getStatus();
      expect(status.healthCheckFailures).toBe(1);
      expect(capturedOutput.some(line => line.includes('Health check failed (1/3)'))).toBe(true);
    });

    it('应该在失败2次后继续计数但不重启', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 触发2次失败
      await (manager as any)._handleHealthCheckFailure();
      await (manager as any)._handleHealthCheckFailure();

      const status = manager.getStatus();
      expect(status.healthCheckFailures).toBe(2);
      expect(status.status).toBe(MCPServerState.RUNNING); // 仍在运行
    });

    it('应该在失败3次后触发自动重启', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      const stopSpy = jest.spyOn(manager, 'stop');
      const ensureStartedSpy = jest.spyOn(manager, 'ensureStarted');

      await manager.ensureStarted();
      stopSpy.mockClear();
      ensureStartedSpy.mockClear();

      // 触发3次失败
      await (manager as any)._handleHealthCheckFailure();
      await (manager as any)._handleHealthCheckFailure();

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      await (manager as any)._handleHealthCheckFailure();

      // 验证自动重启
      expect(stopSpy).toHaveBeenCalled();
      expect(ensureStartedSpy).toHaveBeenCalled();
      expect(capturedOutput.some(line => line.includes('Max health check failures reached'))).toBe(true);
    });

    it('应该在自动重启失败后设置错误状态', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // Mock ensureStarted失败
      jest.spyOn(manager, 'ensureStarted').mockRejectedValueOnce(new Error('Restart failed'));

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      // 触发3次失败
      (manager as any).healthCheckFailureCount = 2;

      await (manager as any)._handleHealthCheckFailure();

      const status = manager.getStatus();
      expect(status.status).toBe(MCPServerState.ERROR);
      expect(status.error?.message).toContain('Auto-restart failed');
      expect(capturedOutput.some(line => line.includes('Auto-restart failed'))).toBe(true);
    });
  });

  describe('getStatus() - 状态报告', () => {
    it('应该包含健康检查失败次数', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      (manager as any).healthCheckFailureCount = 2;

      const status = manager.getStatus();
      expect(status.healthCheckFailures).toBe(2);
    });

    it('应该包含最后健康检查时间', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      const healthCheckSpy = jest.spyOn(manager as any, '_sendHealthCheckRequest')
        .mockResolvedValue({ ok: true });

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      const beforeCheck = new Date();
      await manager.healthCheck();
      const afterCheck = new Date();

      const status = manager.getStatus();
      expect(status.lastHealthCheck).toBeDefined();
      expect(status.lastHealthCheck!.getTime()).toBeGreaterThanOrEqual(beforeCheck.getTime());
      expect(status.lastHealthCheck!.getTime()).toBeLessThanOrEqual(afterCheck.getTime());
    });

    it('应该在重启时重置失败计数', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 检查初始失败计数
      const initialStatus = manager.getStatus();
      expect(initialStatus.healthCheckFailures).toBe(0);

      // 模拟失败
      (manager as any).healthCheckFailureCount = 2;

      // 重启
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });
      await manager.stop();
      await manager.ensureStarted();

      // 验证失败计数重置
      const newStatus = manager.getStatus();
      expect(newStatus.healthCheckFailures).toBe(0);
    });
  });

  describe('_startHealthChecks() - 定时检查', () => {
    it('应该在启动时记录健康检查配置', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      expect(capturedOutput.some(line =>
        line.includes('Starting health checks') &&
        line.includes('interval: 30000ms') &&
        line.includes('max failures: 3')
      )).toBe(true);
    });

    it('应该在停止时清理定时器', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await manager.ensureStarted();

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      await manager.stop();

      // 验证清理了定时器
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('healthCheck() - 健康检查', () => {
    it('应该正确报告健康状态', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });
      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 健康检查
      const healthy = await manager.healthCheck();
      expect(healthy).toBe(true);

      const status = manager.getStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.lastHealthCheck).toBeDefined();
    });

    it('应该检测不健康状态', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      const healthCheckSpy = jest.spyOn(manager as any, '_sendHealthCheckRequest');
      healthCheckSpy.mockResolvedValueOnce({ ok: true });  // 启动时成功

      jest.spyOn(manager as any, '_waitForReady').mockResolvedValue({ status: 'running' });

      await manager.ensureStarted();

      // 恢复原始实现，然后重新mock为失败
      healthCheckSpy.mockRestore();
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: false });

      // 健康检查失败
      const healthy = await manager.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
