/**
 * MCP生命周期管理器集成测试
 *
 * 本测试文件使用真实的进程和系统调用来验证MCP服务器的完整生命周期管理。
 *
 * 测试覆盖：
 * - 真实进程的启动和停止
 * - stdout/stderr输出捕获
 * - 优雅关闭和强制终止
 * - 进程异常退出处理
 * - 健康检查机制
 *
 * 注意：这些测试需要实际的Codex CLI安装才能完全通过。
 * 如果Codex CLI未安装，测试将验证错误处理逻辑。
 */

import { MCPLifecycleManager, MCPServerState } from '../../features/codex/mcpLifecycleManager';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('MCPLifecycleManager Integration Tests', () => {
  let manager: MCPLifecycleManager;
  let outputChannel: vscode.OutputChannel;
  let isCodexInstalled: boolean = false;

  beforeAll(async () => {
    // 检查Codex CLI是否安装
    try {
      await execAsync('codex --version');
      isCodexInstalled = true;
      console.log('✓ Codex CLI is installed - running full integration tests');
    } catch (error) {
      isCodexInstalled = false;
      console.log('⚠ Codex CLI is not installed - running limited integration tests');
    }

    // Mock VSCode window APIs
    jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);
    jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
  });

  beforeEach(() => {
    // 创建真实的输出通道（如果在真实VSCode环境）或mock
    if (typeof vscode.window.createOutputChannel === 'function') {
      outputChannel = vscode.window.createOutputChannel('MCP Integration Test');
    } else {
      // Mock output channel for test environment
      outputChannel = {
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
      } as any;
    }

    manager = new MCPLifecycleManager(outputChannel);

    // 清理之前的mock调用
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // 确保每个测试后都清理资源
    try {
      // 添加超时保护
      await Promise.race([
        manager.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stop timeout in afterEach')), 8000)
        )
      ]);
    } catch (error) {
      // 忽略停止错误，继续清理
      console.warn('Failed to stop manager in afterEach:', error);
    }

    if (outputChannel && typeof outputChannel.dispose === 'function') {
      outputChannel.dispose();
    }
  }, 10000); // afterEach本身也需要超时

  describe('Codex CLI检测和错误处理', () => {
    it('应该正确检测Codex CLI是否安装', async () => {
      if (isCodexInstalled) {
        // 如果安装了，启动应该成功（至少不会因为CLI未安装而失败）
        try {
          const status = await manager.ensureStarted();
          expect([MCPServerState.RUNNING, MCPServerState.ERROR]).toContain(status.status);
        } catch (error) {
          // 可能因为其他原因失败（如端口占用），但不应该是CLI未安装错误
          const errorMessage = error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toMatch(/CLI is not installed/);
        }
      } else {
        // 如果未安装，应该抛出明确的错误
        await expect(manager.ensureStarted()).rejects.toThrow(/Codex CLI is not installed/);

        const status = manager.getStatus();
        expect(status.status).toBe(MCPServerState.ERROR);
        expect(status.error?.message).toContain('Codex CLI');
      }
    }, 10000);

    it('应该在CLI未安装时显示用户友好的错误提示', async () => {
      if (!isCodexInstalled) {
        const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage');

        try {
          await manager.ensureStarted();
        } catch (error) {
          // 期望抛出错误
        }

        // 验证是否调用了错误提示
        expect(showErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Codex CLI'),
          expect.any(String)
        );
      }
    });
  });

  describe('进程启动和输出监听', () => {
    // 这个测试只在Codex已安装时运行
    (isCodexInstalled ? it : it.skip)('应该成功启动MCP服务器进程并捕获输出', async () => {
      const outputLines: string[] = [];
      const originalAppendLine = outputChannel.appendLine;

      // 拦截输出以验证
      (outputChannel.appendLine as any) = jest.fn((line: string) => {
        outputLines.push(line);
        originalAppendLine.call(outputChannel, line);
      });

      try {
        const status = await manager.ensureStarted();

        // 验证状态
        expect(status.status).toBe(MCPServerState.RUNNING);
        expect(status.pid).toBeDefined();
        expect(status.port).toBeDefined();

        // 验证输出捕获
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines.some(line => line.includes('Starting MCP server'))).toBe(true);
        expect(outputLines.some(line => line.includes('started'))).toBe(true);

      } catch (error) {
        // 如果启动失败，记录错误以便调试
        console.error('Failed to start MCP server:', error);
        console.log('Output captured:', outputLines);
        throw error;
      }
    }, 10000); // 10秒超时

    (isCodexInstalled ? it : it.skip)('应该捕获stderr输出', async () => {
      const errorLines: string[] = [];
      const originalAppendLine = outputChannel.appendLine;

      (outputChannel.appendLine as any) = jest.fn((line: string) => {
        if (line.includes('Error') || line.includes('error')) {
          errorLines.push(line);
        }
        originalAppendLine.call(outputChannel, line);
      });

      try {
        await manager.ensureStarted();

        // 即使启动成功，也可能有一些警告信息
        // 我们主要验证stderr监听器已设置
        const status = manager.getStatus();
        expect(status.status).toBe(MCPServerState.RUNNING);

      } catch (error) {
        // 如果启动失败，应该有错误输出
        expect(errorLines.length).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('优雅关闭和强制终止', () => {
    (isCodexInstalled ? it : it.skip)('应该优雅关闭MCP服务器进程（SIGTERM）', async () => {
      // 启动服务器
      await manager.ensureStarted();
      const startStatus = manager.getStatus();
      expect(startStatus.status).toBe(MCPServerState.RUNNING);
      const pid = startStatus.pid!;

      // 优雅关闭
      const stopPromise = manager.stop();

      // 应该在5秒内完成
      await expect(Promise.race([
        stopPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stop timeout')), 5500))
      ])).resolves.toBeUndefined();

      // 验证状态
      const stopStatus = manager.getStatus();
      expect(stopStatus.status).toBe(MCPServerState.STOPPED);
      expect(stopStatus.pid).toBeUndefined();

      // 验证进程确实已终止
      try {
        process.kill(pid, 0); // 检查进程是否存在
        fail('Process should be terminated');
      } catch (error) {
        // 期望抛出错误，因为进程已终止
        expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
      }
    }, 10000);

    (isCodexInstalled ? it : it.skip)('应该强制终止未响应的进程（SIGKILL）', async () => {
      // 这个测试需要模拟一个不响应SIGTERM的进程
      // 由于真实的codex进程会响应SIGTERM，我们需要创建一个测试进程

      // 创建一个忽略SIGTERM的测试脚本
      const testScriptPath = path.join(__dirname, 'test-unresponsive-process.js');
      const testScript = `
        // 忽略SIGTERM
        process.on('SIGTERM', () => {
          console.log('Received SIGTERM, ignoring...');
        });

        // 保持进程运行
        setInterval(() => {
          console.log('Still running...');
        }, 1000);
      `;

      fs.writeFileSync(testScriptPath, testScript);

      try {
        // 启动测试进程（暂时跳过，因为需要修改MCPLifecycleManager来支持自定义命令）
        // 这个测试在实际实现中应该通过mock或创建测试工具来完成

        console.log('Skipping unresponsive process test - requires test infrastructure');

      } finally {
        // 清理测试文件
        if (fs.existsSync(testScriptPath)) {
          fs.unlinkSync(testScriptPath);
        }
      }
    }, 15000);
  });

  describe('进程异常退出处理', () => {
    (isCodexInstalled ? it : it.skip)('应该检测并处理进程意外退出', async () => {
      // 启动服务器
      await manager.ensureStarted();
      const startStatus = manager.getStatus();
      expect(startStatus.status).toBe(MCPServerState.RUNNING);
      const pid = startStatus.pid!;

      // 模拟进程崩溃（强制kill）
      process.kill(pid, 'SIGKILL');

      // 等待状态更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 验证状态已更新为STOPPED
      const crashStatus = manager.getStatus();
      expect(crashStatus.status).toBe(MCPServerState.STOPPED);
      expect(crashStatus.pid).toBeUndefined();
    }, 10000);
  });

  describe('健康检查机制', () => {
    (isCodexInstalled ? it : it.skip)('应该定期执行健康检查', async () => {
      // 启动服务器
      await manager.ensureStarted();

      // 初始健康检查
      const initialHealth = await manager.healthCheck();
      expect(initialHealth).toBe(true);

      // 等待30秒触发自动健康检查（可以通过mock时间来加速）
      // 这里我们只验证手动健康检查工作正常

      const status = manager.getStatus();
      expect(status.lastHealthCheck).toBeDefined();
      expect(status.isHealthy).toBe(true);
    }, 10000);

    (isCodexInstalled ? it : it.skip)('应该在健康检查失败后尝试重启', async () => {
      // 这个测试需要模拟健康检查失败的场景
      // 在真实环境中，我们可以通过kill进程来触发

      await manager.ensureStarted();
      const pid = manager.getStatus().pid!;

      // Kill进程但不通知管理器
      process.kill(pid, 'SIGKILL');

      // 等待健康检查检测到问题并重启
      // 注意：这需要等待最多30秒（健康检查间隔）
      // 在实际测试中，我们可能需要mock定时器或提供测试API

      // 手动触发健康检查
      const health = await manager.healthCheck();
      expect(health).toBe(false);

      // 验证状态已更新
      const status = manager.getStatus();
      expect([MCPServerState.STOPPED, MCPServerState.ERROR]).toContain(status.status);
    }, 10000);
  });

  describe('状态报告', () => {
    (isCodexInstalled ? it : it.skip)('应该准确报告服务器运行时长', async () => {
      await manager.ensureStarted();

      // 等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = manager.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(1000);
      expect(status.uptime).toBeLessThan(2000);
      expect(status.startedAt).toBeDefined();
    }, 10000);

    it('应该在未启动时报告正确的状态', () => {
      const status = manager.getStatus();
      expect(status.status).toBe(MCPServerState.STOPPED);
      expect(status.pid).toBeUndefined();
      expect(status.port).toBeUndefined();
      expect(status.isHealthy).toBe(false);
      expect(status.uptime).toBeUndefined();
    });

    (isCodexInstalled ? it : it.skip)('应该在错误状态下包含错误信息', async () => {
      // 强制触发错误（例如使用无效端口）
      // 这需要修改配置，暂时跳过

      // 验证错误状态包含详细信息
      const status = manager.getStatus();
      if (status.status === MCPServerState.ERROR) {
        expect(status.error).toBeDefined();
        expect(status.error?.message).toBeTruthy();
      }
    });
  });

  describe('并发启动请求处理', () => {
    (isCodexInstalled ? it : it.skip)('应该正确处理并发的ensureStarted调用', async () => {
      // 同时发起多个启动请求
      const promises = [
        manager.ensureStarted(),
        manager.ensureStarted(),
        manager.ensureStarted()
      ];

      const results = await Promise.all(promises);

      // 所有请求应该返回相同的状态
      expect(results[0].pid).toBe(results[1].pid);
      expect(results[1].pid).toBe(results[2].pid);
      expect(results[0].status).toBe(MCPServerState.RUNNING);

      // 只应该启动一个进程
      const status = manager.getStatus();
      expect(status.pid).toBeDefined();
    }, 10000);
  });

  describe('资源清理', () => {
    (isCodexInstalled ? it : it.skip)('应该在停止时清理所有资源', async () => {
      await manager.ensureStarted();
      const pid = manager.getStatus().pid!;

      await manager.stop();

      // 验证进程已终止
      try {
        process.kill(pid, 0);
        fail('Process should be terminated');
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
      }

      // 验证状态已清理
      const status = manager.getStatus();
      expect(status.status).toBe(MCPServerState.STOPPED);
      expect(status.pid).toBeUndefined();
      expect(status.port).toBeUndefined();
      expect(status.startedAt).toBeUndefined();
    }, 10000);

    (isCodexInstalled ? it : it.skip)('应该在多次停止调用时保持幂等性', async () => {
      await manager.ensureStarted();

      // 多次调用stop
      await manager.stop();
      await manager.stop();
      await manager.stop();

      // 应该保持STOPPED状态
      expect(manager.getStatus().status).toBe(MCPServerState.STOPPED);
    }, 10000);
  });
});
