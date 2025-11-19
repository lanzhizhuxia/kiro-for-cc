/**
 * MCP生命周期管理器集成测试
 *
 * 本测试使用模拟的进程来验证MCP管理器的完整生命周期，
 * 而不依赖真实的Codex CLI安装。
 *
 * 测试重点：
 * 1. 进程启动、监控和停止的完整流程
 * 2. stdout/stderr输出捕获
 * 3. 优雅关闭和强制终止
 * 4. 异常退出处理
 * 5. 状态管理
 */

import { MCPLifecycleManager, MCPServerState } from '../../features/codex/mcpLifecycleManager';
import * as vscode from 'vscode';
import { exec, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

describe('MCPLifecycleManager集成测试', () => {
  let manager: MCPLifecycleManager;
  let outputChannel: vscode.OutputChannel;
  let mockProcess: any;
  const capturedOutput: string[] = [];

  // Helper function to mock exec correctly (handles both 2 and 3 parameter versions)
  const mockExecSuccess = () => {
    (exec as unknown as jest.Mock).mockImplementation((cmd: string, options: any, callback?: any) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(null, 'codex version 1.0.0', '');
    });
  };

  const mockExecFailure = (error: Error) => {
    (exec as unknown as jest.Mock).mockImplementation((cmd: string, options: any, callback?: any) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(error, '', '');
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

    // 创建完整的mock进程
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn((signal) => {
        if (signal === 'SIGKILL') {
          mockProcess.killed = true;
        }
      }),
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

  afterEach(async () => {
    try {
      await manager.stop();
    } catch (error) {
      // 忽略
    }
  });

  describe('完整生命周期流程', () => {
    it('应该完成启动→运行→停止的完整流程', async () => {
      mockExecSuccess();

      // Mock spawn
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);

      // Mock健康检查 - 重要：在_waitForReady期间返回true
      const healthCheckSpy = jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      // 1. 启动
      const startStatus = await manager.ensureStarted();
      expect(startStatus.status).toBe(MCPServerState.RUNNING);
      expect(startStatus.pid).toBe(12345);
      expect(startStatus.port).toBe(8765);

      // 验证启动日志
      expect(capturedOutput.some(line => line.includes('Starting MCP server'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('started'))).toBe(true);

      // 2. 运行中 - 健康检查
      const healthy = await manager.healthCheck();
      expect(healthy).toBe(true);

      // 3. 停止
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setImmediate(() => callback(0, null));
        }
      });

      await manager.stop();
      const stopStatus = manager.getStatus();
      expect(stopStatus.status).toBe(MCPServerState.STOPPED);
      expect(capturedOutput.some(line => line.includes('stopped'))).toBe(true);
    }, 15000); // 15秒超时
  });

  describe('进程输出监听', () => {
    it('应该捕获stdout输出', async () => {
      mockExecSuccess();

      let stdoutCallback: Function;
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟stdout输出
      stdoutCallback!(Buffer.from('Server listening on port 8765\n'));
      stdoutCallback!(Buffer.from('MCP server ready\n'));

      // 验证输出被捕获
      expect(capturedOutput.some(line => line.includes('Server listening'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('MCP server ready'))).toBe(true);
    });

    it('应该捕获stderr输出', async () => {
      mockExecSuccess();

      let stderrCallback: Function;
      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟stderr输出
      stderrCallback!(Buffer.from('Warning: deprecated API\n'));

      // 验证错误输出被捕获
      expect(capturedOutput.some(line => line.includes('Error') && line.includes('deprecated'))).toBe(true);
    });
  });

  describe('优雅关闭测试', () => {
    it('应该先发送SIGTERM，进程及时退出时不发送SIGKILL', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟进程快速响应SIGTERM
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setTimeout(() => callback(0, null), 100); // 100ms后退出
        }
      });

      await manager.stop();

      // 验证只发送了SIGTERM
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).not.toHaveBeenCalledWith('SIGKILL');
    });

    it('应该在5秒超时后发送SIGKILL', async () => {
      jest.useFakeTimers();

      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟进程不响应SIGTERM
      mockProcess.on.mockImplementation(() => {
        // 不触发exit事件
      });

      const stopPromise = manager.stop();

      // 快进5秒
      jest.advanceTimersByTime(5000);

      await stopPromise;

      // 验证发送了SIGTERM和SIGKILL
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(capturedOutput.some(line => line.includes('forcing kill'))).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('进程异常退出处理', () => {
    it('应该检测并记录进程意外退出', async () => {
      mockExecSuccess();

      let exitCallback: Function;
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          exitCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();
      expect(manager.getStatus().status).toBe(MCPServerState.RUNNING);

      // 模拟进程崩溃
      exitCallback!(1, 'SIGSEGV');

      // 验证状态更新
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
      expect(capturedOutput.some(line => line.includes('exited with code 1'))).toBe(true);
    });

    it('应该检测并记录进程错误', async () => {
      mockExecSuccess();

      let errorCallback: Function;
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      // 模拟进程错误
      errorCallback!(new Error('ENOENT: command not found'));

      // 验证状态更新
      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
      expect(manager.getStatus().error?.message).toContain('ENOENT');
      expect(capturedOutput.some(line => line.includes('Process error'))).toBe(true);
    });
  });

  describe('状态机转换', () => {
    it('应该正确处理STOPPED → STARTING → RUNNING转换', async () => {
      // 初始状态
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);

      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      // 启动
      const status = await manager.ensureStarted();

      // 最终状态
      expect(status.status).toBe(MCPServerState.RUNNING);
    });

    it('应该正确处理启动失败时的ERROR状态', async () => {
      mockExecFailure(new Error('Command failed'));

      try {
        await manager.ensureStarted();
        fail('Should throw error');
      } catch (error) {
        // 期望抛出错误
      }

      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
    });

    it('应该正确处理RUNNING → STOPPED转换', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();
      expect(manager.getStatus().status).toBe(MCPServerState.RUNNING);

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      await manager.stop();
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
    });
  });

  describe('健康检查机制', () => {
    it('应该正确报告健康状态', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

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

      const healthCheckSpy = jest.spyOn(manager as any, '_sendHealthCheckRequest')
        .mockResolvedValueOnce({ ok: true })  // 启动时成功
        .mockResolvedValueOnce({ ok: false }); // 后续检查失败

      await manager.ensureStarted();

      // 健康检查失败
      const healthy = await manager.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('并发控制', () => {
    it('应该处理多个并发启动请求', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      // 同时发起多个启动请求
      const [result1, result2, result3] = await Promise.all([
        manager.ensureStarted(),
        manager.ensureStarted(),
        manager.ensureStarted()
      ]);

      // 应该返回相同的PID
      expect(result1.pid).toBe(result2.pid);
      expect(result2.pid).toBe(result3.pid);

      // spawn应该只被调用一次
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('资源清理', () => {
    it('应该在停止时清理所有定时器', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

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

    it('应该支持多次停止调用（幂等性）', async () => {
      mockExecSuccess();
      (spawn as unknown as jest.Mock).mockReturnValue(mockProcess);
      jest.spyOn(manager as any, '_sendHealthCheckRequest').mockResolvedValue({ ok: true });

      await manager.ensureStarted();

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          callback(0, null);
        }
      });

      // 多次停止
      await manager.stop();
      await manager.stop();
      await manager.stop();

      // kill应该只被调用一次
      expect(mockProcess.kill).toHaveBeenCalledTimes(1);
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
    });
  });

  describe('错误处理', () => {
    it('应该处理spawn失败', async () => {
      mockExecSuccess();

      (spawn as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(manager.ensureStarted()).rejects.toThrow('Spawn failed');
      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
    });

    it('应该处理配置加载失败', async () => {
      const ConfigManager = require('../../utils/configManager').ConfigManager;
      ConfigManager.getInstance().getSettings.mockRejectedValueOnce(new Error('Config error'));

      await expect(manager.ensureStarted()).rejects.toThrow();
      expect(manager.getStatus().status).toBe(MCPServerState.ERROR);
    });
  });
});
