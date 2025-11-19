/**
 * ComplexityAnalyzer 单元测试
 *
 * 测试覆盖:
 * - 需求2.1: 技术设计文档review任务的复杂度分析
 * - 需求2.2: 功能开发任务的复杂度分析
 * - 需求2.3: 调试任务的复杂度分析
 * - 需求2.4: 多子系统交互的动态评分调整(+2分)
 * - 需求2.5: 跨文件重构的动态评分调整(+1分)
 * - 需求2.6: 加权评分模型(代码规模30%、技术难度40%、业务影响30%)
 */

import * as assert from 'assert';
import { ComplexityAnalyzer } from '../../../features/codex/complexityAnalyzer';
import { TaskDescriptor } from '../../../features/codex/types';

describe('ComplexityAnalyzer Test Suite', () => {
  let analyzer: ComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ComplexityAnalyzer();
  });

  describe('基础评分模型 (需求2.6)', () => {
    test('简单文档任务应获得低分', async () => {
      const task: TaskDescriptor = {
        id: 'test-1',
        type: 'requirements',
        description: 'Write basic requirements document',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.ok(score.total >= 1.0 && score.total <= 4.0,
        `简单文档任务评分应在1-4分范围: ${score.total}`);
    });

    test('复杂实现任务应获得高分', async () => {
      const task: TaskDescriptor = {
        id: 'test-2',
        type: 'implementation',
        description: 'Implement complex async architecture refactoring across multiple modules',
        context: {},
        relatedFiles: [
          'src/features/codex/complexityAnalyzer.ts',
          'src/features/codex/taskRouter.ts',
          'src/features/codex/codexExecutor.ts',
          'src/providers/specExplorerProvider.ts',
          'src/utils/configManager.ts'
        ]
      };

      const score = await analyzer.analyze(task);

      assert.ok(score.total >= 7.0,
        `复杂实现任务评分应>=7分: ${score.total}`);
    });

    test('加权评分公式正确应用 (代码规模30%、技术难度40%、业务影响30%)', async () => {
      const task: TaskDescriptor = {
        id: 'test-3',
        type: 'implementation',
        description: 'Moderate complexity task',
        context: {}
      };

      const score = await analyzer.analyze(task);

      // 验证各维度评分存在
      assert.ok(score.codeScale >= 1 && score.codeScale <= 10);
      assert.ok(score.technicalDifficulty >= 1 && score.technicalDifficulty <= 10);
      assert.ok(score.businessImpact >= 1 && score.businessImpact <= 10);

      // 验证总分在合理范围内
      assert.ok(score.total >= 1 && score.total <= 10);

      // 手动验证加权公式
      const expectedTotal =
        score.codeScale * 0.30 +
        score.technicalDifficulty * 0.40 +
        score.businessImpact * 0.30;

      assert.ok(Math.abs(score.total - expectedTotal) < 0.2,
        `总分应符合加权公式: expected=${expectedTotal}, actual=${score.total}`);
    });
  });

  describe('AST修改检测 (需求2.1, 2.5)', () => {
    test('应检测到refactor关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-4',
        type: 'implementation',
        description: 'Refactor the codebase to improve maintainability',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesASTModification, true,
        'Should detect AST modification from "refactor" keyword');
    });

    test('应检测到中文"重构"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-5',
        type: 'implementation',
        description: '对现有代码进行重构以提升性能',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesASTModification, true,
        'Should detect AST modification from Chinese "重构" keyword');
    });

    test('应检测到"restructure"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-6',
        type: 'implementation',
        description: 'Restructure the module architecture',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesASTModification, true,
        'Should detect AST modification from "restructure" keyword');
    });

    test('简单任务不应检测到AST修改', async () => {
      const task: TaskDescriptor = {
        id: 'test-7',
        type: 'requirements',
        description: 'Write simple documentation',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesASTModification, false,
        'Should not detect AST modification for simple tasks');
    });
  });

  describe('异步复杂度检测 (需求2.1, 2.3)', () => {
    test('应检测到async关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-8',
        type: 'implementation',
        description: 'Implement async data processing pipeline',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesAsyncComplexity, true,
        'Should detect async complexity from "async" keyword');
    });

    test('应检测到concurrent关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-9',
        type: 'debug',
        description: 'Fix concurrent access issue in cache',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesAsyncComplexity, true,
        'Should detect async complexity from "concurrent" keyword');
    });

    test('应检测到中文"异步"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-10',
        type: 'implementation',
        description: '实现异步任务队列管理器',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesAsyncComplexity, true,
        'Should detect async complexity from Chinese "异步" keyword');
    });

    test('应检测到"race condition"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-11',
        type: 'debug',
        description: 'Investigate race condition in worker threads',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesAsyncComplexity, true,
        'Should detect async complexity from "race condition" keyword');
    });
  });

  describe('新技术引入检测 (需求2.1)', () => {
    test('应检测到"new technology"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-12',
        type: 'implementation',
        description: 'Introduce new technology for real-time processing',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesNewTechnology, true,
        'Should detect new technology from "introduce" keyword');
    });

    test('应检测到"new framework"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-13',
        type: 'design',
        description: 'Integrate new framework for state management',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesNewTechnology, true,
        'Should detect new technology from "new framework" keyword');
    });

    test('应检测到中文"新技术"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-14',
        type: 'design',
        description: '引入新技术栈进行系统升级',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.involvesNewTechnology, true,
        'Should detect new technology from Chinese keywords');
    });
  });

  describe('多子系统影响检测 (需求2.2, 2.4)', () => {
    test('应检测到"multiple modules"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-15',
        type: 'implementation',
        description: 'Update API across multiple modules',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.crossModuleImpact, true,
        'Should detect cross-module impact from "multiple modules" keyword');
    });

    test('应检测到中文"多模块"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-16',
        type: 'implementation',
        description: '修改多模块共享的核心接口',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.crossModuleImpact, true,
        'Should detect cross-module impact from Chinese keywords');
    });

    test('涉及多个子系统的任务应自动提升至少2分 (需求2.4)', async () => {
      const taskWithoutMultiSystem: TaskDescriptor = {
        id: 'test-17a',
        type: 'implementation',
        description: 'Simple implementation',
        context: {},
        relatedFiles: ['src/features/codex/test.ts']
      };

      const taskWithMultiSystem: TaskDescriptor = {
        id: 'test-17b',
        type: 'implementation',
        description: 'Update multiple modules implementation',
        context: {},
        relatedFiles: ['src/features/codex/test.ts']
      };

      const scoreWithout = await analyzer.analyze(taskWithoutMultiSystem);
      const scoreWith = await analyzer.analyze(taskWithMultiSystem);

      assert.ok(scoreWith.businessImpact >= scoreWithout.businessImpact + 1.8,
        `多子系统任务的业务影响评分应至少提升2分: without=${scoreWithout.businessImpact}, with=${scoreWith.businessImpact}`);
    });

    test('应通过文件路径检测多子系统影响', async () => {
      const task: TaskDescriptor = {
        id: 'test-18',
        type: 'implementation',
        description: 'Update shared utilities',
        context: {},
        relatedFiles: [
          'src/features/codex/complexityAnalyzer.ts',
          'src/features/spec/specManager.ts',
          'src/providers/specExplorerProvider.ts',
          'src/utils/configManager.ts'
        ]
      };

      const score = await analyzer.analyze(task);

      // 4个文件分布在features/codex, features/spec, providers, utils四个子系统
      assert.strictEqual(score.details.crossModuleImpact, true,
        'Should detect cross-module impact from file distribution');
    });
  });

  describe('数据库迁移检测 (需求2.2)', () => {
    test('应检测到"database migration"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-19',
        type: 'implementation',
        description: 'Perform database migration for user schema',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.requiresDatabaseMigration, true,
        'Should detect database migration from keywords');
    });

    test('应检测到"schema change"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-20',
        type: 'implementation',
        description: 'Apply schema change to add new column',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.requiresDatabaseMigration, true,
        'Should detect database migration from "schema change"');
    });

    test('应检测到中文"数据库迁移"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-21',
        type: 'implementation',
        description: '执行数据库迁移更新表结构',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.requiresDatabaseMigration, true,
        'Should detect database migration from Chinese keywords');
    });
  });

  describe('核心API影响检测 (需求2.2)', () => {
    test('应检测到"core api"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-22',
        type: 'design',
        description: 'Update core api for authentication',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.affectsCoreAPI, true,
        'Should detect core API impact from "core api" keyword');
    });

    test('应检测到"breaking change"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-23',
        type: 'design',
        description: 'Make breaking change to public interface',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.affectsCoreAPI, true,
        'Should detect core API impact from "breaking change"');
    });

    test('应检测到中文"核心API"关键词', async () => {
      const task: TaskDescriptor = {
        id: 'test-24',
        type: 'design',
        description: '修改核心API接口定义',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.affectsCoreAPI, true,
        'Should detect core API impact from Chinese keywords');
    });
  });

  describe('跨文件重构评分调整 (需求2.5)', () => {
    test('单文件重构不应提升评分', async () => {
      const task: TaskDescriptor = {
        id: 'test-25',
        type: 'implementation',
        description: 'Refactor a single module',
        context: {},
        relatedFiles: ['src/features/codex/test.ts']
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.refactoringScope, 'single',
        'Should detect single file refactoring');
    });

    test('跨文件重构应自动提升至少1分 (需求2.5)', async () => {
      const taskSingleFile: TaskDescriptor = {
        id: 'test-26a',
        type: 'implementation',
        description: 'Simple implementation',
        context: {},
        relatedFiles: ['src/features/codex/test.ts']
      };

      const taskMultiFile: TaskDescriptor = {
        id: 'test-26b',
        type: 'implementation',
        description: 'Refactor multiple files',
        context: {},
        relatedFiles: [
          'src/features/codex/test1.ts',
          'src/features/codex/test2.ts',
          'src/features/codex/test3.ts'
        ]
      };

      const scoreSingle = await analyzer.analyze(taskSingleFile);
      const scoreMulti = await analyzer.analyze(taskMultiFile);

      assert.ok(scoreMulti.codeScale >= scoreSingle.codeScale + 0.8,
        `跨文件重构的代码规模评分应至少提升1分: single=${scoreSingle.codeScale}, multi=${scoreMulti.codeScale}`);
    });

    test('应检测到"multiple files refactoring"', async () => {
      const task: TaskDescriptor = {
        id: 'test-27',
        type: 'implementation',
        description: 'Refactor multiple files across the codebase',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.refactoringScope, 'multiple',
        'Should detect multiple file refactoring from keywords');
    });
  });

  describe('任务类型评分差异 (需求2.3)', () => {
    test('Debug任务应获得较高的技术难度评分', async () => {
      const debugTask: TaskDescriptor = {
        id: 'test-28',
        type: 'debug',
        description: 'Debug complex concurrency issue',
        context: {}
      };

      const score = await analyzer.analyze(debugTask);

      assert.ok(score.technicalDifficulty >= 7.0,
        `Debug任务的技术难度应>=7分: ${score.technicalDifficulty}`);
    });

    test('Design任务应获得中等偏高的技术难度评分', async () => {
      const designTask: TaskDescriptor = {
        id: 'test-29',
        type: 'design',
        description: 'Design new module architecture',
        context: {}
      };

      const score = await analyzer.analyze(designTask);

      assert.ok(score.technicalDifficulty >= 5.0 && score.technicalDifficulty <= 8.0,
        `Design任务的技术难度应在5-8分范围: ${score.technicalDifficulty}`);
    });

    test('Requirements任务应获得较低的技术难度评分', async () => {
      const reqTask: TaskDescriptor = {
        id: 'test-30',
        type: 'requirements',
        description: 'Write requirements document',
        context: {}
      };

      const score = await analyzer.analyze(reqTask);

      assert.ok(score.technicalDifficulty >= 1.0 && score.technicalDifficulty <= 4.0,
        `Requirements任务的技术难度应在1-4分范围: ${score.technicalDifficulty}`);
    });
  });

  describe('详细分析指标 (需求2.1)', () => {
    test('应生成完整的详细分析指标', async () => {
      const task: TaskDescriptor = {
        id: 'test-31',
        type: 'implementation',
        description: 'Complex task with multiple aspects',
        context: {},
        relatedFiles: [
          'src/features/codex/test1.ts',
          'src/features/codex/test2.ts',
          'src/features/spec/test.ts'
        ]
      };

      const score = await analyzer.analyze(task);

      // 验证所有详细指标字段存在
      assert.ok(score.details.fileCount !== undefined, 'Should have fileCount');
      assert.ok(score.details.functionDepth !== undefined, 'Should have functionDepth');
      assert.ok(score.details.externalDeps !== undefined, 'Should have externalDeps');
      assert.ok(score.details.cyclomaticComplexity !== undefined, 'Should have cyclomaticComplexity');
      assert.ok(score.details.cognitiveComplexity !== undefined, 'Should have cognitiveComplexity');
      assert.ok(score.details.crossModuleImpact !== undefined, 'Should have crossModuleImpact');
      assert.ok(score.details.refactoringScope !== undefined, 'Should have refactoringScope');
      assert.ok(score.details.involvesASTModification !== undefined, 'Should have involvesASTModification');
      assert.ok(score.details.involvesAsyncComplexity !== undefined, 'Should have involvesAsyncComplexity');
      assert.ok(score.details.involvesNewTechnology !== undefined, 'Should have involvesNewTechnology');
      assert.ok(score.details.requiresDatabaseMigration !== undefined, 'Should have requiresDatabaseMigration');
      assert.ok(score.details.affectsCoreAPI !== undefined, 'Should have affectsCoreAPI');
    });

    test('fileCount应反映relatedFiles数量', async () => {
      const task: TaskDescriptor = {
        id: 'test-32',
        type: 'implementation',
        description: 'Task with files',
        context: {},
        relatedFiles: [
          'src/file1.ts',
          'src/file2.ts',
          'src/file3.ts'
        ]
      };

      const score = await analyzer.analyze(task);

      assert.strictEqual(score.details.fileCount, 3,
        'fileCount should match relatedFiles length');
    });
  });

  describe('综合场景测试', () => {
    test('复杂技术设计文档review任务 (需求2.1)', async () => {
      const task: TaskDescriptor = {
        id: 'test-33',
        type: 'design',
        description: 'Review complex architecture design with new async framework, affecting core API and multiple modules',
        context: {
          additionalContext: {
            notes: 'This involves database migration and breaking changes'
          }
        },
        relatedFiles: [
          'src/features/codex/complexityAnalyzer.ts',
          'src/features/spec/specManager.ts',
          'src/providers/specExplorerProvider.ts',
          'src/utils/configManager.ts',
          'docs/design.md'
        ]
      };

      const score = await analyzer.analyze(task);

      // 验证高复杂度
      assert.ok(score.total >= 7.0, `复杂设计review应获得>=7分: ${score.total}`);

      // 验证关键指标被检测
      assert.strictEqual(score.details.involvesAsyncComplexity, true);
      assert.strictEqual(score.details.involvesNewTechnology, true);
      assert.strictEqual(score.details.affectsCoreAPI, true);
      assert.strictEqual(score.details.requiresDatabaseMigration, true);
      assert.strictEqual(score.details.crossModuleImpact, true);
    });

    test('简单功能开发任务 (需求2.2)', async () => {
      const task: TaskDescriptor = {
        id: 'test-34',
        type: 'implementation',
        description: 'Add a simple utility function',
        context: {},
        relatedFiles: ['src/utils/helper.ts']
      };

      const score = await analyzer.analyze(task);

      // 验证低复杂度
      assert.ok(score.total < 5.0, `简单实现任务应获得<5分: ${score.total}`);

      // 验证关键指标未被触发
      assert.strictEqual(score.details.involvesASTModification, false);
      assert.strictEqual(score.details.involvesAsyncComplexity, false);
      assert.strictEqual(score.details.involvesNewTechnology, false);
      assert.strictEqual(score.details.crossModuleImpact, false);
    });

    test('复杂调试任务 (需求2.3)', async () => {
      const task: TaskDescriptor = {
        id: 'test-35',
        type: 'debug',
        description: 'Debug race condition in async worker pool affecting multiple modules',
        context: {},
        relatedFiles: [
          'src/features/codex/workerPool.ts',
          'src/features/codex/taskQueue.ts',
          'src/utils/threadManager.ts'
        ]
      };

      const score = await analyzer.analyze(task);

      // Debug任务本身就有高基础分
      assert.ok(score.technicalDifficulty >= 7.0,
        `复杂Debug任务的技术难度应>=7分: ${score.technicalDifficulty}`);

      // 验证异步复杂度被检测
      assert.strictEqual(score.details.involvesAsyncComplexity, true);
      assert.strictEqual(score.details.crossModuleImpact, true);
    });
  });

  describe('边界情况测试', () => {
    test('空任务描述应返回最低分', async () => {
      const task: TaskDescriptor = {
        id: 'test-36',
        type: 'requirements',
        description: '',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.ok(score.total >= 1.0 && score.total <= 3.0,
        `空任务应获得最低分: ${score.total}`);
    });

    test('评分不应超过10分', async () => {
      const task: TaskDescriptor = {
        id: 'test-37',
        type: 'debug',
        description: 'Complex async refactor with new technology, database migration, core API changes, affecting multiple subsystems',
        context: {},
        relatedFiles: Array.from({ length: 20 }, (_, i) => `src/module${i}/file.ts`)
      };

      const score = await analyzer.analyze(task);

      assert.ok(score.total <= 10.0, `评分不应超过10分: ${score.total}`);
      assert.ok(score.codeScale <= 10.0, `代码规模评分不应超过10分: ${score.codeScale}`);
      assert.ok(score.technicalDifficulty <= 10.0, `技术难度评分不应超过10分: ${score.technicalDifficulty}`);
      assert.ok(score.businessImpact <= 10.0, `业务影响评分不应超过10分: ${score.businessImpact}`);
    });

    test('评分不应低于1分', async () => {
      const task: TaskDescriptor = {
        id: 'test-38',
        type: 'requirements',
        description: 'Trivial documentation update',
        context: {}
      };

      const score = await analyzer.analyze(task);

      assert.ok(score.total >= 1.0, `评分不应低于1分: ${score.total}`);
      assert.ok(score.codeScale >= 1.0, `代码规模评分不应低于1分: ${score.codeScale}`);
      assert.ok(score.technicalDifficulty >= 1.0, `技术难度评分不应低于1分: ${score.technicalDifficulty}`);
      assert.ok(score.businessImpact >= 1.0, `业务影响评分不应低于1分: ${score.businessImpact}`);
    });
  });
});
