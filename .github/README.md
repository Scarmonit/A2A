# GitHub Configuration Directory

This directory contains all GitHub-specific configuration and automation files.

## Structure

```
.github/
├── automation/              # Automation audit logs and config
│   ├── audit.log           # Audit trail of automated actions
│   ├── CONFIG.md           # Automation configuration details
│   └── README.md           # Automation directory documentation
├── ISSUE_TEMPLATE/          # Issue templates
│   ├── bug_report.md       # Bug report template
│   ├── feature_request.md  # Feature request template
│   └── documentation.md    # Documentation issue template
├── workflows/               # GitHub Actions workflows
│   ├── ci.yml              # Continuous Integration (lint, build, test)
│   ├── security.yml        # Security scanning and analysis
│   ├── deploy.yml          # Deployment automation
│   ├── auto-merge.yml      # Automated PR merging
│   └── release.yml         # Release automation
├── copilot-instructions.md  # Instructions for GitHub Copilot
└── pull_request_template.md # Pull request template
```

## Key Files

### copilot-instructions.md
Comprehensive instructions for GitHub Copilot and automation agents, including:
- Repository context and structure
- Allowed and disallowed actions
- Branch naming conventions
- Commit message guidelines
- Auto-merge rules
- Security policies
- Code quality standards

### Workflows

#### ci.yml
- Runs on: Push to branches, pull requests
- Jobs: Lint, build, test, status check
- Purpose: Ensure code quality and functionality

#### security.yml
- Runs on: Push, pull requests, daily schedule
- Jobs: Dependency scan, secret detection, CodeQL analysis, license check
- Purpose: Maintain security and compliance

#### deploy.yml
- Runs on: Push to main branch
- Jobs: Test, deploy to Railway/Render/Fly.io/Vercel
- Purpose: Automated deployment to production

#### auto-merge.yml
- Runs on: PR events, check suite completion
- Jobs: Validate conditions, auto-merge if criteria met
- Purpose: Automate PR merging when safe

#### release.yml
- Runs on: Push to main, manual trigger
- Jobs: Check for releasable changes, create releases
- Purpose: Automate version bumping and releases

### Issue Templates
Provide structured forms for:
- Bug reports with environment details
- Feature requests with problem statements
- Documentation improvements

### Pull Request Template
Standardized PR format including:
- Description and type of change
- Related issues
- Testing details
- Comprehensive checklist
- Breaking changes section

## Automation Policies

### Branch Protection
Configure branch protection rules for `main`:
- Require CI checks to pass
- Require security scans to pass
- Require at least one approval (optional)
- No force pushes
- No deletions

### Required Status Checks
- CI Status Check
- Security scanning
- CodeQL analysis

### Auto-Merge Criteria
All must be true:
- All CI checks pass
- All security scans pass
- No merge conflicts
- No blocking labels
- Not a draft PR
- No BREAKING CHANGES (requires manual approval)

## Maintenance

### Regular Tasks
1. Review automation audit log monthly
2. Update workflows when dependencies change
3. Rotate secrets quarterly
4. Review and update templates as needed

### When to Update
- New automation patterns emerge
- Security policies change
- New CI/CD tools adopted
- Team workflows evolve

## Contributing

When modifying GitHub configuration:
1. Test workflow changes in a fork first
2. Document changes in PR description
3. Update this README if structure changes
4. Get maintainer approval for security-related changes

## Support

For questions about GitHub configuration:
- Open an issue with `type:docs` label
- Tag @Scarmonit for urgent matters
- Refer to GitHub Actions documentation
