/**
 * 深度推理提示词工程 (Deep Thinking Prompts)
 *
 * 职责:
 * 1. 为不同场景提供优化的提示词模板
 * 2. 动态注入任务上下文和代码库信息
 * 3. 确保触发Claude Codex的sequential thinking模式
 * 4. 生成结构化、可解析的分析结果
 *
 * 需求: 需求4.2, 需求4.3
 */

import { AnalysisContext, TaskDescriptor } from '../types';

/**
 * 提示词场景枚举
 */
export enum PromptScenario {
  DESIGN_REVIEW = 'design-review',
  TECH_DECISION = 'tech-decision',
  ARCHITECTURE_REVIEW = 'architecture-review',
  REQUIREMENTS_ANALYSIS = 'requirements-analysis',
  CODE_REFACTORING = 'code-refactoring'
}

/**
 * 提示词模板结构
 */
export interface PromptTemplate {
  /** 模板ID */
  id: string;

  /** 模板名称 */
  name: string;

  /** 模板描述 */
  description: string;

  /** 提示词模板（包含变量占位符） */
  template: string;

  /** 可注入的变量列表 */
  variables: string[];
}

/**
 * 代码库信息
 */
export interface CodebaseInfo {
  /** 总文件数 */
  totalFiles?: number;

  /** 依赖列表 */
  dependencies?: string[];

  /** 架构模式 */
  architecturePattern?: string;

  /** 请求量 */
  requestVolume?: string;

  /** 数据量 */
  dataVolume?: string;

  /** 用户数量 */
  userCount?: string;

  /** 关键路径 */
  criticalPaths?: string[];
}

/**
 * 深度推理提示词生成器
 *
 * 提供不同场景的优化提示词模板，支持动态变量注入
 */
export class DeepThinkingPrompts {
  /**
   * 获取指定场景的提示词模板
   *
   * @param scenario 提示词场景
   * @returns 提示词模板
   */
  static getTemplate(scenario: PromptScenario): PromptTemplate {
    const templates: Record<PromptScenario, PromptTemplate> = {
      [PromptScenario.DESIGN_REVIEW]: this._getDesignReviewTemplate(),
      [PromptScenario.TECH_DECISION]: this._getTechDecisionTemplate(),
      [PromptScenario.ARCHITECTURE_REVIEW]: this._getArchitectureReviewTemplate(),
      [PromptScenario.REQUIREMENTS_ANALYSIS]: this._getRequirementsAnalysisTemplate(),
      [PromptScenario.CODE_REFACTORING]: this._getCodeRefactoringTemplate()
    };

    return templates[scenario];
  }

  /**
   * 生成完整的提示词（注入变量）
   *
   * @param scenario 提示词场景
   * @param context 分析上下文
   * @returns 完整的提示词
   */
  static generatePrompt(scenario: PromptScenario, context: AnalysisContext): string {
    const template = this.getTemplate(scenario);
    let prompt = template.template;

    // 注入任务上下文
    prompt = this._injectTaskContext(prompt, context.task);

    // 注入代码库信息（如果有）
    if (context.codebaseSnapshot) {
      const codebaseInfo: CodebaseInfo = {
        totalFiles: context.codebaseSnapshot.files.length,
        dependencies: context.codebaseSnapshot.externalDependencies || [],
        architecturePattern: 'N/A' // 可以从代码库分析中提取
      };
      prompt = this._injectCodebaseInfo(prompt, codebaseInfo);
    } else {
      // 如果没有代码库信息，使用默认值
      prompt = this._injectCodebaseInfo(prompt, {});
    }

    // 注入复杂度信息（如果有）
    if (context.complexityScore) {
      prompt = this._injectComplexityScore(prompt, context.complexityScore);
    }

    // 清理未替换的变量（用 'N/A' 替换）
    prompt = this._cleanupUnreplacedVariables(prompt);

    return prompt;
  }

  // ==================== 模板定义 ====================

  /**
   * 设计文档Review提示词模板
   */
  private static _getDesignReviewTemplate(): PromptTemplate {
    return {
      id: 'design-review',
      name: '设计文档Review',
      description: '深度分析设计文档的技术可行性、风险和优化建议',
      variables: [
        'TASK_DESCRIPTION',
        'SPEC_NAME',
        'DOCUMENT_CONTENT',
        'FILE_COUNT',
        'DEPENDENCIES',
        'ARCHITECTURE_PATTERN'
      ],
      template: `You are a senior software architect conducting a deep analysis of a design document.

**Task**: {TASK_DESCRIPTION}
**Document Type**: Design Document
**Spec Name**: {SPEC_NAME}

## Document Content:
{DOCUMENT_CONTENT}

## Codebase Context:
- Total Files: {FILE_COUNT}
- Dependencies: {DEPENDENCIES}
- Architecture: {ARCHITECTURE_PATTERN}

## Analysis Framework:

Please provide a comprehensive analysis following this structure:

### 1. Problem Decomposition
Break down the design into atomic problems. For each problem:
- **ID**: Unique identifier (e.g., P1, P1.1, P1.2)
- **Description**: Clear problem statement
- **Complexity**: Score from 1-10
- **Sub-problems**: Nested child problems (if any)

### 2. Risk Identification
Identify potential risks in these categories:
- **Technical Risks**: Implementation challenges, technology limitations, integration issues
- **Security Risks**: Vulnerabilities, data exposure, authentication/authorization issues
- **Performance Risks**: Scalability concerns, bottlenecks, resource consumption
- **Maintainability Risks**: Code complexity, technical debt, testing challenges

For each risk:
- **ID**: Unique identifier (e.g., R1, R2)
- **Category**: One of the categories above
- **Severity**: high | medium | low
- **Description**: Detailed risk description
- **Mitigation**: Recommended mitigation strategy

### 3. Solution Comparison
Compare multiple alternative solutions. For each solution, provide:
- **ID**: Unique identifier (e.g., S1, S2)
- **Approach**: Brief description of the solution
- **Pros**: List of advantages
- **Cons**: List of disadvantages
- **Complexity**: Implementation complexity (1-10)
- **Score**: Overall score (1-10)

### 4. Recommended Decision
Provide a final recommendation with:
- **Selected Solution**: ID of the recommended solution
- **Rationale**: Detailed justification for the choice
- **Estimated Effort**: Time/effort estimation (e.g., "2-3 days", "1 week")
- **Next Steps**: List of actionable next steps

## Output Format

Please structure your response with clear section headers matching the analysis framework above. Use markdown formatting for clarity.

Use sequential-thinking to ensure thorough analysis. Think step by step.`
    };
  }

  /**
   * 技术决策分析提示词模板
   */
  private static _getTechDecisionTemplate(): PromptTemplate {
    return {
      id: 'tech-decision',
      name: '技术决策分析',
      description: '评估技术选型的利弊和长期影响',
      variables: [
        'TASK_DESCRIPTION',
        'CURRENT_TECH_STACK',
        'TEAM_SIZE',
        'TIMELINE',
        'DECISION_QUESTION',
        'OPTIONS'
      ],
      template: `You are a technical advisor helping evaluate a technology decision.

**Decision Context**: {TASK_DESCRIPTION}
**Current Stack**: {CURRENT_TECH_STACK}
**Team Size**: {TEAM_SIZE}
**Timeline**: {TIMELINE}

## Decision Question:
{DECISION_QUESTION}

## Available Options:
{OPTIONS}

## Evaluation Criteria:
- Technical fit with existing stack
- Learning curve for team
- Community support and maturity
- Performance characteristics
- Long-term maintainability
- Cost (licensing, hosting, etc.)

Please analyze this decision using the sequential-thinking framework:

### 1. Problem Decomposition
Break down what this decision really entails:
- Core requirements that drive this decision
- Sub-decisions that need to be made
- Dependencies and constraints

### 2. Risk Assessment
Identify risks for each option:
- **Technical Risks**: Integration challenges, vendor lock-in, technology maturity
- **Team Risks**: Learning curve, skill gaps, adoption resistance
- **Business Risks**: Cost overruns, timeline impact, vendor stability

### 3. Option Comparison
Detailed pros/cons analysis for each option:
- **Option ID**: (e.g., O1, O2)
- **Pros**: Specific advantages
- **Cons**: Specific disadvantages
- **Complexity**: Implementation complexity (1-10)
- **Score**: Overall score (1-10)

### 4. Recommendation
Clear recommendation with rationale:
- **Selected Option**: ID and name of recommended option
- **Rationale**: Detailed reasoning considering both immediate and long-term impact
- **Estimated Effort**: Implementation time/effort
- **Next Steps**: Actionable items to proceed

Consider both immediate impact and long-term consequences. Use sequential-thinking to ensure thorough analysis.`
    };
  }

  /**
   * 架构评审提示词模板
   */
  private static _getArchitectureReviewTemplate(): PromptTemplate {
    return {
      id: 'architecture-review',
      name: '架构评审',
      description: '评估系统架构的可扩展性、可靠性和安全性',
      variables: [
        'SYSTEM_NAME',
        'SCOPE',
        'EXPECTED_SCALE',
        'ARCHITECTURE_CONTENT',
        'REQUEST_VOLUME',
        'DATA_VOLUME',
        'USER_COUNT',
        'CRITICAL_PATHS'
      ],
      template: `You are a principal architect reviewing system architecture.

**System**: {SYSTEM_NAME}
**Scope**: {SCOPE}
**Scale**: {EXPECTED_SCALE}

## Architecture Document:
{ARCHITECTURE_CONTENT}

## Current System Metrics:
- Request Volume: {REQUEST_VOLUME}
- Data Volume: {DATA_VOLUME}
- User Base: {USER_COUNT}
- Critical Paths: {CRITICAL_PATHS}

## Review Focus Areas:

### 1. Scalability Analysis
- Can this architecture handle 10x growth?
- Identify potential bottlenecks
- Horizontal vs vertical scaling strategy
- Database scaling approach
- Caching strategy

For each scalability concern:
- **ID**: Unique identifier
- **Description**: Scalability issue
- **Impact**: Impact on system (high/medium/low)
- **Mitigation**: Recommended approach

### 2. Reliability & Resilience
- Single points of failure
- Disaster recovery strategy
- Data consistency guarantees
- Fault tolerance mechanisms
- Backup and recovery procedures

For each reliability risk:
- **ID**: Unique identifier
- **Risk**: Description of reliability risk
- **Severity**: high/medium/low
- **Mitigation**: Recommended solution

### 3. Security Architecture
- Authentication & authorization model
- Data encryption (at rest & in transit)
- API security (rate limiting, input validation)
- Compliance requirements (GDPR, HIPAA, etc.)
- Secrets management

For each security concern:
- **ID**: Unique identifier
- **Concern**: Security issue
- **Severity**: critical/high/medium/low
- **Recommendation**: Security improvement

### 4. Operational Excellence
- Monitoring & observability strategy
- Deployment strategy (blue-green, canary, rolling)
- Rollback capabilities
- Incident response plan
- Performance monitoring

### 5. Recommended Improvements
Provide prioritized list of improvements:
- **ID**: Improvement identifier
- **Priority**: high/medium/low
- **Description**: What needs to be improved
- **Rationale**: Why this improvement matters
- **Estimated Effort**: Time/effort to implement

Use deep reasoning to uncover hidden issues and propose improvements. Think step by step using sequential-thinking.`
    };
  }

  /**
   * 需求分析提示词模板
   */
  private static _getRequirementsAnalysisTemplate(): PromptTemplate {
    return {
      id: 'requirements-analysis',
      name: '需求分析',
      description: '分析需求的完整性、可行性和优先级',
      variables: [
        'FEATURE_NAME',
        'PRIORITY',
        'TARGET_USERS',
        'REQUIREMENTS_CONTENT'
      ],
      template: `You are a product architect analyzing requirements for completeness and feasibility.

**Feature**: {FEATURE_NAME}
**Priority**: {PRIORITY}
**Target Users**: {TARGET_USERS}

## Requirements Document:
{REQUIREMENTS_CONTENT}

## Analysis Framework:

### 1. Requirements Decomposition
Break requirements into:

**Functional Requirements**:
- **ID**: Unique identifier (e.g., FR1, FR2)
- **Description**: What the system must do
- **Priority**: high/medium/low
- **Complexity**: Implementation complexity (1-10)

**Non-Functional Requirements**:
- **ID**: Unique identifier (e.g., NFR1, NFR2)
- **Type**: Performance/Security/Usability/Reliability/Scalability
- **Description**: Quality attribute requirement
- **Measurable Criteria**: How to verify (e.g., "response time < 200ms")

**Technical Constraints**:
- Technology limitations
- Integration requirements
- Compatibility requirements

**Business Constraints**:
- Timeline constraints
- Budget limitations
- Regulatory requirements

### 2. Feasibility Assessment
For each requirement group:

- **Technical Feasibility**: Can we build this with current technology?
- **Resource Requirements**: Team size, skills needed, tools required
- **Timeline Estimation**: Realistic time estimate with justification
- **Dependencies**: What must be done first, external dependencies
- **Risks**: What could go wrong

### 3. Risk & Gap Analysis

**Missing Requirements**:
- **ID**: Gap identifier
- **Description**: What's missing
- **Impact**: Impact of not addressing (high/medium/low)
- **Recommendation**: Suggested requirement

**Ambiguous Requirements**:
- **ID**: Requirement ID
- **Ambiguity**: What's unclear
- **Clarification Needed**: Questions to ask stakeholders

**Contradictory Requirements**:
- **Conflict**: Description of contradiction
- **Requirements Involved**: Which requirements conflict
- **Resolution**: Suggested resolution

**High-Risk Requirements**:
- **ID**: Requirement ID
- **Risk**: Description of risk
- **Severity**: critical/high/medium/low
- **Mitigation**: Risk mitigation strategy

### 4. Recommendations

**Prioritization Suggestions**:
- **Must Have (P0)**: Critical requirements for MVP
- **Should Have (P1)**: Important but not critical
- **Nice to Have (P2)**: Can be deferred

**Clarification Questions**:
- List of questions for stakeholders

**Alternative Approaches**:
- Different ways to achieve the same goals
- Pros/cons of each approach

**MVP Scope Recommendation**:
- Minimal feature set for first release
- Rationale for scope decisions
- Estimated timeline for MVP

Think deeply about user needs and technical reality. Use sequential-thinking to ensure thorough analysis.`
    };
  }

  /**
   * 代码重构提示词模板
   */
  private static _getCodeRefactoringTemplate(): PromptTemplate {
    return {
      id: 'code-refactoring',
      name: '代码重构分析',
      description: '分析重构范围、风险和实施策略',
      variables: [
        'TASK_DESCRIPTION',
        'FILE_COUNT',
        'COMPLEXITY_SCORE',
        'CODE_SNIPPET',
        'REFACTORING_GOAL'
      ],
      template: `You are a software engineering expert analyzing a code refactoring task.

**Task**: {TASK_DESCRIPTION}
**Refactoring Goal**: {REFACTORING_GOAL}
**Files Affected**: {FILE_COUNT}
**Complexity Score**: {COMPLEXITY_SCORE}/10

## Code Context:
{CODE_SNIPPET}

## Analysis Framework:

### 1. Problem Decomposition
Break down the refactoring into specific sub-tasks:
- **ID**: Subtask identifier (e.g., RT1, RT2)
- **Description**: What needs to be refactored
- **Scope**: Files/functions affected
- **Complexity**: Difficulty (1-10)
- **Dependencies**: What must be done first

### 2. Risk Identification

**Technical Risks**:
- Breaking changes to public APIs
- Regression risks (areas without test coverage)
- Performance degradation risks
- Integration breakage

**Process Risks**:
- Merge conflicts (if long-running branch)
- Testing challenges
- Deployment risks

For each risk:
- **ID**: Risk identifier
- **Category**: Technical/Process
- **Severity**: critical/high/medium/low
- **Description**: Detailed risk description
- **Mitigation**: How to reduce this risk

### 3. Solution Comparison

**Approach 1: Big Bang Refactoring**
- **Pros**: Clean result, faster if successful
- **Cons**: High risk, difficult to review, rollback challenges
- **Complexity**: [1-10]
- **Score**: [1-10]

**Approach 2: Incremental Refactoring**
- **Pros**: Lower risk, easier reviews, can ship incrementally
- **Cons**: Takes longer, may have temporary duplication
- **Complexity**: [1-10]
- **Score**: [1-10]

**Approach 3: Strangler Pattern** (if applicable)
- **Pros**: Zero downtime, gradual migration
- **Cons**: Temporary complexity, need to maintain both versions
- **Complexity**: [1-10]
- **Score**: [1-10]

### 4. Recommended Decision

**Selected Approach**: [Approach ID and name]

**Rationale**:
- Why this approach is best for this specific refactoring
- Consideration of risk tolerance
- Team capacity and timeline

**Estimated Effort**: [e.g., "3-5 days", "2 weeks"]

**Phase Breakdown** (if incremental):
- **Phase 1**: [Description, effort estimate]
- **Phase 2**: [Description, effort estimate]
- **Phase 3**: [Description, effort estimate]

**Next Steps**:
1. [Actionable step 1]
2. [Actionable step 2]
3. [Actionable step 3]

**Testing Strategy**:
- Unit tests to add/update
- Integration tests needed
- Regression testing approach
- Performance benchmarks

Use sequential-thinking to analyze the refactoring deeply and systematically.`
    };
  }

  // ==================== 变量注入方法 ====================

  /**
   * 注入任务上下文
   *
   * @param template 提示词模板
   * @param task 任务描述符
   * @returns 注入后的提示词
   */
  private static _injectTaskContext(template: string, task: TaskDescriptor): string {
    let result = template;

    // 注入任务基本信息
    result = result.replace(/{TASK_DESCRIPTION}/g, task.description || 'N/A');
    result = result.replace(/{TASK_ID}/g, task.id || 'N/A');
    result = result.replace(/{TASK_TYPE}/g, task.type || 'N/A');

    // 注入spec信息
    if (task.specName) {
      result = result.replace(/{SPEC_NAME}/g, task.specName);
      result = result.replace(/{FEATURE_NAME}/g, task.specName);
      result = result.replace(/{SYSTEM_NAME}/g, task.specName);
    }

    // 注入文档内容
    if (task.context) {
      if (task.context.requirements) {
        result = result.replace(/{REQUIREMENTS_CONTENT}/g, task.context.requirements);
        result = result.replace(/{DOCUMENT_CONTENT}/g, task.context.requirements);
      }
      if (task.context.design) {
        result = result.replace(/{DOCUMENT_CONTENT}/g, task.context.design);
        result = result.replace(/{ARCHITECTURE_CONTENT}/g, task.context.design);
      }
      if (task.context.tasks) {
        result = result.replace(/{DOCUMENT_CONTENT}/g, task.context.tasks);
      }

      // 注入额外上下文
      if (task.context.additionalContext) {
        const ctx = task.context.additionalContext;
        result = result.replace(/{PRIORITY}/g, ctx.priority || 'N/A');
        result = result.replace(/{TARGET_USERS}/g, ctx.targetUsers || 'N/A');
        result = result.replace(/{CURRENT_TECH_STACK}/g, ctx.currentTechStack || 'N/A');
        result = result.replace(/{TEAM_SIZE}/g, ctx.teamSize || 'N/A');
        result = result.replace(/{TIMELINE}/g, ctx.timeline || 'N/A');
        result = result.replace(/{DECISION_QUESTION}/g, ctx.decisionQuestion || 'N/A');
        result = result.replace(/{OPTIONS}/g, ctx.options || 'N/A');
        result = result.replace(/{SCOPE}/g, ctx.scope || 'N/A');
        result = result.replace(/{EXPECTED_SCALE}/g, ctx.expectedScale || 'N/A');
        result = result.replace(/{REFACTORING_GOAL}/g, ctx.refactoringGoal || 'N/A');
        result = result.replace(/{CODE_SNIPPET}/g, ctx.codeSnippet || 'N/A');
      }
    }

    // 注入文件信息
    if (task.relatedFiles) {
      result = result.replace(/{FILE_COUNT}/g, String(task.relatedFiles.length));
    }

    return result;
  }

  /**
   * 注入代码库信息
   *
   * @param template 提示词模板
   * @param codebaseInfo 代码库信息
   * @returns 注入后的提示词
   */
  private static _injectCodebaseInfo(template: string, codebaseInfo: CodebaseInfo): string {
    let result = template;

    result = result.replace(/{FILE_COUNT}/g, String(codebaseInfo.totalFiles || 0));
    result = result.replace(
      /{DEPENDENCIES}/g,
      codebaseInfo.dependencies?.join(', ') || 'N/A'
    );
    result = result.replace(
      /{ARCHITECTURE_PATTERN}/g,
      codebaseInfo.architecturePattern || 'N/A'
    );
    result = result.replace(/{REQUEST_VOLUME}/g, codebaseInfo.requestVolume || 'N/A');
    result = result.replace(/{DATA_VOLUME}/g, codebaseInfo.dataVolume || 'N/A');
    result = result.replace(/{USER_COUNT}/g, codebaseInfo.userCount || 'N/A');
    result = result.replace(
      /{CRITICAL_PATHS}/g,
      codebaseInfo.criticalPaths?.join(', ') || 'N/A'
    );

    return result;
  }

  /**
   * 注入复杂度评分
   *
   * @param template 提示词模板
   * @param score 复杂度评分
   * @returns 注入后的提示词
   */
  private static _injectComplexityScore(template: string, score: any): string {
    let result = template;

    result = result.replace(/{COMPLEXITY_SCORE}/g, String(score.total?.toFixed(1) || 'N/A'));

    return result;
  }

  /**
   * 清理未替换的变量
   *
   * 将所有未替换的 {VARIABLE} 替换为 'N/A'
   *
   * @param template 提示词模板
   * @returns 清理后的提示词
   */
  private static _cleanupUnreplacedVariables(template: string): string {
    return template.replace(/{[A-Z_]+}/g, 'N/A');
  }
}
