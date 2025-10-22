#!/usr/bin/env node

/**
 * MCP Self-Improvement Demonstration
 * 
 * This script demonstrates the MCP's autonomous capabilities by:
 * 1. Running self-analysis
 * 2. Analyzing code quality
 * 3. Suggesting enhancements
 * 4. Optionally applying auto-fixes
 * 
 * Usage:
 *   node mcp-demo.js                    # Dry run (analysis only)
 *   node mcp-demo.js --apply-fixes      # Apply automatic fixes
 *   node mcp-demo.js --full-cycle       # Complete self-improvement cycle
 */

import { toolRegistry } from './dist/src/tools.js';
import { registerSelfImprovementTools } from './dist/src/self-improvement-tools.js';
import { analyticsEngine } from './dist/src/analytics-engine.js';
import { mcpMonitor } from './dist/src/mcp-monitor.js';
import { aggregationCache } from './dist/src/aggregation-cache.js';
import pino from 'pino';

const logger = pino({ 
  level: 'info',
  base: { service: 'mcp-demo' }
});

const args = process.argv.slice(2);
const applyFixes = args.includes('--apply-fixes') || args.includes('--full-cycle');
const fullCycle = args.includes('--full-cycle');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       MCP SELF-IMPROVEMENT DEMONSTRATION                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Register the self-improvement tools
logger.info('Registering self-improvement tools...');
registerSelfImprovementTools();

const registeredTools = [
  'mcp_self_analyze',
  'mcp_analyze_code_quality',
  'mcp_auto_fix',
  'mcp_suggest_enhancements'
];

logger.info({ tools: registeredTools }, 'Self-improvement tools registered');

async function runDemo() {
  try {
    // Step 1: Self-Analysis
    console.log('\n📊 STEP 1: MCP Self-Analysis');
    console.log('─'.repeat(60));
    
    const selfAnalyzeTool = toolRegistry.get('mcp_self_analyze');
    if (!selfAnalyzeTool) {
      throw new Error('mcp_self_analyze tool not found');
    }
    
    const analysisResult = await selfAnalyzeTool.handler({
      timeWindow: 3600000, // 1 hour
      includeRecommendations: true
    }, {
      agentId: 'mcp-demo',
      requestId: 'demo-001',
      permissions: ['system:read', 'analytics:read'],
      limits: {}
    });
    
    if (analysisResult.success) {
      const data = analysisResult.result;
      console.log('\n✓ Analysis Complete:');
      console.log(`  - Performance: ${data.performance.requests.total} requests, ${data.performance.activeAgents} active agents`);
      console.log(`  - Insights: ${data.insights.length} detected`);
      console.log(`  - Anomalies: ${data.anomalies}`);
      console.log(`  - Security Issues: ${data.securityIssues}`);
      console.log(`  - Cache Hit Rate: ${(data.cache.hitRate * 100).toFixed(1)}%`);
      console.log(`  - Time Saved by Cache: ${data.cache.timeSaved}ms`);
      
      if (data.recommendations && data.recommendations.length > 0) {
        console.log('\n  Recommendations:');
        data.recommendations.forEach((rec, i) => {
          console.log(`    ${i + 1}. [${rec.priority}] ${rec.type}: ${rec.message}`);
        });
      }
    } else {
      console.error('✗ Analysis failed:', analysisResult.error);
    }
    
    // Step 2: Code Quality Analysis
    console.log('\n\n🔍 STEP 2: Code Quality Analysis');
    console.log('─'.repeat(60));
    
    const codeQualityTool = toolRegistry.get('mcp_analyze_code_quality');
    if (!codeQualityTool) {
      throw new Error('mcp_analyze_code_quality tool not found');
    }
    
    const qualityResult = await codeQualityTool.handler({
      filePath: 'src/',
      checkTypes: ['complexity', 'security', 'performance']
    }, {
      agentId: 'mcp-demo',
      requestId: 'demo-002',
      permissions: ['file:read', 'system:read'],
      limits: {}
    });
    
    if (qualityResult.success) {
      const data = qualityResult.result;
      console.log('\n✓ Code Quality Scan Complete:');
      console.log(`  - Files Analyzed: ${data.filePath}`);
      console.log(`  - Checks Performed: ${data.checksPerformed.join(', ')}`);
      console.log(`  - Issues Found: ${data.issuesFound}`);
      console.log(`  - Critical Issues: ${data.summary.criticalCount}`);
      console.log(`  - Warnings: ${data.summary.warningCount}`);
      
      if (data.issues.length > 0) {
        console.log('\n  Top Issues:');
        data.issues.slice(0, 5).forEach((issue, i) => {
          console.log(`    ${i + 1}. [${issue.severity}] ${issue.type}: ${issue.message}`);
          if (issue.file) {
            console.log(`       File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
          }
        });
      }
    } else {
      console.error('✗ Code quality analysis failed:', qualityResult.error);
    }
    
    // Step 3: Enhancement Suggestions
    console.log('\n\n💡 STEP 3: Enhancement Suggestions');
    console.log('─'.repeat(60));
    
    const suggestTool = toolRegistry.get('mcp_suggest_enhancements');
    if (!suggestTool) {
      throw new Error('mcp_suggest_enhancements tool not found');
    }
    
    const suggestResult = await suggestTool.handler({
      focusAreas: ['performance', 'security', 'maintainability']
    }, {
      agentId: 'mcp-demo',
      requestId: 'demo-003',
      permissions: ['file:read', 'analytics:read'],
      limits: {}
    });
    
    if (suggestResult.success) {
      const data = suggestResult.result;
      console.log('\n✓ Suggestions Generated:');
      console.log(`  - Focus Areas: ${data.focusAreas.join(', ')}`);
      console.log(`  - Total Suggestions: ${data.suggestionsCount}`);
      
      if (data.suggestions.length > 0) {
        console.log('\n  Prioritized Suggestions:');
        data.suggestions.forEach((sugg, i) => {
          console.log(`    ${i + 1}. [${sugg.priority}] ${sugg.area}: ${sugg.title}`);
          console.log(`       ${sugg.description}`);
          console.log(`       → ${sugg.implementation}`);
        });
      }
    } else {
      console.error('✗ Suggestion generation failed:', suggestResult.error);
    }
    
    // Step 4: Auto-Fix (if requested)
    if (applyFixes) {
      console.log('\n\n🔧 STEP 4: Applying Auto-Fixes');
      console.log('─'.repeat(60));
      
      const autoFixTool = toolRegistry.get('mcp_auto_fix');
      if (!autoFixTool) {
        throw new Error('mcp_auto_fix tool not found');
      }
      
      const fixResult = await autoFixTool.handler({
        issueTypes: ['formatting', 'types'],
        dryRun: !fullCycle
      }, {
        agentId: 'mcp-demo',
        requestId: 'demo-004',
        permissions: ['file:write', 'file:read', 'system:execute'],
        limits: {}
      });
      
      if (fixResult.success) {
        const data = fixResult.result;
        console.log(`\n✓ Auto-Fix ${data.dryRun ? 'Preview' : 'Applied'}:`);
        console.log(`  - Dry Run: ${data.dryRun}`);
        console.log(`  - Fixes Applied: ${data.fixesApplied}`);
        
        if (data.fixes.length > 0) {
          console.log('\n  Fixes:');
          data.fixes.forEach((fix, i) => {
            console.log(`    ${i + 1}. [${fix.status}] ${fix.type}: ${fix.message}`);
            if (fix.details) {
              console.log(`       ${fix.details.substring(0, 100)}...`);
            }
          });
        }
      } else {
        console.error('✗ Auto-fix failed:', fixResult.error);
      }
    } else {
      console.log('\n\n🔧 STEP 4: Auto-Fix (Skipped)');
      console.log('─'.repeat(60));
      console.log('  Run with --apply-fixes to preview fixes');
      console.log('  Run with --full-cycle to apply fixes');
    }
    
    // Summary
    console.log('\n\n📈 SUMMARY');
    console.log('═'.repeat(60));
    console.log('✓ MCP Self-Improvement Demonstration Complete\n');
    
    if (!applyFixes) {
      console.log('💡 Next Steps:');
      console.log('  - Run with --apply-fixes to preview automatic fixes');
      console.log('  - Run with --full-cycle for complete autonomous improvement');
      console.log('  - Schedule regular runs via cron or GitHub Actions');
    } else if (!fullCycle) {
      console.log('💡 This was a dry run. Run with --full-cycle to apply fixes.');
    } else {
      console.log('✅ Full autonomous improvement cycle completed!');
    }
    
    console.log('\n📚 Documentation:');
    console.log('  - SELF_IMPROVEMENT_GUIDE.md - Complete guide');
    console.log('  - MCP_INTEGRATION_GUIDE.md - Integration details\n');
    
  } catch (error) {
    console.error('\n✗ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo
runDemo().then(() => {
  console.log('Demo completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});
