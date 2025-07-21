# Changelog

All notable changes to this project will be documented in this file.

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
