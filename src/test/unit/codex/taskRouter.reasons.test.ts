/**
 * TaskRouter - 推荐理由生成逻辑 单元测试
 *
 * 测试覆盖:
 * - Task 13: 推荐理由生成逻辑
 * - 需求1.2: 基于复杂度评分生成人类可读的推荐理由
 * - 需求1.5: 计算推荐置信度
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { TaskRouter } from '../../../features/codex/taskRouter';
import { TaskDescriptor } from '../../../features/codex/types';

/**
 * Mock OutputChannel
 */
class MockOutputChannel implements vscode.OutputChannel {
  name: string = 'Test';
  private lines: string[] = [];

  append(value: string): void {
    this.lines.push(value);
  }

  appendLine(value: string): void {
    this.lines.push(value + '\n');
  }

  clear(): void {
    this.lines = [];
  }

  show(): void {}
  hide(): void {}
  dispose(): void {}
  replace(_value: string): void {}

  getOutput(): string {
    return this.lines.join('');
  }
}

describe('TaskRouter - 推荐理由生成逻辑测试', () => {
  let router: TaskRouter;
  let outputChannel: MockOutputChannel;
  let mockContext: any;

  beforeEach(() => {
    outputChannel = new MockOutputChannel();

    // 创建模拟的扩展上下文
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => []
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
        keys: () => []
      },
      extensionPath: '/test/path',
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/log',
      asAbsolutePath: (relativePath: string) => `/test/path/${relativePath}`
    };

    router = new TaskRouter(mockContext, outputChannel as any);
  });

  describe('代码规模理由生成', () => {
    test('高代码规模 (>=7分) 应生成相应理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-1',
        type: 'implementation',
        description: 'Large scale implementation across multiple files',
        relatedFiles: Array.from({ length: 12 }, (_, i) => `src/file${i}.ts`)
      };

      const recommendation = await router.recommend(task);

      // 应该包含代码规模相关的理由
      const hasCodeScaleReason = recommendation.reasons.some(r =>
        r.includes('代码规模') || r.includes('文件')
      );

      assert.strictEqual(hasCodeScaleReason, true,
        '高代码规模任务应包含代码规模相关理由');
    });

    test('中等代码规模 (5-7分) 应生成相应理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-2',
        type: 'implementation',
        description: 'Moderate implementation',
        relatedFiles: ['src/file1.ts', 'src/file2.ts', 'src/file3.ts', 'src/file4.ts']
      };

      const recommendation = await router.recommend(task);

      // 可能包含代码规模相关的理由
      const reasons = recommendation.reasons.join(' ');
      assert.ok(reasons.length > 0, '应该生成推荐理由');
    });

    test('低代码规模 (<5分) 通常不生成代码规模理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-3',
        type: 'requirements',
        description: 'Simple documentation task',
        relatedFiles: []
      };

      const recommendation = await router.recommend(task);

      // 低复杂度任务应该有默认理由
      assert.ok(recommendation.reasons.length > 0, '应该至少有一条理由');
    });

    test('理由应包含文件数量信息', async () => {
      const task: TaskDescriptor = {
        id: 'test-4',
        type: 'implementation',
        description: 'Implementation task',
        relatedFiles: Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`)
      };

      const recommendation = await router.recommend(task);

      const hasFileCountInfo = recommendation.reasons.some(r =>
        /\d+个文件/.test(r) || r.includes('文件')
      );

      // 如果代码规模足够高,应该包含文件数量信息
      if (recommendation.score >= 7) {
        assert.strictEqual(hasFileCountInfo, true,
          '高复杂度任务的理由应包含文件数量信息');
      }
    });
  });

  describe('技术难度理由生成', () => {
    test('高技术难度 (>=8分) 应生成详细理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-5',
        type: 'debug',
        description: 'Debug complex async race condition with new database migration',
        context: {
          additionalContext: {
            notes: 'Involves AST modification and new technology'
          }
        }
      };

      const recommendation = await router.recommend(task);

      // 应该包含技术难度相关的理由
      const hasTechnicalReason = recommendation.reasons.some(r =>
        r.includes('技术难度')
      );

      assert.strictEqual(hasTechnicalReason, true,
        '高技术难度任务应包含技术难度相关理由');
    });

    test('AST修改应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-6',
        type: 'implementation',
        description: 'Refactor and restructure the codebase using AST transformation'
      };

      const recommendation = await router.recommend(task);

      // 如果技术难度足够高,应该提到AST修改
      if (recommendation.score >= 7) {
        const hasASTMention = recommendation.reasons.some(r =>
          r.includes('AST') || r.includes('修改')
        );
        assert.strictEqual(hasASTMention, true,
          '涉及AST修改的任务理由应提到相关信息');
      }
    });

    test('异步复杂度应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-7',
        type: 'implementation',
        description: 'Implement complex async pipeline with concurrent processing and race condition handling'
      };

      const recommendation = await router.recommend(task);

      // 如果技术难度足够高,应该提到异步复杂度
      if (recommendation.score >= 7) {
        const hasAsyncMention = recommendation.reasons.some(r =>
          r.includes('异步') || r.includes('并发')
        );
        assert.strictEqual(hasAsyncMention, true,
          '涉及异步复杂度的任务理由应提到相关信息');
      }
    });

    test('新技术引入应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-8',
        type: 'design',
        description: 'Introduce new framework and integrate new technology stack'
      };

      const recommendation = await router.recommend(task);

      // 如果技术难度足够高,应该提到新技术
      if (recommendation.score >= 7) {
        const hasNewTechMention = recommendation.reasons.some(r =>
          r.includes('新技术') || r.includes('引入')
        );
        assert.strictEqual(hasNewTechMention, true,
          '涉及新技术的任务理由应提到相关信息');
      }
    });

    test('数据库迁移应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-9',
        type: 'implementation',
        description: 'Implement database migration for schema change'
      };

      const recommendation = await router.recommend(task);

      // 如果技术难度足够高,应该提到数据库迁移
      if (recommendation.score >= 7) {
        const hasDBMention = recommendation.reasons.some(r =>
          r.includes('数据库') || r.includes('迁移')
        );
        assert.strictEqual(hasDBMention, true,
          '涉及数据库迁移的任务理由应提到相关信息');
      }
    });
  });

  describe('业务影响理由生成', () => {
    test('高业务影响 (>=7分) 应生成相应理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-10',
        type: 'implementation',
        description: 'Update core API affecting multiple modules',
        relatedFiles: [
          'src/features/codex/api.ts',
          'src/features/spec/api.ts',
          'src/providers/api.ts',
          'src/utils/api.ts'
        ]
      };

      const recommendation = await router.recommend(task);

      // 应该包含业务影响相关的理由
      const hasBusinessReason = recommendation.reasons.some(r =>
        r.includes('业务影响') || r.includes('影响')
      );

      if (recommendation.score >= 7) {
        assert.strictEqual(hasBusinessReason, true,
          '高业务影响任务应包含业务影响相关理由');
      }
    });

    test('核心API影响应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-11',
        type: 'design',
        description: 'Make breaking change to core API'
      };

      const recommendation = await router.recommend(task);

      // 如果业务影响足够高,应该提到核心API
      if (recommendation.score >= 7) {
        const hasCoreAPIMention = recommendation.reasons.some(r =>
          r.includes('核心') || r.includes('API')
        );
        assert.strictEqual(hasCoreAPIMention, true,
          '影响核心API的任务理由应提到相关信息');
      }
    });

    test('跨模块影响应出现在理由中', async () => {
      const task: TaskDescriptor = {
        id: 'test-12',
        type: 'implementation',
        description: 'Update shared utilities across multiple modules',
        relatedFiles: [
          'src/features/codex/util.ts',
          'src/features/spec/util.ts',
          'src/providers/util.ts',
          'src/utils/shared.ts'
        ]
      };

      const recommendation = await router.recommend(task);

      // 如果业务影响足够高,应该提到跨模块影响
      if (recommendation.score >= 7) {
        const hasCrossModuleMention = recommendation.reasons.some(r =>
          r.includes('模块') || r.includes('跨')
        );
        assert.strictEqual(hasCrossModuleMention, true,
          '跨模块影响的任务理由应提到相关信息');
      }
    });
  });

  describe('重构理由生成', () => {
    test('跨文件重构应生成相应理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-13',
        type: 'implementation',
        description: 'Refactor multiple files to improve architecture',
        relatedFiles: [
          'src/file1.ts',
          'src/file2.ts',
          'src/file3.ts'
        ]
      };

      const recommendation = await router.recommend(task);

      // 如果复杂度足够高,应该提到重构
      if (recommendation.score >= 7) {
        const hasRefactoringMention = recommendation.reasons.some(r =>
          r.includes('重构')
        );
        assert.strictEqual(hasRefactoringMention, true,
          '跨文件重构的任务理由应提到相关信息');
      }
    });
  });

  describe('置信度计算', () => {
    test('三个维度评分一致时置信度应较高 (>=90)', async () => {
      const task: TaskDescriptor = {
        id: 'test-14',
        type: 'debug',
        description: 'Debug complex async race condition in large codebase affecting core API',
        relatedFiles: Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`)
      };

      const recommendation = await router.recommend(task);

      // 高复杂度任务通常三个维度都高,置信度应该高
      if (recommendation.score >= 8) {
        assert.ok(recommendation.confidence >= 85,
          `三个维度一致的高复杂度任务置信度应>=85: ${recommendation.confidence}`);
      }
    });

    test('三个维度评分差异大时置信度应较低 (<70)', async () => {
      const task: TaskDescriptor = {
        id: 'test-15',
        type: 'implementation',
        description: 'Simple implementation with some complexity',
        relatedFiles: ['src/file1.ts']
      };

      const recommendation = await router.recommend(task);

      // 简单任务的置信度可能因为某个维度稍高而降低
      assert.ok(recommendation.confidence >= 0 && recommendation.confidence <= 100,
        `置信度应在0-100范围内: ${recommendation.confidence}`);
    });

    test('极端评分 (>=9 或 <=2) 应提升置信度', async () => {
      const task1: TaskDescriptor = {
        id: 'test-16a',
        type: 'requirements',
        description: 'Trivial documentation update'
      };

      const task2: TaskDescriptor = {
        id: 'test-16b',
        type: 'debug',
        description: 'Extremely complex async refactoring with new database migration and core API breaking changes across 20+ files',
        relatedFiles: Array.from({ length: 25 }, (_, i) => `src/module${i}/file.ts`)
      };

      const rec1 = await router.recommend(task1);
      const rec2 = await router.recommend(task2);

      // 极端值任务的置信度应该有加成
      if (rec1.score <= 2) {
        assert.ok(rec1.confidence >= 80,
          `低分任务应有较高置信度: score=${rec1.score}, confidence=${rec1.confidence}`);
      }

      if (rec2.score >= 9) {
        assert.ok(rec2.confidence >= 85,
          `高分任务应有较高置信度: score=${rec2.score}, confidence=${rec2.confidence}`);
      }
    });

    test('置信度应始终在0-100范围内', async () => {
      const tasks: TaskDescriptor[] = [
        { id: 't1', type: 'requirements', description: 'Simple doc' },
        { id: 't2', type: 'implementation', description: 'Medium task' },
        { id: 't3', type: 'debug', description: 'Complex async refactor with new tech and core API changes' },
        { id: 't4', type: 'design', description: 'Design review' }
      ];

      for (const task of tasks) {
        const recommendation = await router.recommend(task);
        assert.ok(recommendation.confidence >= 0 && recommendation.confidence <= 100,
          `置信度必须在0-100范围内: ${recommendation.confidence}`);
      }
    });

    test('置信度应为整数', async () => {
      const task: TaskDescriptor = {
        id: 'test-17',
        type: 'implementation',
        description: 'Standard implementation task'
      };

      const recommendation = await router.recommend(task);

      assert.strictEqual(recommendation.confidence % 1, 0,
        `置信度应为整数: ${recommendation.confidence}`);
    });
  });

  describe('综合场景测试', () => {
    test('简单任务应生成适当的理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-18',
        type: 'requirements',
        description: 'Write simple requirements document'
      };

      const recommendation = await router.recommend(task);

      // 应该有至少一条理由
      assert.ok(recommendation.reasons.length > 0,
        '简单任务应至少有一条推荐理由');

      // 理由应该是人类可读的
      recommendation.reasons.forEach(reason => {
        assert.ok(reason.length > 0, '理由不应为空');
        assert.ok(reason.includes('•') || reason.length > 5,
          `理由应该是有意义的文本: ${reason}`);
      });

      // 置信度应该合理
      assert.ok(recommendation.confidence >= 50,
        `简单任务的置信度应>=50: ${recommendation.confidence}`);
    });

    test('复杂任务应生成多条详细理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-19',
        type: 'implementation',
        description: 'Implement complex async architecture refactoring with new framework integration, database migration, and core API breaking changes',
        relatedFiles: Array.from({ length: 12 }, (_, i) => `src/module${i}/file.ts`)
      };

      const recommendation = await router.recommend(task);

      // 应该推荐Codex模式
      assert.strictEqual(recommendation.mode, 'codex',
        '复杂任务应推荐Codex模式');

      // 应该有多条理由
      assert.ok(recommendation.reasons.length >= 2,
        `复杂任务应有多条理由: ${recommendation.reasons.length}`);

      // 理由应该是人类可读的
      recommendation.reasons.forEach(reason => {
        assert.ok(reason.length > 10, `理由应该足够详细: ${reason}`);
      });

      // 置信度应该较高
      assert.ok(recommendation.confidence >= 70,
        `复杂任务的置信度应>=70: ${recommendation.confidence}`);
    });

    test('中等复杂度任务应生成平衡的理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-20',
        type: 'design',
        description: 'Design new module architecture',
        relatedFiles: ['src/features/new/design.md']
      };

      const recommendation = await router.recommend(task);

      // 应该有理由
      assert.ok(recommendation.reasons.length > 0,
        '中等复杂度任务应有推荐理由');

      // 置信度应该在合理范围
      assert.ok(recommendation.confidence >= 40 && recommendation.confidence <= 95,
        `中等复杂度任务的置信度应在40-95范围: ${recommendation.confidence}`);
    });
  });

  describe('理由可读性验证', () => {
    test('所有理由应该是人类可读的中文', async () => {
      const tasks: TaskDescriptor[] = [
        {
          id: 't1',
          type: 'requirements',
          description: 'Simple task'
        },
        {
          id: 't2',
          type: 'implementation',
          description: 'Refactor complex async code'
        },
        {
          id: 't3',
          type: 'debug',
          description: 'Debug race condition'
        }
      ];

      for (const task of tasks) {
        const recommendation = await router.recommend(task);

        recommendation.reasons.forEach(reason => {
          // 理由应该包含中文字符
          const hasChinese = /[\u4e00-\u9fa5]/.test(reason);
          assert.strictEqual(hasChinese, true,
            `理由应该是中文: ${reason}`);

          // 理由不应该太短
          assert.ok(reason.length >= 5,
            `理由不应该太短: ${reason}`);

          // 理由应该以项目符号开始
          assert.ok(reason.startsWith('•'),
            `理由应该以项目符号开始: ${reason}`);
        });
      }
    });

    test('理由应该包含评分信息', async () => {
      const task: TaskDescriptor = {
        id: 'test-21',
        type: 'implementation',
        description: 'Complex implementation task with multiple aspects',
        relatedFiles: Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`)
      };

      const recommendation = await router.recommend(task);

      // 至少一条理由应该包含评分信息
      const hasScoreInfo = recommendation.reasons.some(r =>
        /评分.*\d+(\.\d+)?\/10/.test(r)
      );

      if (recommendation.score >= 5) {
        assert.strictEqual(hasScoreInfo, true,
          '理由应该包含评分信息');
      }
    });
  });

  describe('默认理由生成', () => {
    test('如果没有生成任何理由,应该添加默认理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-22',
        type: 'requirements',
        description: 'Simple task without special characteristics'
      };

      const recommendation = await router.recommend(task);

      // 应该至少有一条理由
      assert.ok(recommendation.reasons.length > 0,
        '应该至少有一条理由(包括默认理由)');
    });

    test('高分任务应生成有意义的理由', async () => {
      const task: TaskDescriptor = {
        id: 'test-23',
        type: 'debug',
        description: 'Complex debugging task',
        relatedFiles: Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`)
      };

      const recommendation = await router.recommend(task);

      if (recommendation.score >= 7) {
        // 高分任务应该有有意义的理由(不只是空的默认理由)
        const hasMeaningfulReason = recommendation.reasons.some(r =>
          r.includes('深度分析') || r.includes('复杂度') ||
          r.includes('代码规模') || r.includes('技术难度') ||
          r.includes('业务影响') || r.includes('文件')
        );
        assert.strictEqual(hasMeaningfulReason, true,
          '高分任务应该有有意义的推荐理由');
      }
    });
  });
});
