/**
 * CodexExecutor重连场景集成测试
 *
 * 测试覆盖:
 * - 需求8.3: 连接中断后的重连逻辑（最多3次，间隔10秒）
 * - 需求8.4: 重连失败后的状态保存
 *
 * 测试场景:
 * 1. 模拟连接中断后成功重连（第1次尝试）
 * 2. 模拟连接中断后成功重连（第2次尝试）
 * 3. 模拟连接中断后成功重连（第3次尝试）
 * 4. 模拟连接中断后所有重连尝试失败
 * 5. 模拟重连过程中避免重复重连
 * 6. 模拟重连成功后恢复心跳
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodexExecutor } from '../../features/codex/codexExecutor';
import { SessionStateManager } from '../../features/codex/sessionStateManager';
import { Session } from '../../features/codex/types';

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

/**
 * 模拟MCP客户端
 */
class MockMCPClient {
  private _connected = false;
  private _shouldFailReconnect = false;
  private _reconnectAttemptToSucceed = 1;
  private _currentAttempt = 0;

  isConnected(): boolean {
    return this._connected;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async connect(): Promise<void> {
    this._currentAttempt++;

    if (this._shouldFailReconnect) {
      if (this._currentAttempt < this._reconnectAttemptToSucceed) {
        throw new Error('Connection refused');
      }
    }

    this._connected = true;
  }

  // 测试辅助方法
  simulateDisconnection(): void {
    this._connected = false;
  }

  setShouldFailReconnect(shouldFail: boolean, attemptToSucceed: number = 999): void {
    this._shouldFailReconnect = shouldFail;
    this._reconnectAttemptToSucceed = attemptToSucceed;
    this._currentAttempt = 0;
  }

  reset(): void {
    this._connected = false;
    this._shouldFailReconnect = false;
    this._reconnectAttemptToSucceed = 1;
    this._currentAttempt = 0;
  }
}

describe('CodexExecutor Reconnection Scenarios Test Suite', () => {
  let outputChannel: MockOutputChannel;
  let sessionStateManager: MockSessionStateManager;
  let executor: CodexExecutor;
  let mockMcpClient: MockMCPClient;
  let testSession: Session;

  beforeEach(() => {
    outputChannel = new MockOutputChannel();
    sessionStateManager = new MockSessionStateManager();
    executor = new CodexExecutor(outputChannel, sessionStateManager as any);
    mockMcpClient = new MockMCPClient();

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
    mockMcpClient.reset();
    await executor.dispose();
  });

  describe('重连成功场景', () => {
    test('第1次重连尝试成功', async () => {
      // 设置模拟客户端在第1次尝试时成功
      mockMcpClient.setShouldFailReconnect(false);

      // 注入模拟客户端
      (executor as any).mcpClient = mockMcpClient;

      // 模拟断开连接
      mockMcpClient.simulateDisconnection();

      // 清空日志
      outputChannel.clear();

      // 触发重连（使用较短的超时来加快测试）
      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100; // 100ms用于测试

      try {
        // 模拟_ensureMCPClient以使用我们的mock客户端
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        await (executor as any)._handleConnectionLoss(testSession);

        // 验证日志
        const logs = outputChannel.messages.join('');
        assert.ok(
          logs.includes('Reconnection attempt 1/3'),
          '应记录第1次重连尝试'
        );
        assert.ok(
          logs.includes('Reconnected successfully on attempt 1'),
          '应记录重连成功'
        );

        // 验证重连计数器已重置
        assert.strictEqual(
          (executor as any).reconnectAttempts,
          0,
          '重连成功后计数器应重置'
        );
        assert.strictEqual(
          (executor as any).isReconnecting,
          false,
          '重连成功后标志应重置'
        );
      } finally {
        // 恢复原始配置
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });

    test('第2次重连尝试成功', async () => {
      // 设置模拟客户端在第2次尝试时成功
      mockMcpClient.setShouldFailReconnect(true, 2);

      // 注入模拟客户端
      (executor as any).mcpClient = mockMcpClient;

      // 使用较短的超时
      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      outputChannel.clear();

      try {
        // 模拟_ensureMCPClient以使用我们的mock客户端
        const originalEnsure = (executor as any)._ensureMCPClient.bind(executor);
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        await (executor as any)._handleConnectionLoss(testSession);

        const logs = outputChannel.messages.join('');
        assert.ok(
          logs.includes('Reconnection attempt 1/3'),
          '应记录第1次重连尝试'
        );
        assert.ok(
          logs.includes('Reconnection attempt 1 failed'),
          '第1次应失败'
        );
        assert.ok(
          logs.includes('Reconnection attempt 2/3'),
          '应记录第2次重连尝试'
        );
        assert.ok(
          logs.includes('Reconnected successfully on attempt 2'),
          '第2次应成功'
        );

        // 恢复原始方法
        (executor as any)._ensureMCPClient = originalEnsure;
      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });

    test('重连成功后应重启心跳', async () => {
      mockMcpClient.setShouldFailReconnect(false);
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      try {
        // 模拟_ensureMCPClient以使用我们的mock客户端
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        // 确保初始没有心跳
        (executor as any)._stopHeartbeat();
        assert.strictEqual(
          (executor as any).heartbeatTimer,
          undefined,
          '初始应无心跳定时器'
        );

        await (executor as any)._handleConnectionLoss(testSession);

        // 验证心跳已重启
        assert.ok(
          (executor as any).heartbeatTimer,
          '重连成功后应重启心跳定时器'
        );

        // 清理
        (executor as any)._stopHeartbeat();
      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });
  });

  describe('重连失败场景', () => {
    test('所有3次重连尝试都失败', async () => {
      // 设置所有重连尝试都失败
      mockMcpClient.setShouldFailReconnect(true, 999);

      // 注入模拟客户端
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      outputChannel.clear();

      try {
        // 模拟_ensureMCPClient
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        await (executor as any)._handleConnectionLoss(testSession);

        const logs = outputChannel.messages.join('');

        // 验证所有3次尝试
        assert.ok(
          logs.includes('Reconnection attempt 1/3'),
          '应记录第1次重连尝试'
        );
        assert.ok(
          logs.includes('Reconnection attempt 2/3'),
          '应记录第2次重连尝试'
        );
        assert.ok(
          logs.includes('Reconnection attempt 3/3'),
          '应记录第3次重连尝试'
        );

        // 验证失败消息
        assert.ok(
          logs.includes('All reconnection attempts failed'),
          '应记录所有重连尝试失败'
        );

        // 验证状态已保存
        const checkpoints = sessionStateManager.checkpoints.get(testSession.id);
        assert.ok(checkpoints, '应创建检查点');
        assert.ok(checkpoints!.length > 0, '应有至少一个检查点');

        // 验证会话状态已更新为失败
        const sessionStatus = sessionStateManager.sessionStatuses.get(testSession.id);
        assert.strictEqual(sessionStatus, 'failed', '会话状态应更新为failed');

      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });

    test('重连失败后应保存详细状态', async () => {
      mockMcpClient.setShouldFailReconnect(true, 999);
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      try {
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        // 添加一些活跃请求
        (executor as any).activeRequests.set('req-1', {
          controller: new AbortController(),
          startTime: new Date()
        });
        (executor as any).activeRequests.set('req-2', {
          controller: new AbortController(),
          startTime: new Date()
        });

        await (executor as any)._handleConnectionLoss(testSession);

        // 验证检查点包含详细信息
        const checkpoints = sessionStateManager.checkpoints.get(testSession.id);
        assert.ok(checkpoints, '应创建检查点');

        const checkpoint = checkpoints![0];
        assert.ok(checkpoint.state.disconnectedAt, '应记录断开时间');
        assert.ok(checkpoint.state.error, '应记录错误信息');
        assert.strictEqual(
          checkpoint.state.reconnectAttempts,
          3,
          '应记录重连尝试次数'
        );
        assert.ok(
          Array.isArray(checkpoint.state.activeRequests),
          '应记录活跃请求列表'
        );

      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });
  });

  describe('重连防护机制', () => {
    test('重连进行中时不应开始新的重连', async () => {
      mockMcpClient.setShouldFailReconnect(false);
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      try {
        // 手动设置为重连中
        (executor as any).isReconnecting = true;

        outputChannel.clear();

        // 尝试触发重连
        await (executor as any)._handleConnectionLoss(testSession);

        const logs = outputChannel.messages.join('');

        // 不应记录任何重连尝试
        assert.ok(
          !logs.includes('Reconnection attempt'),
          '重连进行中时不应开始新的重连'
        );

        // 重置标志
        (executor as any).isReconnecting = false;

      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });

    test('重连完成后应重置isReconnecting标志', async () => {
      mockMcpClient.setShouldFailReconnect(false);
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      try {
        // 初始应为false
        assert.strictEqual(
          (executor as any).isReconnecting,
          false,
          '初始isReconnecting应为false'
        );

        await (executor as any)._handleConnectionLoss(testSession);

        // 重连完成后应重置为false
        assert.strictEqual(
          (executor as any).isReconnecting,
          false,
          '重连完成后isReconnecting应重置为false'
        );

      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });
  });

  describe('重连配置验证', () => {
    test('应使用正确的最大重连次数', () => {
      const maxAttempts = (executor as any).MAX_RECONNECT_ATTEMPTS;
      assert.strictEqual(maxAttempts, 3, '最大重连次数应为3');
    });

    test('应使用正确的重连间隔', () => {
      const interval = (executor as any).RECONNECT_INTERVAL_MS;
      assert.strictEqual(interval, 10000, '重连间隔应为10秒(10000ms)');
    });

    test('心跳间隔应为30秒', () => {
      const interval = (executor as any).HEARTBEAT_INTERVAL_MS;
      assert.strictEqual(interval, 30000, '心跳间隔应为30秒(30000ms)');
    });
  });

  describe('边界条件和异常情况', () => {
    test('断开连接时MCP客户端为null不应崩溃', async () => {
      // 设置mcpClient为null
      (executor as any).mcpClient = null;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 100;

      try {
        // 应该不会抛出错误
        await assert.doesNotReject(
          async () => {
            await (executor as any)._handleConnectionLoss(testSession);
          },
          'MCP客户端为null时不应崩溃'
        );
      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });

    test('重连过程中dispose应优雅处理', async () => {
      mockMcpClient.setShouldFailReconnect(true, 999);
      (executor as any).mcpClient = mockMcpClient;

      const originalInterval = (executor as any).RECONNECT_INTERVAL_MS;
      (executor as any).RECONNECT_INTERVAL_MS = 500; // 稍长的间隔

      try {
        (executor as any)._ensureMCPClient = async () => {
          await mockMcpClient.connect();
        };

        // 启动重连（不等待）
        const reconnectPromise = (executor as any)._handleConnectionLoss(testSession);

        // 在重连过程中dispose
        await executor.dispose();

        // 等待重连完成（如果还在进行）
        await reconnectPromise.catch(() => {
          // 忽略错误
        });

        // 验证心跳已停止
        assert.strictEqual(
          (executor as any).heartbeatTimer,
          undefined,
          'dispose后心跳应停止'
        );

      } finally {
        (executor as any).RECONNECT_INTERVAL_MS = originalInterval;
      }
    });
  });
});
