/**
 * CodexExecutor 单元测试
 *
 * 测试 CodexExecutor 的核心功能：
 * - 执行任务流程
 * - 上下文准备
 * - MCP服务器集成
 * - 错误处理
 * - 请求取消
 */

import * as vscode from 'vscode';
import { CodexExecutor, MCPRequest, MCPResponse, ExecutionContext } from '../codexExecutor';
import { MCPLifecycleManager } from '../mcpLifecycleManager';
import {
  TaskDescriptor,
  Session,
  ExecutionOptions,
  MCPServerStatus
} from '../types';

// Mock VSCode
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn()
  },
  workspace: {
    workspaceFolders: []
  },
  env: {
    openExternal: jest.fn()
  },
  Uri: {
    parse: jest.fn((str: string) => ({ toString: () => str }))
  }
}));

// Mock MCPLifecycleManager
jest.mock('../mcpLifecycleManager');

describe('CodexExecutor', () => {
  let executor: CodexExecutor;
  let mockOutputChannel: vscode.OutputChannel;
  let mockMCPManager: jest.Mocked<MCPLifecycleManager>;

  // 创建测试用的任务描述符
  const createTestTask = (overrides?: Partial<TaskDescriptor>): TaskDescriptor => ({
    id: 'test-task-1',
    type: 'design',
    description: 'Test task description',
    specName: 'test-spec',
    relatedFiles: ['src/test.ts'],
    context: {
      requirements: 'Test requirements',
      design: 'Test design',
      tasks: 'Test tasks'
    },
    metadata: {
      testKey: 'testValue'
    },
    ...overrides
  });

  // 创建测试用的会话
  const createTestSession = (overrides?: Partial<Session>): Session => ({
    id: 'test-session-1',
    task: createTestTask(),
    status: 'active',
    createdAt: new Date(),
    lastActiveAt: new Date(),
    context: {
      options: {
        timeout: 300000
      }
    },
    ...overrides
  });

  beforeEach(() => {
    // 创建mock输出通道
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Output',
      replace: jest.fn()
    } as any;

    // 创建executor实例
    executor = new CodexExecutor(mockOutputChannel);

    // 获取mock的MCPLifecycleManager实例
    mockMCPManager = (executor as any).mcpManager as jest.Mocked<MCPLifecycleManager>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('应该成功执行任务', async () => {
      // Arrange
      const task = createTestTask();
      const session = createTestSession();
      const mockServerStatus: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        isHealthy: true,
        healthCheckFailures: 0,
        startedAt: new Date(),
        uptime: 5000
      };

      mockMCPManager.ensureStarted.mockResolvedValue(mockServerStatus);

      // Mock _sendMCPRequest
      const mockResponse: MCPResponse = {
        requestId: 'test-req-1',
        status: 'success',
        data: {
          output: 'Task completed successfully',
          generatedFiles: ['output.md'],
          metadata: { taskId: task.id }
        },
        timestamp: new Date()
      };
      jest.spyOn(executor as any, '_sendMCPRequest').mockResolvedValue(mockResponse);

      // Act
      const result = await executor.execute(task, session);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mode).toBe('codex');
      expect(result.sessionId).toBe(session.id);
      expect(result.output).toBe('Task completed successfully');
      expect(result.generatedFiles).toEqual(['output.md']);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // 验证MCP服务器已启动
      expect(mockMCPManager.ensureStarted).toHaveBeenCalled();

      // 验证日志输出
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Starting execution for task')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Execution completed successfully')
      );
    });

    it('应该在MCP服务器未运行时返回错误', async () => {
      // Arrange
      const task = createTestTask();
      const session = createTestSession();
      const mockServerStatus: MCPServerStatus = {
        status: 'error',
        healthCheckFailures: 0,
        error: {
          message: 'Server failed to start'
        }
      };

      mockMCPManager.ensureStarted.mockResolvedValue(mockServerStatus);

      // Act
      const result = await executor.execute(task, session);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('MCP server is not running');
    });

    it('应该在MCP请求失败时返回错误', async () => {
      // Arrange
      const task = createTestTask();
      const session = createTestSession();
      const mockServerStatus: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        healthCheckFailures: 0,
        isHealthy: true
      };

      mockMCPManager.ensureStarted.mockResolvedValue(mockServerStatus);

      // Mock _sendMCPRequest to throw error
      const testError = new Error('MCP request failed');
      jest.spyOn(executor as any, '_sendMCPRequest').mockRejectedValue(testError);

      // Act
      const result = await executor.execute(task, session);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('MCP request failed');
    });

    it('应该正确计算执行时长', async () => {
      // Arrange
      const task = createTestTask();
      const session = createTestSession();
      const mockServerStatus: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        healthCheckFailures: 0
      };

      mockMCPManager.ensureStarted.mockResolvedValue(mockServerStatus);

      // Mock _sendMCPRequest with delay
      const mockResponse: MCPResponse = {
        requestId: 'test-req-1',
        status: 'success',
        data: {
          output: 'Task completed'
        },
        timestamp: new Date()
      };
      jest.spyOn(executor as any, '_sendMCPRequest').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return mockResponse;
      });

      // Act
      const result = await executor.execute(task, session);

      // Assert
      expect(result.duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('prepareContext()', () => {
    it('应该正确准备执行上下文', async () => {
      // Arrange
      const task = createTestTask({
        relatedFiles: ['file1.ts', 'file2.ts'],
        context: {
          requirements: 'Test requirements',
          design: 'Test design',
          tasks: 'Test tasks',
          additionalContext: {
            customKey: 'customValue'
          }
        },
        metadata: {
          priority: 'high'
        }
      });

      // Act
      const context = await executor.prepareContext(task);

      // Assert
      expect(context.task).toEqual(task);
      expect(context.customContext).toBeDefined();
      expect(context.customContext?.requirements).toBe('Test requirements');
      expect(context.customContext?.design).toBe('Test design');
      expect(context.customContext?.tasks).toBe('Test tasks');
      expect(context.customContext?.customKey).toBe('customValue');
      expect(context.customContext?.taskMetadata).toEqual({ priority: 'high' });
    });

    it('应该处理没有上下文的任务', async () => {
      // Arrange
      const task = createTestTask({
        context: undefined,
        metadata: undefined
      });

      // Act
      const context = await executor.prepareContext(task);

      // Assert
      expect(context.task).toEqual(task);
      expect(context.customContext).toBeUndefined();
    });

    it('应该记录日志', async () => {
      // Arrange
      const task = createTestTask();

      // Act
      await executor.prepareContext(task);

      // Assert
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Preparing context for task')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Context prepared')
      );
    });
  });

  describe('checkServerStatus()', () => {
    it('应该返回MCP服务器状态', async () => {
      // Arrange
      const mockStatus: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        healthCheckFailures: 0,
        isHealthy: true
      };
      mockMCPManager.getStatus.mockReturnValue(mockStatus);

      // Act
      const status = await executor.checkServerStatus();

      // Assert
      expect(status).toEqual(mockStatus);
      expect(mockMCPManager.getStatus).toHaveBeenCalled();
    });
  });

  describe('stopServer()', () => {
    it('应该停止MCP服务器', async () => {
      // Arrange
      mockMCPManager.stop.mockResolvedValue();

      // Act
      await executor.stopServer();

      // Assert
      expect(mockMCPManager.stop).toHaveBeenCalled();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Stopping MCP server')
      );
    });
  });

  describe('cancelRequest()', () => {
    it('应该取消活跃的请求', () => {
      // Arrange
      const requestId = 'test-req-1';
      const mockController = new AbortController();
      (executor as any).activeRequests.set(requestId, {
        controller: mockController,
        startTime: new Date()
      });

      const abortSpy = jest.spyOn(mockController, 'abort');

      // Act
      executor.cancelRequest(requestId);

      // Assert
      expect(abortSpy).toHaveBeenCalled();
      expect((executor as any).activeRequests.has(requestId)).toBe(false);
    });

    it('应该忽略不存在的请求', () => {
      // Act & Assert
      expect(() => {
        executor.cancelRequest('non-existent-req');
      }).not.toThrow();
    });
  });

  describe('dispose()', () => {
    it('应该清理所有资源', async () => {
      // Arrange
      const requestId1 = 'req-1';
      const requestId2 = 'req-2';
      (executor as any).activeRequests.set(requestId1, {
        controller: new AbortController(),
        startTime: new Date()
      });
      (executor as any).activeRequests.set(requestId2, {
        controller: new AbortController(),
        startTime: new Date()
      });

      mockMCPManager.stop.mockResolvedValue();

      // Act
      await executor.dispose();

      // Assert
      expect((executor as any).activeRequests.size).toBe(0);
      expect(mockMCPManager.stop).toHaveBeenCalled();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Disposing executor')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Executor disposed')
      );
    });
  });

  describe('_mockMCPRequest()', () => {
    it('应该返回成功的模拟响应', async () => {
      // Arrange
      const request: MCPRequest = {
        id: 'test-req-1',
        type: 'execute',
        context: {
          task: createTestTask(),
          sessionId: 'test-session-1'
        }
      };
      const controller = new AbortController();

      // Act
      const response = await (executor as any)._mockMCPRequest(request, controller.signal);

      // Assert
      expect(response.status).toBe('success');
      expect(response.requestId).toBe(request.id);
      expect(response.data).toBeDefined();
      expect(response.data?.output).toContain('Successfully executed task');
    });

    it('应该在取消时返回错误响应', async () => {
      // Arrange
      const request: MCPRequest = {
        id: 'test-req-1',
        type: 'execute',
        context: {
          task: createTestTask(),
          sessionId: 'test-session-1'
        }
      };
      const controller = new AbortController();

      // 立即取消
      controller.abort();

      // Act
      const response = await (executor as any)._mockMCPRequest(request, controller.signal);

      // Assert
      expect(response.status).toBe('error');
      expect(response.error?.message).toBe('Request cancelled');
      expect(response.error?.code).toBe('CANCELLED');
    });
  });

  describe('_processResponse()', () => {
    it('应该处理成功的响应', () => {
      // Arrange
      const startTime = new Date(Date.now() - 1000); // 1秒前
      const sessionId = 'test-session-1';
      const response: MCPResponse = {
        requestId: 'test-req-1',
        status: 'success',
        data: {
          output: 'Success output',
          generatedFiles: ['file1.md', 'file2.ts'],
          metadata: { key: 'value' }
        },
        timestamp: new Date()
      };

      // Act
      const result = (executor as any)._processResponse(response, startTime, sessionId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mode).toBe('codex');
      expect(result.sessionId).toBe(sessionId);
      expect(result.output).toBe('Success output');
      expect(result.generatedFiles).toEqual(['file1.md', 'file2.ts']);
      expect(result.metadata).toEqual({ key: 'value' });
      expect(result.duration).toBeGreaterThanOrEqual(1000);
    });

    it('应该处理错误响应', () => {
      // Arrange
      const startTime = new Date(Date.now() - 500);
      const sessionId = 'test-session-1';
      const response: MCPResponse = {
        requestId: 'test-req-1',
        status: 'error',
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          stack: 'Error stack trace'
        },
        timestamp: new Date()
      };

      // Act
      const result = (executor as any)._processResponse(response, startTime, sessionId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.code).toBe('TEST_ERROR');
      expect(result.error?.stack).toBe('Error stack trace');
    });

    it('应该处理超时响应', () => {
      // Arrange
      const startTime = new Date(Date.now() - 5000);
      const sessionId = 'test-session-1';
      const response: MCPResponse = {
        requestId: 'test-req-1',
        status: 'timeout',
        timestamp: new Date()
      };

      // Act
      const result = (executor as any)._processResponse(response, startTime, sessionId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('timeout');
    });
  });

  describe('集成测试：完整执行流程', () => {
    it('应该完整执行任务并返回结果', async () => {
      // Arrange
      const task = createTestTask({
        id: 'integration-test-1',
        description: 'Integration test task'
      });
      const session = createTestSession({
        id: 'integration-session-1',
        task
      });

      const mockServerStatus: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        healthCheckFailures: 0,
        isHealthy: true
      };

      mockMCPManager.ensureStarted.mockResolvedValue(mockServerStatus);

      // Act
      const result = await executor.execute(task, session);

      // Assert
      expect(result).toBeDefined();
      expect(result.sessionId).toBe(session.id);
      expect(mockMCPManager.ensureStarted).toHaveBeenCalled();
    });
  });
});
