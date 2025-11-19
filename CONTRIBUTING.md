# Contributing to Kiro for Claude Code

We welcome contributions to the Kiro for Claude Code extension! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Issues

- Use the GitHub issue tracker
- Provide clear reproduction steps
- Include relevant logs and screenshots
- Specify your VSCode version and OS

### Submitting Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/kiro-for-cc.git
   cd kiro-for-cc
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Make your changes**
   - Follow the existing code style
   - Write clear, descriptive commit messages
   - Add tests for new functionality

5. **Run tests**
   ```bash
   npm test
   npm run test:coverage
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

7. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

8. **Create a Pull Request**
   - Provide a clear description of changes
   - Link related issues
   - Ensure CI checks pass

## Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Prettier (config: `.prettierrc`)
- **Linting**: ESLint (config: `.eslintrc.json`)
- **Naming**:
  - Classes: `PascalCase`
  - Functions/methods: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts` or `camelCase.ts`

### Code Quality Standards

- **Test Coverage**: Aim for 80%+ coverage for new code
- **Documentation**: Add JSDoc comments for public APIs
- **Error Handling**: All async operations should have try-catch blocks
- **Logging**: Use the provided OutputChannel for debugging

### Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(codex): add support for custom MCP tools
fix(security): prevent sensitive data leakage in logs
docs(architecture): update component diagrams
refactor(router): simplify complexity analysis logic
test(session): add integration tests for session recovery
```

## Project Structure

```
src/
├── extension.ts           # Extension entry point
├── constants.ts          # Configuration constants
├── features/            # Business logic
│   ├── codex/          # Codex workflow system
│   ├── spec/           # Spec management
│   └── steering/       # Steering documents
├── providers/          # VSCode TreeDataProviders
├── prompts/           # AI prompt templates
└── utils/             # Utility functions
```

## Testing

### Unit Tests

Located in `src/features/codex/__tests__/`

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- ComplexityAnalyzer  # Run specific test
```

### Integration Tests

Require a running MCP server:

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

## Extending the Codex System

### Adding New Complexity Rules

See: `docs/codex-architecture.md` - Section 5.1

### Adding New Security Rules

See: `docs/codex-architecture.md` - Section 5.2

### Integrating New MCP Tools

See: `docs/codex-architecture.md` - Section 5.3

## Documentation

- **Architecture**: `/Users/xuqian/workspace/kiro-for-cc/docs/codex-architecture.md`
- **Design Specs**: `.claude/specs/codex-workflow-orchestration/`
- **Code Comments**: Use JSDoc for public APIs

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a git tag
4. Push to GitHub
5. CI will build and publish

## Getting Help

- **Documentation**: Read `docs/codex-architecture.md`
- **Issues**: Check existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Recognition

Contributors will be acknowledged in the project README and release notes.

Thank you for contributing to Kiro for Claude Code!
