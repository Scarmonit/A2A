import { AgentDescriptor, AgentCapability } from './agents.js';
import { v4 as uuidv4 } from 'uuid';

// Real-world agent types with practical capabilities
export const ENHANCED_AGENT_TYPES = {
  // Web automation agents
  WEB_SCRAPER: 'web-scraper',
  SEO_ANALYZER: 'seo-analyzer',
  WEBSITE_MONITOR: 'website-monitor',
  
  // Content creation agents
  CONTENT_WRITER: 'content-writer',
  CODE_REVIEWER: 'code-reviewer',
  DOCUMENTATION_GENERATOR: 'doc-generator',
  
  // Data processing agents
  DATA_ANALYST: 'data-analyst',
  CSV_PROCESSOR: 'csv-processor',
  API_TESTER: 'api-tester',
  
  // DevOps agents
  LOG_ANALYZER: 'log-analyzer',
  DEPLOY_MANAGER: 'deploy-manager',
  SECURITY_SCANNER: 'security-scanner',
  
  // Business automation agents
  EMAIL_PROCESSOR: 'email-processor',
  REPORT_GENERATOR: 'report-generator',
  TASK_SCHEDULER: 'task-scheduler'
};

export function createEnhancedAgent(type: string, config: any = {}): AgentDescriptor {
  const agentId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  switch (type) {
    case ENHANCED_AGENT_TYPES.WEB_SCRAPER:
      return {
        id: agentId,
        name: 'Advanced Web Scraper',
        version: '2.0.0',
        category: 'web_automation',
        tags: ['scraping', 'web', 'data-extraction', 'automation'],
        capabilities: [
          {
            name: 'scrape_website',
            description: 'Extract data from websites with advanced selectors and pagination',
            inputSchema: {
              type: 'object',
              properties: {
                urls: { type: 'array', items: { type: 'string' } },
                selectors: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    links: { type: 'string' },
                    images: { type: 'string' },
                    custom: { type: 'object' }
                  }
                },
                options: {
                  type: 'object',
                  properties: {
                    waitFor: { type: 'string' },
                    pagination: { type: 'boolean' },
                    maxPages: { type: 'number' },
                    delay: { type: 'number' },
                    userAgent: { type: 'string' }
                  }
                },
                outputFormat: { type: 'string', enum: ['json', 'csv', 'excel'] },
                saveToFile: { type: 'string' }
              },
              required: ['urls']
            },
            outputSchema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'array' },
                totalItems: { type: 'number' },
                errors: { type: 'array' },
                executionTime: { type: 'number' }
              }
            }
          }
        ],
        config: {
          maxConcurrentRequests: config.maxConcurrentRequests || 5,
          requestDelay: config.requestDelay || 1000,
          retryAttempts: config.retryAttempts || 3,
          ...config
        }
      };

    case ENHANCED_AGENT_TYPES.CONTENT_WRITER:
      return {
        id: agentId,
        name: 'AI Content Writer',
        version: '2.0.0',
        category: 'content_creation',
        tags: ['writing', 'content', 'seo', 'marketing'],
        capabilities: [
          {
            name: 'generate_content',
            description: 'Generate high-quality content for various purposes',
            inputSchema: {
              type: 'object',
              properties: {
                contentType: { type: 'string', enum: ['blog-post', 'article', 'product-description', 'email', 'social-media', 'technical-docs'] },
                topic: { type: 'string' },
                keywords: { type: 'array', items: { type: 'string' } },
                tone: { type: 'string', enum: ['professional', 'casual', 'technical', 'marketing', 'academic'] },
                length: { type: 'string', enum: ['short', 'medium', 'long'] },
                targetAudience: { type: 'string' },
                requirements: {
                  type: 'object',
                  properties: {
                    includeHeadings: { type: 'boolean' },
                    includeBulletPoints: { type: 'boolean' },
                    includeConclusion: { type: 'boolean' },
                    seoOptimized: { type: 'boolean' }
                  }
                },
                outputFormat: { type: 'string', enum: ['markdown', 'html', 'text'] },
                saveToFile: { type: 'string' }
              },
              required: ['contentType', 'topic']
            },
            outputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                wordCount: { type: 'number' },
                readingTime: { type: 'number' },
                seoScore: { type: 'number' },
                suggestions: { type: 'array' }
              }
            }
          }
        ],
        config: {
          qualityLevel: config.qualityLevel || 'high',
          creativity: config.creativity || 0.7,
          ...config
        }
      };

    case ENHANCED_AGENT_TYPES.DATA_ANALYST:
      return {
        id: agentId,
        name: 'Data Analysis Expert',
        version: '2.0.0',
        category: 'data_processing',
        tags: ['analytics', 'statistics', 'visualization', 'insights'],
        capabilities: [
          {
            name: 'analyze_data',
            description: 'Perform comprehensive data analysis with insights and visualizations',
            inputSchema: {
              type: 'object',
              properties: {
                dataSource: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['file', 'url', 'database', 'api'] },
                    path: { type: 'string' },
                    format: { type: 'string', enum: ['csv', 'json', 'excel', 'sql'] },
                    credentials: { type: 'object' }
                  }
                },
                analysisTypes: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['descriptive', 'correlation', 'trend', 'outlier', 'distribution', 'clustering'] 
                  }
                },
                columns: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object' },
                groupBy: { type: 'array', items: { type: 'string' } },
                visualizations: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['bar', 'line', 'scatter', 'histogram', 'heatmap', 'pie'] 
                  }
                },
                outputOptions: {
                  type: 'object',
                  properties: {
                    generateReport: { type: 'boolean' },
                    saveCharts: { type: 'boolean' },
                    exportData: { type: 'boolean' }
                  }
                }
              },
              required: ['dataSource', 'analysisTypes']
            },
            outputSchema: {
              type: 'object',
              properties: {
                insights: { type: 'array' },
                statistics: { type: 'object' },
                visualizations: { type: 'array' },
                recommendations: { type: 'array' },
                dataQuality: { type: 'object' }
              }
            }
          }
        ],
        config: {
          maxDataSize: config.maxDataSize || 10000000, // 10MB
          cacheResults: config.cacheResults || true,
          ...config
        }
      };

    case ENHANCED_AGENT_TYPES.API_TESTER:
      return {
        id: agentId,
        name: 'API Testing Specialist',
        version: '2.0.0',
        category: 'testing',
        tags: ['api', 'testing', 'automation', 'qa'],
        capabilities: [
          {
            name: 'test_api',
            description: 'Comprehensive API testing with validation and reporting',
            inputSchema: {
              type: 'object',
              properties: {
                apiSpec: {
                  type: 'object',
                  properties: {
                    baseUrl: { type: 'string' },
                    endpoints: { type: 'array' },
                    authentication: { type: 'object' },
                    headers: { type: 'object' }
                  }
                },
                testSuites: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      tests: { type: 'array' },
                      setup: { type: 'object' },
                      cleanup: { type: 'object' }
                    }
                  }
                },
                testTypes: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['functional', 'performance', 'security', 'contract', 'load'] 
                  }
                },
                options: {
                  type: 'object',
                  properties: {
                    parallel: { type: 'boolean' },
                    retryFailed: { type: 'boolean' },
                    generateReport: { type: 'boolean' },
                    mockData: { type: 'boolean' }
                  }
                }
              },
              required: ['apiSpec', 'testSuites']
            },
            outputSchema: {
              type: 'object',
              properties: {
                totalTests: { type: 'number' },
                passed: { type: 'number' },
                failed: { type: 'number' },
                skipped: { type: 'number' },
                results: { type: 'array' },
                performance: { type: 'object' },
                coverage: { type: 'object' }
              }
            }
          }
        ],
        config: {
          timeout: config.timeout || 30000,
          maxRetries: config.maxRetries || 3,
          ...config
        }
      };

    case ENHANCED_AGENT_TYPES.DEPLOY_MANAGER:
      return {
        id: agentId,
        name: 'Deployment Manager',
        version: '2.0.0',
        category: 'devops',
        tags: ['deployment', 'ci-cd', 'automation', 'devops'],
        capabilities: [
          {
            name: 'manage_deployment',
            description: 'Automate application deployments across environments',
            inputSchema: {
              type: 'object',
              properties: {
                project: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    repository: { type: 'string' },
                    branch: { type: 'string' },
                    buildCommand: { type: 'string' },
                    testCommand: { type: 'string' }
                  }
                },
                environment: { type: 'string', enum: ['development', 'staging', 'production'] },
                platform: { type: 'string', enum: ['vercel', 'railway', 'heroku', 'aws', 'docker'] },
                strategy: { type: 'string', enum: ['blue-green', 'rolling', 'canary', 'immediate'] },
                preDeployment: {
                  type: 'object',
                  properties: {
                    runTests: { type: 'boolean' },
                    backupDatabase: { type: 'boolean' },
                    notifyTeam: { type: 'boolean' }
                  }
                },
                postDeployment: {
                  type: 'object',
                  properties: {
                    runHealthChecks: { type: 'boolean' },
                    updateDocumentation: { type: 'boolean' },
                    notifyStakeholders: { type: 'boolean' }
                  }
                }
              },
              required: ['project', 'environment', 'platform']
            },
            outputSchema: {
              type: 'object',
              properties: {
                deploymentId: { type: 'string' },
                status: { type: 'string' },
                url: { type: 'string' },
                logs: { type: 'array' },
                metrics: { type: 'object' },
                rollbackPlan: { type: 'object' }
              }
            }
          }
        ],
        config: {
          autoRollback: config.autoRollback || true,
          notificationChannels: config.notificationChannels || [],
          ...config
        }
      };

    case ENHANCED_AGENT_TYPES.SECURITY_SCANNER:
      return {
        id: agentId,
        name: 'Security Scanner',
        version: '2.0.0',
        category: 'security',
        tags: ['security', 'vulnerability', 'scanning', 'compliance'],
        capabilities: [
          {
            name: 'security_scan',
            description: 'Comprehensive security scanning and vulnerability assessment',
            inputSchema: {
              type: 'object',
              properties: {
                target: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['code', 'website', 'api', 'infrastructure'] },
                    path: { type: 'string' },
                    url: { type: 'string' },
                    credentials: { type: 'object' }
                  }
                },
                scanTypes: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['vulnerability', 'malware', 'dependencies', 'secrets', 'compliance', 'penetration'] 
                  }
                },
                depth: { type: 'string', enum: ['surface', 'deep', 'comprehensive'] },
                compliance: { type: 'array', items: { type: 'string' } },
                reporting: {
                  type: 'object',
                  properties: {
                    format: { type: 'string', enum: ['json', 'html', 'pdf', 'sarif'] },
                    includeRemediation: { type: 'boolean' },
                    priorityFilter: { type: 'string', enum: ['all', 'critical', 'high', 'medium'] }
                  }
                }
              },
              required: ['target', 'scanTypes']
            },
            outputSchema: {
              type: 'object',
              properties: {
                vulnerabilities: { type: 'array' },
                riskScore: { type: 'number' },
                compliance: { type: 'object' },
                recommendations: { type: 'array' },
                remediation: { type: 'object' }
              }
            }
          }
        ],
        config: {
          severity: config.severity || 'medium',
          autoFix: config.autoFix || false,
          ...config
        }
      };

    default:
      throw new Error(`Unknown enhanced agent type: ${type}`);
  }
}

// Batch create multiple enhanced agents
export function createEnhancedAgentBatch(types: string[], commonConfig: any = {}): AgentDescriptor[] {
  return types.map(type => createEnhancedAgent(type, commonConfig));
}

// Create a complete agent ecosystem for specific use cases
export function createAgentEcosystem(useCase: string): AgentDescriptor[] {
  switch (useCase) {
    case 'web-development':
      return createEnhancedAgentBatch([
        ENHANCED_AGENT_TYPES.CODE_REVIEWER,
        ENHANCED_AGENT_TYPES.API_TESTER,
        ENHANCED_AGENT_TYPES.SECURITY_SCANNER,
        ENHANCED_AGENT_TYPES.DEPLOY_MANAGER,
        ENHANCED_AGENT_TYPES.DOCUMENTATION_GENERATOR
      ]);

    case 'data-analysis':
      return createEnhancedAgentBatch([
        ENHANCED_AGENT_TYPES.WEB_SCRAPER,
        ENHANCED_AGENT_TYPES.DATA_ANALYST,
        ENHANCED_AGENT_TYPES.CSV_PROCESSOR,
        ENHANCED_AGENT_TYPES.REPORT_GENERATOR
      ]);

    case 'content-marketing':
      return createEnhancedAgentBatch([
        ENHANCED_AGENT_TYPES.CONTENT_WRITER,
        ENHANCED_AGENT_TYPES.SEO_ANALYZER,
        ENHANCED_AGENT_TYPES.WEBSITE_MONITOR,
        ENHANCED_AGENT_TYPES.EMAIL_PROCESSOR
      ]);

    case 'devops':
      return createEnhancedAgentBatch([
        ENHANCED_AGENT_TYPES.DEPLOY_MANAGER,
        ENHANCED_AGENT_TYPES.LOG_ANALYZER,
        ENHANCED_AGENT_TYPES.SECURITY_SCANNER,
        ENHANCED_AGENT_TYPES.API_TESTER
      ]);

    default:
      return createEnhancedAgentBatch([
        ENHANCED_AGENT_TYPES.WEB_SCRAPER,
        ENHANCED_AGENT_TYPES.DATA_ANALYST,
        ENHANCED_AGENT_TYPES.CONTENT_WRITER,
        ENHANCED_AGENT_TYPES.API_TESTER
      ]);
  }
}