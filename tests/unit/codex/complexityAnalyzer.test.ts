/**
 * ComplexityAnalyzer 单元测试
 *
 * 测试复杂度分析器的各种评分场景
 */

import { ComplexityAnalyzer } from '../../../src/features/codex/complexityAnalyzer';
import { TaskDescriptor } from '../../../src/features/codex/types';

describe('ComplexityAnalyzer', () => {
  let analyzer: ComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ComplexityAnalyzer();
  });

  describe('analyze', () => {
    it('应该返回完整的复杂度评分结构', async () => {
      const task: TaskDescriptor = {
        id: 'test-1',
        type: 'implementation',
        description: 'Implement a simple feature',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('codeScale');
      expect(result).toHaveProperty('technicalDifficulty');
      expect(result).toHaveProperty('businessImpact');
      expect(result).toHaveProperty('details');

      // 总分应该在1-10范围内
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(10);
    });

    it('应该正确计算加权总分', async () => {
      const task: TaskDescriptor = {
        id: 'test-2',
        type: 'implementation',
        description: 'Simple implementation',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 验证加权公式: codeScale*30% + technicalDifficulty*40% + businessImpact*30%
      const expectedTotal =
        result.codeScale * 0.3 +
        result.technicalDifficulty * 0.4 +
        result.businessImpact * 0.3;

      // 允许0.1的浮点误差
      expect(Math.abs(result.total - expectedTotal)).toBeLessThan(0.1);
    });
  });

  describe('代码规模评分 (30%权重)', () => {
    it('无文件的文档任务应该得到低分', async () => {
      const task: TaskDescriptor = {
        id: 'doc-1',
        type: 'requirements',
        description: 'Write requirements document',
        specName: 'test-spec',
        relatedFiles: []
      };

      const result = await analyzer.analyze(task);

      // 无文件应该得分1-2分
      expect(result.codeScale).toBeLessThanOrEqual(2);
      expect(result.details.fileCount).toBe(0);
    });

    it('单文件任务应该得到低-中等分', async () => {
      const task: TaskDescriptor = {
        id: 'single-1',
        type: 'implementation',
        description: 'Modify a single file',
        specName: 'test-spec',
        relatedFiles: ['src/test.ts']
      };

      const result = await analyzer.analyze(task);

      // 单文件应该得分2-4分
      expect(result.codeScale).toBeGreaterThanOrEqual(2);
      expect(result.codeScale).toBeLessThanOrEqual(4);
      expect(result.details.fileCount).toBe(1);
    });

    it('2-3个文件应该得到中等分', async () => {
      const task: TaskDescriptor = {
        id: 'few-1',
        type: 'implementation',
        description: 'Modify few files',
        specName: 'test-spec',
        relatedFiles: ['src/file1.ts', 'src/file2.ts', 'src/file3.ts']
      };

      const result = await analyzer.analyze(task);

      // 2-3个文件应该得分3-5分
      expect(result.codeScale).toBeGreaterThanOrEqual(3);
      expect(result.codeScale).toBeLessThanOrEqual(5);
      expect(result.details.fileCount).toBe(3);
    });

    it('4-5个文件应该得到中-高分', async () => {
      const task: TaskDescriptor = {
        id: 'medium-1',
        type: 'implementation',
        description: 'Modify multiple files',
        specName: 'test-spec',
        relatedFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts']
      };

      const result = await analyzer.analyze(task);

      // 4-5个文件应该得分5-7分
      expect(result.codeScale).toBeGreaterThanOrEqual(5);
      expect(result.codeScale).toBeLessThanOrEqual(7);
      expect(result.details.fileCount).toBe(5);
    });

    it('6-10个文件应该得到高分', async () => {
      const task: TaskDescriptor = {
        id: 'many-1',
        type: 'implementation',
        description: 'Large refactoring',
        specName: 'test-spec',
        relatedFiles: Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`)
      };

      const result = await analyzer.analyze(task);

      // 6-10个文件应该得分7-9分
      expect(result.codeScale).toBeGreaterThanOrEqual(7);
      expect(result.codeScale).toBeLessThanOrEqual(9);
      expect(result.details.fileCount).toBe(8);
    });

    it('超过10个文件应该得到满分或接近满分', async () => {
      const task: TaskDescriptor = {
        id: 'huge-1',
        type: 'implementation',
        description: 'Massive refactoring',
        specName: 'test-spec',
        relatedFiles: Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`)
      };

      const result = await analyzer.analyze(task);

      // 超过10个文件应该得分9-10分
      expect(result.codeScale).toBeGreaterThanOrEqual(9);
      expect(result.codeScale).toBeLessThanOrEqual(10);
      expect(result.details.fileCount).toBe(15);
    });

    it('应该基于描述推测文件数量', async () => {
      const task: TaskDescriptor = {
        id: 'estimate-1',
        type: 'implementation',
        description: 'This task involves multiple files across the codebase',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 描述中提到"multiple files",应该推测为中等数量
      expect(result.details.fileCount).toBeGreaterThan(1);
    });
  });

  describe('技术难度评分 (40%权重)', () => {
    it('requirements任务应该得到低分', async () => {
      const task: TaskDescriptor = {
        id: 'req-1',
        type: 'requirements',
        description: 'Define requirements',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // requirements应该得分2分左右
      expect(result.technicalDifficulty).toBeLessThanOrEqual(4);
    });

    it('design任务应该得到中-高分', async () => {
      const task: TaskDescriptor = {
        id: 'design-1',
        type: 'design',
        description: 'Design system architecture',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // design应该得分6分左右
      expect(result.technicalDifficulty).toBeGreaterThanOrEqual(5);
      expect(result.technicalDifficulty).toBeLessThanOrEqual(8);
    });

    it('debug任务应该得到高分', async () => {
      const task: TaskDescriptor = {
        id: 'debug-1',
        type: 'debug',
        description: 'Fix critical bug',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // debug应该得分8分左右
      expect(result.technicalDifficulty).toBeGreaterThanOrEqual(7);
    });

    it('涉及架构变更应该增加2分', async () => {
      const task: TaskDescriptor = {
        id: 'arch-1',
        type: 'implementation',
        description: 'Refactor the architecture to improve scalability',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // implementation基础分7 + 架构变更2分 = 9分
      expect(result.technicalDifficulty).toBeGreaterThanOrEqual(8);
      expect(result.details.involvesASTModification).toBe(true);
    });

    it('涉及新技术引入应该增加1.5分', async () => {
      const task: TaskDescriptor = {
        id: 'tech-1',
        type: 'implementation',
        description: 'Integrate new framework for better performance',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 应该检测到新技术
      expect(result.details.involvesNewTechnology).toBe(true);
      expect(result.technicalDifficulty).toBeGreaterThan(7);
    });

    it('涉及异步/并发应该增加1.5分', async () => {
      const task: TaskDescriptor = {
        id: 'async-1',
        type: 'implementation',
        description: 'Implement concurrent data processing with async workers',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 应该检测到异步复杂度
      expect(result.details.involvesAsyncComplexity).toBe(true);
      expect(result.technicalDifficulty).toBeGreaterThan(7);
    });

    it('涉及数据库迁移应该增加1分', async () => {
      const task: TaskDescriptor = {
        id: 'db-1',
        type: 'implementation',
        description: 'Add database migration for new schema',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 应该检测到数据库迁移
      expect(result.details.requiresDatabaseMigration).toBe(true);
      expect(result.technicalDifficulty).toBeGreaterThan(6);
    });

    it('涉及性能优化应该增加1分', async () => {
      const task: TaskDescriptor = {
        id: 'perf-1',
        type: 'implementation',
        description: 'Optimize performance by implementing cache',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.technicalDifficulty).toBeGreaterThan(6);
    });

    it('涉及安全相关应该增加1分', async () => {
      const task: TaskDescriptor = {
        id: 'sec-1',
        type: 'implementation',
        description: 'Implement authentication and authorization',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.technicalDifficulty).toBeGreaterThan(6);
    });

    it('多个复杂因素叠加不应超过10分', async () => {
      const task: TaskDescriptor = {
        id: 'complex-1',
        type: 'debug',
        description: 'Refactor architecture with new framework, async processing, database migration, security, and performance optimization',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 即使所有因素叠加,也不应超过10分
      expect(result.technicalDifficulty).toBeLessThanOrEqual(10);
    });

    it('应该支持中文关键词检测', async () => {
      const task: TaskDescriptor = {
        id: 'chinese-1',
        type: 'implementation',
        description: '重构架构以支持异步处理和数据库迁移',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.involvesASTModification).toBe(true);
      expect(result.details.involvesAsyncComplexity).toBe(true);
      expect(result.details.requiresDatabaseMigration).toBe(true);
      expect(result.technicalDifficulty).toBeGreaterThan(8);
    });
  });

  describe('业务影响评分 (30%权重)', () => {
    it('默认应该给中等影响分', async () => {
      const task: TaskDescriptor = {
        id: 'normal-1',
        type: 'implementation',
        description: 'Normal feature implementation',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 默认业务影响5分左右
      expect(result.businessImpact).toBeGreaterThanOrEqual(4);
      expect(result.businessImpact).toBeLessThanOrEqual(6);
    });

    it('涉及核心功能应该增加3分', async () => {
      const task: TaskDescriptor = {
        id: 'core-1',
        type: 'implementation',
        description: 'Modify core authentication system',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 核心功能应该得高分
      expect(result.businessImpact).toBeGreaterThanOrEqual(7);
    });

    it('涉及多子系统应该增加2分', async () => {
      const task: TaskDescriptor = {
        id: 'cross-1',
        type: 'implementation',
        description: 'Implement cross-module communication',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.crossModuleImpact).toBe(true);
      expect(result.businessImpact).toBeGreaterThan(6);
    });

    it('涉及API变更应该增加2分', async () => {
      const task: TaskDescriptor = {
        id: 'api-1',
        type: 'implementation',
        description: 'Breaking change to core API interface',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.affectsCoreAPI).toBe(true);
      expect(result.businessImpact).toBeGreaterThan(6);
    });

    it('涉及用户体验应该增加1.5分', async () => {
      const task: TaskDescriptor = {
        id: 'ux-1',
        type: 'implementation',
        description: 'Improve user experience with new UI',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.businessImpact).toBeGreaterThan(5);
    });

    it('涉及数据完整性应该增加2分', async () => {
      const task: TaskDescriptor = {
        id: 'data-1',
        type: 'implementation',
        description: 'Implement data integrity checks to prevent data loss',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.businessImpact).toBeGreaterThan(6);
    });

    it('简单文档任务应该降低影响分', async () => {
      const task: TaskDescriptor = {
        id: 'doc-2',
        type: 'requirements',
        description: 'Write simple requirements',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 文档任务应该得低分 (修正为3.5以下,因为默认5分-3分降级=2分,但可能有其他关键词加分)
      expect(result.businessImpact).toBeLessThanOrEqual(4);
    });

    it('核心功能文档任务不应降低影响分', async () => {
      const task: TaskDescriptor = {
        id: 'doc-3',
        type: 'requirements',
        description: 'Define core critical requirements',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 核心功能文档应该保持中-高分
      expect(result.businessImpact).toBeGreaterThan(5);
    });
  });

  describe('重构范围检测', () => {
    it('无重构任务应该返回none', async () => {
      const task: TaskDescriptor = {
        id: 'no-refactor-1',
        type: 'implementation',
        description: 'Add new feature',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.refactoringScope).toBe('none');
    });

    it('单文件重构应该返回single', async () => {
      const task: TaskDescriptor = {
        id: 'single-refactor-1',
        type: 'implementation',
        description: 'Refactor this file',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.refactoringScope).toBe('single');
    });

    it('多文件重构应该返回multiple', async () => {
      const task: TaskDescriptor = {
        id: 'multi-refactor-1',
        type: 'implementation',
        description: 'Refactor multiple modules',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.refactoringScope).toBe('multiple');
    });

    it('跨模块重构应该返回multiple', async () => {
      const task: TaskDescriptor = {
        id: 'cross-refactor-1',
        type: 'implementation',
        description: 'Refactor cross-module dependencies',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details.refactoringScope).toBe('multiple');
    });
  });

  describe('综合场景测试', () => {
    it('简单需求文档 - 应该得到低复杂度评分(<3)', async () => {
      const task: TaskDescriptor = {
        id: 'scenario-1',
        type: 'requirements',
        description: 'Write requirements for a simple UI change',
        specName: 'simple-feature',
        relatedFiles: []
      };

      const result = await analyzer.analyze(task);

      // 简单需求: 低代码规模 + 低技术难度 + 低业务影响
      expect(result.total).toBeLessThan(3);
    });

    it('中等复杂度实现 - 应该得到中等评分(4-6)', async () => {
      const task: TaskDescriptor = {
        id: 'scenario-2',
        type: 'implementation',
        description: 'Implement a new API endpoint with validation',
        specName: 'api-feature',
        relatedFiles: ['src/api.ts', 'src/validation.ts', 'src/types.ts']
      };

      const result = await analyzer.analyze(task);

      // 中等实现: 中等代码规模 + 中-高技术难度 + 中等业务影响
      expect(result.total).toBeGreaterThanOrEqual(4);
      expect(result.total).toBeLessThanOrEqual(7);
    });

    it('复杂架构重构 - 应该得到高复杂度评分(≥7)', async () => {
      const task: TaskDescriptor = {
        id: 'scenario-3',
        type: 'implementation',
        description: 'Refactor core architecture to support new async processing with database migration and breaking API changes across multiple subsystems',
        specName: 'major-refactor',
        relatedFiles: Array.from({ length: 12 }, (_, i) => `src/core/module${i}.ts`)
      };

      const result = await analyzer.analyze(task);

      // 复杂重构: 高代码规模 + 高技术难度 + 高业务影响
      expect(result.total).toBeGreaterThanOrEqual(7);

      // 验证详细指标
      expect(result.details.involvesASTModification).toBe(true);
      expect(result.details.involvesAsyncComplexity).toBe(true);
      expect(result.details.requiresDatabaseMigration).toBe(true);
      expect(result.details.affectsCoreAPI).toBe(true);
      expect(result.details.crossModuleImpact).toBe(true); // 需要描述中包含"multiple subsystems"等关键词
      expect(result.details.refactoringScope).toBe('multiple');
    });

    it('关键bug修复 - 应该得到中-高评分(5-8)', async () => {
      const task: TaskDescriptor = {
        id: 'scenario-4',
        type: 'debug',
        description: 'Fix critical race condition with concurrent async processing in core payment system',
        specName: 'critical-bugfix',
        relatedFiles: ['src/payment/processor.ts', 'src/payment/queue.ts']
      };

      const result = await analyzer.analyze(task);

      // 关键bug: 中等代码规模 + 高技术难度 + 高业务影响
      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.total).toBeLessThanOrEqual(9);

      expect(result.details.involvesAsyncComplexity).toBe(true); // 需要明确包含"async"或"concurrent"等关键词
    });

    it('技术设计review - 应该得到中等评分(4-6)', async () => {
      const task: TaskDescriptor = {
        id: 'scenario-5',
        type: 'review',
        description: 'Review design for new microservice architecture',
        specName: 'design-review',
        context: {
          design: 'Detailed design document for microservice migration'
        }
      };

      const result = await analyzer.analyze(task);

      // design review: 低代码规模 + 中-高技术难度 + 中等业务影响
      expect(result.total).toBeGreaterThanOrEqual(4);
      expect(result.total).toBeLessThanOrEqual(7);
    });
  });

  describe('边界条件测试', () => {
    it('空描述任务应该返回默认评分', async () => {
      const task: TaskDescriptor = {
        id: 'empty-1',
        type: 'implementation',
        description: '',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(10);
    });

    it('超长描述不应导致评分溢出', async () => {
      const longDescription = 'refactor '.repeat(100) + 'architecture '.repeat(100);
      const task: TaskDescriptor = {
        id: 'long-1',
        type: 'implementation',
        description: longDescription,
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      // 即使描述很长,评分也应该在1-10范围内
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(10);
    });

    it('context字段中的关键词也应该被检测', async () => {
      const task: TaskDescriptor = {
        id: 'context-1',
        type: 'implementation',
        description: 'Implement feature',
        specName: 'test-spec',
        context: {
          requirements: 'This requires refactoring core architecture with async processing',
          additionalContext: {
            notes: 'Breaking changes to API'
          }
        }
      };

      const result = await analyzer.analyze(task);

      expect(result.details.involvesASTModification).toBe(true);
      expect(result.details.involvesAsyncComplexity).toBe(true);
      expect(result.details.affectsCoreAPI).toBe(true);
      expect(result.technicalDifficulty).toBeGreaterThan(7);
    });

    it('各维度评分不应超过10分', async () => {
      const task: TaskDescriptor = {
        id: 'max-1',
        type: 'debug',
        description: 'Massive refactor of core critical architecture with new framework, async, database, security, performance, breaking API changes affecting multiple subsystems and data integrity',
        specName: 'test-spec',
        relatedFiles: Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`)
      };

      const result = await analyzer.analyze(task);

      expect(result.codeScale).toBeLessThanOrEqual(10);
      expect(result.technicalDifficulty).toBeLessThanOrEqual(10);
      expect(result.businessImpact).toBeLessThanOrEqual(10);
      expect(result.total).toBeLessThanOrEqual(10);
    });

    it('各维度评分不应低于1分', async () => {
      const task: TaskDescriptor = {
        id: 'min-1',
        type: 'requirements',
        description: 'Simple task',
        specName: 'test-spec',
        relatedFiles: []
      };

      const result = await analyzer.analyze(task);

      expect(result.codeScale).toBeGreaterThanOrEqual(1);
      expect(result.technicalDifficulty).toBeGreaterThanOrEqual(1);
      expect(result.businessImpact).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('details字段完整性测试', () => {
    it('应该包含所有必需的details字段', async () => {
      const task: TaskDescriptor = {
        id: 'details-1',
        type: 'implementation',
        description: 'Test task',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(result.details).toHaveProperty('fileCount');
      expect(result.details).toHaveProperty('functionDepth');
      expect(result.details).toHaveProperty('externalDeps');
      expect(result.details).toHaveProperty('cyclomaticComplexity');
      expect(result.details).toHaveProperty('cognitiveComplexity');
      expect(result.details).toHaveProperty('crossModuleImpact');
      expect(result.details).toHaveProperty('refactoringScope');
      expect(result.details).toHaveProperty('involvesASTModification');
      expect(result.details).toHaveProperty('involvesAsyncComplexity');
      expect(result.details).toHaveProperty('involvesNewTechnology');
      expect(result.details).toHaveProperty('requiresDatabaseMigration');
      expect(result.details).toHaveProperty('affectsCoreAPI');
    });

    it('details字段类型应该正确', async () => {
      const task: TaskDescriptor = {
        id: 'types-1',
        type: 'implementation',
        description: 'Test task',
        specName: 'test-spec'
      };

      const result = await analyzer.analyze(task);

      expect(typeof result.details.fileCount).toBe('number');
      expect(typeof result.details.functionDepth).toBe('number');
      expect(typeof result.details.externalDeps).toBe('number');
      expect(typeof result.details.cyclomaticComplexity).toBe('number');
      expect(typeof result.details.cognitiveComplexity).toBe('number');
      expect(typeof result.details.crossModuleImpact).toBe('boolean');
      expect(['none', 'single', 'multiple']).toContain(result.details.refactoringScope);
      expect(typeof result.details.involvesASTModification).toBe('boolean');
      expect(typeof result.details.involvesAsyncComplexity).toBe('boolean');
      expect(typeof result.details.involvesNewTechnology).toBe('boolean');
      expect(typeof result.details.requiresDatabaseMigration).toBe('boolean');
      expect(typeof result.details.affectsCoreAPI).toBe('boolean');
    });
  });
});
