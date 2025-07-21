---
allowed-tools: Bash(git *), Bash(npm version:*), Bash(node:*), Edit
description: Publish a new version of the extension
---

## Context

- Current git status: !`git status --porcelain`
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Recent tags: !`git tag --sort=-version:refname | head -5`

## Your task

Help the user publish a new version of the extension by:

1. First check if there are uncommitted changes. If yes, abort with a warning.
2. Ask the user for the new version number (show current version).
3. Get the previous version tag and analyze commits since then to generate a changelog.
4. Update package.json version using `npm version X.X.X --no-git-tag-version`.
5. Commit the version bump with message "chore: bump version to X.X.X" - IMPORTANT: Always add both package.json AND package-lock.json to the commit.
6. Create an annotated tag `vX.X.X` with a detailed message that includes:
   - First line: "Release vX.X.X"
   - Empty line
   - Generated changelog with sections for New Features, Bug Fixes, and Improvements
7. Push both the commit and tag to origin.
8. Inform the user that GitHub Actions will handle the rest.

Make sure to handle errors gracefully and provide clear feedback at each step.