/**
 * FeedbackCollector 单元测试
 *
 * 测试反馈收集和统计功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FeedbackCollector, FeedbackEntry, FeedbackStats } from '../feedbackCollector';

// Mock vscode
jest.mock('vscode', () => ({
  OutputChannel: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  existsSync: jest.fn(),
}));

describe('FeedbackCollector', () => {
  let feedbackCollector: FeedbackCollector;
  let mockOutputChannel: vscode.OutputChannel;
  const testWorkspaceRoot = '/test/workspace';
  const feedbackPath = path.join(testWorkspaceRoot, '.claude/codex/feedback.json');

  beforeEach(() => {
    // 创建 mock OutputChannel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Channel',
      replace: jest.fn(),
    } as any;

    // 重置所有 mock
    jest.clearAllMocks();

    // 创建 FeedbackCollector 实例
    feedbackCollector = new FeedbackCollector(testWorkspaceRoot, mockOutputChannel);
  });

  describe('initialize', () => {
    it('应该在没有已有反馈时正确初始化', async () => {
      // 模拟文件不存在
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

      await feedbackCollector.initialize();

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.dirname(feedbackPath),
        { recursive: true }
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Initialization completed')
      );
      expect(feedbackCollector.getFeedbackCount()).toBe(0);
    });

    it('应该加载已有反馈', async () => {
      // 模拟文件存在
      const existingFeedback: FeedbackEntry[] = [
        {
          id: 'feedback-1',
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
          type: 'useful',
          rating: 5,
          comment: 'Great analysis!',
          analysisContext: {
            scenario: 'design-review',
            taskType: 'design',
            executionTime: 5000
          }
        }
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(existingFeedback)
      );

      await feedbackCollector.initialize();

      expect(fs.promises.readFile).toHaveBeenCalledWith(feedbackPath, 'utf-8');
      expect(feedbackCollector.getFeedbackCount()).toBe(1);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Loaded 1 feedback entries')
      );
    });

    it('应该处理初始化失败的情况', async () => {
      // 模拟读取失败
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      await feedbackCollector.initialize();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize')
      );
      expect(feedbackCollector.getFeedbackCount()).toBe(0);
    });
  });

  describe('collectFeedback', () => {
    beforeEach(async () => {
      // 初始化
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      await feedbackCollector.initialize();
    });

    it('应该收集有用反馈', async () => {
      await feedbackCollector.collectFeedback(
        'session-1',
        'useful',
        {
          scenario: 'design-review',
          taskType: 'design',
          executionTime: 5000
        },
        {
          rating: 5,
          comment: 'Very helpful!'
        }
      );

      expect(feedbackCollector.getFeedbackCount()).toBe(1);
      expect(fs.promises.writeFile).toHaveBeenCalled();

      const feedback = feedbackCollector.getAllFeedback()[0];
      expect(feedback.type).toBe('useful');
      expect(feedback.rating).toBe(5);
      expect(feedback.comment).toBe('Very helpful!');
      expect(feedback.sessionId).toBe('session-1');
    });

    it('应该收集无用反馈', async () => {
      await feedbackCollector.collectFeedback(
        'session-2',
        'not-useful',
        {
          scenario: 'implementation',
          taskType: 'implementation',
          executionTime: 3000
        },
        {
          rating: 2,
          comment: 'Too slow and inaccurate'
        }
      );

      const feedback = feedbackCollector.getAllFeedback()[0];
      expect(feedback.type).toBe('not-useful');
      expect(feedback.rating).toBe(2);
      expect(feedback.analysisContext.scenario).toBe('implementation');
    });

    it('应该收集建议反馈', async () => {
      await feedbackCollector.collectFeedback(
        'session-3',
        'suggestion',
        {
          scenario: 'debug',
          taskType: 'debug',
          executionTime: 2000
        },
        {
          comment: 'Please add more details'
        }
      );

      const feedback = feedbackCollector.getAllFeedback()[0];
      expect(feedback.type).toBe('suggestion');
      expect(feedback.rating).toBeUndefined();
    });

    it('应该处理没有可选参数的情况', async () => {
      await feedbackCollector.collectFeedback(
        'session-4',
        'useful',
        {
          scenario: 'test',
          taskType: 'test',
          executionTime: 1000
        }
      );

      const feedback = feedbackCollector.getAllFeedback()[0];
      expect(feedback.rating).toBeUndefined();
      expect(feedback.comment).toBeUndefined();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // 初始化并添加测试数据
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      await feedbackCollector.initialize();

      // 添加多条反馈
      await feedbackCollector.collectFeedback(
        'session-1',
        'useful',
        { scenario: 'design', taskType: 'design', executionTime: 5000 },
        { rating: 5, comment: 'Great!' }
      );

      await feedbackCollector.collectFeedback(
        'session-2',
        'useful',
        { scenario: 'design', taskType: 'design', executionTime: 4000 },
        { rating: 4 }
      );

      await feedbackCollector.collectFeedback(
        'session-3',
        'not-useful',
        { scenario: 'implementation', taskType: 'implementation', executionTime: 3000 },
        { rating: 2, comment: 'Too slow' }
      );

      await feedbackCollector.collectFeedback(
        'session-4',
        'suggestion',
        { scenario: 'debug', taskType: 'debug', executionTime: 2000 },
        { comment: 'Add more details' }
      );
    });

    it('应该返回正确的统计信息', () => {
      const stats = feedbackCollector.getStats();

      expect(stats.totalFeedback).toBe(4);
      expect(stats.usefulCount).toBe(2);
      expect(stats.notUsefulCount).toBe(1);
      expect(stats.suggestionCount).toBe(1);
      expect(stats.averageRating).toBeCloseTo(3.7, 1); // (5+4+2)/3 = 3.67
    });

    it('应该支持按场景过滤', () => {
      const stats = feedbackCollector.getStats({ scenario: 'design' });

      expect(stats.totalFeedback).toBe(2);
      expect(stats.usefulCount).toBe(2);
      expect(stats.notUsefulCount).toBe(0);
    });

    it('应该支持按时间过滤', () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1); // 1小时前

      const stats = feedbackCollector.getStats({ startDate });

      expect(stats.totalFeedback).toBe(4); // 所有反馈都在1小时内
    });

    it('应该在没有初始化时抛出错误', () => {
      const newCollector = new FeedbackCollector(testWorkspaceRoot, mockOutputChannel);
      expect(() => newCollector.getStats()).toThrow('not initialized');
    });
  });

  describe('analyzeCommonIssues', () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      await feedbackCollector.initialize();
    });

    it('应该识别常见问题关键词', async () => {
      // 添加包含常见问题的反馈
      await feedbackCollector.collectFeedback(
        'session-1',
        'not-useful',
        { scenario: 'test', taskType: 'test', executionTime: 1000 },
        { comment: 'Too slow and timeout' }
      );

      await feedbackCollector.collectFeedback(
        'session-2',
        'not-useful',
        { scenario: 'test', taskType: 'test', executionTime: 1000 },
        { comment: 'Slow response' }
      );

      await feedbackCollector.collectFeedback(
        'session-3',
        'suggestion',
        { scenario: 'test', taskType: 'test', executionTime: 1000 },
        { comment: 'Error occurred' }
      );

      const issues = feedbackCollector.analyzeCommonIssues();

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('slow'); // 'slow'应该是最常见的
    });

    it('应该在没有负面反馈时返回空数组', async () => {
      await feedbackCollector.collectFeedback(
        'session-1',
        'useful',
        { scenario: 'test', taskType: 'test', executionTime: 1000 },
        { comment: 'Great!' }
      );

      const issues = feedbackCollector.analyzeCommonIssues();

      expect(issues).toEqual([]);
    });
  });

  describe('generateReport', () => {
    const reportPath = '/test/report.md';

    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      await feedbackCollector.initialize();

      // 添加测试数据
      await feedbackCollector.collectFeedback(
        'session-1',
        'useful',
        { scenario: 'design', taskType: 'design', executionTime: 5000 },
        { rating: 5, comment: 'Excellent!' }
      );
    });

    it('应该生成完整的报告', async () => {
      await feedbackCollector.generateReport(reportPath);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        reportPath,
        expect.stringContaining('# Codex 深度分析反馈报告')
      );

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        reportPath,
        expect.stringContaining('总体统计')
      );

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        reportPath,
        expect.stringContaining('场景分析')
      );
    });

    it('应该创建输出目录', async () => {
      await feedbackCollector.generateReport(reportPath);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.dirname(reportPath),
        { recursive: true }
      );
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      await feedbackCollector.initialize();
    });

    it('应该保留最近1000条反馈', async () => {
      // 添加1100条反馈（模拟）
      const allFeedback = feedbackCollector.getAllFeedback();
      for (let i = 0; i < 1100; i++) {
        allFeedback.push({
          id: `feedback-${i}`,
          sessionId: `session-${i}`,
          timestamp: new Date(Date.now() - i * 1000).toISOString(), // 递减时间
          type: 'useful',
          analysisContext: {
            scenario: 'test',
            taskType: 'test',
            executionTime: 1000
          }
        });
      }

      // 直接修改内部数组（用于测试）
      (feedbackCollector as any).feedback = allFeedback;

      await feedbackCollector.cleanup();

      expect(feedbackCollector.getFeedbackCount()).toBe(1000);
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('应该在反馈数量少于1000时不清理', async () => {
      await feedbackCollector.collectFeedback(
        'session-1',
        'useful',
        { scenario: 'test', taskType: 'test', executionTime: 1000 }
      );

      // 清除之前的调用记录
      (fs.promises.writeFile as jest.Mock).mockClear();

      await feedbackCollector.cleanup();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('No cleanup needed')
      );
    });
  });
});
