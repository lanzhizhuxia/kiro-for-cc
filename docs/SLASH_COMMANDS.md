# Slash Commands Guide

Claude Code slash commands for Kiro for CC development.

## Available Commands

### `/install` - Build and Install

Build the extension and install it to VSCode/Cursor.

**Usage:**
```bash
/install
```

**What it does:**
1. Compiles TypeScript
2. Builds .vsix package
3. Detects available editors (VSCode/Cursor)
4. Asks which editor to install to
5. Installs the extension
6. Provides post-installation instructions

**Example interaction:**
```
You: /install

Claude: I'll build and install the extension. Let me check what's available...

✅ VSCode detected
✅ Cursor detected

Where would you like to install?
1. VSCode only
2. Cursor only
3. Both

You: 1

Claude: [runs ./scripts/build-and-install.sh vscode]

✅ Successfully installed to VSCode!

Please restart VSCode to load the new version.
```

---

### `/build` - Build Package Only

Build the .vsix package without installing.

**Usage:**
```bash
/build
```

**What it does:**
1. Compiles TypeScript
2. Builds .vsix package
3. Shows package info (filename, size)
4. Provides manual installation commands

**Example output:**
```
✅ Build completed successfully!

📦 Package: kiro-for-cc-0.2.9.vsix
📊 Size: 2.3 MB

To install manually:
  VSCode: code --install-extension kiro-for-cc-0.2.9.vsix
  Cursor: cursor --install-extension kiro-for-cc-0.2.9.vsix

Or use: /install
```

---

### `/dev` - Development Mode

Start development workflow with watch mode and F5 instructions.

**Usage:**
```bash
/dev
```

**What it does:**
1. Checks if watch process is already running
2. Starts `npm run watch` if needed
3. Provides F5 workflow instructions
4. Explains reload process (Cmd+R / Ctrl+R)

**Example output:**
```
🛠️ Starting development mode...

Watch process not running. Starting it now...
[runs npm run watch]

✅ Watch mode active - files will auto-compile on save

📋 Next steps:
1. Press F5 in VSCode to launch Extension Development Host
2. A new VSCode window will open with your extension loaded
3. Make changes to your code in the original window
4. Press Cmd+R (macOS) / Ctrl+R (Windows/Linux) in the Extension Development Host to reload

💡 Tips:
- View logs in: Output panel → "Kiro for Claude Code"
- Debug: Set breakpoints before pressing F5
- Stop watch: Press Ctrl+C in the terminal
```

---

### `/dev-help` - Show All Commands

Display all available development commands and workflows.

**Usage:**
```bash
/dev-help
```

**What it shows:**
- All available slash commands
- NPM scripts reference
- Common workflows
- Documentation links

---

### `/publish` - Publish New Version

Publish a new version to VSCode Marketplace (interactive workflow).

**Usage:**
```bash
/publish
```

**What it does:**
1. Checks for uncommitted changes
2. Asks for new version number
3. Generates changelog from git commits
4. Updates CHANGELOG.md, package.json, README files
5. Creates git commit and tag
6. Pushes to GitHub
7. GitHub Actions handles marketplace publishing

**Example interaction:**
```
You: /publish

Claude: Checking git status...
✅ Working directory clean

Current version: 0.2.9
What's the new version? (e.g., 0.3.0)

You: 0.3.0

Claude: Analyzing commits since v0.2.9...

Generated changelog:
- Added Sam integration with progress tracking
- Improved build automation with scripts
- Added slash commands for development

Proceed with publishing? (yes/no)

You: yes

Claude: [Updates files, commits, creates tag, pushes]

✅ Version 0.3.0 published!

GitHub Actions will build and publish to the marketplace.
Monitor: https://github.com/notdp/kiro-for-cc/actions
```

---

## Command Comparison

| Task | Slash Command | NPM Script | Manual |
|------|---------------|------------|--------|
| Build & Install | `/install` | `npm run install:local` | Compile → Package → Install |
| Build Only | `/build` | `npm run package` | `npm run compile && vsce package` |
| Development | `/dev` | `npm run watch` + F5 | Manual watch + F5 |
| Publish | `/publish` | Manual steps | Many manual steps |

## Tips

### When to use what?

**Daily Development:**
```bash
/dev    # Start once, then just F5 and Cmd+R
```

**Testing before commit:**
```bash
/install    # Full build and install to test as end user
```

**Building for distribution:**
```bash
/build    # Create .vsix for sharing
```

**Releasing:**
```bash
/publish    # Automated version bump and publish
```

### Workflow Examples

**Starting work on a new feature:**
```bash
/dev
# Press F5
# Code your feature
# Cmd+R to reload and test
# Repeat
```

**Testing before pushing:**
```bash
/install
# Test all functionality in real VSCode/Cursor
# If good, commit and push
```

**Preparing a release:**
```bash
/build         # Verify packaging works
# Test the .vsix manually
/publish       # If all good, publish
```

## Behind the Scenes

Each slash command is defined in `.claude/commands/{name}.md`:

```
.claude/commands/
├── install.md      # /install command
├── build.md        # /build command
├── dev.md          # /dev command
├── dev-help.md     # /dev-help command
└── publish.md      # /publish command
```

These files contain:
- Allowed tools (bash, npm, etc.)
- Context information (current version, git status)
- Task description for Claude
- Error handling instructions

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [LOCAL_INSTALL.md](./LOCAL_INSTALL.md) - Detailed installation guide
- [QUICK_START.md](../QUICK_START.md) - Quick reference
- [SAM_INTEGRATION.md](./SAM_INTEGRATION.md) - Sam features

---

**Version**: 0.2.9+
**Last Updated**: 2025-01-18
