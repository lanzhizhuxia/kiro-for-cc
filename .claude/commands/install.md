---
allowed-tools: Bash(npm:*), Bash(chmod:*), Bash(./scripts/*)
description: Build and install the extension locally
---

## Context

Working in Kiro for Claude Code extension directory.

## Your task

Build and install the Kiro for Claude Code extension to the local editor.

**Steps:**

1. First, ensure the build script has execute permission:
   ```bash
   chmod +x scripts/build-and-install.sh
   ```

2. Ask the user which editor they want to install to:
   - VSCode
   - Cursor
   - Both editors
   - Auto-detect (let the script figure it out)

3. Run the installation script with the appropriate target:
   - For VSCode: `./scripts/build-and-install.sh vscode`
   - For Cursor: `./scripts/build-and-install.sh cursor`
   - For both: `./scripts/build-and-install.sh both`
   - For auto-detect: `./scripts/build-and-install.sh`

4. The script will:
   - Compile TypeScript code
   - Build the .vsix package
   - Detect available editors
   - Install to the selected editor(s)
   - Provide success/failure feedback

5. After successful installation:
   - Inform the user they need to restart their editor
   - Suggest they check the extension version to confirm it's updated
   - If the extension doesn't seem updated, suggest:
     - Disable the extension in Extensions panel
     - Wait 2 seconds
     - Re-enable the extension
     - Restart the editor

**Alternative: Development Mode**

If the user wants to develop without installing:
- Press F5 in VSCode to launch Extension Development Host
- This loads the extension in a separate test window
- Changes can be tested by pressing Cmd+R / Ctrl+R in the test window

**Error Handling:**

- If npm dependencies are missing: run `npm install`
- If compilation fails: show the error and suggest checking TypeScript syntax
- If installation fails: suggest manual installation with the generated .vsix file
- If script permission error: ensure chmod worked properly

Provide clear feedback at each step and explain what's happening.
