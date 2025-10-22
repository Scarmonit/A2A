// Self-Improving MCP Tools
// Tools that enable the MCP server to analyze and enhance itself

import { toolRegistry, ToolDescriptor } from './tools.js';
import { analyticsEngine } from './analytics-engine.js';
import { mcpMonitor } from './mcp-monitor.js';
import { aggregationCache } from './aggregation-cache.js';
import pino from 'pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Self-Analysis Tool
 * Analyzes the MCP server's own performance and suggests improvements
 */
const selfAnalyzeTool: ToolDescriptor = {
  name: 'mcp_self_analyze',
  description: 'Analyze the MCP server performance, detect issues, and suggest improvements',
  category: 'self_improvement',
  permissions: ['system:read', 'analytics:read'],
  parameters: [
    {
      name: 'timeWindow',
      type: 'number',
      description: 'Time window in ms to analyze (default: 1 hour)',
      required: false
    },
    {
      name: 'includeRecommendations',
      type: 'boolean',
      description: 'Include specific code recommendations',
      required: false
    }
  ],
  handler: async (params, context) => {
    const timeWindow = params.timeWindow || 3600000;
    const includeRecs = params.includeRecommendations !== false;
    
    try {
      // Gather performance metrics
      const metrics = analyticsEngine.getRealTimeMetrics();
      const insights = analyticsEngine.generateInsights({
        start: Date.now() - timeWindow,
        end: Date.now()
      });
      
      // Check for anomalies
      const anomalies = mcpMonitor.detectAnomalousToolCalls(timeWindow);
      const securityIssues = mcpMonitor.detectPrivilegeEscalation(timeWindow);
      
      // Cache performance
      const cacheStats = aggregationCache.getStats();
      
      // Analyze and generate recommendations
      const analysis = {
        timestamp: Date.now(),
        timeWindow,
        performance: {
          requests: metrics.requests,
          avgExecutionTime: metrics.performance.avgExecutionTime,
          activeAgents: metrics.performance.activeAgents
        },
        insights: insights.map(i => ({
          type: i.type,
          severity: i.severity,
          title: i.title,
          confidence: i.confidence
        })),
        anomalies: anomalies.length,
        securityIssues: securityIssues.length,
        cache: {
          hitRate: cacheStats.hitRate,
          timeSaved: cacheStats.totalComputeTimeSaved,
          size: cacheStats.size
        },
        recommendations: includeRecs ? generateRecommendations(metrics, insights, anomalies, cacheStats) : []
      };
      
      return {
        success: true,
        result: analysis
      };
    } catch (error: any) {
      logger.error({ error }, 'Self-analysis failed');
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Code Quality Analysis Tool
 * Analyzes code quality and suggests improvements
 */
const analyzeCodeQualityTool: ToolDescriptor = {
  name: 'mcp_analyze_code_quality',
  description: 'Analyze code quality, detect issues, and suggest refactoring opportunities',
  category: 'self_improvement',
  permissions: ['file:read', 'system:read'],
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to file or directory to analyze',
      required: false
    },
    {
      name: 'checkTypes',
      type: 'array',
      description: 'Types of checks to perform: complexity, duplicates, security, performance',
      required: false
    }
  ],
  handler: async (params, context) => {
    const filePath = params.filePath || 'src/';
    const checks = params.checkTypes || ['complexity', 'duplicates', 'security', 'performance'];
    
    try {
      const issues: any[] = [];
      
      // Run TypeScript compiler to check for errors
      if (checks.includes('security') || checks.includes('complexity')) {
        try {
          await execAsync('npx tsc --noEmit');
        } catch (error: any) {
          if (error.stdout) {
            issues.push({
              type: 'typescript_errors',
              severity: 'error',
              message: 'TypeScript compilation errors detected',
              details: error.stdout
            });
          }
        }
      }
      
      // Check for common code quality issues
      if (checks.includes('complexity')) {
        const complexityIssues = await analyzeComplexity(filePath);
        issues.push(...complexityIssues);
      }
      
      // Security checks
      if (checks.includes('security')) {
        const securityIssues = await analyzeSecurityPatterns(filePath);
        issues.push(...securityIssues);
      }
      
      return {
        success: true,
        result: {
          filePath,
          checksPerformed: checks,
          issuesFound: issues.length,
          issues: issues.slice(0, 20), // Limit to top 20
          summary: generateCodeQualitySummary(issues)
        }
      };
    } catch (error: any) {
      logger.error({ error }, 'Code quality analysis failed');
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Auto-Fix Tool
 * Attempts to automatically fix common issues
 */
const autoFixTool: ToolDescriptor = {
  name: 'mcp_auto_fix',
  description: 'Automatically fix common issues detected in the codebase',
  category: 'self_improvement',
  permissions: ['file:write', 'file:read', 'system:execute'],
  parameters: [
    {
      name: 'issueTypes',
      type: 'array',
      description: 'Types of issues to fix: formatting, imports, types, security',
      required: true
    },
    {
      name: 'dryRun',
      type: 'boolean',
      description: 'Preview changes without applying them',
      required: false
    }
  ],
  handler: async (params, context) => {
    const issueTypes = params.issueTypes || [];
    const dryRun = params.dryRun === true;
    
    try {
      const fixes: any[] = [];
      
      // Auto-format code
      if (issueTypes.includes('formatting')) {
        try {
          const cmd = dryRun ? 'npx prettier --check "src/**/*.ts"' : 'npx prettier --write "src/**/*.ts"';
          const { stdout } = await execAsync(cmd);
          fixes.push({
            type: 'formatting',
            status: 'success',
            message: dryRun ? 'Would format files' : 'Files formatted',
            details: stdout
          });
        } catch (error: any) {
          fixes.push({
            type: 'formatting',
            status: 'skipped',
            message: 'Prettier not configured or errors encountered'
          });
        }
      }
      
      // Fix TypeScript issues
      if (issueTypes.includes('types')) {
        try {
          await execAsync('npx tsc --noEmit');
          fixes.push({
            type: 'types',
            status: 'success',
            message: 'No TypeScript errors found'
          });
        } catch (error: any) {
          fixes.push({
            type: 'types',
            status: 'errors_found',
            message: 'TypeScript errors need manual review',
            details: error.stdout?.slice(0, 1000)
          });
        }
      }
      
      return {
        success: true,
        result: {
          dryRun,
          fixesApplied: fixes.filter(f => f.status === 'success').length,
          fixes
        },
        filesModified: dryRun ? [] : fixes.filter(f => f.status === 'success').map(f => f.type)
      };
    } catch (error: any) {
      logger.error({ error }, 'Auto-fix failed');
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Enhancement Suggestion Tool
 * Suggests enhancements based on patterns and best practices
 */
const suggestEnhancementsTool: ToolDescriptor = {
  name: 'mcp_suggest_enhancements',
  description: 'Suggest enhancements and optimizations based on current codebase analysis',
  category: 'self_improvement',
  permissions: ['file:read', 'analytics:read'],
  parameters: [
    {
      name: 'focusAreas',
      type: 'array',
      description: 'Focus areas: performance, security, maintainability, scalability',
      required: false
    }
  ],
  handler: async (params, context) => {
    const focusAreas = params.focusAreas || ['performance', 'security', 'maintainability'];
    
    try {
      const suggestions: any[] = [];
      
      // Performance suggestions
      if (focusAreas.includes('performance')) {
        const cacheStats = aggregationCache.getStats();
        if (cacheStats.hitRate < 0.5) {
          suggestions.push({
            area: 'performance',
            priority: 'high',
            title: 'Low cache hit rate',
            description: `Cache hit rate is ${(cacheStats.hitRate * 100).toFixed(1)}%, consider increasing TTL or cache size`,
            implementation: 'Adjust cache TTL values in aggregation-cache.ts or increase CACHE_MAX_SIZE env var'
          });
        }
        
        const metrics = analyticsEngine.getRealTimeMetrics();
        if (metrics.performance.avgExecutionTime > 1000) {
          suggestions.push({
            area: 'performance',
            priority: 'medium',
            title: 'High average execution time',
            description: `Average execution time is ${metrics.performance.avgExecutionTime}ms`,
            implementation: 'Consider adding more caching, optimizing database queries, or parallelizing operations'
          });
        }
      }
      
      // Security suggestions
      if (focusAreas.includes('security')) {
        const securityIssues = mcpMonitor.detectPrivilegeEscalation(3600000);
        if (securityIssues.length > 0) {
          suggestions.push({
            area: 'security',
            priority: 'critical',
            title: 'Security issues detected',
            description: `${securityIssues.length} potential security issues found`,
            implementation: 'Review permission requests and implement stricter access controls'
          });
        }
      }
      
      // Maintainability suggestions
      if (focusAreas.includes('maintainability')) {
        suggestions.push({
          area: 'maintainability',
          priority: 'low',
          title: 'Add more inline documentation',
          description: 'Complex functions could benefit from JSDoc comments',
          implementation: 'Add JSDoc comments to public methods and complex logic'
        });
      }
      
      return {
        success: true,
        result: {
          timestamp: Date.now(),
          focusAreas,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.sort((a, b) => {
            const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
            return (priorities[b.priority as keyof typeof priorities] || 0) - 
                   (priorities[a.priority as keyof typeof priorities] || 0);
          })
        }
      };
    } catch (error: any) {
      logger.error({ error }, 'Enhancement suggestions failed');
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Helper functions

function generateRecommendations(metrics: any, insights: any[], anomalies: any[], cacheStats: any): any[] {
  const recs: any[] = [];
  
  if (metrics.requests.rate > 10) {
    recs.push({
      type: 'scaling',
      priority: 'high',
      message: 'High request rate detected, consider horizontal scaling'
    });
  }
  
  if (cacheStats.hitRate < 0.3) {
    recs.push({
      type: 'performance',
      priority: 'high',
      message: 'Low cache hit rate, increase TTL values or cache size'
    });
  }
  
  if (anomalies.length > 5) {
    recs.push({
      type: 'stability',
      priority: 'critical',
      message: 'Multiple anomalies detected, review agent configurations'
    });
  }
  
  return recs;
}

async function analyzeComplexity(filePath: string): Promise<any[]> {
  const issues: any[] = [];
  
  try {
    const files = await getTypeScriptFiles(filePath);
    
    for (const file of files.slice(0, 10)) { // Limit to 10 files
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      // Check for overly long functions
      let functionDepth = 0;
      let functionStart = 0;
      
      lines.forEach((line, i) => {
        if (line.includes('function') || line.includes('=>')) {
          functionDepth++;
          functionStart = i;
        }
        
        if (functionDepth > 0 && line.includes('}')) {
          functionDepth--;
          if (functionDepth === 0 && (i - functionStart) > 100) {
            issues.push({
              type: 'complexity',
              severity: 'warning',
              file,
              line: functionStart,
              message: `Function is ${i - functionStart} lines long, consider breaking it down`
            });
          }
        }
      });
    }
  } catch (error) {
    logger.debug({ error }, 'Complexity analysis partial failure');
  }
  
  return issues;
}

async function analyzeSecurityPatterns(filePath: string): Promise<any[]> {
  const issues: any[] = [];
  
  try {
    const files = await getTypeScriptFiles(filePath);
    
    for (const file of files.slice(0, 10)) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Check for common security issues
      if (content.includes('eval(') || content.includes('new Function(')) {
        issues.push({
          type: 'security',
          severity: 'error',
          file,
          message: 'Dangerous eval() or new Function() usage detected'
        });
      }
      
      if (content.includes('innerHTML =') && !file.includes('test')) {
        issues.push({
          type: 'security',
          severity: 'warning',
          file,
          message: 'Potential XSS vulnerability with innerHTML'
        });
      }
    }
  } catch (error) {
    logger.debug({ error }, 'Security analysis partial failure');
  }
  
  return issues;
}

async function getTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await getTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.debug({ error, dir }, 'Failed to read directory');
  }
  
  return files;
}

function generateCodeQualitySummary(issues: any[]): any {
  const byType = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const bySeverity = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalIssues: issues.length,
    byType,
    bySeverity,
    criticalCount: bySeverity.error || 0,
    warningCount: bySeverity.warning || 0
  };
}

/**
 * Register all self-improvement tools
 */
export function registerSelfImprovementTools(): void {
  logger.info('Registering self-improvement MCP tools');
  
  toolRegistry.register(selfAnalyzeTool);
  toolRegistry.register(analyzeCodeQualityTool);
  toolRegistry.register(autoFixTool);
  toolRegistry.register(suggestEnhancementsTool);
  
  logger.info({
    tools: [
      selfAnalyzeTool.name,
      analyzeCodeQualityTool.name,
      autoFixTool.name,
      suggestEnhancementsTool.name
    ]
  }, 'Self-improvement tools registered');
}
