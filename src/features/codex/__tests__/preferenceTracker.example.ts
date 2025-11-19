/**
 * PreferenceTracker 使用示例
 *
 * 演示如何在实际场景中使用用户偏好学习机制
 */

import { PreferenceTracker } from '../preferenceTracker';
import { TaskDescriptor } from '../types';

/**
 * 示例: 基本的偏好记录和分析
 */
async function basicUsageExample() {
  console.log('=== 基本使用示例 ===\n');

  // 创建偏好追踪器
  const tracker = new PreferenceTracker(
    '/path/to/workspace',
    console as any
  );
  await tracker.initialize();

  // 场景1: 用户接受Codex推荐
  const task1: TaskDescriptor = {
    id: 'task-001',
    type: 'design',
    description: '设计一个复杂的微服务架构'
  };

  await tracker.recordDecision(
    task1,
    'codex',      // 推荐模式
    8.5,          // 复杂度评分
    'codex',      // 用户选择
    {
      reasons: ['• 代码规模较大', '• 技术难度很高'],
      confidence: 85
    }
  );

  // 场景2: 用户拒绝Codex推荐
  const task2: TaskDescriptor = {
    id: 'task-002',
    type: 'tasks',
    description: '实现简单的配置文件读取'
  };

  await tracker.recordDecision(
    task2,
    'codex',      // 推荐模式
    7.2,          // 复杂度评分
    'local',      // 用户选择(拒绝推荐)
    {
      reasons: ['• 业务影响范围广'],
      confidence: 70
    }
  );

  // 获取偏好模式
  const pattern = tracker.getPreferencePattern();
  console.log('偏好模式分析:');
  console.log(`  总决策次数: ${pattern.totalDecisions}`);
  console.log(`  接受率: ${pattern.acceptanceRate.toFixed(1)}%`);
  console.log(`  偏好模式: ${pattern.preferredMode}`);
  console.log();
}

/**
 * 示例: 阈值调整建议
 */
async function thresholdAdjustmentExample() {
  console.log('=== 阈值调整建议示例 ===\n');

  const tracker = new PreferenceTracker(
    '/path/to/workspace',
    console as any
  );
  await tracker.initialize();

  // 模拟用户在高复杂度任务中倾向选择local
  for (let i = 0; i < 10; i++) {
    await tracker.recordDecision(
      {
        id: `task-${i}`,
        type: 'design',
        description: `高复杂度任务 ${i}`
      },
      'codex',
      8.0 + Math.random(),
      'local'  // 用户总是选择local
    );
  }

  // 获取阈值调整建议
  const adjustment = tracker.suggestAdjustment();
  console.log('阈值调整建议:');
  console.log(`  当前阈值: ${adjustment.currentThreshold}`);
  console.log(`  建议阈值: ${adjustment.suggestedThreshold}`);
  console.log(`  理由: ${adjustment.reason}`);
  console.log(`  置信度: ${adjustment.confidence.toFixed(0)}%`);
  console.log(`  是否建议应用: ${adjustment.shouldApply ? '是' : '否'}`);
  console.log();
}

/**
 * 示例: 按任务类型分析偏好
 */
async function taskTypePreferenceExample() {
  console.log('=== 按任务类型分析偏好示例 ===\n');

  const tracker = new PreferenceTracker(
    '/path/to/workspace',
    console as any
  );
  await tracker.initialize();

  // 设计任务: 倾向使用Codex
  for (let i = 0; i < 5; i++) {
    await tracker.recordDecision(
      { id: `design-${i}`, type: 'design', description: 'Design task' },
      'codex',
      8,
      'codex'
    );
  }

  // 简单任务: 倾向使用local
  for (let i = 0; i < 5; i++) {
    await tracker.recordDecision(
      { id: `tasks-${i}`, type: 'tasks', description: 'Tasks' },
      'local',
      4,
      'local'
    );
  }

  const pattern = tracker.getPreferencePattern();
  console.log('按任务类型的偏好:');

  Object.entries(pattern.byTaskType).forEach(([taskType, stats]) => {
    console.log(`  ${taskType}:`);
    console.log(`    决策次数: ${stats.count}`);
    console.log(`    Codex选择: ${stats.codexCount}`);
    console.log(`    Local选择: ${stats.localCount}`);
    console.log(`    偏好: ${stats.preference}`);
  });
  console.log();
}

/**
 * 示例: 决策历史查询
 */
async function decisionHistoryExample() {
  console.log('=== 决策历史查询示例 ===\n');

  const tracker = new PreferenceTracker(
    '/path/to/workspace',
    console as any
  );
  await tracker.initialize();

  // 记录一些决策
  await tracker.recordDecision(
    { id: 'task-1', type: 'design', description: 'Task 1' },
    'codex',
    8,
    'codex'
  );

  await tracker.recordDecision(
    { id: 'task-2', type: 'tasks', description: 'Task 2' },
    'local',
    5,
    'local'
  );

  // 查询最近的决策
  const history = tracker.getDecisionHistory(5);

  console.log(`最近 ${history.length} 个决策:`);
  history.forEach((record, index) => {
    console.log(`  ${index + 1}. ${record.task.description}`);
    console.log(`     推荐: ${record.recommendedMode} (评分: ${record.recommendedScore})`);
    console.log(`     选择: ${record.chosenMode}`);
    console.log(`     接受: ${record.acceptedRecommendation ? '是' : '否'}`);
  });
  console.log();
}

/**
 * 示例: 集成到TaskRouter中的实际使用
 */
async function taskRouterIntegrationExample() {
  console.log('=== TaskRouter集成示例 ===\n');

  const tracker = new PreferenceTracker(
    '/path/to/workspace',
    console as any
  );
  await tracker.initialize();

  // 模拟TaskRouter的使用流程

  // 1. 分析任务复杂度
  const task: TaskDescriptor = {
    id: 'task-001',
    type: 'design',
    description: '实现分布式缓存系统'
  };

  const complexityScore = 8.5;  // 来自ComplexityAnalyzer

  // 2. 生成推荐
  const recommendedMode = complexityScore >= 7 ? 'codex' : 'local';

  // 3. 询问用户
  const userChoice = 'codex';  // 用户确认

  // 4. 记录决策(用于偏好学习)
  await tracker.recordDecision(
    task,
    recommendedMode,
    complexityScore,
    userChoice,
    {
      reasons: ['• 代码规模较大', '• 技术难度很高'],
      confidence: 85
    }
  );

  console.log('决策已记录到偏好追踪器');

  // 5. 定期分析偏好,可能调整阈值
  const pattern = tracker.getPreferencePattern();
  if (pattern.totalDecisions >= 10) {
    const adjustment = tracker.suggestAdjustment();
    if (adjustment.shouldApply) {
      console.log(`\n建议调整阈值: ${adjustment.currentThreshold} -> ${adjustment.suggestedThreshold}`);
      console.log(`理由: ${adjustment.reason}`);
    }
  }
  console.log();
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    await basicUsageExample();
    await thresholdAdjustmentExample();
    await taskTypePreferenceExample();
    await decisionHistoryExample();
    await taskRouterIntegrationExample();

    console.log('=== 所有示例运行完成 ===');
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples();
}

export {
  basicUsageExample,
  thresholdAdjustmentExample,
  taskTypePreferenceExample,
  decisionHistoryExample,
  taskRouterIntegrationExample
};
