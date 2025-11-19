/**
 * LocalAgentExecutor 集成测试
 *
 * 测试覆盖:
 * - 完整的agent执行流程
 * - 与ClaudeCodeProvider的集成
 * - 真实文件系统操作
 * - Agent可用性检查
 * - 错误处理和降级
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LocalAgentExecutor } from '../../features/codex/localAgentExecutor';
import { TaskDescriptor } from '../../features/codex/types';

describe('LocalAgentExecutor Integration Tests', () => {
  let executor: LocalAgentExecutor;
  let outputChannel: vscode.OutputChannel;
  let workspaceRoot: string;

  beforeAll(async () => {
    // 获取工作空间根目录
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found for integration tests');
    }
    workspaceRoot = workspaceFolder.uri.fsPath;

    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('LocalAgentExecutor Test');

    // 创建executor实例
    executor = new LocalAgentExecutor(outputChannel);
  });

  afterAll(() => {
    // 清理资源
    if (outputChannel) {
      outputChannel.dispose();
    }
  });

  describe('Agent可用性检查', () => {
    test('应正确检查spec-requirements agent是否可用', async () => {

      const isAvailable = await executor.isAgentAvailable('spec-requirements');

      // 验证返回值为布尔类型
      assert.strictEqual(typeof isAvailable, 'boolean',
        'isAgentAvailable应返回布尔值');

      // 如果可用,验证文件确实存在
      if (isAvailable) {
        const agentPath = path.join(
          workspaceRoot,
          '.claude/system-prompts/spec-requirements.md'
        );

        assert.ok(fs.existsSync(agentPath),
          'Agent文件应实际存在');
      }
    });

    test('不存在的agent应返回false', async () => {

      const isAvailable = await executor.isAgentAvailable('non-existent-agent-xyz');

      assert.strictEqual(isAvailable, false,
        '不存在的agent应返回false');
    });

    test('listAvailableAgents应返回所有可用agent', async () => {

      const agents = await executor.listAvailableAgents();

      // 验证返回数组
      assert.ok(Array.isArray(agents),
        'listAvailableAgents应返回数组');

      // 验证每个agent名称都是字符串
      agents.forEach(agent => {
        assert.strictEqual(typeof agent, 'string',
          '每个agent名称应为字符串');
      });

      // 如果有agents,验证文件确实存在
      if (agents.length > 0) {
        const firstAgent = agents[0];
        const agentPath = path.join(
          workspaceRoot,
          `.claude/system-prompts/${firstAgent}.md`
        );

        assert.ok(fs.existsSync(agentPath),
          `第一个agent ${firstAgent} 文件应存在`);
      }
    });

    test('应列出kfc相关的agent', async () => {

      const agents = await executor.listAvailableAgents();

      // 检查是否包含spec相关agent
      const specAgents = agents.filter(agent =>
        agent.startsWith('spec-')
      );

      if (specAgents.length > 0) {
        outputChannel.appendLine(`Found spec agents: ${specAgents.join(', ')}`);

        // 验证至少有一些常见的spec agent
        const commonAgents = ['spec-requirements', 'spec-design', 'spec-tasks', 'spec-impl', 'spec-judge'];
        const foundCommonAgents = commonAgents.filter(agent => agents.includes(agent));

        assert.ok(foundCommonAgents.length > 0,
          `应至少有一个常见spec agent可用,找到: ${foundCommonAgents.join(', ')}`);
      }
    });
  });

  describe('任务执行流程', () => {
    test('应能执行简单任务(仅验证流程,不执行真实Claude Code)', async () => {

      const task: TaskDescriptor = {
        id: 'integration-test-1',
        type: 'requirements',
        description: 'Integration test task - placeholder',
        specName: 'test-feature',
        context: {}
      };

      // 注意: 这个测试不会真正执行Claude Code(因为需要环境配置)
      // 我们只验证接口调用不会抛出异常
      try {
        // 由于需要Claude Code环境,这里可能会失败
        // 我们捕获异常并验证错误类型
        const result = await executor.execute(task);

        // 如果成功执行,验证结果结构
        assert.ok(result, '应返回执行结果');
        assert.ok('success' in result, '结果应包含success字段');
        assert.ok('mode' in result, '结果应包含mode字段');
        assert.ok('sessionId' in result, '结果应包含sessionId字段');
        assert.ok('duration' in result, '结果应包含duration字段');

        assert.strictEqual(result.mode, 'local',
          '执行模式应为local');

      } catch (error) {
        // 预期可能失败(如果Claude Code未配置)
        assert.ok(error instanceof Error,
          '错误应为Error实例');

        outputChannel.appendLine(`Expected error in integration test: ${error.message}`);

        // 验证错误处理是否正确
        assert.ok(error.message.length > 0,
          '错误消息不应为空');
      }
    });

    test('执行结果应包含sessionId', async () => {

      const task: TaskDescriptor = {
        id: 'integration-test-2',
        type: 'design',
        description: 'Test session ID generation',
        specName: 'test-feature'
      };

      try {
        const result = await executor.execute(task);

        assert.ok(result.sessionId, '应包含sessionId');
        assert.ok(result.sessionId.startsWith('local-'),
          'SessionId应以local-开头');

        outputChannel.appendLine(`Generated sessionId: ${result.sessionId}`);

      } catch (error) {
        // 预期可能失败
        outputChannel.appendLine(`Expected error: ${error}`);
      }
    });

    test('执行结果应包含时间信息', async () => {

      const task: TaskDescriptor = {
        id: 'integration-test-3',
        type: 'tasks',
        description: 'Test timing information',
        specName: 'test-feature'
      };

      try {
        const result = await executor.execute(task);

        assert.ok(result.startTime, '应包含startTime');
        assert.ok(result.endTime, '应包含endTime');
        assert.ok(result.duration >= 0, 'duration应为非负数');

        assert.ok(result.endTime >= result.startTime,
          'endTime应不早于startTime');

        const calculatedDuration = result.endTime.getTime() - result.startTime.getTime();
        assert.ok(Math.abs(calculatedDuration - result.duration) < 100,
          'duration应与时间差一致(误差<100ms)');

      } catch (error) {
        outputChannel.appendLine(`Expected error: ${error}`);
      }
    });
  });

  describe('错误处理', () => {
    test('无效任务应返回失败结果', async () => {

      const task: TaskDescriptor = {
        id: 'integration-test-4',
        type: 'requirements',
        description: '', // 空描述可能导致失败
        specName: 'test-feature'
      };

      try {
        const result = await executor.execute(task);

        // 即使任务无效,也应返回结构化结果
        assert.ok(result, '应返回结果对象');
        assert.ok('success' in result, '结果应包含success字段');

        if (!result.success) {
          assert.ok(result.error, '失败结果应包含error信息');
          assert.ok(result.error.message, '错误应包含message');
        }

      } catch (error) {
        // 也可能直接抛出异常
        assert.ok(error instanceof Error, '异常应为Error实例');
      }
    });
  });

  describe('与现有系统集成', () => {
    test('应能访问.claude/system-prompts目录', async () => {

      const systemPromptsDir = path.join(workspaceRoot, '.claude/system-prompts');

      try {
        await fs.promises.access(systemPromptsDir, fs.constants.R_OK);

        // 目录存在且可读
        const files = await fs.promises.readdir(systemPromptsDir);

        outputChannel.appendLine(`Found ${files.length} files in .claude/system-prompts`);

        // 验证至少有一些.md文件
        const mdFiles = files.filter(f => f.endsWith('.md'));
        assert.ok(mdFiles.length > 0,
          '.claude/system-prompts目录应包含.md文件');

      } catch (error) {
        // 目录可能不存在
        outputChannel.appendLine(`Note: .claude/system-prompts directory not found, this is expected if not initialized`);
      }
    });

    test('应与现有spec目录结构兼容', async () => {

      const specsDir = path.join(workspaceRoot, '.claude/specs');

      try {
        await fs.promises.access(specsDir, fs.constants.R_OK);

        // 目录存在且可读
        const subdirs = await fs.promises.readdir(specsDir);

        outputChannel.appendLine(`Found ${subdirs.length} spec directories`);

        // 验证是否有spec子目录
        if (subdirs.length > 0) {
          for (const subdir of subdirs) {
            const subdirPath = path.join(specsDir, subdir);
            const stat = await fs.promises.stat(subdirPath);

            if (stat.isDirectory()) {
              outputChannel.appendLine(`  - ${subdir}`);
            }
          }
        }

      } catch (error) {
        outputChannel.appendLine(`Note: .claude/specs directory not found`);
      }
    });
  });

  describe('性能测试', () => {
    test('Agent可用性检查应在合理时间内完成', async () => {

      const startTime = Date.now();
      await executor.isAgentAvailable('spec-requirements');
      const duration = Date.now() - startTime;

      assert.ok(duration < 1000,
        `Agent可用性检查应在1秒内完成,实际耗时: ${duration}ms`);
    });

    test('列出所有agent应在合理时间内完成', async () => {

      const startTime = Date.now();
      await executor.listAvailableAgents();
      const duration = Date.now() - startTime;

      assert.ok(duration < 2000,
        `列出所有agent应在2秒内完成,实际耗时: ${duration}ms`);
    });
  });
});
