---
allowed-tools: Bash(npm:*), Bash(./scripts/*)
description: Quick development workflow - compile and prepare for F5 testing
---

## Context

Working in Kiro for Claude Code extension directory.

## Your task

Help the user with the development workflow for testing the extension.

**Workflow Options:**

### Option 1: Watch Mode (Recommended for Active Development)

Start continuous compilation on file changes:

```bash
npm run watch
```

Then:
1. Press **F5** in VSCode to launch Extension Development Host
2. A new VSCode window will open with the extension loaded
3. Make code changes in the original window
4. Press **Cmd+R** (macOS) or **Ctrl+R** (Windows/Linux) in the Extension Development Host to reload
5. Test your changes

**Benefits:**
- Auto-compilation on save
- Fast reload cycle
- No need to rebuild/reinstall

### Option 2: Quick Compile (One-time Test)

Compile once without watching:

```bash
npm run quick-update
```

Then follow the same F5 → Cmd+R workflow.

### Option 3: Full Install (Test as End User)

If you want to test the extension as an installed package:

```bash
/install
```

This will build and install the extension to your VSCode/Cursor.

**Recommendation:**

Start with watch mode for the best development experience. This will auto-compile on file changes, making the F5 → Cmd+R workflow much faster.

**Tips:**

1. **Console Logs**: Use `console.log()` in your TypeScript code and view output in:
   - Developer Tools: Help → Toggle Developer Tools → Console
   - Output Channel: "Kiro for Claude Code" in the Output panel

2. **Debugging**: Set breakpoints in your TypeScript code before pressing F5

3. **Extension Logs**: Check the "Kiro for Claude Code" output channel for detailed logs

4. **Stop Watch Mode**: Press Ctrl+C in the terminal running `npm run watch`

**Next Steps:**

Ask the user which workflow they prefer or automatically start watch mode and remind them to press F5.
