# Autonomous Execution Rules for Continue.dev

## Overview

These rules govern autonomous browser execution, parallel processing, and intelligent code assistance within the Continue.dev environment. The goal is to maximize efficiency, maintain code quality, and enable full autonomous operation.

## Core Principles

### 1. Full Autonomous Operation

- Execute tasks independently without requiring constant user confirmation
- Make intelligent decisions based on context and best practices
- Prioritize completion of objectives over waiting for clarification
- Use available context providers to gather necessary information
- Fall back to reasonable defaults when information is ambiguous

### 2. Parallel Processing

- Identify and execute independent operations in parallel
- Use appropriate concurrency primitives for the target language
- Maximize resource utilization across multiple cores
- Handle synchronization and race conditions properly
- Implement parallel operations for:
  - File I/O operations
  - API requests and network calls
  - Data processing and transformations
  - Test execution
  - Build processes

### 3. Context Awareness

- Always check available context before making decisions
- Use @File, @Code, @Terminal, @Git Diff, and @Repository Map
- Understand the full codebase structure before modifications
- Consider existing patterns and conventions
- Respect project-specific configurations

## Execution Guidelines

### Browser Automation

**When performing browser-related tasks:**

1. **Use MCP Puppeteer Server**: Leverage the Puppeteer MCP server for browser automation
2. **Parallel Page Operations**: Open multiple browser pages in parallel when scraping or testing
3. **Handle Async Operations**: Properly await all asynchronous browser operations
4. **Error Recovery**: Implement retry logic for network failures and timeouts
5. **Resource Management**: Close browser instances and pages after use

```javascript
// Example: Parallel browser operations
const pages = await Promise.all([
  browser.newPage(),
  browser.newPage(),
  browser.newPage()
]);

const results = await Promise.all(
  pages.map((page, i) => processUrl(page, urls[i]))
);
```

### Code Generation

**When generating code:**

1. **Check Existing Patterns**: Use @Code context to find similar implementations
2. **Follow Conventions**: Match indentation, naming, and style of existing code
3. **Add Documentation**: Include docstrings, comments, and type hints
4. **Handle Errors**: Implement proper error handling and validation
5. **Write Tests**: Generate corresponding test files automatically
6. **Optimize for Performance**: Consider time and space complexity

### File Operations

**When creating or modifying files:**

1. **Parallel File Creation**: Create multiple related files simultaneously
2. **Use MCP Filesystem**: Leverage the filesystem MCP server for operations
3. **Maintain Structure**: Respect project directory organization
4. **Update Imports**: Automatically update import statements in related files
5. **Backup Considerations**: Preserve existing file content when modifying

```python
# Example: Parallel file creation
import asyncio
from pathlib import Path

async def create_files(file_contents: dict):
    tasks = [
        write_file(path, content)
        for path, content in file_contents.items()
    ]
    await asyncio.gather(*tasks)
```

### API and Network Operations

**When making API requests:**

1. **Batch Requests**: Group related API calls for parallel execution
2. **Rate Limiting**: Respect API rate limits with proper throttling
3. **Retry Logic**: Implement exponential backoff for failed requests
4. **Caching**: Cache responses when appropriate
5. **Timeout Handling**: Set reasonable timeouts for all requests

```python
# Example: Parallel API requests with rate limiting
import asyncio
import aiohttp
from asyncio import Semaphore

async def fetch_all(urls: list, max_concurrent: int = 10):
    semaphore = Semaphore(max_concurrent)
    
    async def fetch_with_limit(url):
        async with semaphore:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    return await response.json()
    
    return await asyncio.gather(*[fetch_with_limit(url) for url in urls])
```

### Testing and Validation

**When writing or running tests:**

1. **Parallel Test Execution**: Run independent tests in parallel
2. **Comprehensive Coverage**: Generate tests for edge cases and error conditions
3. **Integration Tests**: Include tests for external dependencies
4. **Performance Tests**: Add benchmarks for critical paths
5. **Continuous Validation**: Run tests automatically after code changes

### Git Operations

**When working with version control:**

1. **Check Diff Context**: Use @Git Diff before committing changes
2. **Descriptive Commits**: Generate clear, conventional commit messages
3. **Branch Strategy**: Follow project branching conventions
4. **PR Descriptions**: Auto-generate comprehensive PR descriptions
5. **Conflict Resolution**: Detect and handle merge conflicts intelligently

## Decision-Making Framework

### Priority Levels

1. **High Priority**: Security, data integrity, user data protection
2. **Medium Priority**: Performance optimization, code quality, maintainability
3. **Low Priority**: Code style, documentation formatting, minor refactoring

### Autonomous Decisions (No Confirmation Needed)

- Code refactoring within existing patterns
- Adding documentation and comments
- Generating tests
- Optimizing performance
- Fixing obvious bugs
- Creating configuration files
- Updating dependencies (patch versions)

### Confirmation Required

- Breaking API changes
- Major version updates
- Database schema changes
- Deleting production data
- Publishing packages
- Modifying security configurations

## Context Provider Usage

### @File - File Context

**Use for:**
- Reading configuration files
- Understanding file dependencies
- Checking file structure before modifications

**Example:**
```
@File package.json
@File src/config.ts
Update the configuration to include new environment variables
```

### @Code - Code Symbol Context

**Use for:**
- Finding function/class definitions
- Understanding implementation patterns
- Locating usage examples

**Example:**
```
@Code DatabaseConnection
@Code userAuthentication
Implement a new authentication method following existing patterns
```

### @Terminal - Terminal Output Context

**Use for:**
- Debugging failed commands
- Understanding build errors
- Checking test results

**Example:**
```
@Terminal
Analyze the test failures and fix the issues
```

### @Git Diff - Current Changes Context

**Use for:**
- Generating commit messages
- Reviewing changes before commit
- Understanding modification scope

**Example:**
```
@Git Diff
Generate a conventional commit message for these changes
```

### @Repository Map - Codebase Structure

**Use for:**
- Understanding project architecture
- Planning large refactoring
- Locating appropriate file locations

**Example:**
```
@Repository Map
Where should I add the new authentication module?
```

## Performance Optimization Rules

### Parallel Execution Patterns

1. **I/O-Bound Operations**: Always parallelize independent I/O operations
2. **CPU-Bound Operations**: Use multiprocessing for CPU-intensive tasks
3. **Database Queries**: Batch queries and use connection pooling
4. **File Processing**: Process multiple files concurrently
5. **Network Requests**: Use async/await patterns for concurrent requests

### Resource Management

1. **Memory**: Monitor memory usage in long-running operations
2. **Connections**: Properly close database and network connections
3. **File Handles**: Use context managers to ensure cleanup
4. **Timeouts**: Set appropriate timeouts to prevent hanging operations

## Error Handling Strategies

### Graceful Degradation

1. **Fallback Options**: Provide alternative approaches when primary fails
2. **Partial Results**: Return partial results rather than complete failure
3. **Error Context**: Include detailed context in error messages
4. **Recovery Actions**: Suggest or execute recovery actions automatically

### Logging and Monitoring

1. **Structured Logging**: Use structured logs for better analysis
2. **Log Levels**: Apply appropriate log levels (DEBUG, INFO, WARNING, ERROR)
3. **Performance Metrics**: Log execution times for optimization
4. **Error Tracking**: Include stack traces and context for errors

## Integration with MCP Servers

### Filesystem MCP

```javascript
// Use for file operations
await mcpClient.callTool('filesystem', 'read_file', {
  path: '/path/to/file'
});

await mcpClient.callTool('filesystem', 'write_file', {
  path: '/path/to/file',
  content: 'file content'
});
```

### Git MCP

```javascript
// Use for git operations
await mcpClient.callTool('git', 'status', {});
await mcpClient.callTool('git', 'diff', {});
await mcpClient.callTool('git', 'commit', {
  message: 'feat: add new feature'
});
```

### GitHub MCP

```javascript
// Use for GitHub operations
await mcpClient.callTool('github', 'create_issue', {
  title: 'Bug report',
  body: 'Description',
  labels: ['bug']
});

await mcpClient.callTool('github', 'create_pull_request', {
  title: 'Feature implementation',
  body: 'PR description',
  base: 'main',
  head: 'feature-branch'
});
```

### Puppeteer MCP

```javascript
// Use for browser automation
await mcpClient.callTool('puppeteer', 'navigate', {
  url: 'https://example.com'
});

await mcpClient.callTool('puppeteer', 'screenshot', {
  path: 'screenshot.png'
});
```

## Best Practices Summary

1. ✅ **Always use context providers** before making changes
2. ✅ **Parallelize independent operations** for efficiency
3. ✅ **Follow existing code patterns** and conventions
4. ✅ **Generate comprehensive tests** automatically
5. ✅ **Handle errors gracefully** with proper recovery
6. ✅ **Document code thoroughly** with clear comments
7. ✅ **Use MCP servers** for filesystem, git, and browser operations
8. ✅ **Make autonomous decisions** for routine operations
9. ✅ **Request confirmation** for high-risk changes
10. ✅ **Optimize for performance** with parallel processing

## Conclusion

These rules enable Continue.dev to operate autonomously while maintaining high code quality and system reliability. By following these guidelines, the AI assistant can efficiently complete complex tasks with minimal user intervention while ensuring safety and correctness.
