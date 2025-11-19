/**
 * Deep Thinking Prompts 单元测试
 *
 * 测试提示词模板系统的功能：
 * 1. 模板获取
 * 2. 变量注入
 * 3. 场景选择
 * 4. 缺失变量处理
 */

import { DeepThinkingPrompts, PromptScenario } from '../../features/codex/prompts/deepThinkingPrompts';
import { AnalysisContext, TaskDescriptor, ComplexityScore, CodebaseSnapshot } from '../../features/codex/types';

describe('DeepThinkingPrompts', () => {
  describe('Template Retrieval', () => {
    it('should retrieve design review template', () => {
      const template = DeepThinkingPrompts.getTemplate(PromptScenario.DESIGN_REVIEW);

      expect(template.id).toBe('design-review');
      expect(template.name).toBe('设计文档Review');
      expect(template.template.length).toBeGreaterThan(0);
      expect(template.variables.length).toBeGreaterThan(0);
      expect(template.variables).toContain('TASK_DESCRIPTION');
      expect(template.variables).toContain('DOCUMENT_CONTENT');
    });

    it('should retrieve all scenario templates', () => {
      const scenarios = [
        PromptScenario.DESIGN_REVIEW,
        PromptScenario.TECH_DECISION,
        PromptScenario.ARCHITECTURE_REVIEW,
        PromptScenario.REQUIREMENTS_ANALYSIS,
        PromptScenario.CODE_REFACTORING
      ];

      for (const scenario of scenarios) {
        const template = DeepThinkingPrompts.getTemplate(scenario);
        expect(template).toBeDefined();
        expect(template.id).toBeTruthy();
        expect(template.template).toBeTruthy();
        expect(template.variables).toBeInstanceOf(Array);
      }
    });
  });

  describe('Prompt Generation', () => {
    it('should generate design review prompt with full context', () => {
      const task: TaskDescriptor = {
        id: 'task-001',
        type: 'design',
        description: 'Design a new authentication system',
        specName: 'auth-system',
        relatedFiles: ['auth.ts', 'user.ts'],
        context: {
          design: '## Authentication Design\n\nUse JWT tokens...'
        }
      };

      const codebaseSnapshot: CodebaseSnapshot = {
        timestamp: new Date(),
        files: ['src/auth.ts', 'src/user.ts'],
        externalDependencies: ['jsonwebtoken', 'bcrypt']
      };

      const context: AnalysisContext = {
        task,
        codebaseSnapshot
      };

      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);

      expect(prompt).toContain('Design a new authentication system');
      expect(prompt).toContain('auth-system');
      expect(prompt).toContain('Use JWT tokens');
      expect(prompt).toContain('Total Files: 2');
      expect(prompt).toContain('jsonwebtoken, bcrypt');
    });

    it('should handle missing context gracefully', () => {
      const task: TaskDescriptor = {
        id: 'task-002',
        type: 'design',
        description: 'Simple task without context'
      };

      const context: AnalysisContext = { task };

      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);

      expect(prompt).toContain('Simple task without context');
      expect(prompt).toContain('Total Files: 0');
      expect(prompt).toContain('Dependencies: N/A');
    });

    it('should replace unreplaced variables with N/A', () => {
      const task: TaskDescriptor = {
        id: 'minimal-task',
        type: 'design',
        description: 'Minimal task'
      };

      const context: AnalysisContext = { task };
      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);

      // 验证没有未替换的变量占位符
      const unreplacedVars = prompt.match(/{[A-Z_]+}/g);
      expect(unreplacedVars).toBeNull();
    });
  });

  describe('Variable Injection', () => {
    it('should inject task context variables', () => {
      const task: TaskDescriptor = {
        id: 'test-task-id',
        type: 'design',
        description: 'Test task description',
        specName: 'test-spec',
        context: {
          design: 'Test design content'
        }
      };

      const context: AnalysisContext = { task };
      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);

      expect(prompt).toContain('Test task description');
      expect(prompt).toContain('test-spec');
      expect(prompt).toContain('Test design content');
    });

    it('should inject codebase information', () => {
      const task: TaskDescriptor = {
        id: 'test-task',
        type: 'design',
        description: 'Test'
      };

      const codebaseSnapshot: CodebaseSnapshot = {
        timestamp: new Date(),
        files: Array(150).fill('file.ts'),
        externalDependencies: ['react', 'express', 'typescript']
      };

      const context: AnalysisContext = {
        task,
        codebaseSnapshot
      };

      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);

      expect(prompt).toContain('Total Files: 150');
      expect(prompt).toContain('react, express, typescript');
    });

    it('should inject complexity score', () => {
      const task: TaskDescriptor = {
        id: 'task',
        type: 'design',
        description: 'Test',
        relatedFiles: ['file1.ts', 'file2.ts', 'file3.ts']
      };

      const complexityScore: ComplexityScore = {
        total: 7.5,
        codeScale: 6.0,
        technicalDifficulty: 8.0,
        businessImpact: 8.5,
        details: {
          fileCount: 3,
          functionDepth: 4,
          externalDeps: 2,
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          crossModuleImpact: true,
          refactoringScope: 'multiple'
        }
      };

      const context: AnalysisContext = {
        task,
        complexityScore
      };

      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.CODE_REFACTORING, context);

      expect(prompt).toContain('Complexity Score**: 7.5/10');
      expect(prompt).toContain('Files Affected**: 3');
    });
  });

  describe('Scenario-Specific Prompts', () => {
    it('should generate tech decision prompt', () => {
      const task: TaskDescriptor = {
        id: 'tech-decision',
        type: 'review',
        description: 'Choose database',
        context: {
          additionalContext: {
            currentTechStack: 'Node.js, TypeScript',
            teamSize: '5 developers',
            timeline: '3 months',
            decisionQuestion: 'PostgreSQL or MongoDB?',
            options: 'Option 1: PostgreSQL\nOption 2: MongoDB'
          }
        }
      };

      const context: AnalysisContext = { task };
      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.TECH_DECISION, context);

      expect(prompt).toContain('Node.js, TypeScript');
      expect(prompt).toContain('5 developers');
      expect(prompt).toContain('PostgreSQL or MongoDB?');
      expect(prompt).toContain('Evaluation Criteria');
    });

    it('should generate requirements analysis prompt', () => {
      const task: TaskDescriptor = {
        id: 'req-analysis',
        type: 'requirements',
        description: 'Analyze authentication requirements',
        specName: 'user-auth',
        context: {
          requirements: '1. Users must sign up with email\n2. OAuth support',
          additionalContext: {
            priority: 'high',
            targetUsers: 'B2B customers'
          }
        }
      };

      const context: AnalysisContext = { task };
      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.REQUIREMENTS_ANALYSIS, context);

      expect(prompt).toContain('sign up with email');
      expect(prompt).toContain('Priority**: high');
      expect(prompt).toContain('Target Users**: B2B customers');
      expect(prompt).toContain('Feasibility Assessment');
    });

    it('should generate code refactoring prompt', () => {
      const task: TaskDescriptor = {
        id: 'refactor',
        type: 'implementation',
        description: 'Refactor to TypeScript',
        context: {
          additionalContext: {
            refactoringGoal: 'Add type safety',
            codeSnippet: 'function auth(req, res) { /* code */ }'
          }
        }
      };

      const context: AnalysisContext = { task };
      const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.CODE_REFACTORING, context);

      expect(prompt).toContain('Refactor to TypeScript');
      expect(prompt).toContain('Add type safety');
      expect(prompt).toContain('function auth');
      expect(prompt).toContain('Big Bang Refactoring');
      expect(prompt).toContain('Incremental Refactoring');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task description', () => {
      const task: TaskDescriptor = {
        id: 'empty-desc',
        type: 'design',
        description: ''
      };

      const context: AnalysisContext = { task };

      expect(() => {
        const prompt = DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);
        expect(prompt.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle undefined context values', () => {
      const task: TaskDescriptor = {
        id: 'null-context',
        type: 'design',
        description: 'Test task',
        context: {
          requirements: undefined,
          design: undefined
        }
      };

      const context: AnalysisContext = { task };

      expect(() => {
        DeepThinkingPrompts.generatePrompt(PromptScenario.DESIGN_REVIEW, context);
      }).not.toThrow();
    });
  });
});
