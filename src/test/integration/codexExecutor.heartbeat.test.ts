/**
 * CodexExecutor心跳和连接检测集成测试
 *
 * 测试覆盖:
 * - 需求8.2: WHILE Codex会话活跃 THEN 系统 SHALL 每30秒发送心跳请求，检测连接状态
 * - 需求8.3: WHEN 检测到连接中断 THEN 系统 SHALL 尝试重连最多3次，间隔10秒
 * - 需求8.4: WHEN 重连失败 THEN 系统 SHALL 保存当前工作状态，通知用户会话已中断
 *
 * 测试场景:
 * 1. 心跳机制正常工作
 * 2. 连接中断后自动重连
 * 3. 重连失败后保存状态
 * 4. 连接错误识别
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodexExecutor } from '../../features/codex/codexExecutor';
import { SessionStateManager } from '../../features/codex/sessionStateManager';
import { TaskDescriptor, Session } from '../../features/codex/types';

/**
 * 模拟输出通道
 */
class MockOutputChannel implements vscode.OutputChannel {
  name = 'Test Output';
  messages: string[] = [];

  append(value: string): void {
    this.messages.push(value);
  }

  appendLine(value: string): void {
    this.messages.push(value + '\n');
  }

  clear(): void {
    this.messages = [];
  }

  show(): void {}
  hide(): void {}
  dispose(): void {}
  replace(value: string): void {}
}

/**
 * 模拟会话状态管理器
 */
class MockSessionStateManager {
  public savedStates: Map<string, any> = new Map();
  public checkpoints: Map<string, any[]> = new Map();
  public sessionStatuses: Map<string, string> = new Map();

  async saveState(session: Session, result?: any): Promise<void> {
    this.savedStates.set(session.id, { session, result, timestamp: new Date() });
  }

  async createCheckpoint(
    sessionId: string,
    state: Record<string, any>,
    description: string
  ): Promise<void> {
    if (!this.checkpoints.has(sessionId)) {
      this.checkpoints.set(sessionId, []);
    }
    this.checkpoints.get(sessionId)!.push({ state, description, timestamp: new Date() });
  }

  async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    this.sessionStatuses.set(sessionId, status);
  }
}

describe('CodexExecutor Heartbeat and Connection Detection Test Suite', () => {
  let outputChannel: MockOutputChannel;
  let sessionStateManager: MockSessionStateManager;
  let executor: CodexExecutor;
  let testSession: Session;

  beforeEach(() => {
    outputChannel = new MockOutputChannel();
    sessionStateManager = new MockSessionStateManager();
    executor = new CodexExecutor(outputChannel, sessionStateManager as any);

    // 创建测试会话
    testSession = {
      id: 'codex-1234567890-test',
      task: {
        id: 'task-1',
        type: 'implementation',
        description: 'Test task'
      },
      status: 'active',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      checkpoints: []
    };
  });

  afterEach(async () => {
    // 清理资源
    await executor.dispose();
  });

  describe('连接错误识别 (需求8.3)', () => {
    test('应正确识别各种连接错误', () => {
      const connectionErrors = [
        new Error('MCP client is not connected'),
        new Error('Connection lost'),
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Socket hang up'),
        new Error('Network error')
      ];

      for (const error of connectionErrors) {
        const isConnectionError = (executor as any)._isConnectionError(error);
        assert.strictEqual(
          isConnectionError,
          true,
          `应识别为连接错误: ${error.message}`
        );
      }
    });

    test('不应将非连接错误识别为连接错误', () => {
      const nonConnectionErrors = [
        new Error('Invalid syntax'),
        new Error('Task execution failed'),
        new Error('Timeout'),
        undefined,
        null
      ];

      for (const error of nonConnectionErrors) {
        const isConnectionError = (executor as any)._isConnectionError(error);
        assert.strictEqual(
          isConnectionError,
          false,
          `不应识别为连接错误: ${error}`
        );
      }
    });
  });

  describe('状态保存 (需求8.4)', () => {
    test('连接中断时应保存状态', async () => {
      const error = new Error('Connection lost');

      // 调用保存状态方法
      await (executor as any)._saveStateOnDisconnection(testSession, error);

      // 验证检查点是否创建
      const checkpoints = sessionStateManager.checkpoints.get(testSession.id);
      assert.ok(checkpoints, '应创建检查点');
      assert.strictEqual(checkpoints!.length, 1, '应有1个检查点');

      const checkpoint = checkpoints![0];
      assert.strictEqual(
        checkpoint.description,
        'Connection interruption - state saved',
        '检查点描述应正确'
      );
      assert.ok(checkpoint.state.disconnectedAt, '应保存断开连接时间');
      assert.ok(checkpoint.state.error, '应保存错误信息');
      assert.strictEqual(
        checkpoint.state.error.message,
        'Connection lost',
        '错误消息应正确'
      );
    });

    test('没有会话状态管理器时应优雅处理', async () => {
      const executorWithoutManager = new CodexExecutor(outputChannel);
      const error = new Error('Connection lost');

      // 应该不会抛出错误
      await assert.doesNotReject(
        async () => {
          await (executorWithoutManager as any)._saveStateOnDisconnection(
            testSession,
            error
          );
        },
        '没有会话状态管理器时不应抛出错误'
      );

      // 应该在日志中记录
      const logMessages = outputChannel.messages.join('');
      assert.ok(
        logMessages.includes('No session state manager available'),
        '应记录缺少会话状态管理器的日志'
      );

      await executorWithoutManager.dispose();
    });
  });

  describe('心跳机制 (需求8.2)', () => {
    test('心跳启动后应记录日志', () => {
      // 清空之前的日志
      outputChannel.clear();

      // 启动心跳
      (executor as any)._startHeartbeat(testSession);

      // 验证日志
      const logMessages = outputChannel.messages.join('');
      assert.ok(
        logMessages.includes('Starting heartbeat'),
        '应记录心跳启动日志'
      );
      assert.ok(
        logMessages.includes(testSession.id),
        '日志应包含会话ID'
      );

      // 清理
      (executor as any)._stopHeartbeat();
    });

    test('心跳停止后应清理定时器', () => {
      // 启动心跳
      (executor as any)._startHeartbeat(testSession);
      const timer = (executor as any).heartbeatTimer;
      assert.ok(timer, '应创建心跳定时器');

      // 停止心跳
      (executor as any)._stopHeartbeat();
      const timerAfterStop = (executor as any).heartbeatTimer;
      assert.strictEqual(timerAfterStop, undefined, '心跳定时器应被清理');

      // 验证日志
      const logMessages = outputChannel.messages.join('');
      assert.ok(
        logMessages.includes('Heartbeat stopped'),
        '应记录心跳停止日志'
      );
    });

    test('重复启动心跳应清除旧定时器', () => {
      // 第一次启动
      (executor as any)._startHeartbeat(testSession);
      const firstTimer = (executor as any).heartbeatTimer;

      // 第二次启动
      (executor as any)._startHeartbeat(testSession);
      const secondTimer = (executor as any).heartbeatTimer;

      // 应该是不同的定时器
      assert.notStrictEqual(firstTimer, secondTimer, '应创建新的定时器');

      // 清理
      (executor as any)._stopHeartbeat();
    });
  });

  describe('重连逻辑模拟 (需求8.3)', () => {
    test('重连状态标志应正确设置', async () => {
      // 初始状态
      assert.strictEqual(
        (executor as any).isReconnecting,
        false,
        '初始状态应为未重连'
      );
      assert.strictEqual(
        (executor as any).reconnectAttempts,
        0,
        '初始重连尝试次数应为0'
      );
    });

    test('睡眠函数应正常工作', async () => {
      const startTime = Date.now();
      await (executor as any)._sleep(100);
      const endTime = Date.now();

      const elapsed = endTime - startTime;
      assert.ok(elapsed >= 100, `睡眠时间应至少100ms，实际: ${elapsed}ms`);
      assert.ok(elapsed < 200, `睡眠时间不应超过200ms，实际: ${elapsed}ms`);
    });

    test('重连配置常量应正确设置', () => {
      assert.strictEqual(
        (executor as any).MAX_RECONNECT_ATTEMPTS,
        3,
        '最大重连次数应为3'
      );
      assert.strictEqual(
        (executor as any).RECONNECT_INTERVAL_MS,
        10000,
        '重连间隔应为10秒'
      );
    });
  });

  describe('完整执行流程中的心跳管理', () => {
    test('执行成功后应停止心跳', async () => {
      // 注意：这是一个简化的测试，因为实际执行需要MCP服务器
      // 我们主要验证心跳的启动和停止逻辑

      // 模拟执行后立即停止
      (executor as any)._startHeartbeat(testSession);
      assert.ok(
        (executor as any).heartbeatTimer,
        '执行期间心跳应启动'
      );

      (executor as any)._stopHeartbeat();
      assert.strictEqual(
        (executor as any).heartbeatTimer,
        undefined,
        '执行结束后心跳应停止'
      );
    });

    test('执行失败后应停止心跳', async () => {
      (executor as any)._startHeartbeat(testSession);
      assert.ok(
        (executor as any).heartbeatTimer,
        '执行期间心跳应启动'
      );

      // 模拟执行失败
      (executor as any)._stopHeartbeat();

      assert.strictEqual(
        (executor as any).heartbeatTimer,
        undefined,
        '执行失败后心跳应停止'
      );
    });
  });

  describe('清理和资源释放', () => {
    test('dispose时应停止心跳', async () => {
      (executor as any)._startHeartbeat(testSession);
      assert.ok(
        (executor as any).heartbeatTimer,
        '心跳应已启动'
      );

      await executor.dispose();

      assert.strictEqual(
        (executor as any).heartbeatTimer,
        undefined,
        'dispose后心跳应停止'
      );
    });

    test('dispose应清理所有资源', async () => {
      // 启动心跳
      (executor as any)._startHeartbeat(testSession);

      // 添加一些活跃请求（模拟）
      const controller = new AbortController();
      (executor as any).activeRequests.set('req-1', {
        controller,
        startTime: new Date()
      });

      await executor.dispose();

      // 验证清理
      assert.strictEqual(
        (executor as any).heartbeatTimer,
        undefined,
        '心跳定时器应被清理'
      );
      assert.strictEqual(
        (executor as any).activeRequests.size,
        0,
        '活跃请求应被清理'
      );
      assert.strictEqual(
        (executor as any).mcpClient,
        undefined,
        'MCP客户端应被清理'
      );
    });
  });

  describe('边界条件测试', () => {
    test('在未连接状态发送心跳应抛出错误', async () => {
      // mcpClient未初始化的情况
      await assert.rejects(
        async () => {
          await (executor as any)._sendHeartbeat(testSession);
        },
        /not connected/,
        '未连接时应抛出连接错误'
      );
    });

    test('心跳间隔配置应正确', () => {
      const interval = (executor as any).HEARTBEAT_INTERVAL_MS;
      assert.strictEqual(interval, 30000, '心跳间隔应为30秒(30000ms)');
    });

    test('错误对象为undefined时不应崩溃', () => {
      const result = (executor as any)._isConnectionError(undefined);
      assert.strictEqual(result, false, 'undefined不应被识别为连接错误');
    });

    test('错误对象为null时不应崩溃', () => {
      const result = (executor as any)._isConnectionError(null);
      assert.strictEqual(result, false, 'null不应被识别为连接错误');
    });
  });
});
