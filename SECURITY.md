# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by following these steps:

### Private Disclosure Process

1. **DO NOT** open a public issue for security vulnerabilities
2. Send a detailed report to the repository maintainers via one of these methods:
   - Open a [Security Advisory](https://github.com/Scarmonit/A2A/security/advisories/new) on GitHub
   - Contact the maintainer directly through GitHub

### What to Include in Your Report

Please provide as much information as possible to help us understand and resolve the issue:

- Type of vulnerability (e.g., XSS, SQL injection, remote code execution)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Within 7 days with a detailed plan for addressing the vulnerability
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### Disclosure Policy

- We will acknowledge your report within 48 hours
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible depending on complexity
- We will publicly disclose the vulnerability after a fix is available

### Security Best Practices

When contributing to this project:

1. **Never commit secrets**: No API keys, passwords, tokens, or credentials in code
2. **Use environment variables**: Store sensitive configuration in environment variables
3. **Update dependencies**: Keep dependencies up to date to avoid known vulnerabilities
4. **Code review**: All changes must pass automated security checks before merging
5. **Least privilege**: Request only the minimum permissions needed

### Automated Security Checks

This repository uses automated security scanning:

- Dependency vulnerability scanning
- Secret detection
- Static code analysis
- Security-focused linting

All PRs must pass these checks before merging.

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate responsible security researchers who help keep our project secure.

## Attribution

We will acknowledge security researchers who responsibly disclose vulnerabilities in our release notes and CHANGELOG (unless they prefer to remain anonymous).

Thank you for helping keep A2A MCP Server and our users safe!
