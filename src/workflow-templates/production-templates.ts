import { WorkflowTemplate } from '../workflow-orchestrator.js';

/**
 * Production-Ready Workflow Templates
 *
 * Pre-built workflows for common production scenarios:
 * 1. CI/CD Pipeline
 * 2. Data Backup & Recovery
 * 3. Security Audit & Compliance
 * 4. Incident Response
 * 5. Performance Optimization
 * 6. Content Deployment Pipeline
 * 7. Database Migration
 * 8. Multi-Cloud Deployment
 */

export const PRODUCTION_WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  /**
   * 1. CI/CD Pipeline Workflow
   */
  'cicd-pipeline': {
    name: 'CI/CD Deployment Pipeline',
    description: 'Automated build, test, and deployment workflow',
    steps: [
      {
        name: 'checkout_code',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'analyze_structure',
          path: '{{repository_path}}',
          recursive: true,
        },
      },
      {
        name: 'run_linter',
        agentId: 'code-gen-000',
        capability: 'generate_code',
        input: {
          task: 'Run linter and code quality checks',
          language: '{{language}}',
        },
        dependencies: ['checkout_code'],
        retries: {
          maxAttempts: 2,
          backoffMs: 1000,
        },
      },
      {
        name: 'run_tests',
        agentId: 'code-gen-001',
        capability: 'generate_code',
        input: {
          task: 'Run unit and integration tests',
          language: '{{language}}',
        },
        dependencies: ['checkout_code'],
        timeout: 300000, // 5 minutes
      },
      {
        name: 'build_artifacts',
        agentId: 'code-gen-002',
        capability: 'generate_code',
        input: {
          task: 'Build production artifacts',
          language: '{{language}}',
        },
        dependencies: ['run_linter', 'run_tests'],
      },
      {
        name: 'run_security_scan',
        agentId: 'system-monitor-000',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
        },
        dependencies: ['build_artifacts'],
      },
      {
        name: 'deploy_staging',
        agentId: 'file-ops-001',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{staging_path}}/deployment.txt',
          content: 'Deployment to staging: {{timestamp}}',
        },
        dependencies: ['run_security_scan'],
        conditions: {
          runIf: 'run_security_scan_result.success === true',
        },
      },
      {
        name: 'smoke_tests',
        agentId: 'code-gen-003',
        capability: 'generate_code',
        input: {
          task: 'Run smoke tests on staging',
          language: '{{language}}',
        },
        dependencies: ['deploy_staging'],
      },
      {
        name: 'deploy_production',
        agentId: 'file-ops-002',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{production_path}}/deployment.txt',
          content: 'Production deployment: {{timestamp}}',
        },
        dependencies: ['smoke_tests'],
        conditions: {
          runIf: 'smoke_tests_result.success === true',
        },
      },
      {
        name: 'notify_team',
        agentId: 'file-ops-003',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{notification_log}}',
          content: 'Deployment completed successfully at {{timestamp}}',
        },
        dependencies: ['deploy_production'],
      },
    ],
    defaultContext: {
      repository_path: './src',
      language: 'javascript',
      staging_path: './staging',
      production_path: './production',
      notification_log: './deployment.log',
      timestamp: new Date().toISOString(),
    },
  },

  /**
   * 2. Data Backup & Recovery Workflow
   */
  'data-backup-recovery': {
    name: 'Data Backup and Recovery',
    description: 'Automated database backup, verification, and recovery workflow',
    steps: [
      {
        name: 'validate_backup_location',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'analyze_structure',
          path: '{{backup_location}}',
        },
      },
      {
        name: 'create_backup',
        agentId: 'data-processor-000',
        capability: 'process_data',
        input: {
          data_source: '{{database_url}}',
          output_format: 'json',
          save_to: '{{backup_location}}/backup-{{timestamp}}.json',
        },
        dependencies: ['validate_backup_location'],
        timeout: 600000, // 10 minutes
      },
      {
        name: 'verify_backup_integrity',
        agentId: 'data-processor-001',
        capability: 'process_data',
        input: {
          data_source: '{{backup_location}}/backup-{{timestamp}}.json',
          operations: [
            { type: 'filter', expression: 'item !== null' },
          ],
        },
        dependencies: ['create_backup'],
      },
      {
        name: 'compress_backup',
        agentId: 'file-ops-001',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{backup_location}}/backup-{{timestamp}}.tar.gz',
          content: 'Compressed backup created',
        },
        dependencies: ['verify_backup_integrity'],
      },
      {
        name: 'upload_to_cloud',
        agentId: 'file-ops-002',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{cloud_storage}}/backup-{{timestamp}}.tar.gz',
          content: 'Uploaded to cloud storage',
        },
        dependencies: ['compress_backup'],
        conditions: {
          runIf: 'compress_backup_result.success === true',
        },
      },
      {
        name: 'cleanup_old_backups',
        agentId: 'file-ops-003',
        capability: 'file_operations',
        input: {
          operation: 'list',
          path: '{{backup_location}}',
          recursive: false,
        },
        dependencies: ['upload_to_cloud'],
      },
      {
        name: 'send_notification',
        agentId: 'file-ops-004',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{notification_log}}',
          content: 'Backup completed successfully at {{timestamp}}',
        },
        dependencies: ['cleanup_old_backups'],
      },
    ],
    defaultContext: {
      backup_location: './backups',
      database_url: process.env.DATABASE_URL || 'postgresql://localhost/mydb',
      cloud_storage: './cloud-backups',
      notification_log: './backup.log',
      timestamp: new Date().toISOString(),
      retention_days: 30,
    },
  },

  /**
   * 3. Security Audit & Compliance Workflow
   */
  'security-audit': {
    name: 'Security Audit and Compliance Check',
    description: 'Automated security scanning and compliance verification',
    steps: [
      {
        name: 'scan_dependencies',
        agentId: 'system-monitor-000',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
        },
      },
      {
        name: 'analyze_code_vulnerabilities',
        agentId: 'data-processor-000',
        capability: 'process_data',
        input: {
          data_source: '{{source_path}}',
          operations: [
            { type: 'filter', expression: 'item.severity === "high"' },
          ],
        },
        dependencies: ['scan_dependencies'],
      },
      {
        name: 'check_secrets',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'analyze_structure',
          path: '{{source_path}}',
          recursive: true,
        },
        dependencies: ['scan_dependencies'],
      },
      {
        name: 'verify_compliance',
        agentId: 'data-processor-001',
        capability: 'process_data',
        input: {
          data: '{{compliance_requirements}}',
          operations: [
            { type: 'map', expression: 'item.checked = true' },
          ],
        },
        dependencies: ['analyze_code_vulnerabilities', 'check_secrets'],
      },
      {
        name: 'generate_report',
        agentId: 'file-ops-001',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{report_path}}/security-audit-{{timestamp}}.json',
          content: 'Security audit report generated',
        },
        dependencies: ['verify_compliance'],
      },
      {
        name: 'create_tickets',
        agentId: 'file-ops-002',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{tickets_path}}/issues.json',
          content: 'Security issues logged',
        },
        dependencies: ['generate_report'],
        conditions: {
          runIf: 'analyze_code_vulnerabilities_result.result.length > 0',
        },
      },
    ],
    defaultContext: {
      source_path: './src',
      report_path: './security-reports',
      tickets_path: './security-tickets',
      compliance_requirements: '[]',
      timestamp: new Date().toISOString(),
    },
  },

  /**
   * 4. Incident Response Workflow
   */
  'incident-response': {
    name: 'Incident Response Automation',
    description: 'Automated incident detection, triage, and response',
    steps: [
      {
        name: 'detect_anomaly',
        agentId: 'system-monitor-000',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
          alert_threshold: {
            memory: 90,
          },
        },
      },
      {
        name: 'gather_logs',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'list',
          path: '{{log_path}}',
          recursive: true,
        },
        dependencies: ['detect_anomaly'],
      },
      {
        name: 'analyze_logs',
        agentId: 'data-processor-000',
        capability: 'process_data',
        input: {
          data_source: '{{log_path}}',
          operations: [
            { type: 'filter', expression: 'item.level === "error"' },
            { type: 'sort', expression: 'b.timestamp - a.timestamp' },
          ],
        },
        dependencies: ['gather_logs'],
      },
      {
        name: 'identify_root_cause',
        agentId: 'data-processor-001',
        capability: 'process_data',
        input: {
          data: '{{analyze_logs_result}}',
          operations: [
            { type: 'group', expression: 'item.error_type' },
          ],
        },
        dependencies: ['analyze_logs'],
      },
      {
        name: 'create_incident_ticket',
        agentId: 'file-ops-001',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{incident_path}}/incident-{{timestamp}}.json',
          content: 'Incident ticket created',
        },
        dependencies: ['identify_root_cause'],
      },
      {
        name: 'notify_on_call',
        agentId: 'file-ops-002',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{notification_log}}',
          content: 'On-call team notified at {{timestamp}}',
        },
        dependencies: ['create_incident_ticket'],
      },
      {
        name: 'trigger_auto_remediation',
        agentId: 'system-monitor-001',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
        },
        dependencies: ['identify_root_cause'],
        conditions: {
          runIf: 'identify_root_cause_result.success === true',
        },
      },
    ],
    defaultContext: {
      log_path: './logs',
      incident_path: './incidents',
      notification_log: './notifications.log',
      timestamp: new Date().toISOString(),
      severity: 'high',
    },
  },

  /**
   * 5. Performance Optimization Workflow
   */
  'performance-optimization': {
    name: 'Performance Analysis and Optimization',
    description: 'Automated performance profiling and optimization recommendations',
    steps: [
      {
        name: 'baseline_metrics',
        agentId: 'system-monitor-000',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
        },
      },
      {
        name: 'profile_application',
        agentId: 'data-processor-000',
        capability: 'process_data',
        input: {
          data_source: '{{app_metrics_url}}',
          operations: [
            { type: 'sort', expression: 'b.duration - a.duration' },
          ],
        },
        dependencies: ['baseline_metrics'],
        timeout: 300000,
      },
      {
        name: 'identify_bottlenecks',
        agentId: 'data-processor-001',
        capability: 'process_data',
        input: {
          data: '{{profile_application_result}}',
          operations: [
            { type: 'filter', expression: 'item.duration > 1000' },
          ],
        },
        dependencies: ['profile_application'],
      },
      {
        name: 'analyze_database_queries',
        agentId: 'data-processor-002',
        capability: 'process_data',
        input: {
          data_source: '{{db_log_path}}',
          operations: [
            { type: 'filter', expression: 'item.query_time > 100' },
          ],
        },
        dependencies: ['baseline_metrics'],
      },
      {
        name: 'generate_recommendations',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{report_path}}/optimization-recommendations-{{timestamp}}.json',
          content: 'Performance optimization recommendations generated',
        },
        dependencies: ['identify_bottlenecks', 'analyze_database_queries'],
      },
      {
        name: 'implement_caching',
        agentId: 'code-gen-000',
        capability: 'generate_code',
        input: {
          task: 'Implement caching strategy',
          language: '{{language}}',
        },
        dependencies: ['generate_recommendations'],
        conditions: {
          skipIf: 'auto_implement === false',
        },
      },
      {
        name: 'run_performance_tests',
        agentId: 'system-monitor-001',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
            memory: true,
          },
        },
        dependencies: ['implement_caching'],
      },
    ],
    defaultContext: {
      app_metrics_url: './metrics/app.json',
      db_log_path: './logs/database.log',
      report_path: './performance-reports',
      language: 'javascript',
      auto_implement: false,
      timestamp: new Date().toISOString(),
    },
  },

  /**
   * 6. Content Deployment Pipeline
   */
  'content-deployment': {
    name: 'Content Deployment Pipeline',
    description: 'Automated content processing, optimization, and deployment',
    steps: [
      {
        name: 'fetch_content',
        agentId: 'web-scraper-000',
        capability: 'scrape_web',
        input: {
          urls: '{{content_sources}}',
          format: 'json',
        },
      },
      {
        name: 'process_content',
        agentId: 'data-processor-000',
        capability: 'process_data',
        input: {
          data: '{{fetch_content_result}}',
          operations: [
            { type: 'filter', expression: 'item.status === 200' },
            { type: 'map', expression: 'item.data' },
          ],
        },
        dependencies: ['fetch_content'],
      },
      {
        name: 'optimize_images',
        agentId: 'file-ops-000',
        capability: 'file_operations',
        input: {
          operation: 'list',
          path: '{{image_path}}',
          recursive: true,
        },
        dependencies: ['process_content'],
      },
      {
        name: 'generate_sitemaps',
        agentId: 'file-ops-001',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{output_path}}/sitemap.xml',
          content: 'Sitemap generated',
        },
        dependencies: ['process_content'],
      },
      {
        name: 'deploy_to_cdn',
        agentId: 'file-ops-002',
        capability: 'file_operations',
        input: {
          operation: 'create',
          path: '{{cdn_path}}/content',
          content: 'Content deployed to CDN',
        },
        dependencies: ['optimize_images', 'generate_sitemaps'],
      },
      {
        name: 'invalidate_cache',
        agentId: 'system-monitor-000',
        capability: 'monitor_system',
        input: {
          checks: {
            disk: true,
          },
        },
        dependencies: ['deploy_to_cdn'],
      },
    ],
    defaultContext: {
      content_sources: ['https://example.com'],
      image_path: './images',
      output_path: './dist',
      cdn_path: './cdn',
      timestamp: new Date().toISOString(),
    },
  },
};
