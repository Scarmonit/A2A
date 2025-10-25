# Linear MCP Usage Examples

## Overview
Examples demonstrating how to use the Linear MCP server for issue tracking, project management, and workflow automation.

## Prerequisites
- Linear API key configured in `config.json`
- MCP server installed and running
- Active Linear workspace

## Example 1: Create Issue

```javascript
// Create a new issue in Linear
const issue = await mcp.call('linear', {
  method: 'createIssue',
  teamId: 'YOUR_TEAM_ID',
  data: {
    title: 'Bug: Authentication fails on login',
    description: 'Users are unable to log in...',
    priority: 1,
    labels: ['bug', 'high-priority']
  }
});
```

## Example 2: Query Issues

```javascript
// Get all open issues assigned to a user
const issues = await mcp.call('linear', {
  method: 'getIssues',
  filter: {
    assignee: 'user@example.com',
    status: 'in_progress',
    priority: [1, 2]
  }
});
```

## Example 3: Update Issue Status

```javascript
// Update issue workflow status
const updated = await mcp.call('linear', {
  method: 'updateIssue',
  issueId: 'ISSUE_ID',
  data: {
    stateId: 'completed',
    comment: 'Resolved in PR #123'
  }
});
```

## Example 4: Project Management

```javascript
// Get project roadmap and milestones
const roadmap = await mcp.call('linear', {
  method: 'getProjects',
  teamId: 'YOUR_TEAM_ID',
  includeCompleted: false
});
```

## Best Practices

1. **Consistent Labels**: Use standardized labels across your team
2. **Priority Management**: Set appropriate priorities for triage
3. **Descriptions**: Include clear, detailed issue descriptions
4. **Linking**: Connect related issues and PRs
5. **Status Updates**: Keep issue statuses current

## Common Use Cases

- Automated issue creation from bug reports
- Sprint planning and management
- Issue triage automation
- Status synchronization with CI/CD
- Team workload balancing
