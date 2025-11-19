# Sam Integration - Quick Start Guide

## What is Sam?

Sam (Spec Automation Manager) is your AI-powered project manager integrated into Kiro for Claude Code. Sam automates the entire spec-driven workflow from requirements to implementation.

## Key Features

### 🚀 One-Click Start
- Click the "🤖 Ask Sam" button in Spec Explorer
- Enter your feature description
- Sam automatically gathers project context and starts working

### 📊 Visual Progress Tracking
- Real-time progress icons in Spec Explorer:
  - 🔄 In Progress (spinning sync icon)
  - ✅ Completed (green check)
  - ⚠️ Blocked (yellow warning)
- Hover over any spec to see detailed progress tooltip

### 🔄 Smart Resume
- Right-click on any in-progress spec
- Click "Continue Sam Work" to resume where you left off
- Sam automatically detects blockers and asks if they're resolved

## Quick Usage

### Start a New Feature

```
1. Open Spec Explorer in VSCode sidebar
2. Click the "🤖 Ask Sam" button (robot icon)
3. Enter: "User authentication with JWT"
4. Sam will:
   - Read your language preference (from ~/.claude/CLAUDE.md)
   - Scan existing specs to avoid duplication
   - Detect your Git branch
   - Load project rules from CLAUDE.md
   - Start the spec workflow
```

### Continue Previous Work

```
Day 1:
- Start "user-authentication" feature
- Sam completes requirements phase
- Close VSCode

Day 2:
- Open VSCode
- See "user-authentication 🔄" in Spec Explorer
- Right-click → "Continue Sam Work"
- Sam resumes from where it left off
```

### View Progress

```
Right-click any spec with progress icon
→ Click "View Sam Progress"
→ Opens PROGRESS.md file
```

## How Sam Works

### Auto Context Gathering

Sam automatically collects:
- **Workspace path**: Current project location
- **Language preference**: From `~/.claude/CLAUDE.md` (Chinese/English)
- **Project rules**: From `CLAUDE.md` (coding standards)
- **Existing specs**: All specs in `.claude/specs/`
- **Git branch**: Current branch name

### Progress Tracking

Sam creates `PROGRESS.md` files in `.claude/specs/{feature_name}/`:
- Current phase (requirements/design/tasks/implementation)
- Completed phases
- In-progress tasks
- Blockers
- Decision records

### Visual Indicators

**Spec Tree Icons**:
- No icon = Regular spec (no Sam progress)
- 🔄 Spinning sync = Sam working
- ⚠️ Warning = Has blockers
- ✅ Check = Completed

**Tooltip Information**:
- Hover over any spec to see:
  - Current phase
  - Completed phases
  - In-progress tasks (up to 3)
  - Blockers (if any)
  - Recent decisions (up to 2)

## File Structure

```
.claude/specs/{feature_name}/
├── PROGRESS.md          # Sam's progress tracking
├── requirements.md      # Generated requirements
├── design.md           # Generated design
└── tasks.md            # Generated tasks
```

## Tips & Best Practices

1. **Let Sam handle context**: Don't manually specify paths or configs - Sam reads them automatically
2. **Review each phase**: Sam waits for your approval before proceeding to the next phase
3. **Use PROGRESS.md**: It's the source of truth for cross-session continuity
4. **Address blockers**: If Sam detects blockers, it will ask before continuing

## Troubleshooting

### "No progress found"
- Ensure `.claude/specs/{feature_name}/PROGRESS.md` exists
- Try refreshing Spec Explorer

### Progress not updating in tree
- Click the refresh button in Spec Explorer
- Reload VSCode window if issue persists

### "ProgressTracker not initialized"
- This is an internal error - reload VSCode
- Report to GitHub issues if it persists

## Next Steps

- See [README.md](../README.md) for installation
- See [CLAUDE.md](../CLAUDE.md) for project-specific configuration
- See system prompts in [.claude/system-prompts/](../.claude/system-prompts/)

---

**Version**: 0.2.9+ (Sam Integration)
**Last Updated**: 2025-01-18
