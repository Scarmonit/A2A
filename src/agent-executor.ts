import { AgentDescriptor, agentRegistry } from './agents.js';
import { practicalToolRegistry } from './practical-tools.js';
import { ToolExecutionContext } from './tools.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'agent-executor' } });

export interface AgentExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolsUsed: string[];
  executionTime: number;
  changes: {
    filesCreated?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    networkRequests?: number;
    systemCalls?: number;
  };
}

export class AgentExecutor {
  async executeAgent(
    agentId: string, 
    capability: string, 
    input: any, 
    context: ToolExecutionContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const changes = {
      filesCreated: [] as string[],
      filesModified: [] as string[],
      filesDeleted: [] as string[],
      networkRequests: 0,
      systemCalls: 0
    };

    try {
      const agent = agentRegistry.get(agentId);
      if (!agent) {
        return {
          success: false,
          error: `Agent ${agentId} not found`,
          toolsUsed,
          executionTime: Date.now() - startTime,
          changes
        };
      }

      const cap = agent.capabilities.find(c => c.name === capability);
      if (!cap) {
        return {
          success: false,
          error: `Capability ${capability} not found on agent ${agentId}`,
          toolsUsed,
          executionTime: Date.now() - startTime,
          changes
        };
      }

      logger.info({ agentId, capability }, 'Executing agent capability');

      // Execute based on agent type and capability
      const result = await this.executeCapability(agent, capability, input, context, toolsUsed, changes);

      return {
        success: true,
        result,
        toolsUsed,
        executionTime: Date.now() - startTime,
        changes
      };
    } catch (error) {
      logger.error({ error, agentId, capability }, 'Agent execution failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolsUsed,
        executionTime: Date.now() - startTime,
        changes
      };
    }
  }

  private async executeCapability(
    agent: AgentDescriptor,
    capability: string,
    input: any,
    context: ToolExecutionContext,
    toolsUsed: string[],
    changes: any
  ): Promise<any> {
    const agentCategory = agent.category || 'general';
    
    // Map agent capabilities to practical tools
    switch (capability) {
      case 'scrape_website':
        return await this.executeTool('scrape_website_advanced', {
          urls: input.urls || [],
          selectors: input.selectors || {},
          options: input.options || {},
          outputFile: input.outputFile
        }, context, toolsUsed, changes);

      case 'generate_content':
        return await this.executeTool('generate_content_advanced', {
          contentType: input.contentType || 'article',
          topic: input.topic || 'AI Technology',
          keywords: input.keywords || [],
          tone: input.tone || 'professional',
          length: input.length || 'medium',
          outputFile: input.outputFile
        }, context, toolsUsed, changes);

      case 'analyze_data':
        return await this.executeTool('analyze_data_comprehensive', {
          dataSource: input.dataSource || { type: 'file', path: 'data.csv', format: 'csv' },
          analysisTypes: input.analysisTypes || ['descriptive'],
          columns: input.columns || [],
          outputOptions: input.outputOptions || {}
        }, context, toolsUsed, changes);

      case 'test_api':
        return await this.executeTool('test_api_comprehensive', {
          apiSpec: input.apiSpec || {},
          testSuites: input.testSuites || [],
          options: input.options || {}
        }, context, toolsUsed, changes);

      case 'monitor_system':
        return await this.executeTool('monitor_system_advanced', {
          checks: input.checks || { memory: true, disk: true },
          alertThresholds: input.alertThresholds || {},
          outputFile: input.outputFile
        }, context, toolsUsed, changes);

      case 'process_files':
        return await this.executeTool('process_files_batch', {
          pattern: input.pattern || '*',
          operations: input.operations || [{ type: 'copy' }],
          outputDir: input.outputDir
        }, context, toolsUsed, changes);

      case 'security_scan':
        return await this.simulateSecurityScan(input, context, toolsUsed, changes);

      case 'manage_deployment':
        return await this.simulateDeployment(input, context, toolsUsed, changes);

      case 'chat':
        // Echo capability for basic testing
        return this.simulateChat(input, context);

      // Generic capability execution
      default:
        return await this.executeGenericCapability(agent, capability, input, context, toolsUsed, changes);
    }
  }

  private async executeTool(
    toolName: string,
    params: any,
    context: ToolExecutionContext,
    toolsUsed: string[],
    changes: any
  ): Promise<any> {
    toolsUsed.push(toolName);
    const result = await practicalToolRegistry.execute(toolName, params, context);
    
    // Track changes based on tool result
    if (result.success && result.result) {
      if (result.result.filesCreated) {
        changes.filesCreated.push(...result.result.filesCreated);
      }
      if (result.result.filesModified) {
        changes.filesModified.push(...result.result.filesModified);
      }
      if (result.result.networkRequests) {
        changes.networkRequests += result.result.networkRequests;
      }
    }

    return result;
  }

  private async simulateSecurityScan(
    input: any, 
    context: ToolExecutionContext,
    toolsUsed: string[],
    changes: any
  ): Promise<any> {
    toolsUsed.push('security_scan');
    
    // Simulate security scanning
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate scan time
    
    return {
      success: true,
      vulnerabilities: [
        {
          type: 'medium',
          description: 'Outdated dependency detected',
          file: 'package.json',
          recommendation: 'Update to latest version'
        }
      ],
      riskScore: 3.2,
      compliance: {
        passed: 8,
        failed: 2,
        score: 80
      },
      recommendations: [
        'Update outdated dependencies',
        'Implement security headers',
        'Add input validation'
      ]
    };
  }

  private async simulateDeployment(
    input: any,
    context: ToolExecutionContext,
    toolsUsed: string[],
    changes: any
  ): Promise<any> {
    toolsUsed.push('manage_deployment');
    
    // Simulate deployment process
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate deployment time
    
    const deploymentId = `deploy_${Date.now()}`;
    const platform = input.platform || 'vercel';
    
    return {
      success: true,
      deploymentId,
      status: 'success',
      url: `https://your-app-${deploymentId}.${platform}.app`,
      logs: [
        'Building application...',
        'Running tests...',
        'Deploying to production...',
        'Deployment successful!'
      ],
      metrics: {
        buildTime: '45s',
        deployTime: '23s',
        totalTime: '1m 8s'
      },
      rollbackPlan: {
        available: true,
        command: `${platform} rollback ${deploymentId}`
      }
    };
  }

  private simulateChat(input: any, context: ToolExecutionContext): any {
    const messages = input.messages || [];
    if (messages.length === 0) {
      return {
        success: true,
        response: 'Hello! I am an A2A agent ready to help you.',
        requestId: context.requestId,
        streamUrl: `ws://127.0.0.1:8787/stream?requestId=${context.requestId}`
      };
    }

    const lastMessage = messages[messages.length - 1];
    return {
      success: true,
      response: `Echo: ${lastMessage.content}`,
      requestId: context.requestId,
      streamUrl: `ws://127.0.0.1:8787/stream?requestId=${context.requestId}`
    };
  }

  private async executeGenericCapability(
    agent: AgentDescriptor,
    capability: string,
    input: any,
    context: ToolExecutionContext,
    toolsUsed: string[],
    changes: any
  ): Promise<any> {
    // For unknown capabilities, try to execute based on agent category
    const category = agent.category || 'general';
    
    switch (category) {
      case 'file_operations':
        return await this.executeTool('process_files_batch', {
          pattern: input.pattern || '*',
          operations: input.operations || [{ type: 'copy' }]
        }, context, toolsUsed, changes);
      
      case 'web_automation':
        return await this.executeTool('scrape_website_advanced', {
          urls: input.urls || ['https://example.com'],
          selectors: input.selectors || { title: 'title' }
        }, context, toolsUsed, changes);
      
      case 'content_creation':
        return await this.executeTool('generate_content_advanced', {
          contentType: 'article',
          topic: input.topic || 'Technology',
          keywords: input.keywords || []
        }, context, toolsUsed, changes);
      
      case 'data_processing':
        return await this.executeTool('analyze_data_comprehensive', {
          dataSource: { type: 'file', path: 'data.csv', format: 'csv' },
          analysisTypes: ['descriptive']
        }, context, toolsUsed, changes);
      
      default:
        return {
          success: true,
          result: `Executed ${capability} on agent ${agent.id}`,
          message: `Generic execution of ${capability} capability`,
          timestamp: new Date().toISOString()
        };
    }
  }
}

export const agentExecutor = new AgentExecutor();