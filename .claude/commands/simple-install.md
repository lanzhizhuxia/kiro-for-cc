---
allowed-tools: Bash(npm:*), Bash(chmod:*), Bash(./scripts/*)
description: Simple build and install command
---

## Your task

Build and install the extension.

Please follow these steps:

1. Run: `chmod +x scripts/build-and-install.sh`

2. Ask the user which editor they want to install to (VSCode, Cursor, Both, or Auto-detect).

3. Run the appropriate command:
   - VSCode: `./scripts/build-and-install.sh vscode`
   - Cursor: `./scripts/build-and-install.sh cursor`
   - Both: `./scripts/build-and-install.sh both`
   - Auto: `./scripts/build-and-install.sh`

4. Report the results to the user.