/**
 * 任务路由器单元测试
 *
 * 测试覆盖:
 * 1. 路由决策逻辑 (固定模式、auto模式)
 * 2. 复杂度评分推荐
 * 3. 用户确认流程
 * 4. 推荐理由生成
 * 5. 置信度计算
 * 6. 边界条件和错误处理
 */

import * as vscode from 'vscode';
import { TaskRouter } from '../taskRouter';
import { ComplexityAnalyzer } from '../complexityAnalyzer';
import { ConfigManager } from '../../../utils/configManager';
import {
  TaskDescriptor,
  ExecutionMode,
  ModeRecommendation,
  ComplexityScore
} from '../types';

// Mock dependencies
jest.mock('../complexityAnalyzer');
jest.mock('../../../utils/configManager');
jest.mock('vscode');

describe('TaskRouter', () => {
  let router: TaskRouter;
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;
  let mockAnalyzer: jest.Mocked<ComplexityAnalyzer>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  // Sample task descriptors
  const createTask = (
    type: TaskDescriptor['type'],
    description: string,
    relatedFiles?: string[]
  ): TaskDescriptor => ({
    id: 'test-task-1',
    type,
    description,
    relatedFiles
  });

  // Sample complexity score
  const createComplexityScore = (
    total: number,
    codeScale: number = 5,
    technicalDifficulty: number = 5,
    businessImpact: number = 5
  ): ComplexityScore => ({
    total,
    codeScale,
    technicalDifficulty,
    businessImpact,
    details: {
      fileCount: 3,
      functionDepth: 2,
      externalDeps: 1,
      cyclomaticComplexity: 0,
      cognitiveComplexity: 0,
      crossModuleImpact: false,
      refactoringScope: 'none',
      involvesASTModification: false,
      involvesAsyncComplexity: false,
      involvesNewTechnology: false,
      requiresDatabaseMigration: false,
      affectsCoreAPI: false
    }
  });

  beforeEach(() => {
    // Setup mocks
    mockContext = {} as vscode.ExtensionContext;
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    } as any;

    // Mock ComplexityAnalyzer
    mockAnalyzer = new ComplexityAnalyzer() as jest.Mocked<ComplexityAnalyzer>;

    // Mock ConfigManager
    mockConfigManager = ConfigManager.getInstance() as jest.Mocked<ConfigManager>;

    // Create router instance
    router = new TaskRouter(mockContext, mockOutputChannel);

    // Inject mocked dependencies
    (router as any).analyzer = mockAnalyzer;
    (router as any).configManager = mockConfigManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('route()', () => {
    describe('固定模式路由', () => {
      it('应该直接返回配置的local模式', async () => {
        // Arrange
        const task = createTask('implementation', 'Simple implementation task');
        mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
          codex: { defaultMode: 'local' }
        });

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('local');
        expect(mockAnalyzer.analyze).not.toHaveBeenCalled();
      });

      it('应该直接返回配置的codex模式', async () => {
        // Arrange
        const task = createTask('design', 'Complex design task');
        mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
          codex: { defaultMode: 'codex' }
        });

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('codex');
        expect(mockAnalyzer.analyze).not.toHaveBeenCalled();
      });
    });

    describe('Auto模式路由', () => {
      beforeEach(() => {
        mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
          codex: { defaultMode: 'auto' }
        });
      });

      it('应该在评分<7时推荐local模式,不询问用户', async () => {
        // Arrange
        const task = createTask('requirements', 'Simple requirements task');
        const lowScore = createComplexityScore(5, 4, 5, 6);
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(lowScore);

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('local');
        expect(mockAnalyzer.analyze).toHaveBeenCalledWith(task);
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      });

      it('应该在评分≥7时推荐codex模式,并询问用户确认', async () => {
        // Arrange
        const task = createTask('implementation', 'Complex implementation with multiple modules');
        const highScore = createComplexityScore(8.5, 9, 8, 9);
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(highScore);

        // Mock user confirmation
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用Codex');

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('codex');
        expect(mockAnalyzer.analyze).toHaveBeenCalledWith(task);
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      });

      it('应该在用户拒绝codex时回退到local模式', async () => {
        // Arrange
        const task = createTask('design', 'Complex design task');
        const highScore = createComplexityScore(9, 10, 9, 8);
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(highScore);

        // Mock user rejection
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用本地Agent');

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('local');
      });

      it('应该在用户取消对话框时回退到local模式', async () => {
        // Arrange
        const task = createTask('implementation', 'Complex task');
        const highScore = createComplexityScore(7.5, 8, 7, 8);
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(highScore);

        // Mock user cancellation (undefined)
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('local');
      });
    });

    describe('配置加载失败处理', () => {
      it('应该在配置加载失败时使用auto模式', async () => {
        // Arrange
        const task = createTask('implementation', 'Task with config error');
        mockConfigManager.loadSettings = jest.fn().mockRejectedValue(new Error('Config load failed'));

        const lowScore = createComplexityScore(4, 3, 4, 5);
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(lowScore);

        // Act
        const result = await router.route(task);

        // Assert
        expect(result).toBe('local');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load config')
        );
      });
    });
  });

  describe('recommend()', () => {
    it('应该在评分<7时推荐local模式', async () => {
      // Arrange
      const task = createTask('tasks', 'Simple task breakdown');
      const lowScore = createComplexityScore(4.5, 3, 5, 5);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(lowScore);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.mode).toBe('local');
      expect(result.score).toBe(4.5);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('应该在评分≥7时推荐codex模式', async () => {
      // Arrange
      const task = createTask('implementation', 'Complex implementation');
      const highScore = createComplexityScore(8.2, 9, 8, 8);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(highScore);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.mode).toBe('codex');
      expect(result.score).toBe(8.2);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('应该在边界值7.0时推荐codex模式', async () => {
      // Arrange
      const task = createTask('debug', 'Debugging task');
      const boundaryScore = createComplexityScore(7.0, 7, 7, 7);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(boundaryScore);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.mode).toBe('codex');
      expect(result.score).toBe(7.0);
    });
  });

  describe('推荐理由生成', () => {
    it('应该为高代码规模生成相应理由', async () => {
      // Arrange
      const task = createTask('implementation', 'Large codebase modification');
      const score = createComplexityScore(8, 9, 7, 7);
      score.details.fileCount = 15;
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('代码规模较大')
        ])
      );
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('15个文件')
        ])
      );
    });

    it('应该为高技术难度生成详细理由', async () => {
      // Arrange
      const task = createTask('implementation', 'Complex async implementation');
      const score = createComplexityScore(8.5, 6, 9, 8);
      score.details.involvesAsyncComplexity = true;
      score.details.involvesNewTechnology = true;
      score.details.requiresDatabaseMigration = true;
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('技术难度很高')
        ])
      );
      expect(result.reasons.join(' ')).toContain('异步/并发处理');
      expect(result.reasons.join(' ')).toContain('新技术引入');
      expect(result.reasons.join(' ')).toContain('数据库迁移');
    });

    it('应该为高业务影响生成相应理由', async () => {
      // Arrange
      const task = createTask('design', 'Core API redesign');
      const score = createComplexityScore(9, 7, 9, 10);
      score.details.crossModuleImpact = true;
      score.details.affectsCoreAPI = true;
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('业务影响范围广')
        ])
      );
      expect(result.reasons.join(' ')).toContain('跨多个模块');
      expect(result.reasons.join(' ')).toContain('影响核心API');
    });

    it('应该为跨文件重构添加理由', async () => {
      // Arrange
      const task = createTask('implementation', 'Multi-file refactoring');
      const score = createComplexityScore(7.5, 8, 7, 7);
      score.details.refactoringScope = 'multiple';
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('跨文件重构')
        ])
      );
    });

    it('应该为中等复杂度任务生成合理理由', async () => {
      // Arrange
      const task = createTask('review', 'Code review task');
      const score = createComplexityScore(5.5, 5, 6, 5);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('本地Agent可以胜任')
        ])
      );
    });

    it('应该为评分全为中等的任务生成默认理由', async () => {
      // Arrange
      const task = createTask('requirements', 'Basic requirements');
      const score = createComplexityScore(4.5, 4, 5, 4);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('置信度计算', () => {
    it('应该为评分一致的任务返回高置信度', async () => {
      // Arrange - 三个维度评分非常接近
      const task = createTask('implementation', 'Consistent complexity task');
      const score = createComplexityScore(8, 8, 8, 8);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it('应该为评分分散的任务返回低置信度', async () => {
      // Arrange - 三个维度评分差异很大
      const task = createTask('implementation', 'Inconsistent complexity task');
      const score = createComplexityScore(6, 2, 10, 5);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.confidence).toBeLessThan(70);
    });

    it('应该为极端评分提升置信度', async () => {
      // Arrange - 非常高的评分
      const task = createTask('implementation', 'Very complex task');
      const score = createComplexityScore(9.5, 9, 10, 10);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.confidence).toBeGreaterThanOrEqual(95);
    });

    it('应该为极低评分提升置信度', async () => {
      // Arrange - 非常低的评分
      const task = createTask('requirements', 'Very simple task');
      const score = createComplexityScore(1.5, 1, 2, 2);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      const result = await router.recommend(task);

      // Assert
      expect(result.confidence).toBeGreaterThanOrEqual(95);
    });

    it('置信度应该在0-100范围内', async () => {
      // Test with various scores
      const testCases = [
        createComplexityScore(1, 1, 1, 1),
        createComplexityScore(5, 3, 7, 5),
        createComplexityScore(7, 5, 9, 6),
        createComplexityScore(10, 10, 10, 10),
        createComplexityScore(6, 1, 10, 7)
      ];

      for (const score of testCases) {
        const task = createTask('implementation', 'Test task');
        mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

        const result = await router.recommend(task);

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('用户确认对话框', () => {
    beforeEach(() => {
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        codex: { defaultMode: 'auto' }
      });
    });

    it('应该显示包含评分和理由的确认消息', async () => {
      // Arrange
      const task = createTask('implementation', 'Complex task');
      const score = createComplexityScore(8.7, 9, 9, 8);
      score.details.involvesAsyncComplexity = true;
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用Codex');

      // Act
      await router.route(task);

      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('8.7/10'),
        expect.objectContaining({ modal: true }),
        '使用Codex',
        '使用本地Agent'
      );

      const callArgs = (vscode.window.showInformationMessage as jest.Mock).mock.calls[0];
      const message = callArgs[0];
      expect(message).toContain('推荐理由');
      expect(message).toContain('置信度');
    });

    it('应该在确认消息中显示理由列表', async () => {
      // Arrange
      const task = createTask('implementation', 'Multi-aspect complex task');
      const score = createComplexityScore(9, 10, 9, 8);
      score.details.fileCount = 20;
      score.details.crossModuleImpact = true;
      score.details.affectsCoreAPI = true;
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用Codex');

      // Act
      await router.route(task);

      // Assert
      const callArgs = (vscode.window.showInformationMessage as jest.Mock).mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('代码规模较大');
      expect(message).toContain('技术难度');
      expect(message).toContain('业务影响');
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理复杂度分析器抛出的异常', async () => {
      // Arrange
      const task = createTask('implementation', 'Task causing analyzer error');
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        codex: { defaultMode: 'auto' }
      });
      mockAnalyzer.analyze = jest.fn().mockRejectedValue(new Error('Analyzer failed'));

      // Act & Assert
      await expect(router.route(task)).rejects.toThrow('Analyzer failed');
    });

    it('应该处理无配置对象的情况', async () => {
      // Arrange
      const task = createTask('implementation', 'Task with missing config');
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        // codex property missing
      } as any);

      const lowScore = createComplexityScore(3, 2, 3, 4);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(lowScore);

      // Act
      const result = await router.route(task);

      // Assert - should use 'auto' as default
      expect(result).toBe('local');
    });

    it('应该处理评分恰好为7的边界情况', async () => {
      // Arrange
      const task = createTask('design', 'Boundary case task');
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        codex: { defaultMode: 'auto' }
      });

      const boundaryScore = createComplexityScore(7.0, 7, 7, 7);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(boundaryScore);

      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用Codex');

      // Act
      const result = await router.route(task);

      // Assert - score >= 7 should recommend Codex
      expect(result).toBe('codex');
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('应该处理评分略低于7的情况', async () => {
      // Arrange
      const task = createTask('design', 'Just below boundary');
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        codex: { defaultMode: 'auto' }
      });

      const belowBoundaryScore = createComplexityScore(6.9, 7, 7, 7);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(belowBoundaryScore);

      // Act
      const result = await router.route(task);

      // Assert - score < 7 should recommend local
      expect(result).toBe('local');
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('日志记录', () => {
    it('应该记录路由决策的完整流程', async () => {
      // Arrange
      const task = createTask('implementation', 'Logged task');
      mockConfigManager.loadSettings = jest.fn().mockResolvedValue({
        codex: { defaultMode: 'auto' }
      });

      const score = createComplexityScore(8, 8, 8, 8);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('使用Codex');

      // Act
      await router.route(task);

      // Assert
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[TaskRouter] Starting route decision')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Default mode from config')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Auto mode enabled')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Recommendation:')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('User confirmed')
      );
    });

    it('应该记录推荐生成过程', async () => {
      // Arrange
      const task = createTask('design', 'Recommendation logging');
      const score = createComplexityScore(7.5, 7, 8, 7);
      mockAnalyzer.analyze = jest.fn().mockResolvedValue(score);

      // Act
      await router.recommend(task);

      // Assert
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[TaskRouter] Generating recommendation')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Complexity score:')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Recommendation generated:')
      );
    });
  });
});
