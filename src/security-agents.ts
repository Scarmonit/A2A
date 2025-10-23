/**
 * Simplified Security Agents for awesome-hacking integration
 * Defensive security only
 */

import { AgentDescriptor, AgentCapability, AgentRegistry } from './agents.js';

export enum SecurityAgentType {
  VULNERABILITY_SCANNER = 'vulnerability-scanner',
  DEPENDENCY_AUDITOR = 'dependency-auditor',
  CODE_SECURITY_ANALYZER = 'code-security-analyzer',
  SECRET_DETECTOR = 'secret-detector',
  WEB_SECURITY_SCANNER = 'web-security-scanner',
  DOCKER_SECURITY_SCANNER = 'docker-security-scanner',
  NETWORK_MONITOR = 'network-monitor',
  COMPLIANCE_CHECKER = 'compliance-checker',
  SSL_TLS_VALIDATOR = 'ssl-tls-validator',
  THREAT_HUNTER = 'threat-hunter'
}

export interface SecurityScanResult {
  agentId: string;
  scanType: string;
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  findings: SecurityFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  location?: string;
  remediation: string;
  references?: string[];
  cve?: string[];
}

/**
 * Create security agent with proper typing
 */
export function createSecurityAgent(type: SecurityAgentType): AgentDescriptor {
  const baseCapability: AgentCapability = {
    name: 'scan',
    description: 'Perform security scan',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' }
      }
    },
    outputSchema: { type: 'object' }
  };

  const agentId = `security-${type}-${Date.now()}`;

  const agentMap: Record<SecurityAgentType, { name: string; description: string; tools: string[] }> = {
    [SecurityAgentType.VULNERABILITY_SCANNER]: {
      name: 'Vulnerability Scanner',
      description: 'Scans for CVE vulnerabilities',
      tools: ['npm audit', 'CVE database']
    },
    [SecurityAgentType.DEPENDENCY_AUDITOR]: {
      name: 'Dependency Auditor',
      description: 'Audits dependencies for security issues',
      tools: ['npm audit', 'yarn audit']
    },
    [SecurityAgentType.CODE_SECURITY_ANALYZER]: {
      name: 'Code Security Analyzer',
      description: 'Static analysis for security flaws',
      tools: ['semgrep', 'eslint-security']
    },
    [SecurityAgentType.SECRET_DETECTOR]: {
      name: 'Secret Detector',
      description: 'Finds hardcoded secrets',
      tools: ['truffleHog', 'git-secrets']
    },
    [SecurityAgentType.WEB_SECURITY_SCANNER]: {
      name: 'Web Security Scanner',
      description: 'OWASP Top 10 scanning',
      tools: ['OWASP ZAP', 'Nikto']
    },
    [SecurityAgentType.DOCKER_SECURITY_SCANNER]: {
      name: 'Docker Security Scanner',
      description: 'Container security scanning',
      tools: ['Docker Bench', 'Trivy']
    },
    [SecurityAgentType.NETWORK_MONITOR]: {
      name: 'Network Monitor',
      description: 'Network traffic monitoring',
      tools: ['Wireshark', 'tcpdump']
    },
    [SecurityAgentType.COMPLIANCE_CHECKER]: {
      name: 'Compliance Checker',
      description: 'Validates security standards',
      tools: ['OpenSCAP', 'CIS-CAT']
    },
    [SecurityAgentType.SSL_TLS_VALIDATOR]: {
      name: 'SSL/TLS Validator',
      description: 'Certificate validation',
      tools: ['testssl.sh', 'sslyze']
    },
    [SecurityAgentType.THREAT_HUNTER]: {
      name: 'Threat Hunter',
      description: 'Proactive threat detection',
      tools: ['YARA', 'Sigma']
    }
  };

  const config = agentMap[type];

  return {
    id: agentId,
    name: config.name,
    version: '1.0.0',
    capabilities: [baseCapability],
    category: 'Security',
    tags: ['security', 'defensive', 'awesome-hacking'],
    config: {
      description: config.description,
      tools: config.tools,
      agentType: type,
      defensiveOnly: true
    }
  };
}

/**
 * Security Agent Registry
 */
export class SecurityAgentRegistry extends AgentRegistry {
  private scanResults: Map<string, SecurityScanResult[]> = new Map();

  deploySecurityAgent(type: SecurityAgentType): AgentDescriptor {
    const agent = createSecurityAgent(type);
    this.deploy(agent);
    return agent;
  }

  deploySecuritySuite(types: SecurityAgentType[]): AgentDescriptor[] {
    return types.map(type => this.deploySecurityAgent(type));
  }

  recordScanResult(result: SecurityScanResult): void {
    if (!this.scanResults.has(result.agentId)) {
      this.scanResults.set(result.agentId, []);
    }
    this.scanResults.get(result.agentId)!.push(result);
  }

  getScanHistory(agentId: string): SecurityScanResult[] {
    return this.scanResults.get(agentId) || [];
  }

  getSecurityPosture() {
    const allResults = Array.from(this.scanResults.values()).flat();
    const totals = allResults.reduce((acc, result) => ({
      critical: acc.critical + result.summary.critical,
      high: acc.high + result.summary.high,
      medium: acc.medium + result.summary.medium,
      low: acc.low + result.summary.low
    }), { critical: 0, high: 0, medium: 0, low: 0 });

    const lastScan = allResults.length > 0
      ? Math.max(...allResults.map(r => r.timestamp))
      : 0;

    return {
      totalScans: allResults.length,
      criticalFindings: totals.critical,
      highFindings: totals.high,
      mediumFindings: totals.medium,
      lowFindings: totals.low,
      agentsDeployed: this.list().filter(a => a.category === 'Security').length,
      lastScanTime: lastScan
    };
  }

  getRecommendedAgents(projectType: 'web' | 'api' | 'docker' | 'general'): SecurityAgentType[] {
    const recommendations: Record<string, SecurityAgentType[]> = {
      web: [
        SecurityAgentType.WEB_SECURITY_SCANNER,
        SecurityAgentType.CODE_SECURITY_ANALYZER,
        SecurityAgentType.SECRET_DETECTOR,
        SecurityAgentType.SSL_TLS_VALIDATOR
      ],
      api: [
        SecurityAgentType.CODE_SECURITY_ANALYZER,
        SecurityAgentType.DEPENDENCY_AUDITOR,
        SecurityAgentType.SECRET_DETECTOR
      ],
      docker: [
        SecurityAgentType.DOCKER_SECURITY_SCANNER,
        SecurityAgentType.VULNERABILITY_SCANNER,
        SecurityAgentType.COMPLIANCE_CHECKER
      ],
      general: [
        SecurityAgentType.VULNERABILITY_SCANNER,
        SecurityAgentType.CODE_SECURITY_ANALYZER,
        SecurityAgentType.SECRET_DETECTOR,
        SecurityAgentType.DEPENDENCY_AUDITOR
      ]
    };

    return recommendations[projectType] || recommendations.general;
  }
}

export const securityAgentRegistry = new SecurityAgentRegistry();
