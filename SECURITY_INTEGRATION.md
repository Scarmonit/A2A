# Security Integration - awesome-hacking Implementation

## Overview

This document describes the integration of defensive security capabilities from the [awesome-hacking](https://github.com/carpedm20/awesome-hacking) repository into the A2A MCP Server.

**IMPORTANT**: All implemented capabilities are **DEFENSIVE ONLY**. This integration focuses exclusively on:
- ✅ Vulnerability scanning and detection
- ✅ Security monitoring and alerting
- ✅ Code security analysis
- ✅ Compliance validation
- ✅ Threat detection and response
- ❌ NO offensive security tools
- ❌ NO exploit frameworks
- ❌ NO attack tools

## Architecture

### Security Agent System

The security system consists of four main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Agent Registry                   │
│  Manages deployment and coordination of security agents     │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼────────┐ ┌──▼──────────┐ ┌▼────────────────┐
│ Security Agents│ │  Scanners   │ │   Workflows     │
│  (18 types)    │ │  (4 types)  │ │  (10 types)     │
└────────────────┘ └─────────────┘ └─────────────────┘
```

### Component Details

#### 1. Security Agents (`src/security-agents.ts`)

**18 Defensive Security Agent Types:**

**Vulnerability Detection:**
- `VULNERABILITY_SCANNER` - CVE database lookups, system vulnerability scanning
- `DEPENDENCY_AUDITOR` - npm/yarn/pnpm dependency security auditing
- `DOCKER_SECURITY_SCANNER` - Container image vulnerability scanning
- `WEB_SECURITY_SCANNER` - OWASP Top 10, XSS, SQLi, CSRF detection

**Code Analysis:**
- `CODE_SECURITY_ANALYZER` - Static code analysis for security flaws
- `SECRET_DETECTOR` - Hardcoded secret/credential detection
- `STATIC_ANALYZER` - Comprehensive static security analysis

**Monitoring & Detection:**
- `NETWORK_MONITOR` - Network traffic security monitoring
- `TRAFFIC_ANALYZER` - Packet analysis for threats
- `INTRUSION_DETECTOR` - Real-time intrusion detection

**Compliance & Hardening:**
- `COMPLIANCE_CHECKER` - CIS, OWASP, PCI-DSS, SOC2 validation
- `SECURITY_HARDENING` - Security configuration recommendations
- `SSL_TLS_VALIDATOR` - Certificate and TLS configuration validation

**Forensics & Response:**
- `LOG_ANALYZER` - Security event log analysis
- `INCIDENT_RESPONDER` - Automated incident response workflows
- `THREAT_HUNTER` - Proactive threat hunting (IOCs, TTPs)

**Cryptography:**
- `CRYPTO_VALIDATOR` - Cryptographic implementation validation
- `CERTIFICATE_MONITOR` - SSL/TLS certificate monitoring

#### 2. Security Scanners (`src/security-scanner.ts`)

**Four Scanner Implementations:**

1. **VulnerabilityScanner**
   - Dependency vulnerability scanning via npm audit
   - Docker image security analysis
   - CVE database integration
   - Severity classification

2. **CodeSecurityAnalyzer**
   - Pattern-based security issue detection
   - Detects: eval(), innerHTML, XSS vectors, crypto misuse
   - Multi-language support (JS, TS, Python, Go, Java)
   - Location-specific findings with line numbers

3. **SecretDetector**
   - API key detection
   - Password/credential scanning
   - Private key discovery
   - Token and authorization header detection
   - Regex-based pattern matching

4. **ComplianceChecker**
   - OWASP compliance validation
   - CIS benchmark checking
   - PCI-DSS requirement validation
   - Custom standard support

#### 3. Security Workflows (`src/security-workflows.ts`)

**10 Pre-defined Security Workflows:**

1. **Quick Security Scan** - Fast scan for common issues
   - Secret detection
   - Dependency audit
   - ~2-5 seconds execution

2. **Comprehensive Security Assessment** - Full audit
   - All vulnerability scanners
   - Complete code analysis
   - Compliance checks
   - ~30-60 seconds execution

3. **Pre-Commit Security Check** - Run before commits
   - Secret scanning
   - Code security analysis
   - Prevents vulnerable code commits

4. **CI/CD Security Pipeline** - Continuous integration
   - Automated dependency audits
   - Code security checks
   - Compliance validation
   - Exit codes for CI/CD integration

5. **Production Readiness Check** - Pre-deployment audit
   - Complete vulnerability assessment
   - Security hardening verification
   - Compliance validation
   - Comprehensive reporting

6. **Docker Security Audit** - Container security
   - Image vulnerability scanning
   - CIS Docker benchmark
   - Configuration validation

7. **Web Application Security Test** - Web app focus
   - OWASP Top 10 checking
   - SSL/TLS validation
   - Security header verification

8. **Compliance Audit** - Standards validation
   - Multiple standards (OWASP, CIS, PCI-DSS)
   - Gap analysis
   - Remediation recommendations

9. **Continuous Monitoring** - Ongoing security
   - Real-time monitoring
   - Anomaly detection
   - Threat hunting

10. **Incident Response** - Security incident handling
    - Automated analysis
    - Threat assessment
    - Response coordination

## Integrated Tools

### From awesome-hacking Repository

**Vulnerability Scanning:**
- npm audit (dependency vulnerabilities)
- OWASP Dependency-Check
- CVE Database (National Vulnerability Database)
- Docker Bench Security
- Trivy (container scanning)

**Code Analysis:**
- Semgrep (multi-language SAST)
- Bandit (Python security)
- ESLint Security (JavaScript)
- Gosec (Go security)

**Secret Detection:**
- TruffleHog (git secret scanning)
- git-secrets (pre-commit protection)
- detect-secrets (secret patterns)
- Keyscope (key validation)

**Docker Security:**
- Docker Bench for Security
- Trivy
- Clair
- Container best practices

**Web Security:**
- OWASP ZAP (web app scanner)
- Nikto (web server scanner)
- w3af (web app attack framework - defensive mode)
- testssl.sh (SSL/TLS testing)

**Network Analysis:**
- Wireshark (packet analysis)
- tcpdump (packet capture)
- NetworkMiner (forensics)
- Zeek/Suricata (IDS)

**Compliance:**
- OpenSCAP (security compliance)
- CIS-CAT (CIS benchmarks)
- InSpec (compliance as code)

## Usage

### Basic Usage

```javascript
import { SecurityAgentType, securityAgentRegistry } from './dist/src/security-agents.js';
import { securityScanner } from './dist/src/security-scanner.js';
import { securityWorkflows } from './dist/src/security-workflows.js';

// Deploy security agents
const agent = securityAgentRegistry.deploySecurityAgent(
  SecurityAgentType.VULNERABILITY_SCANNER
);

// Run a quick scan
const result = await securityWorkflows.quickSecurityScan('./path/to/project');

console.log(securityWorkflows.formatWorkflowResult(result));
```

### Comprehensive Scan

```javascript
// Run full security assessment
const result = await securityWorkflows.comprehensiveSecurityAssessment('./project');

// Check results
if (result.summary.criticalFindings > 0) {
  console.error('CRITICAL vulnerabilities found!');
  process.exit(1);
}
```

### CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Run Security Scan
        run: node demo-security-agents.js

      - name: CI/CD Security Pipeline
        run: |
          node -e "
          import('./dist/src/security-workflows.js').then(async ({ securityWorkflows }) => {
            const result = await securityWorkflows.cicdSecurityPipeline('.');
            if (result.status === 'failed') process.exit(1);
          });
          "
```

### Pre-Commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Running security checks..."

node -e "
import('./dist/src/security-workflows.js').then(async ({ securityWorkflows }) => {
  const result = await securityWorkflows.preCommitSecurityCheck('.');
  if (result.summary.criticalFindings > 0) {
    console.error('CRITICAL security issues detected. Commit blocked.');
    process.exit(1);
  }
});
"
```

## Security Scan Results

### Result Structure

```typescript
interface SecurityScanResult {
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
```

### Finding Details

```typescript
interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  location?: string;  // File path and line number
  remediation: string;
  references?: string[];  // Links to documentation
  cve?: string[];  // CVE identifiers
}
```

## Best Practices

### 1. Regular Scanning

```javascript
// Run daily comprehensive scan
import cron from 'node-cron';

cron.schedule('0 0 * * *', async () => {
  const result = await securityWorkflows.comprehensiveSecurityAssessment('./');
  // Send results to monitoring system
});
```

### 2. Fail Fast in CI/CD

```javascript
const result = await securityWorkflows.cicdSecurityPipeline('./');

if (result.summary.criticalFindings > 0) {
  console.error('CRITICAL vulnerabilities detected!');
  process.exit(1);  // Fail the build
}
```

### 3. Prioritize Findings

```javascript
// Sort findings by severity
const sortedFindings = result.scanResults
  .flatMap(r => r.findings)
  .sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

// Handle critical first
for (const finding of sortedFindings.filter(f => f.severity === 'critical')) {
  console.error(`URGENT: ${finding.title}`);
  console.error(`  Fix: ${finding.remediation}`);
}
```

### 4. Track Security Posture

```javascript
// Monitor security metrics over time
const posture = securityAgentRegistry.getSecurityPosture();

console.log(`Critical: ${posture.criticalFindings} (target: 0)`);
console.log(`High: ${posture.highFindings} (target: < 5)`);
console.log(`Medium: ${posture.mediumFindings} (target: < 20)`);
```

## Performance

### Scan Performance Benchmarks

| Workflow | Typical Duration | Agents Used |
|----------|------------------|-------------|
| Quick Scan | 2-5 seconds | 2 |
| Pre-Commit | 5-10 seconds | 2-3 |
| CI/CD Pipeline | 15-30 seconds | 4-5 |
| Comprehensive | 30-60 seconds | 6+ |
| Docker Audit | 10-20 seconds | 3 |
| Compliance | 20-40 seconds | 2-4 |

### Optimization Tips

1. **Parallel Scans**: All scanners run in parallel for maximum speed
2. **Incremental Scans**: Only scan changed files in pre-commit hooks
3. **Caching**: Cache dependency audit results for faster CI/CD
4. **Selective Scans**: Use targeted workflows for specific needs

## Security Standards Compliance

### OWASP ASVS

- ✅ V1: Architecture, Design and Threat Modeling
- ✅ V2: Authentication
- ✅ V3: Session Management
- ✅ V5: Validation, Sanitization and Encoding
- ✅ V6: Stored Cryptography
- ✅ V7: Error Handling and Logging
- ✅ V8: Data Protection
- ✅ V10: Malicious Code

### CIS Benchmarks

- ✅ CIS Docker Benchmark
- ✅ CIS Kubernetes Benchmark
- ✅ CIS Node.js Benchmark

### PCI-DSS

- ✅ Requirement 6: Develop and maintain secure systems
- ✅ Requirement 11: Test security systems regularly

## Troubleshooting

### Common Issues

**Issue**: Scan takes too long
- **Solution**: Use `quickSecurityScan` or targeted workflows

**Issue**: Too many false positives
- **Solution**: Configure severity thresholds, use `.securityignore` file

**Issue**: CI/CD failing on warnings
- **Solution**: Adjust failure thresholds, focus on critical/high only

**Issue**: Docker scans not working
- **Solution**: Ensure Docker is installed and images are pulled locally

## API Reference

### Security Agent Registry

```typescript
// Deploy single agent
securityAgentRegistry.deploySecurityAgent(SecurityAgentType.VULNERABILITY_SCANNER);

// Deploy multiple agents
securityAgentRegistry.deploySecuritySuite([
  SecurityAgentType.CODE_SECURITY_ANALYZER,
  SecurityAgentType.SECRET_DETECTOR
]);

// Get deployed agents
const agents = securityAgentRegistry.getSecurityAgents();

// Get security posture
const posture = securityAgentRegistry.getSecurityPosture();

// Get recommendations
const recommended = securityAgentRegistry.getRecommendedAgents('web');
```

### Security Scanner

```typescript
// Scan dependencies
const depResult = await securityScanner.scanDependencies('./project');

// Analyze code
const codeResult = await securityScanner.analyzeCode('./project');

// Scan for secrets
const secretResult = await securityScanner.scanSecrets('./project');

// Check compliance
const compResult = await securityScanner.checkCompliance('./project', 'OWASP');

// Comprehensive scan
const allResults = await securityScanner.runComprehensiveScan('./project');
```

### Security Workflows

```typescript
// Quick scan
const quick = await securityWorkflows.quickSecurityScan('./project');

// Comprehensive assessment
const comprehensive = await securityWorkflows.comprehensiveSecurityAssessment('./project');

// Pre-commit check
const preCommit = await securityWorkflows.preCommitSecurityCheck('./project');

// CI/CD pipeline
const cicd = await securityWorkflows.cicdSecurityPipeline('./project');

// Production readiness
const prod = await securityWorkflows.productionReadinessCheck('./project');

// Docker audit
const docker = await securityWorkflows.dockerSecurityAudit('./project', 'image:tag');

// Web app test
const web = await securityWorkflows.webApplicationSecurityTest('./project');

// Compliance audit
const compliance = await securityWorkflows.complianceAudit('./project', ['OWASP', 'CIS']);

// Format results
const formatted = securityWorkflows.formatWorkflowResult(result);
```

## Resources

- **awesome-hacking**: https://github.com/carpedm20/awesome-hacking
- **OWASP**: https://owasp.org/
- **CIS Benchmarks**: https://www.cisecurity.org/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CVE Database**: https://cve.mitre.org/
- **MITRE ATT&CK**: https://attack.mitre.org/

## License

This security integration uses only open-source defensive security tools and complies with all licensing requirements.

## Support

For issues or questions:
1. Check this documentation
2. Review the demo: `node demo-security-agents.js`
3. Check scan results for recommendations
4. Consult awesome-hacking repository for tool-specific documentation
