/**
 * ProgressIndicator集成测试 (Task 44)
 *
 * 测试任务执行进度指示器的完整功能
 * 需求: 需求9.2
 */

import * as vscode from 'vscode';
import { ProgressIndicator, ExecutionPhase } from '../../features/codex/progressIndicator';

describe('ProgressIndicator Integration Tests', () => {
  /**
   * 测试1: 进度指示器基本生命周期
   */
  it('should create, update, and complete progress indicator', async () => {
    const indicator = new ProgressIndicator();

    // 启动进度窗口（异步）
    const progressPromise = indicator.start('Test Task', true);

    // 验证初始状态
    expect(indicator.getCurrentProgress()).toBe(0);
    expect(indicator.getCurrentPhase()).toBeUndefined();
    expect(indicator.isCancelled()).toBe(false);

    // 设置阶段
    indicator.setPhase('initializing');
    expect(indicator.getCurrentPhase()).toBe('initializing');
    expect(indicator.getCurrentProgress()).toBe(0);

    // 等待一小段时间确保进度窗口显示
    await new Promise(resolve => setTimeout(resolve, 100));

    // 更新进度
    indicator.updateMessage('Custom message');
    indicator.updateProgress(20);
    expect(indicator.getCurrentProgress()).toBe(20);

    // 完成进度
    indicator.complete();

    // 等待进度窗口关闭
    await progressPromise;

    console.log('Test 1 passed: Basic lifecycle');
  }, 10000);

  /**
   * 测试2: 所有执行阶段切换
   */
  it('should support all execution phases', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test All Phases', true);

    const phases: ExecutionPhase[] = [
      'initializing',
      'routing',
      'analyzing-codebase',
      'deep-thinking',
      'executing',
      'saving-results',
      'completed'
    ];

    for (const phase of phases) {
      indicator.setPhase(phase);
      expect(indicator.getCurrentPhase()).toBe(phase);

      // 等待一小段时间模拟实际执行
      await new Promise(resolve => setTimeout(resolve, 50));

      // 验证进度递增
      expect(indicator.getCurrentProgress()).toBeGreaterThanOrEqual(0);
      expect(indicator.getCurrentProgress()).toBeLessThanOrEqual(100);
    }

    // 验证最终进度为100
    expect(indicator.getCurrentProgress()).toBe(100);

    indicator.complete();
    await progressPromise;

    console.log('Test 2 passed: All phases');
  }, 15000);

  /**
   * 测试3: 进度增量更新
   */
  it('should handle incremental progress updates', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test Incremental Progress', true);

    indicator.setPhase('executing');
    const initialProgress = indicator.getCurrentProgress();

    // 多次增量更新
    indicator.updateProgress(10);
    expect(indicator.getCurrentProgress()).toBe(initialProgress + 10);

    indicator.updateProgress(15);
    expect(indicator.getCurrentProgress()).toBe(initialProgress + 25);

    indicator.updateProgress(20);
    expect(indicator.getCurrentProgress()).toBe(initialProgress + 45);

    // 验证进度不超过100
    indicator.updateProgress(100);
    expect(indicator.getCurrentProgress()).toBe(100);

    indicator.complete();
    await progressPromise;

    console.log('Test 3 passed: Incremental updates');
  }, 10000);

  /**
   * 测试4: 自定义消息更新
   */
  it('should update custom messages', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test Custom Messages', true);

    // 更新自定义消息
    indicator.updateMessage('Step 1: Initializing...');
    await new Promise(resolve => setTimeout(resolve, 100));

    indicator.updateMessage('Step 2: Processing data...');
    await new Promise(resolve => setTimeout(resolve, 100));

    indicator.updateMessage('Step 3: Finalizing...');
    await new Promise(resolve => setTimeout(resolve, 100));

    indicator.complete();
    await progressPromise;

    console.log('Test 4 passed: Custom messages');
  }, 10000);

  /**
   * 测试5: 阶段进度基准
   */
  it('should have correct progress baselines for phases', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test Phase Baselines', true);

    // 验证各阶段的进度基准
    indicator.setPhase('initializing');
    expect(indicator.getCurrentProgress()).toBe(0);

    indicator.setPhase('routing');
    expect(indicator.getCurrentProgress()).toBe(10);

    indicator.setPhase('analyzing-codebase');
    expect(indicator.getCurrentProgress()).toBe(30);

    indicator.setPhase('deep-thinking');
    expect(indicator.getCurrentProgress()).toBe(50);

    indicator.setPhase('executing');
    expect(indicator.getCurrentProgress()).toBe(70);

    indicator.setPhase('saving-results');
    expect(indicator.getCurrentProgress()).toBe(90);

    indicator.setPhase('completed');
    expect(indicator.getCurrentProgress()).toBe(100);

    indicator.complete();
    await progressPromise;

    console.log('Test 5 passed: Phase baselines');
  }, 10000);

  /**
   * 测试6: 进度窗口位置配置
   */
  it('should support different progress locations', async () => {
    const indicator = new ProgressIndicator();

    // 使用状态栏位置
    const progressPromise = indicator.start(
      'Test Window Location',
      true,
      vscode.ProgressLocation.Window
    );

    indicator.setPhase('executing');
    await new Promise(resolve => setTimeout(resolve, 200));

    indicator.complete();
    await progressPromise;

    console.log('Test 6 passed: Progress locations');
  }, 10000);

  /**
   * 测试7: 可取消性配置
   */
  it('should respect cancellable configuration', async () => {
    const indicator1 = new ProgressIndicator();
    const progressPromise1 = indicator1.start('Cancellable Task', true);

    expect(indicator1.isCancelled()).toBe(false);

    indicator1.complete();
    await progressPromise1;

    const indicator2 = new ProgressIndicator();
    const progressPromise2 = indicator2.start('Non-cancellable Task', false);

    expect(indicator2.isCancelled()).toBe(false);

    indicator2.complete();
    await progressPromise2;

    console.log('Test 7 passed: Cancellable configuration');
  }, 10000);

  /**
   * 测试8: 自定义阶段消息
   */
  it('should support custom phase messages', async () => {
    const indicator = new ProgressIndicator();

    // 设置自定义消息
    indicator.setCustomPhaseMessages({
      'initializing': 'Custom init message',
      'executing': 'Custom execution message'
    });

    const progressPromise = indicator.start('Test Custom Phase Messages', true);

    indicator.setPhase('initializing');
    await new Promise(resolve => setTimeout(resolve, 100));

    indicator.setPhase('executing');
    await new Promise(resolve => setTimeout(resolve, 100));

    indicator.complete();
    await progressPromise;

    console.log('Test 8 passed: Custom phase messages');
  }, 10000);

  /**
   * 测试9: 快速完成场景
   */
  it('should handle quick completion without errors', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Quick Task', true);

    // 立即完成
    indicator.complete();
    await progressPromise;

    console.log('Test 9 passed: Quick completion');
  }, 5000);

  /**
   * 测试10: 多阶段跳跃
   */
  it('should handle phase jumps correctly', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test Phase Jumps', true);

    // 跳过某些阶段
    indicator.setPhase('initializing');
    expect(indicator.getCurrentProgress()).toBe(0);

    // 直接跳到执行阶段
    indicator.setPhase('executing');
    expect(indicator.getCurrentProgress()).toBe(70);

    // 跳到完成阶段
    indicator.setPhase('completed');
    expect(indicator.getCurrentProgress()).toBe(100);

    indicator.complete();
    await progressPromise;

    console.log('Test 10 passed: Phase jumps');
  }, 10000);

  /**
   * 测试11: 长时间运行的任务
   */
  it('should handle long-running tasks', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Long Running Task', true);

    const phases: ExecutionPhase[] = [
      'initializing',
      'routing',
      'analyzing-codebase',
      'deep-thinking',
      'executing',
      'saving-results',
      'completed'
    ];

    for (const phase of phases) {
      indicator.setPhase(phase);

      // 模拟长时间运行
      await new Promise(resolve => setTimeout(resolve, 300));

      // 在执行阶段进行多次增量更新
      if (phase === 'executing') {
        for (let i = 0; i < 5; i++) {
          indicator.updateProgress(2);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    indicator.complete();
    await progressPromise;

    console.log('Test 11 passed: Long-running task');
  }, 30000);

  /**
   * 测试12: 错误处理和清理
   */
  it('should handle errors and cleanup properly', async () => {
    const indicator = new ProgressIndicator();

    const progressPromise = indicator.start('Test Error Handling', true);

    try {
      indicator.setPhase('executing');

      // 模拟错误
      throw new Error('Simulated error');
    } catch (error) {
      // 确保进度指示器被正确清理
      indicator.complete();
      await progressPromise;
    }

    console.log('Test 12 passed: Error handling');
  }, 10000);
});
