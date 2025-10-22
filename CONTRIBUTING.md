# Contributing to A2A MCP Server
Thank you for your interest in contributing to the A2A MCP Server project! This document provides guidelines and instructions for contributing.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Ownership](#code-ownership)
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
- Define types for function parameters and returns
- Use interfaces for complex objects

### Code Style
- Use ESLint for linting (`npm run lint`)
- Follow existing code patterns
- Use meaningful variable and function names
- Keep functions small and focused
- Avoid deep nesting (max 3 levels)

### Error Handling
- Always handle errors appropriately
- Use try-catch for async operations
- Log errors with context
- Return meaningful error messages

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples
```
feat(agents): add new capability for data processing
fix(server): resolve WebSocket connection timeout
docs(readme): update installation instructions
```

## Pull Request Process

1. **Before submitting**:
   - Update documentation
   - Add/update tests
   - Ensure all tests pass
   - Update CHANGELOG.md

2. **PR Description should include**:
   - Summary of changes
   - Related issues (use `Closes #123`)
   - Testing performed
   - Breaking changes (if any)
   - Screenshots (for UI changes)

3. Auto-merge conditions (for trusted contributors):
   - All checks pass
   - Required reviews completed
   - No merge conflicts
   - No blocking labels

## Code Ownership

### CODEOWNERS File
This repository uses a [CODEOWNERS](https://github.com/Scarmonit/A2A/blob/master/CODEOWNERS) file to define code ownership and automatically request reviews from the appropriate team members. The current code owners are:

- **@Scarmonit** - Repository owner and primary maintainer
- **@jules** - Co-owner with full review authority
- **@copilot** - AI assistant for automated reviews and suggestions

### Review Process
When you submit a pull request that modifies files covered by CODEOWNERS:

1. **Automatic Review Requests**: GitHub will automatically request reviews from the designated code owners based on which files you've changed.

2. **Required Approvals**: Pull requests typically require at least one approval from a code owner before merging, depending on the repository's branch protection rules.

3. **Code Owner Responsibilities**:
   - Review pull requests for their areas of ownership
   - Provide constructive feedback
   - Ensure code quality and consistency
   - Verify tests pass and documentation is updated

### Adding New Code Owners
If you believe additional code owners should be added for specific areas of the codebase:

1. Open an issue discussing the proposed change
2. Explain the rationale (e.g., domain expertise, active maintenance)
3. Tag existing code owners for review
4. Submit a PR updating the CODEOWNERS file after consensus

**Note**: CODEOWNERS is a review mechanism, not a permission system. Repository write access must be configured separately in GitHub settings.

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
