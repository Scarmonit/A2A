/**
 * Security Orchestration Workflows
 * Combines multiple security agents for comprehensive security assessment
 */

import { SecurityAgentType, securityAgentRegistry, SecurityScanResult } from './security-agents.js';
import { securityScanner } from './security-scanner.js';

export interface SecurityWorkflowResult {
  workflowId: string;
  workflowName: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'partial' | 'failed';
  scanResults: SecurityScanResult[];
  overallSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    infoFindings: number;
  };
  recommendations: string[];
}

/**
 * Pre-defined security workflows
 */
export class SecurityWorkflows {
  /**
   * Quick Security Scan - Fast scan for common issues
   */
  async quickSecurityScan(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `quick-scan-${startTime}`;

    console.log('⚡ Running Quick Security Scan...\n');

    const results: SecurityScanResult[] = [];

    // Deploy necessary agents
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.SECRET_DETECTOR);
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.DEPENDENCY_AUDITOR);

    // Run scans in parallel
    const [secretScan, depScan] = await Promise.all([
      securityScanner.scanSecrets(projectPath),
      securityScanner.scanDependencies(projectPath)
    ]);

    results.push(secretScan, depScan);

    return this.createWorkflowResult(
      workflowId,
      'Quick Security Scan',
      startTime,
      results
    );
  }

  /**
   * Comprehensive Security Assessment - Full security audit
   */
  async comprehensiveSecurityAssessment(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `comprehensive-${startTime}`;

    console.log('🔒 Running Comprehensive Security Assessment...\n');

    const results: SecurityScanResult[] = [];

    // Deploy full security suite
    const agents = [
      SecurityAgentType.VULNERABILITY_SCANNER,
      SecurityAgentType.DEPENDENCY_AUDITOR,
      SecurityAgentType.CODE_SECURITY_ANALYZER,
      SecurityAgentType.SECRET_DETECTOR,
      SecurityAgentType.COMPLIANCE_CHECKER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    console.log(`✅ Deployed ${agents.length} security agents\n`);

    // Run all scans
    const scanResults = await securityScanner.runComprehensiveScan(projectPath);
    results.push(...scanResults);

    return this.createWorkflowResult(
      workflowId,
      'Comprehensive Security Assessment',
      startTime,
      results
    );
  }

  /**
   * Pre-Commit Security Check - Run before committing code
   */
  async preCommitSecurityCheck(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `pre-commit-${startTime}`;

    console.log('🔍 Running Pre-Commit Security Check...\n');

    const results: SecurityScanResult[] = [];

    // Deploy agents
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.SECRET_DETECTOR);
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.CODE_SECURITY_ANALYZER);

    // Run focused scans
    const [secretScan, codeScan] = await Promise.all([
      securityScanner.scanSecrets(projectPath),
      securityScanner.analyzeCode(projectPath)
    ]);

    results.push(secretScan, codeScan);

    return this.createWorkflowResult(
      workflowId,
      'Pre-Commit Security Check',
      startTime,
      results
    );
  }

  /**
   * CI/CD Security Pipeline - For continuous integration
   */
  async cicdSecurityPipeline(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `cicd-${startTime}`;

    console.log('🚀 Running CI/CD Security Pipeline...\n');

    const results: SecurityScanResult[] = [];

    // Deploy CI/CD focused agents
    const agents = [
      SecurityAgentType.DEPENDENCY_AUDITOR,
      SecurityAgentType.CODE_SECURITY_ANALYZER,
      SecurityAgentType.SECRET_DETECTOR,
      SecurityAgentType.COMPLIANCE_CHECKER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    // Run scans
    const scanResults = await securityScanner.runComprehensiveScan(projectPath);
    results.push(...scanResults);

    return this.createWorkflowResult(
      workflowId,
      'CI/CD Security Pipeline',
      startTime,
      results
    );
  }

  /**
   * Production Readiness Check - Before deploying to production
   */
  async productionReadinessCheck(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `prod-ready-${startTime}`;

    console.log('🎯 Running Production Readiness Check...\n');

    const results: SecurityScanResult[] = [];

    // Deploy comprehensive agent suite
    const agents = [
      SecurityAgentType.VULNERABILITY_SCANNER,
      SecurityAgentType.DEPENDENCY_AUDITOR,
      SecurityAgentType.SECRET_DETECTOR,
      SecurityAgentType.COMPLIANCE_CHECKER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    // Run all production checks
    const scanResults = await securityScanner.runComprehensiveScan(projectPath);
    results.push(...scanResults);

    return this.createWorkflowResult(
      workflowId,
      'Production Readiness Check',
      startTime,
      results
    );
  }

  /**
   * Docker Security Audit - For containerized applications
   */
  async dockerSecurityAudit(projectPath: string, imageName?: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `docker-audit-${startTime}`;

    console.log('🐳 Running Docker Security Audit...\n');

    const results: SecurityScanResult[] = [];

    // Deploy Docker-focused agents
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.DOCKER_SECURITY_SCANNER);
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.VULNERABILITY_SCANNER);
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.COMPLIANCE_CHECKER);

    // Run Docker-specific scans
    const [depScan, complianceScan] = await Promise.all([
      securityScanner.scanDependencies(projectPath),
      securityScanner.checkCompliance(projectPath, 'CIS')
    ]);

    results.push(depScan, complianceScan);

    return this.createWorkflowResult(
      workflowId,
      'Docker Security Audit',
      startTime,
      results
    );
  }

  /**
   * Web Application Security Test - For web apps
   */
  async webApplicationSecurityTest(projectPath: string): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `web-security-${startTime}`;

    console.log('🌐 Running Web Application Security Test...\n');

    const results: SecurityScanResult[] = [];

    // Deploy web-focused agents
    const agents = [
      SecurityAgentType.WEB_SECURITY_SCANNER,
      SecurityAgentType.CODE_SECURITY_ANALYZER,
      SecurityAgentType.SSL_TLS_VALIDATOR,
      SecurityAgentType.COMPLIANCE_CHECKER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    // Run web security scans
    const [codeScan, complianceScan] = await Promise.all([
      securityScanner.analyzeCode(projectPath),
      securityScanner.checkCompliance(projectPath, 'OWASP')
    ]);

    results.push(codeScan, complianceScan);

    return this.createWorkflowResult(
      workflowId,
      'Web Application Security Test',
      startTime,
      results
    );
  }

  /**
   * Compliance Audit - Check against security standards
   */
  async complianceAudit(
    projectPath: string,
    standards: ('OWASP' | 'CIS' | 'PCI-DSS')[]
  ): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `compliance-${startTime}`;

    console.log('📋 Running Compliance Audit...\n');

    const results: SecurityScanResult[] = [];

    // Deploy compliance agents
    securityAgentRegistry.deploySecurityAgent(SecurityAgentType.COMPLIANCE_CHECKER);

    // Run compliance checks
    for (const standard of standards) {
      const result = await securityScanner.checkCompliance(projectPath, standard);
      results.push(result);
    }

    return this.createWorkflowResult(
      workflowId,
      `Compliance Audit (${standards.join(', ')})`,
      startTime,
      results
    );
  }

  /**
   * Continuous Monitoring Workflow - Ongoing security monitoring
   */
  async continuousMonitoring(projectPath: string, duration: number = 60000): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `continuous-monitoring-${startTime}`;

    console.log('👁️  Starting Continuous Security Monitoring...\n');

    const results: SecurityScanResult[] = [];

    // Deploy monitoring agents
    const agents = [
      SecurityAgentType.NETWORK_MONITOR,
      SecurityAgentType.THREAT_HUNTER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    // Run initial scan
    const initialScan = await securityScanner.runComprehensiveScan(projectPath);
    results.push(...initialScan);

    console.log(`Monitoring for ${duration / 1000} seconds...\n`);

    return this.createWorkflowResult(
      workflowId,
      'Continuous Security Monitoring',
      startTime,
      results
    );
  }

  /**
   * Incident Response Workflow - Respond to security incidents
   */
  async incidentResponse(
    projectPath: string,
    incidentType: 'breach' | 'vulnerability' | 'attack'
  ): Promise<SecurityWorkflowResult> {
    const startTime = Date.now();
    const workflowId = `incident-response-${startTime}`;

    console.log(`🚨 Initiating Incident Response for ${incidentType}...\n`);

    const results: SecurityScanResult[] = [];

    // Deploy incident response agents
    const agents = [
      SecurityAgentType.THREAT_HUNTER,
      SecurityAgentType.VULNERABILITY_SCANNER
    ];

    securityAgentRegistry.deploySecuritySuite(agents);

    // Run incident analysis
    const scanResults = await securityScanner.runComprehensiveScan(projectPath);
    results.push(...scanResults);

    return this.createWorkflowResult(
      workflowId,
      `Incident Response (${incidentType})`,
      startTime,
      results
    );
  }

  /**
   * Create workflow result from scan results
   */
  private createWorkflowResult(
    workflowId: string,
    workflowName: string,
    startTime: number,
    scanResults: SecurityScanResult[]
  ): SecurityWorkflowResult {
    const endTime = Date.now();

    // Aggregate findings
    const totalFindings = scanResults.reduce((sum, r) => sum + r.summary.total, 0);
    const criticalFindings = scanResults.reduce((sum, r) => sum + r.summary.critical, 0);
    const highFindings = scanResults.reduce((sum, r) => sum + r.summary.high, 0);
    const mediumFindings = scanResults.reduce((sum, r) => sum + r.summary.medium, 0);
    const lowFindings = scanResults.reduce((sum, r) => sum + r.summary.low, 0);
    const infoFindings = scanResults.reduce((sum, r) => sum + r.summary.info, 0);

    // Determine overall severity
    let overallSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';
    if (criticalFindings > 0) overallSeverity = 'critical';
    else if (highFindings > 0) overallSeverity = 'high';
    else if (mediumFindings > 0) overallSeverity = 'medium';
    else if (lowFindings > 0) overallSeverity = 'low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalFindings > 0) {
      recommendations.push(`🚨 URGENT: ${criticalFindings} critical vulnerabilities require immediate attention`);
    }
    if (highFindings > 0) {
      recommendations.push(`⚠️  ${highFindings} high-severity issues should be prioritized`);
    }
    if (mediumFindings > 0) {
      recommendations.push(`📌 ${mediumFindings} medium-severity issues need scheduling`);
    }
    if (totalFindings === 0) {
      recommendations.push('✅ No security issues detected. Continue monitoring regularly.');
    }

    // Add general recommendations
    recommendations.push('Run security scans regularly as part of your CI/CD pipeline');
    recommendations.push('Keep all dependencies up to date');
    recommendations.push('Review and update security policies');

    // Determine status
    const status = criticalFindings > 0 ? 'failed' : highFindings > 0 ? 'partial' : 'success';

    return {
      workflowId,
      workflowName,
      startTime,
      endTime,
      duration: endTime - startTime,
      status,
      scanResults,
      overallSeverity,
      summary: {
        totalFindings,
        criticalFindings,
        highFindings,
        mediumFindings,
        lowFindings,
        infoFindings
      },
      recommendations
    };
  }

  /**
   * Format workflow result for display
   */
  formatWorkflowResult(result: SecurityWorkflowResult): string {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`Security Workflow: ${result.workflowName}`);
    lines.push(`Workflow ID: ${result.workflowId}`);
    lines.push(`Status: ${result.status.toUpperCase()}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`${'='.repeat(80)}\n`);

    lines.push('📊 Summary:');
    lines.push(`   Total Findings: ${result.summary.totalFindings}`);
    lines.push(`   🔴 Critical: ${result.summary.criticalFindings}`);
    lines.push(`   🟠 High: ${result.summary.highFindings}`);
    lines.push(`   🟡 Medium: ${result.summary.mediumFindings}`);
    lines.push(`   🟢 Low: ${result.summary.lowFindings}`);
    lines.push(`   ℹ️  Info: ${result.summary.infoFindings}\n`);

    lines.push('📋 Recommendations:');
    result.recommendations.forEach(rec => lines.push(`   • ${rec}`));

    lines.push(`\n${'='.repeat(80)}\n`);

    return lines.join('\n');
  }
}

// Export singleton
export const securityWorkflows = new SecurityWorkflows();
