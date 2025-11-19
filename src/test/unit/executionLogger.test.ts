/**
 * ExecutionLogger 单元测试
 *
 * 测试执行日志记录器的所有功能，包括：
 * - 日志初始化
 * - 各种日志类型记录
 * - 文件写入
 * - OutputChannel 输出
 * - 错误处理
 * - 资源清理
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExecutionLogger, LogLevel, LogType } from '../../features/codex/executionLogger';

// Mock vscode模块
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    workspaceFolders: [{
      uri: {
        fsPath: path.join(__dirname, '../../../.test-workspace')
      }
    }]
  }
}));

describe('ExecutionLogger Test Suite', () => {
  let outputChannel: any;
  let testWorkspaceRoot: string;
  let testLogDir: string;

  beforeAll(() => {
    outputChannel = {
      appendLine: jest.fn(),
      dispose: jest.fn()
    };

    testWorkspaceRoot = path.join(__dirname, '../../../.test-workspace');
    testLogDir = path.join(testWorkspaceRoot, '.claude/codex/execution-history');

    // 创建测试目录
    fs.mkdirSync(testLogDir, { recursive: true });
  });

  afterAll(() => {
    // 清理测试日志目录
    if (fs.existsSync(testLogDir)) {
      const files = fs.readdirSync(testLogDir);
      for (const file of files) {
        if (file.startsWith('test-')) {
          try {
            fs.unlinkSync(path.join(testLogDir, file));
          } catch (error) {
            // 忽略删除错误
          }
        }
      }
    }
  });

  describe('初始化测试', () => {
    test('应该成功初始化日志记录器', async () => {
      const logger = new ExecutionLogger('test-init-001', outputChannel);

      await logger.init();

      const logPath = logger.getLogFilePath();
      expect(logPath).toBeTruthy();
      expect(logPath).toContain('test-init-001.log');
      expect(fs.existsSync(testLogDir)).toBe(true);

      logger.dispose();
    });

    test('应该创建日志文件并写入头部', async () => {
      const logger = new ExecutionLogger('test-init-002', outputChannel);

      await logger.init();

      // 等待写入流完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const logPath = logger.getLogFilePath();
      expect(fs.existsSync(logPath)).toBe(true);

      // 读取日志文件内容
      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('=== Execution Log Started for Task: test-init-002 ===');

      logger.dispose();
    });

    test('重复初始化应该被忽略', async () => {
      const logger = new ExecutionLogger('test-init-003', outputChannel);

      await logger.init();
      const logPath1 = logger.getLogFilePath();

      await logger.init();
      const logPath2 = logger.getLogFilePath();

      expect(logPath1).toBe(logPath2);

      logger.dispose();
    });
  });

  describe('MCP通信日志测试', () => {
    test('应该记录MCP请求', async () => {
      const logger = new ExecutionLogger('test-mcp-request-001', outputChannel);
      await logger.init();

      const params = {
        model: 'gpt-5-codex',
        prompt: 'Test prompt',
        taskId: 'test-001'
      };

      logger.logMCPRequest('callCodex', params);
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[MCP-REQUEST]');
      expect(content).toContain('callCodex');
      expect(content).toContain('gpt-5-codex');

      logger.dispose();
    });

    test('应该记录成功的MCP响应', async () => {
      const logger = new ExecutionLogger('test-mcp-response-success', outputChannel);
      await logger.init();

      const response = {
        status: 'success',
        data: {
          output: 'Test output',
          generatedFiles: ['test.ts']
        },
        timestamp: new Date()
      };

      logger.logMCPResponse('callCodex', response);
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[MCP-RESPONSE]');
      expect(content).toContain('Success');

      logger.dispose();
    });

    test('应该记录失败的MCP响应', async () => {
      const logger = new ExecutionLogger('test-mcp-response-error', outputChannel);
      await logger.init();

      const response = {
        status: 'error',
        error: {
          message: 'Test error message'
        },
        timestamp: new Date()
      };

      logger.logMCPResponse('callCodex', response);
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[MCP-RESPONSE]');
      expect(content).toContain('Error');
      expect(content).toContain('Test error message');

      logger.dispose();
    });

    test('应该清理敏感数据', async () => {
      const logger = new ExecutionLogger('test-sanitize-001', outputChannel);
      await logger.init();

      const params = {
        apiKey: 'secret-key-123',
        password: 'my-password',
        prompt: 'Test prompt'
      };

      logger.logMCPRequest('callCodex', params);
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('***REDACTED***');
      expect(content).not.toContain('secret-key-123');
      expect(content).not.toContain('my-password');
      expect(content).toContain('Test prompt');

      logger.dispose();
    });
  });

  describe('推理步骤日志测试', () => {
    test('应该记录推理步骤', async () => {
      const logger = new ExecutionLogger('test-thinking-001', outputChannel);
      await logger.init();

      const details = {
        complexity: 7,
        subProblems: 3,
        estimatedTime: '2 hours'
      };

      logger.logThinkingStep('Problem decomposition', details);
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[THINKING]');
      expect(content).toContain('Problem decomposition');
      expect(content).toContain('complexity');

      logger.dispose();
    });

    test('应该记录多个推理步骤', async () => {
      const logger = new ExecutionLogger('test-thinking-multi', outputChannel);
      await logger.init();

      logger.logThinkingStep('Step 1: Analysis', { phase: 'initializing' });
      logger.logThinkingStep('Step 2: Decomposition', { phase: 'analyzing' });
      logger.logThinkingStep('Step 3: Solution', { phase: 'completed' });

      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('Step 1: Analysis');
      expect(content).toContain('Step 2: Decomposition');
      expect(content).toContain('Step 3: Solution');

      logger.dispose();
    });
  });

  describe('文件操作日志测试', () => {
    test('应该记录文件读取操作', async () => {
      const logger = new ExecutionLogger('test-file-read', outputChannel);
      await logger.init();

      logger.logFileOperation('Read', 'src/extension.ts');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[FILE-OP]');
      expect(content).toContain('Read: src/extension.ts');

      logger.dispose();
    });

    test('应该记录文件写入操作', async () => {
      const logger = new ExecutionLogger('test-file-write', outputChannel);
      await logger.init();

      logger.logFileOperation('Write', 'src/test.ts');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('Write: src/test.ts');

      logger.dispose();
    });

    test('应该记录文件删除操作', async () => {
      const logger = new ExecutionLogger('test-file-delete', outputChannel);
      await logger.init();

      logger.logFileOperation('Delete', 'src/old.ts');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('Delete: src/old.ts');

      logger.dispose();
    });
  });

  describe('错误日志测试', () => {
    test('应该记录错误信息', async () => {
      const logger = new ExecutionLogger('test-error-001', outputChannel);
      await logger.init();

      const error = new Error('Test error message');
      logger.logError(error);

      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[ERROR]');
      expect(content).toContain('Test error message');

      logger.dispose();
    });

    test('应该记录错误堆栈', async () => {
      const logger = new ExecutionLogger('test-error-stack', outputChannel);
      await logger.init();

      const error = new Error('Test error with stack');
      logger.logError(error);

      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('stack');

      logger.dispose();
    });

    test('应该记录带上下文的错误', async () => {
      const logger = new ExecutionLogger('test-error-context', outputChannel);
      await logger.init();

      const error = new Error('Connection failed');
      logger.logError(error, 'MCP Communication');

      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('MCP Communication');
      expect(content).toContain('Connection failed');

      logger.dispose();
    });
  });

  describe('普通信息日志测试', () => {
    test('应该记录普通信息', async () => {
      const logger = new ExecutionLogger('test-info-001', outputChannel);
      await logger.init();

      logger.logInfo('Task started');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('[INFO]');
      expect(content).toContain('Task started');

      logger.dispose();
    });

    test('应该记录带数据的信息', async () => {
      const logger = new ExecutionLogger('test-info-data', outputChannel);
      await logger.init();

      logger.logInfo('Task execution', { duration: 1000, success: true });
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('duration');
      expect(content).toContain('1000');

      logger.dispose();
    });
  });

  describe('缓冲区和刷新测试', () => {
    test('缓冲区满时应该自动刷新', async () => {
      const logger = new ExecutionLogger('test-buffer-full', outputChannel);
      await logger.init();

      // 写入超过MAX_BUFFER_SIZE的日志（50条）
      for (let i = 0; i < 55; i++) {
        logger.logInfo(`Buffer message ${i}`);
      }

      // 由于缓冲区满，应该已经自动刷新
      await new Promise(resolve => setTimeout(resolve, 1000));

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('Buffer message 0');

      logger.dispose();
    });

    test('手动flush应该立即写入', async () => {
      const logger = new ExecutionLogger('test-manual-flush', outputChannel);
      await logger.init();

      logger.logInfo('Before flush');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      expect(content).toContain('Before flush');

      logger.dispose();
    });
  });

  describe('资源清理测试', () => {
    test('dispose应该清理所有资源', async () => {
      const logger = new ExecutionLogger('test-dispose-001', outputChannel);
      await logger.init();

      logger.logInfo('Test message');

      logger.dispose();

      // 验证日志文件已写入
      const logPath = logger.getLogFilePath();
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('Test message');
    });
  });

  describe('时间戳格式测试', () => {
    test('时间戳应该包含日期和时间', async () => {
      const logger = new ExecutionLogger('test-timestamp-001', outputChannel);
      await logger.init();

      logger.logInfo('Timestamp test');
      await logger.flush();

      const logPath = logger.getLogFilePath();
      const content = fs.readFileSync(logPath, 'utf8');

      // 验证时间戳格式: [2025-01-18 14:30:45.123]
      const timestampPattern = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/;
      expect(timestampPattern.test(content)).toBe(true);

      logger.dispose();
    });
  });

  describe('日志文件路径测试', () => {
    test('应该返回正确的日志文件路径', async () => {
      const logger = new ExecutionLogger('test-path-001', outputChannel);
      await logger.init();

      const logPath = logger.getLogFilePath();

      expect(logPath).toContain('.claude/codex/execution-history');
      expect(logPath).toContain('test-path-001.log');

      logger.dispose();
    });
  });
});
