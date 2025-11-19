---
allowed-tools: Read
description: Show development workflow guide and available commands
---

## Kiro for Claude Code - Development Commands

Here are all available slash commands for developing this extension:

### 📦 Building & Installing

| Command | Description |
|---------|-------------|
| `/install` | Build and install the extension to VSCode/Cursor |
| `/build` | Build the .vsix package without installing |

### 🛠️ Development Workflow

| Command | Description |
|---------|-------------|
| `/dev` | Start development mode (watch + F5 instructions) |
| `/publish` | Publish a new version to the marketplace |

### 📚 Documentation

Quick reference for common development tasks:

#### Daily Development

```bash
# Start watch mode for auto-compilation
npm run watch

# Press F5 in VSCode
# Make changes
# Press Cmd+R / Ctrl+R in Extension Development Host to reload
```

#### Testing Full Installation

```bash
# Use the slash command
/install

# Or use npm script
npm run install:local
```

#### Building for Distribution

```bash
# Build .vsix file
/build

# Or use npm script
npm run package
```

#### Publishing New Version

```bash
# Publish to marketplace
/publish

# Follow the prompts to update version, changelog, etc.
```

### 🔧 NPM Scripts Reference

All available npm scripts:

```json
{
  "compile": "Build TypeScript once",
  "watch": "Auto-compile on file changes",
  "package": "Build .vsix file",
  "install:local": "Auto-detect and install",
  "install:vscode": "Install to VSCode only",
  "install:cursor": "Install to Cursor only",
  "install:both": "Install to both editors",
  "quick-update": "Quick compile for dev mode"
}
```

### 📖 Documentation Files

- [README.md](../../../README.md) - Main project documentation
- [QUICK_START.md](../../../QUICK_START.md) - Quick reference card
- [docs/LOCAL_INSTALL.md](../../../docs/LOCAL_INSTALL.md) - Detailed installation guide
- [docs/SAM_INTEGRATION.md](../../../docs/SAM_INTEGRATION.md) - Sam feature documentation
- [CLAUDE.md](../../../CLAUDE.md) - Project development guide

### 🎯 Common Workflows

**Starting a new feature:**
```bash
/dev          # Start watch mode
# Press F5
# Code your feature
# Cmd+R to reload
# Test and iterate
```

**Testing before commit:**
```bash
/install      # Install and test as end user
# Test all features
# If good, commit changes
```

**Preparing release:**
```bash
/build        # Build .vsix
# Test the .vsix file
/publish      # If all good, publish
```

### 💡 Tips

1. **Use `/dev` for daily development** - fastest iteration cycle
2. **Use `/install` before committing** - test as end user
3. **Use `/build` to verify packaging** - catches build issues
4. **Use `/publish` for releases** - automated version management

---

For more detailed information, see:
- `/install --help` (via script: `./scripts/build-and-install.sh --help`)
- [docs/LOCAL_INSTALL.md](../../../docs/LOCAL_INSTALL.md)
