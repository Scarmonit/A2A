# Contributing to A2A MCP Server

Thank you for your interest in contributing to the A2A MCP Server project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/A2A.git
   cd A2A
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a branch** following our naming conventions:
   - `feature/<short-desc>[-<ticket>]` - for new features
   - `fix/<short-desc>[-<ticket>]` - for bug fixes
   - `chore/<short-desc>` - for maintenance tasks
   - `hotfix/<short-desc>` - for urgent fixes

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   ```bash
   npm run build
   npm run start
   ```

4. **Commit your changes** using conventional commits (see below)

5. **Push to your fork** and create a Pull Request

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Enable strict type checking
- Avoid using `any` type when possible
- Use interfaces for object shapes
- Use type guards for runtime type checking

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at the end of statements
- Maximum line length: 100 characters
- Use meaningful variable and function names

### File Organization

```
src/
├── index.ts          # Entry point
├── agents.ts         # Agent implementations
├── server.ts         # Server configuration
└── types/            # Type definitions
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <short summary>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```
feat(agents): add support for streaming responses

Implement WebSocket streaming for agent responses to improve
real-time communication capabilities.

Closes #123
```

```
fix(auth): resolve token refresh issue

Fix token refresh logic that was causing authentication failures
after extended sessions.

Closes #456
```

```
docs: update deployment instructions

BREAKING CHANGE: Changed environment variable names for consistency
```

## Pull Request Process

### Before Submitting

1. ✅ Ensure your code builds without errors
2. ✅ Run all tests and ensure they pass
3. ✅ Update documentation if needed
4. ✅ Add/update tests for your changes
5. ✅ Follow the coding standards
6. ✅ Update CHANGELOG.md with your changes

### PR Template

Your PR should include:

- **Summary**: Brief description of changes
- **Why**: Reason for the changes
- **What**: Key technical changes made
- **Testing**: How you tested the changes
- **Checklist**:
  - [ ] Lint passes
  - [ ] Build succeeds
  - [ ] Tests added/updated
  - [ ] Documentation updated
  - [ ] CHANGELOG.md updated

### Review Process

1. Automated checks must pass:
   - Linting
   - Build
   - Tests
   - Security scans

2. Code review by maintainers:
   - At least one approval required
   - Address all review comments

3. Auto-merge conditions (for trusted contributors):
   - All checks pass
   - Required reviews completed
   - No merge conflicts
   - No blocking labels

## Testing

### Running Tests

```bash
# Build the project
npm run build

# Start the server
npm run start

# In another terminal, run test scripts
node test-agent-ecosystem.js
node simple-agent-test.js
```

### Writing Tests

- Test files should be named: `test-*.js`
- Include both positive and negative test cases
- Test edge cases and error conditions
- Use descriptive test names

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex logic with inline comments
- Keep comments up to date with code changes

### Project Documentation

- Update README.md for user-facing changes
- Update deployment docs for infrastructure changes
- Add examples for new features

### Documentation Files

- `README.md` - Project overview and quick start
- `CHANGELOG.md` - Version history and changes
- `QUICK_DEPLOY.md` - Deployment instructions
- `OLLAMA_SETUP.md` - Ollama integration guide
- `YOUR_DEPLOYMENT.md` - Custom deployment guide

## Questions?

If you have questions or need help:

1. Check existing documentation
2. Search existing issues
3. Open a new issue with the `question` label
4. Tag maintainers if urgent

## License

By contributing to A2A MCP Server, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing! 🎉
