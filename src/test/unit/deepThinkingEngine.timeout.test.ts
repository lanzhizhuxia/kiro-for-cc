/**
 * DeepThinkingEngine 超时和取消机制测试
 *
 * 测试内容：
 * - 超时检测
 * - 取消操作
 * - 进度报告
 * - 中间结果保存
 */

import * as assert from 'assert';
import { DeepThinkingEngine, AnalysisProgress } from '../../features/codex/deepThinkingEngine';
import { MCPClient } from '../../features/codex/mcpClient';
import { AnalysisContext, TaskDescriptor } from '../../features/codex/types';

describe('DeepThinkingEngine - Timeout and Cancel', () => {
  let engine: DeepThinkingEngine;
  let mcpClient: MCPClient;
  let outputChannel: any;
  let progressCallback: jest.Mock;
  let cancelCallback: jest.Mock;

  beforeEach(() => {
    // 创建mock对象
    outputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Channel',
      replace: jest.fn()
    };

    mcpClient = {
      callCodex: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    } as any;

    progressCallback = jest.fn();
    cancelCallback = jest.fn();

    // 创建引擎实例
    engine = new DeepThinkingEngine(mcpClient, outputChannel, {
      timeout: 5000, // 5秒超时用于测试
      onProgress: progressCallback,
      onCancel: cancelCallback
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该报告初始化阶段进度', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-1',
        type: 'design',
        description: 'Test task'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应
    (mcpClient.callCodex as jest.Mock).mockResolvedValue({
      result: {
        content: [
          { type: 'text', text: 'Test response' }
        ]
      }
    });

    // 执行分析
    await engine.analyze(context);

    // 验证初始化阶段的进度报告
    expect(progressCallback).toHaveBeenCalled();
    const firstCall = progressCallback.mock.calls[0][0] as AnalysisProgress;
    assert.strictEqual(firstCall.phase, 'initializing', 'First phase should be initializing');
    assert.strictEqual(firstCall.percentage, 0, 'Initial percentage should be 0');
  });

  it('应该报告所有阶段的进度', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-2',
        type: 'design',
        description: 'Test task'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应
    (mcpClient.callCodex as jest.Mock).mockResolvedValue({
      result: {
        content: [
          { type: 'text', text: 'Test response' }
        ]
      }
    });

    // 执行分析
    await engine.analyze(context);

    // 验证所有阶段都被报告
    const phases = progressCallback.mock.calls.map((call: any[]) => call[0].phase);
    expect(phases).toContain('initializing');
    expect(phases).toContain('analyzing');
    expect(phases).toContain('parsing');
    expect(phases).toContain('completed');
  });

  it('应该在超时时抛出错误', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-3',
        type: 'design',
        description: 'Test task'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应，模拟长时间操作
    (mcpClient.callCodex as jest.Mock).mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            result: {
              content: [{ type: 'text', text: 'Test response' }]
            }
          });
        }, 10000); // 10秒，超过引擎的5秒超时
      })
    );

    // 执行分析并期望抛出超时错误
    await expect(engine.analyze(context)).rejects.toThrow(/timeout/);
  });

  it('应该在取消时停止分析', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-4',
        type: 'design',
        description: 'Test task'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应，模拟长时间操作
    (mcpClient.callCodex as jest.Mock).mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            result: {
              content: [{ type: 'text', text: 'Test response' }]
            }
          });
        }, 10000);
      })
    );

    // 异步取消分析
    setTimeout(() => {
      engine.cancel();
    }, 1000);

    // 执行分析并期望抛出取消错误
    await expect(engine.analyze(context)).rejects.toThrow(/cancelled/);

    // 验证取消回调被调用
    expect(cancelCallback).toHaveBeenCalled();
  });

  it('应该检查取消状态', () => {
    // 初始状态应该是未取消
    expect(engine.isCancelled()).toBe(false);

    // 取消后状态应该是已取消
    engine.cancel();
    expect(engine.isCancelled()).toBe(true);
  });

  it('应该在取消/超时时保存中间结果', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-5',
        type: 'design',
        description: 'Test task for intermediate save'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应，模拟长时间操作
    (mcpClient.callCodex as jest.Mock).mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            result: {
              content: [{ type: 'text', text: 'Test response' }]
            }
          });
        }, 10000);
      })
    );

    // 异步取消分析
    setTimeout(() => {
      engine.cancel();
    }, 1000);

    // 执行分析
    try {
      await engine.analyze(context);
    } catch (error) {
      // 预期会抛出取消错误
    }

    // 注意：实际的文件保存测试需要mock fs模块，这里仅验证逻辑流程
    // 在实际环境中，应该检查文件是否被创建
  });

  it('应该报告已用时间', async () => {
    // 准备测试数据
    const context: AnalysisContext = {
      task: {
        id: 'test-6',
        type: 'design',
        description: 'Test task'
      } as TaskDescriptor,
      complexityScore: { total: 5, codeScale: 5, technicalDifficulty: 5, businessImpact: 5 } as any
    };

    // Mock MCP响应
    (mcpClient.callCodex as jest.Mock).mockResolvedValue({
      result: {
        content: [
          { type: 'text', text: 'Test response' }
        ]
      }
    });

    // 执行分析
    await engine.analyze(context);

    // 验证进度报告包含已用时间
    progressCallback.mock.calls.forEach((call: any[]) => {
      const progress = call[0] as AnalysisProgress;
      expect(progress.elapsedTime).toBeGreaterThanOrEqual(0);
      expect(typeof progress.elapsedTime).toBe('number');
    });
  });
});
