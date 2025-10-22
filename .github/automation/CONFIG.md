# Automation Configuration

## Auto-Merge Settings

### Enabled Conditions
- All CI checks pass
- Security scans pass
- No merge conflicts
- No `blocked` or `needs:review` labels
- Not a draft PR
- No BREAKING CHANGES

### Merge Strategy
- Method: Squash merge
- Commit message format: Includes PR title and number
- Bot signature: Included in commit body

## Release Automation

### Trigger Conditions
- Push to main branch with conventional commits
- Manual workflow dispatch

### Version Bump Rules
- **Patch**: Fix commits
- **Minor**: Feature commits
- **Major**: BREAKING CHANGE in commit

### Release Process
1. Analyze commits since last tag
2. Determine version bump type
3. Update package.json and CHANGELOG.md
4. Create git tag
5. Push changes
6. Create GitHub release

## Security Scanning

### Schedule
- On every push to main/develop
- On every pull request
- Daily at 2 AM UTC

### Scans Performed
- Dependency vulnerabilities (npm audit)
- Secret detection (TruffleHog)
- Code security analysis (CodeQL)
- License compliance

### Handling Findings
- Critical/High: Block PR merge
- Medium: Review required
- Low: Log for future review

## CI/CD Pipeline

### Build Process
1. Lint: TypeScript compiler check
2. Build: Compile TypeScript to JavaScript
3. Test: Verify server startup and functionality
4. Deploy: Push to configured platforms (on main branch)

### Deployment Platforms
- Railway (primary)
- Render (secondary)
- Fly.io (secondary)
- Vercel (serverless)

## Bot Identity

### GitHub Actions Bot
- Username: github-actions[bot]
- Email: github-actions[bot]@users.noreply.github.com
- Signature: Included in all automated commits

### Permissions
- Read: All repository content
- Write: Code, PRs, issues, releases
- Admin: None (requires manual intervention)

## Token Management

### Required Secrets
- `GITHUB_TOKEN`: Built-in (automatic)
- `RAILWAY_TOKEN`: Railway deployment
- `RENDER_SERVICE_ID`: Render deployment
- `RENDER_API_KEY`: Render deployment
- `FLY_API_TOKEN`: Fly.io deployment
- `VERCEL_TOKEN`: Vercel deployment
- `ORG_ID`: Vercel organization
- `PROJECT_ID`: Vercel project

### Rotation Policy
- Review tokens quarterly
- Rotate immediately if compromised
- Use minimum required scopes

## Escalation

### When to Escalate to Human
1. BREAKING CHANGES detected
2. Security vulnerabilities found
3. Deployment failures persist
4. Automation behavior is unclear
5. Repository settings changes needed

### Contact
- Primary: @Scarmonit (repository owner)
- Method: GitHub issues or mentions
- Response: Within 48 hours

## Revision History
- 2025-10-22: Initial automation configuration documented
