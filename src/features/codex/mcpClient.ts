/**
 * MCP客户端 - Codex MCP服务器通信
 *
 * 负责与Codex MCP服务器进行stdio通信，调用mcp__codex__codex和mcp__codex__codex-reply工具。
 *
 * @module mcpClient
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as vscode from 'vscode';

/**
 * Codex工具调用参数
 */
export interface CodexToolParams {
  /** 模型名称 */
  model?: string;
  /** 沙箱模式 */
  sandbox?: string;
  /** 审批策略 */
  'approval-policy'?: string;
  /** 任务提示 */
  prompt: string;
  /** 允许额外的字符串属性 */
  [key: string]: unknown;
}

/**
 * Codex回复工具调用参数
 */
export interface CodexReplyToolParams {
  /** 会话ID */
  conversationId: string;
  /** 后续指令 */
  prompt: string;
  /** 允许额外的字符串属性 */
  [key: string]: unknown;
}

/**
 * MCP工具调用结果
 */
export interface MCPToolResult {
  /** 工具返回的内容 */
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  /** 是否为错误 */
  isError?: boolean;
  /** 允许额外的字符串属性 */
  [key: string]: unknown;
}

/**
 * Codex会话信息
 */
export interface CodexSession {
  /** 会话ID */
  conversationId: string;
  /** 任务标记 */
  taskMarker: string;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * MCP客户端配置
 */
export interface MCPClientConfig {
  /** 服务器命令 */
  command: string;
  /** 命令参数 */
  args: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
}

/**
 * MCP客户端接口
 */
export interface IMCPClient {
  /**
   * 连接到MCP服务器
   */
  connect(): Promise<void>;

  /**
   * 断开与MCP服务器的连接
   */
  disconnect(): Promise<void>;

  /**
   * 调用Codex工具（首次调用）
   * @param params Codex工具参数
   * @returns 工具调用结果和会话信息
   */
  callCodex(params: CodexToolParams): Promise<{
    result: MCPToolResult;
    session: CodexSession;
  }>;

  /**
   * 调用Codex回复工具（继续会话）
   * @param params Codex回复工具参数
   * @returns 工具调用结果
   */
  callCodexReply(params: CodexReplyToolParams): Promise<MCPToolResult>;

  /**
   * 检查MCP客户端是否已连接
   */
  isConnected(): boolean;
}

/**
 * MCP客户端实现
 *
 * 使用MCP SDK与Codex MCP服务器通信：
 * - 通过stdio传输层启动和管理codex mcp-server进程
 * - 调用mcp__codex__codex工具进行深度分析
 * - 调用mcp__codex__codex-reply工具继续会话
 * - 管理会话状态和任务标记
 *
 * @example
 * ```typescript
 * const client = new MCPClient({
 *   command: 'codex',
 *   args: ['mcp-server'],
 *   cwd: workspaceRoot
 * }, outputChannel);
 *
 * await client.connect();
 * const { result, session } = await client.callCodex({
 *   model: 'gpt-5-codex',
 *   sandbox: 'danger-full-access',
 *   'approval-policy': 'on-failure',
 *   prompt: '[TASK_MARKER: 20251118-1430-001]\n分析代码库'
 * });
 * ```
 */
export class MCPClient implements IMCPClient {
  /** MCP客户端实例 */
  private client: Client;

  /** stdio传输层 */
  private transport?: StdioClientTransport;

  /** 客户端配置 */
  private config: MCPClientConfig;

  /** 输出通道 */
  private outputChannel: vscode.OutputChannel;

  /** 连接状态 */
  private connected: boolean = false;

  /** 活跃会话映射（task_marker -> conversationId） */
  private activeSessions: Map<string, CodexSession> = new Map();

  /**
   * 构造函数
   * @param config MCP客户端配置
   * @param outputChannel VSCode输出通道
   */
  constructor(config: MCPClientConfig, outputChannel: vscode.OutputChannel) {
    this.config = config;
    this.outputChannel = outputChannel;

    // 创建MCP客户端
    this.client = new Client(
      {
        name: 'kiro-codex-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          // 客户端能力配置
        }
      }
    );

    this.outputChannel.appendLine('[MCPClient] Client initialized');
  }

  /**
   * 连接到MCP服务器
   *
   * 创建stdio传输层并连接到codex mcp-server进程
   *
   * @throws 如果连接失败
   */
  async connect(): Promise<void> {
    if (this.connected) {
      this.outputChannel.appendLine('[MCPClient] Already connected');
      return;
    }

    try {
      this.outputChannel.appendLine('[MCPClient] Connecting to MCP server...');
      this.outputChannel.appendLine(`[MCPClient] Command: ${this.config.command} ${this.config.args.join(' ')}`);

      // 创建stdio传输层
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
        cwd: this.config.cwd,
        stderr: 'pipe' // 捕获stderr用于日志
      });

      // 监听stderr输出
      const stderr = this.transport.stderr;
      if (stderr) {
        stderr.on('data', (data: Buffer) => {
          this.outputChannel.appendLine(`[MCP Server] ${data.toString().trim()}`);
        });
      }

      // 连接到服务器
      await this.client.connect(this.transport);

      this.connected = true;
      this.outputChannel.appendLine('[MCPClient] Connected successfully');
      this.outputChannel.appendLine(`[MCPClient] Server capabilities: ${JSON.stringify(this.client.getServerCapabilities())}`);
      this.outputChannel.appendLine(`[MCPClient] Server version: ${JSON.stringify(this.client.getServerVersion())}`);

    } catch (error) {
      this.connected = false;
      this.outputChannel.appendLine(`[MCPClient] Connection failed: ${error}`);
      throw new Error(`Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 断开与MCP服务器的连接
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      this.outputChannel.appendLine('[MCPClient] Not connected');
      return;
    }

    try {
      this.outputChannel.appendLine('[MCPClient] Disconnecting from MCP server...');

      // 关闭传输层
      if (this.transport) {
        await this.transport.close();
        this.transport = undefined;
      }

      this.connected = false;
      this.activeSessions.clear();

      this.outputChannel.appendLine('[MCPClient] Disconnected successfully');

    } catch (error) {
      this.outputChannel.appendLine(`[MCPClient] Disconnection error: ${error}`);
      throw error;
    }
  }

  /**
   * 调用Codex工具（首次调用）
   *
   * 调用mcp__codex__codex工具进行深度代码分析
   * 从响应中提取conversationId并创建会话记录
   *
   * @param params Codex工具参数
   * @returns 工具调用结果和会话信息
   * @throws 如果未连接或调用失败
   */
  async callCodex(params: CodexToolParams): Promise<{
    result: MCPToolResult;
    session: CodexSession;
  }> {
    if (!this.connected) {
      throw new Error('MCP client is not connected');
    }

    try {
      this.outputChannel.appendLine('[MCPClient] Calling codex tool...');
      this.outputChannel.appendLine(`[MCPClient] Params: ${JSON.stringify(params, null, 2)}`);

      // 调用工具 - 直接使用原始工具名，不加前缀
      // 设置超时为10分钟（600秒）以支持极端复杂任务
      // 注意：超时后重试会从头开始，所以给足时间很重要
      const response = await this.client.callTool(
        {
          name: 'codex',
          arguments: params as Record<string, unknown>
        },
        undefined, // resultSchema
        {
          timeout: 600000 // 10分钟超时
        }
      );

      this.outputChannel.appendLine(`[MCPClient] Tool response: ${JSON.stringify(response, null, 2)}`);

      // 提取task_marker（从prompt中解析）
      const taskMarker = this._extractTaskMarker(params.prompt);

      // 提取conversationId（从响应中解析）
      const conversationId = this._extractConversationId(response as MCPToolResult);

      // 创建会话记录
      const session: CodexSession = {
        conversationId,
        taskMarker,
        createdAt: new Date()
      };

      // 保存会话
      if (taskMarker) {
        this.activeSessions.set(taskMarker, session);
      }

      this.outputChannel.appendLine(`[MCPClient] Session created: ${JSON.stringify(session)}`);

      return {
        result: response as MCPToolResult,
        session
      };

    } catch (error) {
      this.outputChannel.appendLine(`[MCPClient] Tool call failed: ${error}`);
      throw new Error(`Failed to call Codex tool: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 调用Codex回复工具（继续会话）
   *
   * 调用mcp__codex__codex-reply工具继续现有会话
   *
   * @param params Codex回复工具参数
   * @returns 工具调用结果
   * @throws 如果未连接或调用失败
   */
  async callCodexReply(params: CodexReplyToolParams): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error('MCP client is not connected');
    }

    try {
      this.outputChannel.appendLine('[MCPClient] Calling mcp__codex__codex-reply tool...');
      this.outputChannel.appendLine(`[MCPClient] Params: ${JSON.stringify(params, null, 2)}`);

      // 调用工具 - 设置超时为10分钟
      const response = await this.client.callTool(
        {
          name: 'mcp__codex-cli__codex-reply',
          arguments: params as Record<string, unknown>
        },
        undefined, // resultSchema
        {
          timeout: 600000 // 10分钟超时
        }
      );

      this.outputChannel.appendLine(`[MCPClient] Tool response: ${JSON.stringify(response, null, 2)}`);

      return response as MCPToolResult;

    } catch (error) {
      this.outputChannel.appendLine(`[MCPClient] Tool call failed: ${error}`);
      throw new Error(`Failed to call Codex reply tool: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查MCP客户端是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取活跃会话
   * @param taskMarker 任务标记
   */
  getSession(taskMarker: string): CodexSession | undefined {
    return this.activeSessions.get(taskMarker);
  }

  /**
   * 获取所有活跃会话
   */
  getAllSessions(): CodexSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 从prompt中提取task_marker
   *
   * 格式: [TASK_MARKER: YYYYMMDD-HHMMSS-XXXX]
   *
   * @param prompt 提示文本
   * @returns task_marker或空字符串
   */
  private _extractTaskMarker(prompt: string): string {
    const match = prompt.match(/\[TASK_MARKER:\s*([^\]]+)\]/);
    return match ? match[1].trim() : '';
  }

  /**
   * 从响应中提取conversationId
   *
   * Codex工具会在响应文本中包含conversationId
   * 需要解析响应内容提取ID
   *
   * @param response 工具响应
   * @returns conversationId
   */
  private _extractConversationId(response: MCPToolResult): string {
    // 从响应内容中提取conversationId
    // 假设响应格式为: "Conversation ID: <id>" 或类似格式
    if (response.content && response.content.length > 0) {
      const text = response.content[0].text;

      if (text) {
        // 尝试多种可能的格式
        const patterns = [
          /conversation[_\s]?id[:\s]+([a-zA-Z0-9-]+)/i,
          /session[_\s]?id[:\s]+([a-zA-Z0-9-]+)/i,
          /id[:\s]+([a-zA-Z0-9-]+)/i
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // 如果找不到，生成一个临时ID
      this.outputChannel.appendLine('[MCPClient] Warning: Could not extract conversationId from response, generating temporary ID');
      return `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    throw new Error('No content in response to extract conversationId');
  }

  /**
   * 生成task_marker
   *
   * 格式: YYYYMMDD-HHMMSS-XXXX
   *
   * @returns 新的task_marker
   */
  static generateTaskMarker(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const xxxx = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${xxxx}`;
  }
}
