# Security

This directory provides secrets prevention patterns, security testing frameworks, and continuous security automation aligned with OWASP and industry best practices.

## Contents
- Secrets prevention
- Security testing frameworks
- Continuous scanning and governance

## Secrets Prevention

### Git Hooks: .git/hooks/pre-commit
```bash
#!/usr/bin/env bash
set -euo pipefail

# Block commits that contain high-risk secrets
patterns=(
  'AKIA[0-9A-Z]{16}'         # AWS Access Key ID
  'AIza[0-9A-Za-z\-_]{35}'   # Google API Key
  'ghp_[0-9A-Za-z]{36,}'     # GitHub PAT
  'ssh-rsa AAAA'             # SSH private blocks
  'BEGIN RSA PRIVATE KEY'    # PEM private key
)

files=$(git diff --cached --name-only --diff-filter=ACM)
for f in $files; do
  content=$(git show :"$f")
  for p in "${patterns[@]}"; do
    if echo "$content" | grep -E "$p" -q; then
      echo "[SECURITY] Potential secret detected in $f"
      exit 1
    fi
  done
done
```

### Git Attributes and Filters
```
# .gitattributes
secrets/** filter=redact
```

```
# .gitconfig (project)
[filter "redact"]
  clean = "sed -E 's/(AKIA[0-9A-Z]{16})/[REDACTED]/g'"
  smudge = cat
```

## Security Testing Frameworks

### DAST with OWASP ZAP
```yaml
# .github/workflows/security-zap.yml
name: Security - ZAP DAST
on: [push, pull_request]
jobs:
  zap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ZAP Baseline
        uses: zaproxy/action-baseline@v0.11.0
        with:
          target: ${{ secrets.APP_URL }}
          cmd_options: '-a -j'
```

### SAST with Semgrep
```yaml
# .github/workflows/security-semgrep.yml
name: Security - Semgrep
on: [push, pull_request]
jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: 'p/ci'
```

### Dependency Scanning
```yaml
# .github/workflows/security-deps.yml
name: Security - Dependencies
on: [push, pull_request]
jobs:
  deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx audit-ci --moderate --report
```

## Governance and Policies
- Enforce CODEOWNERS for sensitive paths
- Require signed commits for protected branches
- Mandatory reviews for security-related changes
- Rotate credentials; use short-lived tokens
- Centralize secrets in a vault (e.g., AWS Secrets Manager, Vault)

## Best Practices
1. Shift-left: detect issues in PRs
2. Block on critical findings, warn on low severity
3. Maintain an incident runbook
4. Log and monitor security automation results
5. Train contributors on secret hygiene
