/**
 * PreferenceTracker 单元测试
 *
 * 测试用户偏好学习机制的核心功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PreferenceTracker } from '../preferenceTracker';
import { TaskDescriptor, ExecutionMode } from '../types';

// Mock VSCode Output Channel
class MockOutputChannel {
  private logs: string[] = [];

  appendLine(message: string): void {
    this.logs.push(message);
  }

  getLogs(): string[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }

  // 其他必需的方法(空实现)
  append(): void {}
  replace(): void {}
  show(): void {}
  hide(): void {}
  dispose(): void {}
  name = 'Test Output';
}

describe('PreferenceTracker', () => {
  let tempDir: string;
  let tracker: PreferenceTracker;
  let outputChannel: MockOutputChannel;

  // 创建测试任务
  const createTask = (type: TaskDescriptor['type'], description: string): TaskDescriptor => ({
    id: `task-${Date.now()}-${Math.random()}`,
    type,
    description
  });

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preference-tracker-test-'));

    // 创建.claude/codex目录
    await fs.mkdir(path.join(tempDir, '.claude', 'codex'), { recursive: true });

    // 创建Mock输出通道
    outputChannel = new MockOutputChannel();

    // 创建偏好追踪器
    tracker = new PreferenceTracker(tempDir, outputChannel as any);
    await tracker.initialize();
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('initialize', () => {
    it('should initialize with empty preferences when file does not exist', async () => {
      const pattern = tracker.getPreferencePattern();
      expect(pattern.totalDecisions).toBe(0);
      expect(pattern.acceptedCount).toBe(0);
      expect(pattern.rejectedCount).toBe(0);
      expect(pattern.acceptanceRate).toBe(0);
    });

    it('should load existing preferences from file', async () => {
      // 记录一个决策
      const task = createTask('design', 'Test design task');
      await tracker.recordDecision(task, 'codex', 8, 'codex');

      // 创建新的追踪器实例,应该加载已有数据
      const newTracker = new PreferenceTracker(tempDir, outputChannel as any);
      await newTracker.initialize();

      const pattern = newTracker.getPreferencePattern();
      expect(pattern.totalDecisions).toBe(1);
      expect(pattern.acceptedCount).toBe(1);
    });
  });

  describe('recordDecision', () => {
    it('should record a decision with acceptance', async () => {
      const task = createTask('design', 'Complex design task');

      await tracker.recordDecision(
        task,
        'codex',
        8.5,
        'codex',
        {
          reasons: ['High complexity'],
          confidence: 85
        }
      );

      const history = tracker.getDecisionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].recommendedMode).toBe('codex');
      expect(history[0].chosenMode).toBe('codex');
      expect(history[0].acceptedRecommendation).toBe(true);
      expect(history[0].recommendedScore).toBe(8.5);
    });

    it('should record a decision with rejection', async () => {
      const task = createTask('tasks', 'Simple task');

      await tracker.recordDecision(
        task,
        'codex',
        7.5,
        'local'
      );

      const history = tracker.getDecisionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].recommendedMode).toBe('codex');
      expect(history[0].chosenMode).toBe('local');
      expect(history[0].acceptedRecommendation).toBe(false);
    });

    it('should persist decisions to file', async () => {
      const task = createTask('requirements', 'Test requirement');
      await tracker.recordDecision(task, 'local', 5, 'local');

      // 检查文件是否存在
      const preferencesPath = path.join(tempDir, '.claude', 'codex', 'preferences.json');
      const content = await fs.readFile(preferencesPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.decisions).toHaveLength(1);
      expect(data.decisions[0].taskType).toBe('requirements');
      expect(data.version).toBe('1.0.0');
    });
  });

  describe('getPreferencePattern', () => {
    it('should calculate acceptance rate correctly', async () => {
      const task1 = createTask('design', 'Task 1');
      const task2 = createTask('design', 'Task 2');
      const task3 = createTask('design', 'Task 3');
      const task4 = createTask('design', 'Task 4');

      // 3次接受, 1次拒绝
      await tracker.recordDecision(task1, 'codex', 8, 'codex');
      await tracker.recordDecision(task2, 'codex', 9, 'codex');
      await tracker.recordDecision(task3, 'codex', 7, 'local'); // 拒绝
      await tracker.recordDecision(task4, 'local', 5, 'local');

      const pattern = tracker.getPreferencePattern();

      expect(pattern.totalDecisions).toBe(4);
      expect(pattern.acceptedCount).toBe(3);
      expect(pattern.rejectedCount).toBe(1);
      expect(pattern.acceptanceRate).toBe(75);
    });

    it('should categorize preferences by task type', async () => {
      // 设计任务: 3次codex, 1次local (75% codex, 阈值70%需要至少3/4才能达到)
      await tracker.recordDecision(createTask('design', 'Design 1'), 'codex', 8, 'codex');
      await tracker.recordDecision(createTask('design', 'Design 2'), 'codex', 7, 'codex');
      await tracker.recordDecision(createTask('design', 'Design 3'), 'codex', 8, 'codex');
      await tracker.recordDecision(createTask('design', 'Design 4'), 'local', 4, 'local');

      // 任务列表: 0次codex, 3次local (0% codex < 30%)
      await tracker.recordDecision(createTask('tasks', 'Tasks 1'), 'local', 3, 'local');
      await tracker.recordDecision(createTask('tasks', 'Tasks 2'), 'local', 5, 'local');
      await tracker.recordDecision(createTask('tasks', 'Tasks 3'), 'local', 4, 'local');

      const pattern = tracker.getPreferencePattern();

      expect(pattern.byTaskType['design'].count).toBe(4);
      expect(pattern.byTaskType['design'].codexCount).toBe(3);
      expect(pattern.byTaskType['design'].localCount).toBe(1);
      expect(pattern.byTaskType['design'].preference).toBe('codex'); // 3/4 = 0.75 > 0.7 -> codex

      expect(pattern.byTaskType['tasks'].count).toBe(3);
      expect(pattern.byTaskType['tasks'].codexCount).toBe(0);
      expect(pattern.byTaskType['tasks'].localCount).toBe(3);
      expect(pattern.byTaskType['tasks'].preference).toBe('local'); // 0/3 = 0 < 0.3 -> local
    });

    it('should categorize preferences by complexity range', async () => {
      // 低复杂度 (1-3)
      await tracker.recordDecision(createTask('tasks', 'Low 1'), 'local', 2, 'local');
      await tracker.recordDecision(createTask('tasks', 'Low 2'), 'local', 3, 'codex');

      // 中等复杂度 (4-6)
      await tracker.recordDecision(createTask('design', 'Med 1'), 'local', 5, 'local');
      await tracker.recordDecision(createTask('design', 'Med 2'), 'codex', 6, 'codex');
      await tracker.recordDecision(createTask('design', 'Med 3'), 'codex', 6, 'codex');

      // 高复杂度 (7-10)
      await tracker.recordDecision(createTask('design', 'High 1'), 'codex', 8, 'codex');
      await tracker.recordDecision(createTask('design', 'High 2'), 'codex', 9, 'local');

      const pattern = tracker.getPreferencePattern();

      expect(pattern.byComplexityRange.low.localCount).toBe(1);
      expect(pattern.byComplexityRange.low.codexCount).toBe(1);

      expect(pattern.byComplexityRange.medium.localCount).toBe(1);
      expect(pattern.byComplexityRange.medium.codexCount).toBe(2);

      expect(pattern.byComplexityRange.high.localCount).toBe(1);
      expect(pattern.byComplexityRange.high.codexCount).toBe(1);
    });

    it('should identify overall preferred mode', async () => {
      // 80% codex -> preferred mode should be 'codex'
      for (let i = 0; i < 8; i++) {
        await tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 8, 'codex');
      }
      for (let i = 0; i < 2; i++) {
        await tracker.recordDecision(createTask('tasks', `Task ${i}`), 'local', 5, 'local');
      }

      const pattern = tracker.getPreferencePattern();
      expect(pattern.preferredMode).toBe('codex');
    });
  });

  describe('suggestAdjustment', () => {
    it('should require minimum 10 decisions for reliable suggestion', () => {
      // 只有5个决策
      for (let i = 0; i < 5; i++) {
        tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 8, 'local');
      }

      const adjustment = tracker.suggestAdjustment();

      expect(adjustment.shouldApply).toBe(false);
      expect(adjustment.confidence).toBe(0);
      expect(adjustment.reason).toContain('数据不足');
    });

    it('should suggest threshold increase when user prefers local for high complexity', async () => {
      // 用户在高复杂度任务中70%选择local
      for (let i = 0; i < 7; i++) {
        await tracker.recordDecision(createTask('design', `High ${i}`), 'codex', 8, 'local');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordDecision(createTask('design', `High ${i}`), 'codex', 9, 'codex');
      }

      const adjustment = tracker.suggestAdjustment();

      expect(adjustment.shouldApply).toBe(true);
      expect(adjustment.suggestedThreshold).toBe(8);
      expect(adjustment.currentThreshold).toBe(7);
      expect(adjustment.reason).toContain('本地模式');
      expect(adjustment.impact?.reducedCodexRecommendations).toBeDefined();
    });

    it('should suggest threshold decrease when user prefers codex for medium complexity', async () => {
      // 用户在中等复杂度任务中70%选择codex
      for (let i = 0; i < 7; i++) {
        await tracker.recordDecision(createTask('design', `Med ${i}`), 'local', 5, 'codex');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordDecision(createTask('tasks', `Med ${i}`), 'local', 6, 'local');
      }

      const adjustment = tracker.suggestAdjustment();

      expect(adjustment.shouldApply).toBe(true);
      expect(adjustment.suggestedThreshold).toBe(6);
      expect(adjustment.currentThreshold).toBe(7);
      expect(adjustment.reason).toContain('Codex模式');
      expect(adjustment.impact?.increasedCodexRecommendations).toBeDefined();
    });

    it('should not suggest adjustment when acceptance rate is high', async () => {
      // 85%接受率
      for (let i = 0; i < 17; i++) {
        await tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 8, 'codex');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordDecision(createTask('tasks', `Task ${i}`), 'codex', 7, 'local');
      }

      const adjustment = tracker.suggestAdjustment();

      expect(adjustment.shouldApply).toBe(false);
      expect(adjustment.confidence).toBeGreaterThan(80);
      expect(adjustment.reason).toContain('当前阈值设置合理');
    });

    it('should suggest threshold increase when acceptance rate is low', async () => {
      // 35%接受率,且经常拒绝Codex推荐
      for (let i = 0; i < 7; i++) {
        await tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 8, 'local');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 7, 'codex');
      }
      for (let i = 0; i < 3; i++) {
        await tracker.recordDecision(createTask('tasks', `Task ${i}`), 'local', 5, 'local');
      }

      const adjustment = tracker.suggestAdjustment();

      expect(adjustment.shouldApply).toBe(true);
      expect(adjustment.suggestedThreshold).toBeGreaterThan(7);
      // 这个场景会首先匹配"高复杂度任务偏好local"的规则,而不是"低接受率"规则
      expect(adjustment.reason).toContain('本地模式');
    });
  });

  describe('getDecisionHistory', () => {
    it('should return decisions in reverse chronological order', async () => {
      const task1 = createTask('design', 'Task 1');
      const task2 = createTask('design', 'Task 2');
      const task3 = createTask('design', 'Task 3');

      await tracker.recordDecision(task1, 'codex', 8, 'codex');
      await new Promise(resolve => setTimeout(resolve, 10)); // 确保时间戳不同
      await tracker.recordDecision(task2, 'local', 5, 'local');
      await new Promise(resolve => setTimeout(resolve, 10));
      await tracker.recordDecision(task3, 'codex', 7, 'local');

      const history = tracker.getDecisionHistory();

      expect(history).toHaveLength(3);
      expect(history[0].task.description).toBe('Task 3'); // 最新的
      expect(history[1].task.description).toBe('Task 2');
      expect(history[2].task.description).toBe('Task 1'); // 最早的
    });

    it('should respect limit parameter', async () => {
      // 记录100个决策
      for (let i = 0; i < 100; i++) {
        await tracker.recordDecision(createTask('design', `Task ${i}`), 'codex', 8, 'codex');
      }

      const history = tracker.getDecisionHistory(10);
      expect(history).toHaveLength(10);
    });
  });

  describe('clearPreferences', () => {
    it('should clear all preferences and persist to file', async () => {
      // 记录一些决策
      await tracker.recordDecision(createTask('design', 'Task 1'), 'codex', 8, 'codex');
      await tracker.recordDecision(createTask('tasks', 'Task 2'), 'local', 5, 'local');

      expect(tracker.getPreferencePattern().totalDecisions).toBe(2);

      // 清除
      await tracker.clearPreferences();

      // 验证内存中已清空
      expect(tracker.getPreferencePattern().totalDecisions).toBe(0);

      // 验证文件中已清空
      const preferencesPath = path.join(tempDir, '.claude', 'codex', 'preferences.json');
      const content = await fs.readFile(preferencesPath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.decisions).toHaveLength(0);
    });
  });
});
