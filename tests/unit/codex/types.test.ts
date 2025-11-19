/**
 * 类型定义单元测试
 *
 * 验证所有核心类型接口的完整性和正确性
 */

import {
  ExecutionMode,
  TaskDescriptor,
  ComplexityScore,
  ExecutionResult,
  Session,
  MCPServerStatus,
  ThinkingResult,
  ExecutionOptions,
  ModeRecommendation,
  CodebaseSnapshot,
  ConfigConflict,
  TaskQueueItem,
  QueueStatus,
  ASTMetrics
} from '../../../src/features/codex/types';

describe('Codex Types', () => {
  describe('ExecutionMode', () => {
    it('应该支持所有预定义的执行模式', () => {
      const modes: ExecutionMode[] = ['local', 'codex', 'auto'];
      modes.forEach(mode => {
        expect(['local', 'codex', 'auto'].includes(mode)).toBe(true);
      });
    });
  });

  describe('TaskDescriptor', () => {
    it('应该创建有效的任务描述符', () => {
      const task: TaskDescriptor = {
        id: 'task-001',
        type: 'design',
        description: 'Design system architecture',
        specName: 'codex-workflow',
        relatedFiles: ['src/design.md'],
        context: {
          requirements: 'System requirements',
          design: 'Design document'
        },
        metadata: {
          priority: 'high'
        }
      };

      expect(task.id).toBe('task-001');
      expect(task.type).toBe('design');
      expect(task.description).toBe('Design system architecture');
      expect(task.specName).toBe('codex-workflow');
      expect(task.relatedFiles?.length).toBe(1);
      expect(task.context).toBeDefined();
      expect(task.metadata).toBeDefined();
    });

    it('应该支持所有任务类型', () => {
      const types: TaskDescriptor['type'][] = [
        'requirements',
        'design',
        'tasks',
        'review',
        'implementation',
        'debug'
      ];

      types.forEach(type => {
        const task: TaskDescriptor = {
          id: `task-${type}`,
          type: type,
          description: `Test ${type}`
        };
        expect(task.type).toBe(type);
      });
    });

    it('应该允许可选字段为空', () => {
      const minimalTask: TaskDescriptor = {
        id: 'task-minimal',
        type: 'tasks',
        description: 'Minimal task'
      };

      expect(minimalTask.id).toBeDefined();
      expect(minimalTask.type).toBeDefined();
      expect(minimalTask.description).toBeDefined();
      expect(minimalTask.specName).toBeUndefined();
      expect(minimalTask.relatedFiles).toBeUndefined();
      expect(minimalTask.context).toBeUndefined();
      expect(minimalTask.metadata).toBeUndefined();
    });
  });

  describe('ComplexityScore', () => {
    it('应该创建有效的复杂度评分', () => {
      const score: ComplexityScore = {
        total: 8,
        codeScale: 7,
        technicalDifficulty: 9,
        businessImpact: 8,
        details: {
          fileCount: 25,
          functionDepth: 5,
          externalDeps: 3,
          cyclomaticComplexity: 18,
          cognitiveComplexity: 22,
          crossModuleImpact: true,
          refactoringScope: 'multiple',
          involvesASTModification: true,
          involvesAsyncComplexity: false,
          involvesNewTechnology: true,
          requiresDatabaseMigration: false,
          affectsCoreAPI: true
        }
      };

      expect(score.total).toBe(8);
      expect(score.codeScale).toBe(7);
      expect(score.technicalDifficulty).toBe(9);
      expect(score.businessImpact).toBe(8);
      expect(score.details).toBeDefined();
      expect(score.details.fileCount).toBe(25);
      expect(score.details.crossModuleImpact).toBe(true);
      expect(score.details.refactoringScope).toBe('multiple');
    });

    it('应该支持所有重构范围类型', () => {
      const scopes: ComplexityScore['details']['refactoringScope'][] = [
        'none',
        'single',
        'multiple'
      ];

      scopes.forEach(scope => {
        const score: ComplexityScore = {
          total: 5,
          codeScale: 5,
          technicalDifficulty: 5,
          businessImpact: 5,
          details: {
            fileCount: 10,
            functionDepth: 3,
            externalDeps: 2,
            cyclomaticComplexity: 10,
            cognitiveComplexity: 12,
            crossModuleImpact: false,
            refactoringScope: scope
          }
        };
        expect(score.details.refactoringScope).toBe(scope);
      });
    });
  });

  describe('ExecutionResult', () => {
    it('应该创建成功的执行结果', () => {
      const startTime = new Date('2025-01-01T10:00:00');
      const endTime = new Date('2025-01-01T10:05:00');

      const result: ExecutionResult = {
        success: true,
        mode: 'codex',
        sessionId: 'codex-1735729200000-abc123',
        startTime,
        endTime,
        duration: 300000,
        generatedFiles: ['design.md', 'tasks.md'],
        output: 'Execution completed successfully',
        risks: ['Potential performance impact on large datasets']
      };

      expect(result.success).toBe(true);
      expect(result.mode).toBe('codex');
      expect(result.sessionId).toBe('codex-1735729200000-abc123');
      expect(result.duration).toBe(300000);
      expect(result.generatedFiles?.length).toBe(2);
      expect(result.output).toBeDefined();
      expect(result.risks?.length).toBe(1);
    });

    it('应该创建失败的执行结果', () => {
      const result: ExecutionResult = {
        success: false,
        mode: 'local',
        sessionId: 'local-1735729200000-xyz789',
        startTime: new Date(),
        endTime: new Date(),
        duration: 5000,
        error: {
          message: 'Task execution failed',
          stack: 'Error stack trace...',
          code: 'ERR_EXECUTION_FAILED'
        }
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Task execution failed');
      expect(result.error?.code).toBe('ERR_EXECUTION_FAILED');
    });
  });

  describe('Session', () => {
    it('应该创建有效的会话对象', () => {
      const session: Session = {
        id: 'codex-1735729200000-session123',
        task: {
          id: 'task-001',
          type: 'design',
          description: 'Design task'
        },
        status: 'active',
        createdAt: new Date('2025-01-01T10:00:00'),
        lastActiveAt: new Date('2025-01-01T10:05:00'),
        context: {
          complexityScore: {
            total: 8,
            codeScale: 7,
            technicalDifficulty: 9,
            businessImpact: 8,
            details: {
              fileCount: 25,
              functionDepth: 5,
              externalDeps: 3,
              cyclomaticComplexity: 18,
              cognitiveComplexity: 22,
              crossModuleImpact: true,
              refactoringScope: 'multiple'
            }
          },
          options: {
            enableDeepThinking: true,
            enableCodebaseScan: true
          }
        },
        checkpoints: [
          {
            id: 'checkpoint-001',
            timestamp: new Date('2025-01-01T10:02:00'),
            description: 'Initial analysis completed',
            state: { progress: 50 }
          }
        ]
      };

      expect(session.id).toBe('codex-1735729200000-session123');
      expect(session.status).toBe('active');
      expect(session.task).toBeDefined();
      expect(session.context).toBeDefined();
      expect(session.checkpoints).toBeDefined();
      expect(session.checkpoints?.length).toBe(1);
    });

    it('应该支持所有会话状态', () => {
      const statuses: Session['status'][] = [
        'active',
        'completed',
        'failed',
        'timeout',
        'cancelled'
      ];

      statuses.forEach(status => {
        const session: Session = {
          id: `session-${status}`,
          task: {
            id: 'task-001',
            type: 'tasks',
            description: 'Test task'
          },
          status: status,
          createdAt: new Date(),
          lastActiveAt: new Date()
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('MCPServerStatus', () => {
    it('应该创建有效的MCP服务器状态', () => {
      const status: MCPServerStatus = {
        status: 'running',
        pid: 12345,
        port: 8765,
        lastHealthCheck: new Date(),
        isHealthy: true,
        startedAt: new Date('2025-01-01T10:00:00'),
        uptime: 300000
      };

      expect(status.status).toBe('running');
      expect(status.pid).toBe(12345);
      expect(status.port).toBe(8765);
      expect(status.isHealthy).toBe(true);
      expect(status.uptime).toBe(300000);
    });

    it('应该支持所有服务器状态', () => {
      const statuses: MCPServerStatus['status'][] = [
        'stopped',
        'starting',
        'running',
        'error'
      ];

      statuses.forEach(s => {
        const status: MCPServerStatus = {
          status: s
        };
        expect(status.status).toBe(s);
      });
    });

    it('应该创建错误状态', () => {
      const status: MCPServerStatus = {
        status: 'error',
        error: {
          message: 'Failed to start MCP server',
          code: 'ERR_MCP_START_FAILED'
        }
      };

      expect(status.status).toBe('error');
      expect(status.error).toBeDefined();
      expect(status.error?.message).toBe('Failed to start MCP server');
    });
  });

  describe('ThinkingResult', () => {
    it('应该创建完整的深度推理结果', () => {
      const thinking: ThinkingResult = {
        problemDecomposition: {
          mainProblem: 'Design scalable architecture',
          subProblems: [
            'Define module boundaries',
            'Design data flow',
            'Plan error handling'
          ]
        },
        riskIdentification: {
          level: 'medium',
          risks: [
            {
              description: 'Potential performance bottleneck',
              impact: 'high',
              mitigation: 'Implement caching strategy'
            },
            {
              description: 'Data consistency issues',
              impact: 'medium',
              mitigation: 'Use transaction locks'
            }
          ]
        },
        solutionComparison: {
          alternatives: [
            {
              name: 'Microservices',
              pros: ['Scalability', 'Independent deployment'],
              cons: ['Complexity', 'Network overhead'],
              score: 8
            },
            {
              name: 'Monolith',
              pros: ['Simplicity', 'Easy debugging'],
              cons: ['Scalability limits', 'Tight coupling'],
              score: 6
            }
          ],
          recommended: 'Microservices'
        },
        recommendation: {
          decision: 'Adopt microservices architecture',
          reasons: [
            'Better scalability for future growth',
            'Enables independent team workflows',
            'Supports polyglot technology stack'
          ],
          confidence: 85
        },
        thinkingChain: [
          { step: 1, thought: 'Analyze current system constraints' },
          { step: 2, thought: 'Evaluate architectural patterns' },
          { step: 3, thought: 'Compare trade-offs' }
        ]
      };

      expect(thinking.problemDecomposition).toBeDefined();
      expect(thinking.problemDecomposition.subProblems.length).toBe(3);
      expect(thinking.riskIdentification).toBeDefined();
      expect(thinking.riskIdentification.level).toBe('medium');
      expect(thinking.riskIdentification.risks.length).toBe(2);
      expect(thinking.solutionComparison).toBeDefined();
      expect(thinking.solutionComparison?.alternatives.length).toBe(2);
      expect(thinking.solutionComparison?.recommended).toBe('Microservices');
      expect(thinking.recommendation).toBeDefined();
      expect(thinking.recommendation.confidence).toBe(85);
      expect(thinking.thinkingChain).toBeDefined();
      expect(thinking.thinkingChain?.length).toBe(3);
    });

    it('应该支持所有风险等级', () => {
      const levels: ThinkingResult['riskIdentification']['level'][] = [
        'high',
        'medium',
        'low'
      ];

      levels.forEach(level => {
        const thinking: ThinkingResult = {
          problemDecomposition: {
            mainProblem: 'Test',
            subProblems: []
          },
          riskIdentification: {
            level: level,
            risks: []
          },
          recommendation: {
            decision: 'Test',
            reasons: [],
            confidence: 50
          }
        };
        expect(thinking.riskIdentification.level).toBe(level);
      });
    });
  });

  describe('ExecutionOptions', () => {
    it('应该创建完整的执行选项', () => {
      const options: ExecutionOptions = {
        forceMode: 'codex',
        enableDeepThinking: true,
        enableCodebaseScan: true,
        timeout: 300000,
        runInBackground: false,
        customConfig: {
          logLevel: 'DEBUG',
          maxRetries: 3
        }
      };

      expect(options.forceMode).toBe('codex');
      expect(options.enableDeepThinking).toBe(true);
      expect(options.enableCodebaseScan).toBe(true);
      expect(options.timeout).toBe(300000);
      expect(options.runInBackground).toBe(false);
      expect(options.customConfig).toBeDefined();
    });

    it('应该允许所有字段为可选', () => {
      const minimalOptions: ExecutionOptions = {};
      expect(minimalOptions.forceMode).toBeUndefined();
      expect(minimalOptions.enableDeepThinking).toBeUndefined();
    });
  });

  describe('ModeRecommendation', () => {
    it('应该创建有效的模式推荐', () => {
      const recommendation: ModeRecommendation = {
        mode: 'codex',
        score: 8,
        reasons: [
          '涉及大规模代码修改（25个文件）',
          '技术难度较高',
          '业务影响范围广'
        ],
        confidence: 85
      };

      expect(recommendation.mode).toBe('codex');
      expect(recommendation.score).toBe(8);
      expect(recommendation.reasons.length).toBe(3);
      expect(recommendation.confidence).toBe(85);
    });
  });

  describe('CodebaseSnapshot', () => {
    it('应该创建完整的代码库快照', () => {
      const snapshot: CodebaseSnapshot = {
        timestamp: new Date(),
        files: ['src/index.ts', 'src/utils.ts'],
        dependencyGraph: {
          nodes: [
            { id: 'src/index.ts', path: 'src/index.ts', type: 'source' },
            { id: 'src/utils.ts', path: 'src/utils.ts', type: 'source' }
          ],
          edges: [
            { from: 'src/index.ts', to: 'src/utils.ts', type: 'import' }
          ]
        },
        externalDependencies: ['lodash', 'axios'],
        circularDependencies: [
          {
            files: ['src/a.ts', 'src/b.ts', 'src/a.ts'],
            description: 'Circular dependency detected'
          }
        ]
      };

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.files.length).toBe(2);
      expect(snapshot.dependencyGraph).toBeDefined();
      expect(snapshot.dependencyGraph?.nodes.length).toBe(2);
      expect(snapshot.dependencyGraph?.edges.length).toBe(1);
      expect(snapshot.externalDependencies?.length).toBe(2);
      expect(snapshot.circularDependencies?.length).toBe(1);
    });
  });

  describe('ConfigConflict', () => {
    it('应该创建配置冲突对象', () => {
      const conflict: ConfigConflict = {
        type: 'port',
        description: 'MCP port 8765 is already in use',
        suggestedFix: 'Change port to 8766 in mcp-config.json',
        severity: 'error'
      };

      expect(conflict.type).toBe('port');
      expect(conflict.description).toBeDefined();
      expect(conflict.suggestedFix).toBeDefined();
      expect(conflict.severity).toBe('error');
    });

    it('应该支持所有冲突类型和严重程度', () => {
      const types: ConfigConflict['type'][] = ['port', 'path', 'missing', 'invalid'];
      const severities: ConfigConflict['severity'][] = ['error', 'warning'];

      types.forEach(type => {
        severities.forEach(severity => {
          const conflict: ConfigConflict = {
            type,
            description: 'Test conflict',
            severity
          };
          expect(conflict.type).toBe(type);
          expect(conflict.severity).toBe(severity);
        });
      });
    });
  });

  describe('TaskQueueItem and QueueStatus', () => {
    it('应该创建任务队列项', () => {
      const item: TaskQueueItem = {
        id: 'queue-item-001',
        task: {
          id: 'task-001',
          type: 'tasks',
          description: 'Test task'
        },
        priority: 'high',
        enqueuedAt: new Date(),
        status: 'queued'
      };

      expect(item.id).toBe('queue-item-001');
      expect(item.priority).toBe('high');
      expect(item.status).toBe('queued');
    });

    it('应该创建队列状态', () => {
      const status: QueueStatus = {
        queuedCount: 5,
        processingCount: 2,
        completedCount: 10,
        failedCount: 1,
        maxConcurrency: 3
      };

      expect(status.queuedCount).toBe(5);
      expect(status.processingCount).toBe(2);
      expect(status.completedCount).toBe(10);
      expect(status.failedCount).toBe(1);
      expect(status.maxConcurrency).toBe(3);
    });
  });

  describe('ASTMetrics', () => {
    it('应该创建AST分析指标', () => {
      const metrics: ASTMetrics = {
        cyclomaticComplexity: 15,
        cognitiveComplexity: 20,
        functionCallChain: ['main', 'processData', 'validateInput'],
        externalDependencies: ['lodash', 'axios'],
        typeReferences: ['User', 'Product', 'Order']
      };

      expect(metrics.cyclomaticComplexity).toBe(15);
      expect(metrics.cognitiveComplexity).toBe(20);
      expect(metrics.functionCallChain.length).toBe(3);
      expect(metrics.externalDependencies.length).toBe(2);
      expect(metrics.typeReferences.length).toBe(3);
    });
  });
});
