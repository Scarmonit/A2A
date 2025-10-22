# MCP Self-Improvement - Quick Start Guide

## What This Does

The A2A MCP Server can **analyze and improve itself autonomously**. This demonstrates the MCP's self-improvement capabilities in action.

## Quick Demo

### 1. Basic Analysis (Safe - Read Only)

```bash
node mcp-demo.js
```

This will:
- ✅ Analyze MCP server performance
- ✅ Scan codebase for quality issues
- ✅ Generate enhancement suggestions
- ❌ No changes made to files

**Example Output:**
```
╔══════════════════════════════════════════════════════════════╗
║       MCP SELF-IMPROVEMENT DEMONSTRATION                     ║
╚══════════════════════════════════════════════════════════════╝

📊 STEP 1: MCP Self-Analysis
✓ Analysis Complete:
  - Performance: 0 requests, 0 active agents
  - Cache Hit Rate: 0.0%
  - Recommendations: 1

🔍 STEP 2: Code Quality Analysis
✓ Code Quality Scan Complete:
  - Issues Found: 0
  - Critical Issues: 0

💡 STEP 3: Enhancement Suggestions
✓ Suggestions Generated:
  1. [high] performance: Low cache hit rate
  2. [low] maintainability: Add more inline documentation

🔧 STEP 4: Auto-Fix (Skipped)
  Run with --apply-fixes to preview fixes
```

### 2. Preview Auto-Fixes (Dry Run)

```bash
node mcp-demo.js --apply-fixes
```

This will:
- ✅ Run full analysis
- ✅ Preview what would be fixed
- ❌ No actual changes made

### 3. Apply Fixes (Full Cycle)

```bash
node mcp-demo.js --full-cycle
```

This will:
- ✅ Analyze everything
- ✅ Apply automatic fixes
- ✅ Format code
- ✅ Fix type errors
- ✅ Make actual changes

**⚠️ Warning**: This will modify files! Commit your work first.

## Automated Continuous Improvement

### Using GitHub Actions

The MCP can run autonomously via GitHub Actions:

1. **Scheduled Analysis** - Runs every 6 hours automatically
2. **Manual Trigger** - Run on-demand from GitHub UI
3. **Auto-commit** - Commits improvements back to repo

**Setup:**

The workflow is already configured in `.github/workflows/mcp-self-improvement.yml`

**Manual Trigger:**
1. Go to GitHub Actions tab
2. Select "MCP Self-Improvement Cycle"
3. Click "Run workflow"
4. Choose options:
   - ☐ Apply fixes (preview only)
   - ☐ Full cycle (apply changes)

### Using Cron

```bash
# Add to crontab for hourly self-improvement
0 * * * * cd /path/to/A2A && node mcp-demo.js --full-cycle >> /var/log/mcp-improvement.log 2>&1
```

## What Gets Analyzed

### Performance Metrics
- Request rates and latency
- Agent execution times
- Cache hit rates
- Memory usage
- Active agents

### Code Quality
- **Complexity**: Long functions, deep nesting
- **Security**: XSS vulnerabilities, unsafe patterns
- **Performance**: Inefficient loops, redundant computations
- **TypeScript**: Type errors and inconsistencies

### Security Auditing
- Permission requests
- Privilege escalation attempts
- Anomalous patterns
- Access violations

## What Gets Fixed Automatically

✅ **Safe to Auto-Fix:**
- Code formatting (Prettier)
- Import organization
- TypeScript type errors (simple cases)
- Linting issues

❌ **Requires Manual Review:**
- Breaking changes
- Algorithm modifications
- Security-critical changes
- Complex refactoring

## Integration with MCP Tools

The demo uses these MCP tools:

### 1. `mcp_self_analyze`
Analyzes server performance and generates recommendations.

### 2. `mcp_analyze_code_quality`
Scans codebase for issues:
- Complexity problems
- Security vulnerabilities
- Performance bottlenecks

### 3. `mcp_auto_fix`
Automatically fixes common issues:
- Formatting
- Imports
- Type errors

### 4. `mcp_suggest_enhancements`
Proactively suggests improvements:
- Performance optimizations
- Security enhancements
- Maintainability improvements

## Configuration

### Environment Variables

```bash
# MCP Monitor settings
export MCP_MONITOR_MAX_HISTORY_SIZE=10000

# Cache settings
export CACHE_MAX_SIZE=1000

# Self-improvement settings
export SELF_IMPROVEMENT_ENABLED=true
export AUTO_FIX_ENABLED=true
```

### Custom Analysis

Modify `mcp-demo.js` to customize:

```javascript
// Focus on specific areas
const suggestResult = await suggestTool.handler({
  focusAreas: ['security', 'performance']  // Add/remove as needed
}, context);

// Check specific code paths
const qualityResult = await codeQualityTool.handler({
  filePath: 'src/agents/',  // Target specific directory
  checkTypes: ['security']   // Focus on security only
}, context);
```

## Monitoring Results

### Logs

All operations are logged:

```bash
# View logs
cat /var/log/mcp-improvement.log

# Follow live
tail -f /var/log/mcp-improvement.log
```

### Metrics

Track improvement over time:

```bash
# Generate metrics report
node mcp-demo.js > report_$(date +%Y%m%d).txt

# Compare over time
diff report_20241022.txt report_20241023.txt
```

## Safety Features

### Read-Only by Default
Analysis never modifies files unless explicitly requested.

### Dry Run Mode
Preview all changes before applying:
```bash
node mcp-demo.js --apply-fixes  # Shows what would change
```

### Incremental Fixes
Fixes are applied one category at a time:
1. Formatting
2. Imports
3. Types
4. (Manual review for others)

### Rollback
All changes are made via Git:
```bash
# Undo last improvement
git revert HEAD

# See what changed
git diff HEAD~1
```

## Troubleshooting

### "Tool not found" Error

```bash
# Rebuild the project
npm run build

# Verify tools are registered
node -e "
import('./dist/src/self-improvement-tools.js').then(mod => {
  console.log('Available:', Object.keys(mod));
});
"
```

### "Permission denied" Error

```bash
# Make demo executable
chmod +x mcp-demo.js

# Or run with node explicitly
node mcp-demo.js
```

### No Issues Found

This is good! It means:
- Code quality is high
- No obvious improvements needed
- MCP is running smoothly

### Too Many Issues

Focus on critical issues first:

```javascript
// In mcp-demo.js, filter by severity
const criticalIssues = data.issues.filter(i => i.severity === 'error');
```

## Examples

### Example 1: Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running MCP self-check..."
node mcp-demo.js

if [ $? -ne 0 ]; then
  echo "MCP self-check failed! Fix issues before committing."
  exit 1
fi
```

### Example 2: CI/CD Integration

```yaml
# .github/workflows/ci.yml
- name: MCP Self-Check
  run: node mcp-demo.js
  
- name: Fail on critical issues
  run: |
    node mcp-demo.js | grep -q "Critical Issues: 0" || exit 1
```

### Example 3: Scheduled Improvement

```bash
#!/bin/bash
# weekly-improvement.sh

# Full analysis and fix cycle
node mcp-demo.js --full-cycle

# Commit if changes were made
if [[ -n $(git status -s) ]]; then
  git add -A
  git commit -m "🤖 Weekly MCP improvements"
  git push
fi
```

## Advanced Usage

### Programmatic Access

```javascript
import { toolRegistry } from './dist/src/tools.js';
import { registerSelfImprovementTools } from './dist/src/self-improvement-tools.js';

// Register tools
registerSelfImprovementTools();

// Use in your code
const tool = toolRegistry.get('mcp_self_analyze');
const result = await tool.handler({ timeWindow: 3600000 }, context);

if (result.success) {
  console.log('Analysis:', result.result);
}
```

### Custom Tools

Extend the MCP with your own improvement tools:

```javascript
// my-custom-tool.ts
export const myCustomTool = {
  name: 'my_custom_analyzer',
  description: 'Custom analysis tool',
  category: 'self_improvement',
  permissions: ['file:read'],
  parameters: [...],
  handler: async (params, context) => {
    // Your custom logic
    return { success: true, result: {...} };
  }
};

// Register it
toolRegistry.register(myCustomTool);
```

## Documentation

- **[SELF_IMPROVEMENT_GUIDE.md](./SELF_IMPROVEMENT_GUIDE.md)** - Complete guide to autonomous capabilities
- **[MCP_INTEGRATION_GUIDE.md](./MCP_INTEGRATION_GUIDE.md)** - How to integrate with MCP ecosystem
- **[README_DASHBOARD.md](./README_DASHBOARD.md)** - Dashboard documentation

## Support

Issues? Questions?
1. Check the logs
2. Read the documentation
3. Open a GitHub issue

---

**Status**: ✅ Fully functional and production-ready  
**Safety**: Protected with dry-run mode and rollback capability  
**Automation**: GitHub Actions workflow included
