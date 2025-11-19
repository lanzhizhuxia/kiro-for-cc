---
allowed-tools: Bash(npm:*), Bash(ls:*), Bash(./scripts/*)
description: Build the extension without installing
---

## Context

Working in Kiro for Claude Code extension directory.

## Your task

Build the Kiro for Claude Code extension into a .vsix package file without installing it.

**Steps:**

1. Compile TypeScript code:
   ```bash
   npm run compile
   ```

2. Build the VSIX package:
   ```bash
   npm run package
   ```

3. After successful build:
   - List any existing .vsix files to show the new package
   - The package will be named something like `kiro-for-cc-X.X.X.vsix`
   - Inform the user they can install it manually with:
     - `code --install-extension kiro-for-cc-*.vsix`
     - `cursor --install-extension kiro-for-cc-*.vsix`

**Error Handling:**

- If npm dependencies are missing, run: `npm install`
- If compilation fails, show the error and suggest checking TypeScript code
- If packaging fails, check if vsce is installed: `npm install -g vsce` or `npm install --save-dev vsce`

**Output:**

After successful build, show:
```
✅ Build completed successfully!

📦 Package: kiro-for-cc-{version}.vsix
📊 Size: {size}

To install manually:
  VSCode: code --install-extension kiro-for-cc-{version}.vsix
  Cursor: cursor --install-extension kiro-for-cc-{version}.vsix

Or use: /install
```

Make sure to provide clear feedback at each step.
