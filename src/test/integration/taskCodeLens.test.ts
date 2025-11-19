/**
 * Integration Tests for Task CodeLens Provider
 *
 * 测试任务级别Codex模式支持的完整功能
 *
 * 需求: T55 - 任务级别Codex模式支持
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { TaskCodeLensProvider } from '../../features/codex/taskCodeLensProvider';
import {
  handleExecuteTaskWithCodex,
  handleShowTaskDetails,
  extractTaskDetails,
  extractSpecNameFromPath
} from '../../features/codex/taskExecutionHandler';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    withProgress: jest.fn(),
    createWebviewPanel: jest.fn()
  },
  workspace: {
    openTextDocument: jest.fn(),
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn()
  },
  ViewColumn: {
    Two: 2
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    fire: jest.fn(),
    event: jest.fn()
  })),
  Range: jest.fn().mockImplementation((start, startChar, end, endChar) => ({
    start,
    startChar,
    end,
    endChar
  })),
  CodeLens: jest.fn().mockImplementation((range, command) => ({
    range,
    command
  })),
  ProgressLocation: {
    Notification: 15
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path }))
  }
}));

describe('TaskCodeLensProvider', () => {
  let provider: TaskCodeLensProvider;
  let mockOutputChannel: any;

  beforeEach(() => {
    // Mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn()
    };

    // Mock configuration
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(true)
    });

    provider = new TaskCodeLensProvider(mockOutputChannel);
  });

  describe('provideCodeLenses', () => {
    it('应该为tasks.md文档中的任务提供CodeLens', () => {
      const document: any = {
        fileName: '/path/to/specs/test-feature/tasks.md',
        getText: jest.fn().mockReturnValue(`
# Tasks

- [ ] 1. 创建用户注册功能
  - 实现用户注册表单
  - 添加表单验证

- [ ] 2. 创建用户登录功能
  - 实现登录表单
  - 添加JWT认证

- [x] 3. 已完成的任务
`)
      };

      const codeLenses = provider.provideCodeLenses(document, {} as any);

      // 应该为未完成的任务（1和2）提供CodeLens
      // 每个任务有2个CodeLens: "使用Codex执行" 和 "详情"
      // 已完成任务（3）只有1个CodeLens: "详情"
      expect(codeLenses).toHaveLength(5);
    });

    it('应该不为非tasks.md文档提供CodeLens', () => {
      const document: any = {
        fileName: '/path/to/specs/test-feature/requirements.md',
        getText: jest.fn().mockReturnValue('# Requirements')
      };

      const codeLenses = provider.provideCodeLenses(document, {} as any);

      expect(codeLenses).toHaveLength(0);
    });

    it('应该支持多级任务编号（如2.1）', () => {
      const document: any = {
        fileName: '/path/to/specs/test-feature/tasks.md',
        getText: jest.fn().mockReturnValue(`
# Tasks

- [ ] 1. 主任务
- [ ] 1.1. 子任务1
- [ ] 1.2. 子任务2
- [ ] 2. 另一个主任务
`)
      };

      const codeLenses = provider.provideCodeLenses(document, {} as any);

      // 4个未完成任务，每个2个CodeLens
      expect(codeLenses).toHaveLength(8);
    });

    it('应该在配置禁用时不提供CodeLens', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(false) // 禁用
      });

      const document: any = {
        fileName: '/path/to/specs/test-feature/tasks.md',
        getText: jest.fn().mockReturnValue(`- [ ] 1. 任务`)
      };

      const codeLenses = provider.provideCodeLenses(document, {} as any);

      expect(codeLenses).toHaveLength(0);
    });
  });

  describe('refresh', () => {
    it('应该能够刷新CodeLens', () => {
      // 不应该抛出错误
      expect(() => provider.refresh()).not.toThrow();
    });
  });
});

describe('extractTaskDetails', () => {
  it('应该正确提取任务详细信息', () => {
    const document: any = {
      getText: jest.fn().mockReturnValue(`
# Tasks

- [ ] 1. 创建用户注册功能
  - 实现用户注册表单
  - 添加表单验证
  - 添加密码强度检查

- [ ] 2. 创建用户登录功能
  - 实现登录表单
`)
    };

    const details = extractTaskDetails(document, '1');

    expect(details).toContain('创建用户注册功能');
    expect(details).toContain('实现用户注册表单');
    expect(details).toContain('添加表单验证');
    expect(details).toContain('添加密码强度检查');
  });

  it('应该支持多级任务编号', () => {
    const document: any = {
      getText: jest.fn().mockReturnValue(`
- [ ] 1. 主任务
- [ ] 1.1. 子任务1
  - 详细描述1
- [ ] 1.2. 子任务2
`)
    };

    const details = extractTaskDetails(document, '1.1');

    expect(details).toContain('子任务1');
    expect(details).toContain('详细描述1');
  });

  it('应该在任务不存在时返回null', () => {
    const document: any = {
      getText: jest.fn().mockReturnValue(`- [ ] 1. 任务1`)
    };

    const details = extractTaskDetails(document, '999');

    expect(details).toBeNull();
  });

  it('应该正确处理已完成的任务', () => {
    const document: any = {
      getText: jest.fn().mockReturnValue(`
- [x] 1. 已完成任务
  - 已实现功能
`)
    };

    const details = extractTaskDetails(document, '1');

    expect(details).toContain('已完成任务');
    expect(details).toContain('已实现功能');
  });
});

describe('extractSpecNameFromPath', () => {
  it('应该从标准路径提取spec名称', () => {
    const path = '/workspace/docs/specs/user-auth/tasks.md';
    const specName = extractSpecNameFromPath(path);

    expect(specName).toBe('user-auth');
  });

  it('应该从.claude/specs路径提取spec名称', () => {
    const path = '/workspace/.claude/specs/payment-module/tasks.md';
    const specName = extractSpecNameFromPath(path);

    expect(specName).toBe('payment-module');
  });

  it('应该在路径不匹配时返回null', () => {
    const path = '/workspace/random/path/tasks.md';
    const specName = extractSpecNameFromPath(path);

    expect(specName).toBeNull();
  });

  it('应该处理Windows路径', () => {
    const path = 'C:\\workspace\\specs\\user-auth\\tasks.md';
    const specName = extractSpecNameFromPath(path);

    expect(specName).toBe('user-auth');
  });
});

describe('handleExecuteTaskWithCodex', () => {
  let mockCodexOrchestrator: any;
  let mockOutputChannel: any;

  beforeEach(() => {
    mockCodexOrchestrator = {
      executeTask: jest.fn(),
      showAnalysisResult: jest.fn()
    };

    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn()
    };
  });

  it('应该在用户取消时不执行任务', async () => {
    (vscode.window.showInformationMessage as any).mockResolvedValue('取消');

    const uri: any = { fsPath: '/specs/test/tasks.md' };

    await handleExecuteTaskWithCodex(
      '1',
      '测试任务',
      uri,
      mockCodexOrchestrator,
      mockOutputChannel
    );

    expect(mockCodexOrchestrator.executeTask).not.toHaveBeenCalled();
  });

  it('应该使用Codex模式执行任务', async () => {
    (vscode.window.showInformationMessage as any).mockResolvedValue('执行');
    (vscode.workspace.openTextDocument as any).mockResolvedValue({
      getText: jest.fn().mockReturnValue('- [ ] 1. 任务描述')
    });
    (vscode.window.withProgress as any).mockImplementation(async (options: any, task: any) => {
      const mockProgress = { report: jest.fn() };
      const mockToken = { isCancellationRequested: false };
      return await task(mockProgress, mockToken);
    });

    mockCodexOrchestrator.executeTask.mockResolvedValue({
      success: true,
      sessionId: 'test-session',
      duration: 1000,
      mode: 'codex'
    });

    const uri: any = { fsPath: '/workspace/specs/test-feature/tasks.md' };

    await handleExecuteTaskWithCodex(
      '1',
      '测试任务',
      uri,
      mockCodexOrchestrator,
      mockOutputChannel
    );

    // 验证executeTask被调用，且使用了Codex模式
    expect(mockCodexOrchestrator.executeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'implementation',
        description: '测试任务'
      }),
      expect.objectContaining({
        forceMode: 'codex',
        enableDeepThinking: true,
        enableCodebaseScan: true
      })
    );
  });

  it('应该在任务未找到时显示错误', async () => {
    (vscode.window.showInformationMessage as any).mockResolvedValue('执行');
    (vscode.workspace.openTextDocument as any).mockResolvedValue({
      getText: jest.fn().mockReturnValue('- [ ] 2. 其他任务')
    });

    const uri: any = { fsPath: '/workspace/specs/test-feature/tasks.md' };

    await handleExecuteTaskWithCodex(
      '1',
      '测试任务',
      uri,
      mockCodexOrchestrator,
      mockOutputChannel
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('未找到任务 1')
    );
    expect(mockCodexOrchestrator.executeTask).not.toHaveBeenCalled();
  });
});

describe('handleShowTaskDetails', () => {
  let mockOutputChannel: any;

  beforeEach(() => {
    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn()
    };

    (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue({
      webview: {
        html: ''
      }
    });
  });

  it('应该创建WebView显示任务详情', async () => {
    (vscode.workspace.openTextDocument as any).mockResolvedValue({
      getText: jest.fn().mockReturnValue('- [ ] 1. 测试任务\n  - 详细描述')
    });

    const uri: any = { fsPath: '/workspace/specs/test-feature/tasks.md' };

    await handleShowTaskDetails('1', '测试任务', uri, mockOutputChannel);

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'taskDetails',
      expect.stringContaining('任务 1 详情'),
      vscode.ViewColumn.Two,
      expect.any(Object)
    );
  });

  it('应该在出错时显示错误消息', async () => {
    (vscode.workspace.openTextDocument as any).mockRejectedValue(
      new Error('文件不存在')
    );

    const uri: any = { fsPath: '/invalid/path/tasks.md' };

    await handleShowTaskDetails('1', '测试任务', uri, mockOutputChannel);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('显示任务详情时出错')
    );
  });
});
