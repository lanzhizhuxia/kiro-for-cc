# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2025-01-19

### 🚀 Major Feature: Sam + Codex 自动化协作系统

**Sam 现在可以自动评估和批量执行任务了！**

#### 核心功能

1. **TaskEvaluator - 任务评估器**
   - 自动解析 `tasks.md` 文件
   - 智能评估任务复杂度（0-100分，基于5个因素）
   - 识别8种任务类型（算法、组件、API、数据处理等）
   - 推荐执行方式（Codex vs 手动）
   - 置信度评分（60%-95%）

2. **BatchTaskDelegator - 批量任务委派器**
   - 并发执行（可配置最大并发数，默认3）
   - 自动失败重试（可配置次数）
   - 实时进度显示
   - 超时控制（默认5分钟）

3. **CodeAcceptanceTester - 代码验收测试器**
   - 基本代码质量检查
   - 编译检查（简化版）
   - 代码风格检查（简化版）
   - 支持自定义验证逻辑

4. **CodeIntegrator - 代码整合器**
   - 智能文件路径推断
   - Diff 视图展示（并排对比）
   - 交互式合并选项（接受/合并/拒绝）
   - 自动备份机制（.backup-{timestamp}）

5. **SamCodexCoordinator - 主协调器**
   - 统一管理整个自动化流程
   - 自动更新 `tasks.md` 状态（标记为 [x]）
   - 集成 PROGRESS.md 追踪
   - 生成详细执行报告

#### 新增命令

- `Sam: Auto-Evaluate Tasks` - 评估任务并推荐执行方式
- `Sam: Auto-Implement Tasks with Codex` - 自动化实现任务

#### 智能评估规则

**推荐使用 Codex**:
- ✅ 算法实现（95%置信度）
- ✅ 工具函数（95%置信度）
- ✅ 数据处理（95%置信度）
- ✅ 简单任务（复杂度 < 30分，80%置信度）
- ✅ 适中任务（复杂度 30-70分，75%置信度）

**推荐手动实现**:
- ❌ 文档编写（90%置信度）
- ❌ 重构任务（90%置信度）
- ❌ UI/UX 主观任务（85%置信度）
- ❌ 复杂任务（复杂度 > 70分，70%置信度）

#### 自动化流程

```
1. 解析 tasks.md
2. 评估每个任务（复杂度、类型、推荐）
3. 批量委派给 Codex（3个并发）
4. 自动验收代码质量
5. 显示 diff 供用户审查
6. 更新任务状态（tasks.md）
7. 记录执行报告（PROGRESS.md）
```

#### 文档

- [用户指南](docs/SAM_AUTO_IMPLEMENTATION_GUIDE.md)
- [架构设计](docs/SAM_CODEX_AUTOMATION_DESIGN.md)

#### 技术细节

**新增文件**:
- `src/features/sam/automation/taskEvaluator.ts` (289行)
- `src/features/sam/automation/batchTaskDelegator.ts` (262行)
- `src/features/sam/automation/codeAcceptanceTester.ts` (216行)
- `src/features/sam/automation/codeIntegrator.ts` (246行)
- `src/features/sam/automation/samCodexCoordinator.ts` (395行)
- `src/features/sam/automation/types.ts` (210行)
- `src/features/sam/automation/index.ts` (11行)

**总计**: ~1629行新代码

**集成点**:
- `extension.ts`: 初始化 SamCodexCoordinator
- `package.json`: 注册新命令

## [0.5.0] - 2025-11-19

### 🧹 Major Cleanup: Removed Unused Codex Code

This release removes ~2600 lines (~48%) of unused Codex workflow code to improve maintainability and reduce bundle size.

#### Changes

1. **Deleted Unused Components** (~2600 lines removed)
   - Removed `TaskRouter` (智能任务路由) - never called due to hardcoded `forceMode: 'codex'`
   - Removed `ComplexityAnalyzer` (复杂度分析器) - unused without TaskRouter
   - Removed `DeepThinkingEngine` (深度推理引擎) - disabled via hardcoded `enableDeepThinking: false`
   - Removed `CodebaseAnalyzer` (代码库分析器) - had TODO comments, not implemented
   - Removed `SecurityGuard` (安全守卫) - never imported or called
   - Removed `PreferenceTracker` (偏好学习) - no user feedback UI
   - Removed `FeedbackCollector` (反馈收集器) - no UI implemented
   - Removed `CodexAnalysisWebview` (WebView展示) - unused without DeepThinkingEngine
   - Removed `TaskCodeLensProvider` (任务CodeLens) - unused UI component
   - Removed `MCPLifecycleManager` - functionality integrated into MCPClient
   - Removed `LocalAgentExecutor` - never used (always forced to Codex mode)
   - Removed all test files for deleted components

2. **Simplified Core Components**
   - Simplified `CodexOrchestrator` - removed routing, deep thinking, WebView integration
   - Simplified `types.ts` - removed unused type definitions (ComplexityScore, ThinkingResult, ModeRecommendation, AnalysisContext, CodebaseSnapshot, etc.)
   - Updated `codexExecutor.ts` - removed references to deleted managers
   - Updated `sessionStateManager.ts` - removed unused context properties
   - Updated `specManager.ts` - removed WebView and thinking summary code

3. **Impact**
   - Code reduced from ~5400 lines to ~2800 lines (48% reduction)
   - Files reduced from 21 to 8 TypeScript files (62% reduction)
   - Bundle size reduction: ~100KB (estimated)
   - All working features preserved:
     - ✅ Review Design with Codex
     - ✅ Review Requirements with Codex
     - ✅ Implement Task with Codex (Sam integration)

4. **Breaking Changes**
   - None - all deleted code was unused

## [0.4.0] - 2025-11-19

### ✨ Major Feature: Sam + Codex Integration

**Sam can now delegate implementation tasks to Codex!**

This release implements the PM-Engineer collaboration model:
- **Sam acts as PM/Architect** - Creates specs, evaluates tasks, assigns work to Codex
- **Codex acts as Engineer** - Implements specific coding tasks delegated by Sam

#### New Features

1. **`implementTaskWithCodex()` Method**
   - Sam can delegate specific development tasks to Codex
   - Automatically loads requirements and design context
   - Codex generates complete code implementation with Chinese comments
   - Results saved to spec directory for review

2. **New Command: "Implement Task with Codex"**
   - Available in Command Palette (Cmd+Shift+P)
   - User provides spec name and task description
   - Sam loads context and delegates to Codex
   - Implementation displayed automatically when complete

3. **Chinese Code Generation**
   - Codex outputs code with Chinese comments
   - Follows project coding standards
   - Includes error handling and implementation notes

#### How It Works

```
User → "Implement Task with Codex"
  ↓
Sam loads spec context (requirements + design)
  ↓
Sam builds task for Codex with Chinese instructions
  ↓
Codex analyzes codebase and implements task
  ↓
Sam saves result to .claude/specs/{spec-name}/task-implementation-*.md
  ↓
User reviews implementation
```

#### Example Usage

1. Open Command Palette (Cmd+Shift+P)
2. Run "Implement Task with Codex"
3. Enter spec name: `bubble-sort`
4. Enter task: `实现冒泡排序算法，支持升序和降序`
5. Wait for Codex to generate implementation
6. Review the generated code with Chinese comments

#### Technical Details

- **Integration Point**: SamManager now has CodexOrchestrator dependency
- **Context Loading**: Automatically loads requirements.md and design.md
- **Codebase Scanning**: Enabled for better code generation quality
- **Output Format**: Markdown file with code blocks and implementation notes

## [0.3.9] - 2025-11-19

### ✨ New Features

- **Chinese Language Support for Codex Analysis**:
  - Review Design and Review Requirements now output in Chinese by default
  - Added structured analysis prompts in Chinese for both design and requirements review
  - Codex will now provide comprehensive analysis reports in Chinese
  - Analysis includes: completeness, feasibility, technical decisions, risks, and improvement suggestions

## [0.3.8] - 2025-11-19

### 🐛 Critical Fix

- **MCPClient Tool Names**: Fixed tool names when directly connecting to codex-mcp-server
  - Changed from `'mcp__codex-cli__codex'` (with prefix) to `'codex'` (raw tool name)
  - When using direct stdio connection, MCP SDK doesn't add prefixes automatically
  - Resolves the actual "Unknown tool" error when calling Codex

## [0.3.7] - 2025-11-19

### 🐛 Bug Fixes

- **Codex MCP Integration**: Fixed MCPClient initialization to use configured codex-mcp-server path
  - Changed from starting new `codex mcp-server` process to using user's configured `codex-cli` MCP server
  - Updated tool names from `mcp__codex__*` to `mcp__codex-cli__*` to match actual server
  - Fixed in both `codexOrchestrator.ts` and `codexExecutor.ts`
  - Resolves "Unknown tool" errors when using Review Design feature

## [0.3.6] - 2025-11-19

### 🐛 Bug Fixes

- **Codex MCP Tool Names**: Updated tool names in MCPClient to match codex-cli server
  - Fixed tool name from `mcp__codex__codex` to `mcp__codex-cli__codex`
  - Fixed reply tool name to `mcp__codex-cli__codex-reply`

## [0.3.0] - 2025-11-18

### ✨ New Features - Codex Workflow Orchestration System

This release introduces the **Codex Workflow Orchestration System**, a major new feature that brings intelligent task routing, deep analysis, and automated execution to spec-driven development.

#### Core Components

- **Intelligent Task Router**
  - Automatic complexity analysis with multi-dimensional scoring (code scale, technical difficulty, business impact)
  - Smart routing between quick mode and Codex mode based on task complexity
  - Human-readable recommendation reasons with confidence scores
  - Support for both static analysis and Claude-based dynamic analysis

- **Deep Thinking Engine**
  - Sequential thinking integration via MCP for complex problem decomposition
  - Timeout detection and graceful cancellation mechanism
  - Real-time progress tracking (initializing → analyzing → parsing → completed)
  - Automatic intermediate result saving on timeout/cancellation

- **Codebase Scanner**
  - Comprehensive codebase analysis with file type classification
  - Dependency detection and complexity metrics
  - Language statistics and project structure mapping
  - Smart scanning with configurable depth and exclusion rules

- **MCP Lifecycle Manager**
  - Automatic MCP server startup and health monitoring
  - TCP-based health checks with auto-restart on failure
  - Graceful shutdown handling with cleanup
  - Real-time server status tracking

- **Security Guard**
  - Dangerous command detection (rm -rf, sudo, chmod, etc.)
  - Sensitive file access control (.env, credentials, SSH keys, etc.)
  - Configuration file modification protection with automatic backup
  - Sensitive content sanitization in logs

- **Session Management**
  - Conversation persistence across sessions
  - Task context tracking with unique markers
  - State restoration with file locks and atomic writes
  - Comprehensive session history

- **Execution Logging**
  - Dual-output logging (real-time OutputChannel + persistent file)
  - MCP request/response tracking with sanitization
  - Structured log format with timestamps and severity levels
  - Buffered writes with automatic flush

- **Progress Indicator**
  - VSCode native progress window integration
  - 7-phase execution tracking with detailed messages
  - User-cancellable operations with checkpoint verification
  - Elapsed time reporting

- **Task CodeLens Provider**
  - Inline "Execute with Codex" button in tasks.md
  - One-click task execution from document
  - Integration with Codex orchestrator

#### User Interface Enhancements

- Add Codex analysis commands for design and requirements documents
- Show sparkle icon for Codex-enabled documents in tree view
- Add context menu items for deep document analysis
- Integrate CodeLens in tasks.md for quick task execution

#### Configuration

- Add `kfc.codex.enableTaskCodeLens` setting (default: true)
- Support for Codex configuration in settings panel

#### Testing

- **215+ comprehensive test cases** covering all components
  - Unit tests for each component with Jest
  - Integration tests for MCP lifecycle and orchestration
  - E2E tests covering 10 scenarios (92% function coverage)
  - Security tests with 84 test cases (all 6 security requirements)
  - Mock testing strategy for VSCode API and MCP client

#### Documentation

- Complete user guide (6,500 words) covering installation, usage, FAQ, and troubleshooting
- Comprehensive architecture documentation (15,000 words) with component details and flow diagrams
- CONTRIBUTING.md for developer onboarding
- Updated CLAUDE.md with Codex system overview

### 🎯 What is Codex Mode?

Codex mode is an intelligent execution mode that activates for complex tasks requiring:
- Deep reasoning and problem decomposition
- Large-scale codebase analysis
- Multi-file impact assessment
- Complex dependency resolution
- Critical system changes

The system automatically decides between:
- **Quick Mode**: Direct execution for simple, well-defined tasks
- **Codex Mode**: Enhanced execution with deep thinking, codebase scanning, and comprehensive analysis

### 📊 Project Impact

- **41/77 tasks completed** (53.2%) following structured batch development
- **Fast release plan** executed focusing on P0 features for v1.0
- **Systematic development** through 9 batches with parallel agent execution

## [0.2.9] - 2025-09-21

### 🐛 Bug Fixes

- Fix path normalization for custom specs directory
  - Improve handling of user-configured specs directories
  - Ensure proper path resolution across different operating systems

- Fix missing "Start Task" button when specs directory is configured
  - Resolve issue where CodeLens would not appear with custom specs paths
  - Improve task button visibility detection

- Translate Chinese text to English in spec agents and CodeLens
  - Complete internationalization of spec agent prompts
  - Ensure consistent English language in CodeLens UI elements
  - Improve accessibility for international users

## [0.2.8] - 2025-09-03

### 🐛 Bug Fixes

- Fix "Raw mode is not supported" error when using Claude CLI (#3)
  - Replace pipe input redirection with command substitution
  - Resolves TTY issues in Claude CLI's interactive mode
  - Fixes error that occurs when Ink library cannot access TTY environment through piped input

## [0.2.7] - 2025-08-20

### ✨ New Features

- Add model inherit parameter to all spec agents (#23)
  - All built-in spec agents now include `model: inherit` parameter
  - Ensures spec agents use the same model as the parent session
  - Improves consistency across the spec workflow

## [0.2.6] - 2025-07-31

### 🐛 Bug Fixes

- Fix CodeLens "Start Task" button not showing in files with CRLF line endings (#13)
  - Handle different line ending formats (CRLF/LF) during text splitting
  - Remove redundant file watchers (VSCode handles CodeLens refresh automatically)
  - Clean up debug logs and simplify code structure

### 📚 Documentation

- Add GitHub stars and issues badges with flat-square style to README

## [0.2.5] - 2025-07-28

### 🔧 Improvements

- Update impl-task prompt to use spec-system-prompt-loader sub agent
  - Modified step 1 in impl-task.md to explicitly call spec-system-prompt-loader sub agent
  - This ensures proper context loading during task implementation
  - Auto-generated target TypeScript file updated accordingly

## [0.2.4] - 2025-07-28

### ✨ New Features

- Add task implementation support (Closes #4)
  - Add CodeLens provider for spec tasks with "▶ Implement Task" button
  - Create optimized impl-task prompt for intelligent code implementation
  - Enable continuing task execution after session interruption
  - Support starting new conversations with full spec context

### 🔧 Improvements

- Improve UI clarity by renaming "Agent Steering" to "Steering"
- Enhance spec generation to place dependency diagrams at document end
- Update impl-task prompt to require comprehensive unit tests
- Configure proper VSCode debugging with launch.json and tasks.json
- Fix .gitignore rules for VSCode configuration files

### 🐛 Bug Fixes

- Strengthen spec-system-prompt-loader agent to prevent irrelevant responses
- Remove kfc agents from version control (moved to .gitignore)

## [0.2.3] - 2025-07-28

### ✨ New Features

- Enhance spec workflow with parallel execution and tree-based evaluation
  - Add user-configurable parallel agent execution (1-128 agents)
  - Implement tree-based judge evaluation for efficient multi-document review
  - Add auto mode for intelligent task orchestration based on dependencies
  - Add parent task completion tracking by main thread

### 🔧 Improvements

- Update spec-requirements to prevent directory creation conflicts
- Enhance spec-judge with random suffix for multi-round evaluation
- Improve spec-impl constraints to ensure task marking
- Update built-in agent and system prompt resources

## [0.2.2] - 2025-07-27

### 🐛 Bug Fixes

- Force update built-in agents and system prompts on startup
  - Always overwrite built-in resources to ensure users have the latest versions
  - Prevents issues with outdated agents from previous installations
  - Built-in agents remain in project's .claude/agents/kfc directory only

## [0.2.1] - 2025-07-26

### 🐛 Bug Fixes

- Fix resource file loading issue in packaged extension
  - Update resource paths from 'src/resources' to 'dist/resources' to match webpack bundle structure
  - Add !src/resources/** to .vscodeignore to ensure resources are included in package
  - Resolve "EntryNotFound (FileSystemError)" when copying built-in agents and system prompts

### 📚 Documentation

- Improve README documentation with centered screenshots
- Add prominent Sub Agent feature introduction with visual guide
- Synchronize content between English and Chinese README versions

## [0.2.0] - 2025-07-26

### ✨ New Features

- Add spec sub-agents functionality for Claude Code integration
  - Implement AgentManager for managing Claude Code agents
  - Add AgentsExplorerProvider for displaying agents in VSCode sidebar
  - Create built-in spec workflow agents (requirements, design, tasks, judge, impl, test)
  - Add "New Spec (with Agents)" button to Spec Explorer
  - Support automatic initialization of built-in agents on startup
  - Enable spec-driven development workflow with Claude Code subagents

- Enhance MCP server status parsing and display
  - Parse connection status from 'claude mcp list' output
  - Add removeCommand parsing from 'claude mcp get' output
  - Show debug-disconnect icon for failed connections
  - Update tooltip to display connection status

### 🔧 Improvements

- Add comprehensive unit tests for agent functionality
  - Create tests for AgentManager with 14 test cases
  - Create tests for AgentsExplorerProvider with 15 test cases
  - Achieve 100% test coverage for new agent features

## [0.1.12] - 2025-07-23

### ✨ New Features

- Implement Claude Code permission verification system (ref #3)
  - Add permission check before Claude CLI execution
  - Provide clear user guidance for permission setup

### 🐛 Bug Fixes

- Add missing vscode.ProgressLocation mock for integration tests
  - Fixes test failures in CI/CD pipeline

### 🔧 Improvements

- Use NotificationUtils for auto-dismiss notifications
  - Improve consistency in notification handling across the extension

## [0.1.11] - 2025-07-23

### ✨ New Features

- Add permission check webview for better user guidance
  - Detect Claude CLI permission status before command execution
  - Display interactive guidance when permissions are not granted
  - Help users understand and resolve "Raw mode is not supported" errors
  - Provide quick access to Claude settings configuration

### 🐛 Bug Fixes

- Fix "Raw mode is not supported" error when using piped input (fixes #3)
  - Add `--no-interactive` flag when permission confirmation is needed
  - Handle both folder permissions and bypass mode permissions correctly

### 🔧 Improvements

- Add webpack bundling support for production builds
  - Reduce extension size from 1.04MB to 363KB (65% reduction)
  - Reduce file count from 163 to 35 files (78% reduction)
  - Improve extension loading performance
- Move extension icon to proper media folder location
- Update README with clearer feature descriptions
- Improve Chinese translation in documentation

## [0.1.10] - 2025-07-22

### 🐛 Bug Fixes

- Move runtime dependencies from devDependencies to dependencies
  - Fixes potential installation issues where required packages might not be installed

## [0.1.9] - 2025-07-22

### ✨ New Features

- Add automatic update checker with GitHub API integration
  - Check for new versions on extension startup
  - Manual check available via command palette: "Kiro: Check for Updates"
  - Show notification with "View Changelog" and "Skip" options
  - Rate limit checks to once per 24 hours
  - Skip specific versions to avoid repeated notifications

### 🧪 Testing

- Add comprehensive test suite for prompt system
  - Unit tests for prompt loader and markdown parsing
  - Integration tests with snapshots for all prompts
  - E2E test examples and version comparison
  - Add test infrastructure (Jest, mocks, configs)

### 🔧 Improvements

- Refactor prompt system architecture
  - Convert prompts from TypeScript strings to Markdown files
  - Add build system for compiling prompts
  - Create PromptLoader service for dynamic prompt loading
  - Split createClaudeMd into createUserClaudeMd and createProjectClaudeMd
  - Rename methods for clarity (invokeCCTerminal → invokeClaudeSplitView)
  - Add file system watcher for automatic terminal renaming
  - Implement notification utilities for better UX

## [0.1.8] - 2025-07-21

### ✨ New Features

- Add async loading for MCP server details
- Show loading state while fetching server details
- Display scope descriptions as tooltips instead of inline text

### 🐛 Bug Fixes

- Execute commands in workspace directory for proper scope detection (fixes missing project/local scope servers)

### 🔧 Improvements

- Parallelize server detail fetching for better performance
- Improve MCP servers loading experience with immediate list display

## [0.1.7] - 2025-07-21

### ✨ New Features

- Improve steering document deletion with background Claude execution
- Add Claude-powered changelog generation to release workflow
- Use git tag message for release changelog

### 🐛 Bug Fixes

- Bypass Claude CLI permission prompt for non-interactive execution
- Replace Claude changelog generation with bash script
- Add github_token to Claude action in release workflow

### 🔧 Improvements

- Simplified release workflow to read changelog from git tag messages
- Enhanced publish command to generate comprehensive changelogs

## [0.1.0] - 2025-07-20

### ✨ New Features

- Initial release of Kiro for Claude Code
- Spec-driven development features
- Steering document management
- Claude CLI integration
