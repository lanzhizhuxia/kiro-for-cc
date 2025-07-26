# Changelog

All notable changes to this project will be documented in this file.

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
