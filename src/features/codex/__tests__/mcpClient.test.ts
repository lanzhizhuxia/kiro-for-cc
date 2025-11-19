/**
 * MCPClient单元测试
 *
 * 测试MCP客户端的核心功能，包括：
 * - 连接和断开
 * - 调用Codex工具
 * - 调用Codex回复工具
 * - 会话管理
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPClient, CodexToolParams, CodexReplyToolParams, MCPToolResult } from '../mcpClient';
import * as vscode from 'vscode';

// Mock VSCode
jest.mock('vscode');

// Mock MCP SDK
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn<() => any>().mockImplementation(() => ({
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    callTool: jest.fn<() => Promise<any>>().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Test response with conversation_id: test-conv-123'
        }
      ],
      isError: false
    }),
    getServerCapabilities: jest.fn<() => any>().mockReturnValue({ tools: {} }),
    getServerVersion: jest.fn<() => any>().mockReturnValue({ name: 'codex-mcp', version: '1.0.0' })
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn<() => any>().mockImplementation(() => ({
    start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stderr: {
      on: jest.fn<() => void>()
    }
  }))
}));

describe('MCPClient', () => {
  let mcpClient: MCPClient;
  let mockOutputChannel: vscode.OutputChannel;

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
    } as unknown as vscode.OutputChannel;

    // 创建MCPClient实例
    mcpClient = new MCPClient(
      {
        command: 'codex',
        args: ['mcp-server'],
        cwd: '/test/workspace'
      },
      mockOutputChannel
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该成功创建MCPClient实例', () => {
      expect(mcpClient).toBeDefined();
      expect(mcpClient.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('应该成功连接到MCP服务器', async () => {
      await mcpClient.connect();
      expect(mcpClient.isConnected()).toBe(true);
    });

    it('如果已连接，再次调用connect应该不执行操作', async () => {
      await mcpClient.connect();
      const firstCallCount = (mockOutputChannel.appendLine as jest.Mock).mock.calls.length;

      await mcpClient.connect();
      const secondCallCount = (mockOutputChannel.appendLine as jest.Mock).mock.calls.length;

      // 第二次调用应该只输出一条"Already connected"日志
      expect(secondCallCount).toBe(firstCallCount + 1);
    });
  });

  describe('disconnect', () => {
    it('应该成功断开连接', async () => {
      await mcpClient.connect();
      expect(mcpClient.isConnected()).toBe(true);

      await mcpClient.disconnect();
      expect(mcpClient.isConnected()).toBe(false);
    });

    it('如果未连接，调用disconnect应该不报错', async () => {
      expect(mcpClient.isConnected()).toBe(false);
      await expect(mcpClient.disconnect()).resolves.not.toThrow();
    });
  });

  describe('callCodex', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('应该成功调用Codex工具', async () => {
      const params: CodexToolParams = {
        model: 'gpt-5-codex',
        sandbox: 'danger-full-access',
        'approval-policy': 'on-failure',
        prompt: '[TASK_MARKER: 20251118-1430-001]\nTest task'
      };

      const { result, session } = await mcpClient.callCodex(params);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);

      expect(session).toBeDefined();
      expect(session.conversationId).toBe('test-conv-123');
      expect(session.taskMarker).toBe('20251118-1430-001');
    });

    it('应该能从prompt中提取task_marker', async () => {
      const params: CodexToolParams = {
        prompt: '[TASK_MARKER: 20251118-1500-9999]\nAnother test'
      };

      const { session } = await mcpClient.callCodex(params);
      expect(session.taskMarker).toBe('20251118-1500-9999');
    });

    it('如果未连接应该抛出错误', async () => {
      await mcpClient.disconnect();

      const params: CodexToolParams = {
        prompt: 'Test'
      };

      await expect(mcpClient.callCodex(params)).rejects.toThrow('MCP client is not connected');
    });
  });

  describe('callCodexReply', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('应该成功调用Codex回复工具', async () => {
      const params: CodexReplyToolParams = {
        conversationId: 'test-conv-123',
        prompt: 'Continue task'
      };

      const result = await mcpClient.callCodexReply(params);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('如果未连接应该抛出错误', async () => {
      await mcpClient.disconnect();

      const params: CodexReplyToolParams = {
        conversationId: 'test-conv-123',
        prompt: 'Continue'
      };

      await expect(mcpClient.callCodexReply(params)).rejects.toThrow('MCP client is not connected');
    });
  });

  describe('会话管理', () => {
    beforeEach(async () => {
      await mcpClient.connect();
    });

    it('应该能保存和获取会话', async () => {
      const params: CodexToolParams = {
        prompt: '[TASK_MARKER: 20251118-1600-0001]\nTask 1'
      };

      const { session } = await mcpClient.callCodex(params);

      const retrieved = mcpClient.getSession('20251118-1600-0001');
      expect(retrieved).toBeDefined();
      expect(retrieved?.conversationId).toBe(session.conversationId);
    });

    it('应该能获取所有活跃会话', async () => {
      const params1: CodexToolParams = {
        prompt: '[TASK_MARKER: 20251118-1600-0001]\nTask 1'
      };

      const params2: CodexToolParams = {
        prompt: '[TASK_MARKER: 20251118-1600-0002]\nTask 2'
      };

      await mcpClient.callCodex(params1);
      await mcpClient.callCodex(params2);

      const sessions = mcpClient.getAllSessions();
      expect(sessions.length).toBe(2);
    });

    it('断开连接应该清空所有会话', async () => {
      const params: CodexToolParams = {
        prompt: '[TASK_MARKER: 20251118-1600-0001]\nTask 1'
      };

      await mcpClient.callCodex(params);
      expect(mcpClient.getAllSessions().length).toBe(1);

      await mcpClient.disconnect();
      expect(mcpClient.getAllSessions().length).toBe(0);
    });
  });

  describe('generateTaskMarker', () => {
    it('应该生成正确格式的task_marker', () => {
      const marker = MCPClient.generateTaskMarker();

      // 格式: YYYYMMDD-HHMMSS-XXXX
      const pattern = /^\d{8}-\d{6}-\d{4}$/;
      expect(marker).toMatch(pattern);
    });

    it('每次生成的task_marker应该不同', () => {
      const marker1 = MCPClient.generateTaskMarker();
      const marker2 = MCPClient.generateTaskMarker();

      expect(marker1).not.toBe(marker2);
    });
  });
});
