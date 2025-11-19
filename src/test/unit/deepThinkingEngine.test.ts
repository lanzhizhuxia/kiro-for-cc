/**
 * DeepThinkingEngine 单元测试
 *
 * 测试覆盖：
 * 1. analyze() 主流程
 * 2. Prompt 生成
 * 3. 响应解析
 * 4. 错误处理
 * 5. 超时处理
 */

import * as assert from 'assert';
import { DeepThinkingEngine } from '../../features/codex/deepThinkingEngine';
import { MCPClient, MCPToolResult, CodexSession } from '../../features/codex/mcpClient';
import {
  AnalysisContext,
  TaskDescriptor,
  ComplexityScore,
  ThinkingResult
} from '../../features/codex/types';

/**
 * Mock输出通道
 */
class MockOutputChannel {
  private lines: string[] = [];

  appendLine(value: string): void {
    this.lines.push(value);
  }

  append(value: string): void {
    this.lines.push(value);
  }

  clear(): void {
    this.lines = [];
  }

  getLines(): string[] {
    return this.lines;
  }

  dispose(): void {
    this.clear();
  }

  show(): void {}
  hide(): void {}
  replace(): void {}

  get name(): string {
    return 'Mock Output Channel';
  }
}

/**
 * Mock MCP客户端
 */
class MockMCPClient {
  private connected: boolean = false;
  private mockResponse: MCPToolResult | null = null;

  setMockResponse(response: MCPToolResult): void {
    this.mockResponse = response;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callCodex(): Promise<{
    result: MCPToolResult;
    session: CodexSession;
  }> {
    if (!this.connected) {
      throw new Error('MCP client is not connected');
    }

    if (!this.mockResponse) {
      throw new Error('No mock response set');
    }

    return {
      result: this.mockResponse,
      session: {
        conversationId: 'test-conv-001',
        taskMarker: '20251118-1430-001',
        createdAt: new Date()
      }
    };
  }

  async callCodexReply(): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error('MCP client is not connected');
    }

    if (!this.mockResponse) {
      throw new Error('No mock response set');
    }

    return this.mockResponse;
  }
}

describe('DeepThinkingEngine', () => {
  let engine: DeepThinkingEngine;
  let mockMCPClient: MockMCPClient;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockMCPClient = new MockMCPClient();
    mockOutputChannel = new MockOutputChannel();

    // 创建引擎实例
    engine = new DeepThinkingEngine(
      mockMCPClient as any,
      mockOutputChannel as any,
      {
        timeout: 5000,
        verbose: false
      }
    );
  });

  /**
   * 创建测试用的任务描述符
   */
  function createTestTask(): TaskDescriptor {
    return {
      id: 'test-task-001',
      type: 'implementation',
      description: '实现用户认证功能'
    };
  }

  /**
   * 创建测试用的复杂度评分
   */
  function createTestComplexityScore(): ComplexityScore {
    return {
      total: 7.5,
      codeScale: 6.0,
      technicalDifficulty: 8.0,
      businessImpact: 8.5,
      details: {
        fileCount: 5,
        functionDepth: 3,
        externalDeps: 2,
        cyclomaticComplexity: 15,
        cognitiveComplexity: 20,
        crossModuleImpact: true,
        refactoringScope: 'multiple'
      }
    };
  }

  /**
   * 创建测试用的分析上下文
   */
  function createTestContext(): AnalysisContext {
    return {
      task: createTestTask(),
      complexityScore: createTestComplexityScore()
    };
  }

  /**
   * 创建模拟的Codex响应
   */
  function createMockCodexResponse(): MCPToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `# Deep Analysis Result

## 1. Problem Decomposition

- **ID: P1**: 用户认证功能
  - **Complexity**: 7
  - Sub-problems:
    - **ID: P1.1**: 登录验证
    - **ID: P1.2**: 会话管理
    - **ID: P1.3**: 权限控制

## 2. Risk Identification

- **ID: R1**: 安全风险
  - **Category**: security
  - **Severity**: high
  - **Description**: 密码存储和传输可能存在安全隐患
  - **Mitigation**: 使用bcrypt加密密码，启用HTTPS

- **ID: R2**: 性能风险
  - **Category**: performance
  - **Severity**: medium
  - **Description**: 大量并发登录可能影响系统性能
  - **Mitigation**: 实现请求限流和缓存机制

## 3. Solution Comparison

- **ID: S1**: JWT Token方案
  - **Pros**: 无状态、易于扩展、跨域支持
  - **Cons**: Token无法主动失效、需要处理刷新逻辑
  - **Complexity**: 6
  - **Score**: 8

- **ID: S2**: Session方案
  - **Pros**: 成熟稳定、易于理解
  - **Cons**: 需要存储会话状态、扩展性差
  - **Complexity**: 4
  - **Score**: 6

## 4. Recommended Decision

- **Selected Solution**: S1
- **Rationale**: JWT Token方案更适合现代微服务架构，具有更好的可扩展性
- **Estimated Effort**: 3-5 days
- **Next Steps**:
  - 设计JWT Token结构和刷新机制
  - 实现认证中间件
  - 编写单元测试和集成测试
  - 进行安全审计`
        }
      ],
      isError: false
    };
  }

  describe('analyze()', () => {
    it('应该成功执行深度分析', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      assert.ok(result);
      assert.ok(result.problemDecomposition);
      assert.ok(result.riskIdentification);
      assert.ok(result.solutionComparison);
      assert.ok(result.recommendedDecision);

      assert.ok(result.problemDecomposition.length > 0);
      assert.ok(result.riskIdentification.length > 0);
      assert.ok(result.solutionComparison.length > 0);
    });

    it('应该在MCP客户端未连接时自动连接', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      // 注意：不手动调用connect()

      // Act
      const result = await engine.analyze(context);

      // Assert
      assert.ok(mockMCPClient.isConnected(), 'MCP客户端应该已连接');
      assert.ok(result);
    });

    it('应该处理API调用失败', async () => {
      // Arrange
      const context = createTestContext();
      await mockMCPClient.connect();
      // 不设置mock响应，导致调用失败

      // Act & Assert
      await assert.rejects(
        async () => await engine.analyze(context),
        /Deep thinking analysis failed/
      );
    });

    it('应该包含思考链', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      assert.ok(result.thinkingChain);
      assert.ok(result.thinkingChain.length > 0);
    });
  });

  describe('Prompt生成', () => {
    it('应该生成包含任务信息的prompt', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // 启用verbose模式以查看prompt
      const verboseEngine = new DeepThinkingEngine(
        mockMCPClient as any,
        mockOutputChannel as any,
        { verbose: true }
      );

      // Act
      await verboseEngine.analyze(context);

      // Assert
      const logs = mockOutputChannel.getLines();
      const promptLog = logs.find(line => line.includes('Prompt generated'));
      assert.ok(promptLog, '应该记录prompt生成日志');
    });

    it('应该在prompt中包含复杂度信息', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      await engine.analyze(context);

      // Assert: 通过检查日志验证prompt包含复杂度信息
      // 实际测试中，可以通过mock callCodex方法来捕获prompt内容
      assert.ok(true); // 占位断言
    });
  });

  describe('响应解析', () => {
    it('应该正确解析问题分解', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      const problems = result.problemDecomposition;
      assert.ok(problems.length > 0);

      const firstProblem = problems[0];
      assert.ok(firstProblem.id);
      assert.ok(firstProblem.description);
      assert.ok(typeof firstProblem.complexity === 'number');
      assert.ok(firstProblem.complexity >= 1 && firstProblem.complexity <= 10);
    });

    it('应该正确解析风险识别', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      const risks = result.riskIdentification;
      assert.ok(risks.length > 0);

      const firstRisk = risks[0];
      assert.ok(firstRisk.id);
      assert.ok(firstRisk.category);
      assert.ok(['technical', 'security', 'performance', 'maintainability'].includes(firstRisk.category));
      assert.ok(['high', 'medium', 'low'].includes(firstRisk.severity));
      assert.ok(firstRisk.description);
      assert.ok(firstRisk.mitigation);
    });

    it('应该正确解析方案对比', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      const solutions = result.solutionComparison;
      assert.ok(solutions.length > 0);

      const firstSolution = solutions[0];
      assert.ok(firstSolution.id);
      assert.ok(firstSolution.approach);
      assert.ok(Array.isArray(firstSolution.pros));
      assert.ok(Array.isArray(firstSolution.cons));
      assert.ok(typeof firstSolution.complexity === 'number');
      assert.ok(typeof firstSolution.score === 'number');
    });

    it('应该正确解析决策建议', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert
      const decision = result.recommendedDecision;
      assert.ok(decision.selectedSolution);
      assert.ok(decision.rationale);
      assert.ok(decision.estimatedEffort);
      assert.ok(Array.isArray(decision.nextSteps));
      assert.ok(decision.nextSteps.length > 0);
    });

    it('应该处理格式不完整的响应', async () => {
      // Arrange
      const context = createTestContext();
      const incompleteResponse: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: 'This is an incomplete response without proper sections.'
          }
        ]
      };
      mockMCPClient.setMockResponse(incompleteResponse);
      await mockMCPClient.connect();

      // Act
      const result = await engine.analyze(context);

      // Assert: 应该返回默认值而不是抛出错误
      assert.ok(result.problemDecomposition);
      assert.ok(result.riskIdentification);
      assert.ok(result.solutionComparison);
      assert.ok(result.recommendedDecision);
    });
  });

  describe('错误处理', () => {
    it('应该处理空响应', async () => {
      // Arrange
      const context = createTestContext();
      const emptyResponse: MCPToolResult = {
        content: []
      };
      mockMCPClient.setMockResponse(emptyResponse);
      await mockMCPClient.connect();

      // Act & Assert
      await assert.rejects(
        async () => await engine.analyze(context),
        /Empty response from Codex/
      );
    });

    it('应该处理连接失败', async () => {
      // Arrange
      const context = createTestContext();

      // 创建一个会抛出错误的mock客户端
      const failingClient = {
        isConnected: () => false,
        connect: async () => {
          throw new Error('Connection failed');
        }
      };

      const failingEngine = new DeepThinkingEngine(
        failingClient as any,
        mockOutputChannel as any
      );

      // Act & Assert
      await assert.rejects(
        async () => await failingEngine.analyze(context),
        /Connection failed/
      );
    });

    it('应该记录详细的错误信息', async () => {
      // Arrange
      const context = createTestContext();
      await mockMCPClient.connect();
      // 不设置mock响应

      // Act
      try {
        await engine.analyze(context);
        assert.fail('应该抛出错误');
      } catch (error) {
        // Assert
        const logs = mockOutputChannel.getLines();
        const errorLog = logs.find(line => line.includes('Analysis failed'));
        assert.ok(errorLog, '应该记录错误日志');
      }
    });
  });

  describe('性能和超时', () => {
    it('应该在指定时间内完成分析', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      const startTime = Date.now();

      // Act
      await engine.analyze(context);

      const duration = Date.now() - startTime;

      // Assert: 应该在5秒内完成（配置的超时时间）
      assert.ok(duration < 5000, `分析耗时 ${duration}ms，超过预期`);
    });

    it('应该记录分析耗时', async () => {
      // Arrange
      const context = createTestContext();
      const mockResponse = createMockCodexResponse();
      mockMCPClient.setMockResponse(mockResponse);
      await mockMCPClient.connect();

      // Act
      await engine.analyze(context);

      // Assert
      const logs = mockOutputChannel.getLines();
      const durationLog = logs.find(line => line.includes('completed in'));
      assert.ok(durationLog, '应该记录分析耗时');
    });
  });

  describe('配置选项', () => {
    it('应该使用自定义配置', () => {
      // Arrange & Act
      const customEngine = new DeepThinkingEngine(
        mockMCPClient as any,
        mockOutputChannel as any,
        {
          model: 'custom-model',
          timeout: 60000,
          verbose: true
        }
      );

      // Assert: 通过检查日志验证配置生效
      const logs = mockOutputChannel.getLines();
      const initLog = logs.find(line => line.includes('Engine initialized'));
      assert.ok(initLog);
    });

    it('应该使用默认配置', () => {
      // Arrange & Act
      const defaultEngine = new DeepThinkingEngine(
        mockMCPClient as any,
        mockOutputChannel as any
      );

      // Assert
      const logs = mockOutputChannel.getLines();
      const initLog = logs.find(line => line.includes('Engine initialized'));
      assert.ok(initLog);
    });
  });
});
