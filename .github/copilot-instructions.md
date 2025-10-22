# Copilot / Automation Instructions for Full Automation + Full Control

Purpose
- Define how Copilot-enabled automation agents and bots should behave in this repository, enabling safe, auditable automation that can create branches, open PRs, run checks, and merge when policies are met.

Scope & Authority
- Allowed automated actions (no extra manual approval unless stated):
  - Create feature/fix/chore/hotfix branches off the repository default branch.
  - Commit code, tests, and docs to new branches.
  - Open PRs with populated title, body, checklist, linked issues, and labels.
  - Trigger CI/CD via commits and PRs.
  - Auto-merge PRs when all automated merge rules are satisfied.
  - Draft and create releases when semantic-versioning criteria are met.
- Disallowed / restricted actions (require explicit human approval):
  - Direct pushes to protected branches (main/master/etc.) unless branch protection allows it.
  - Changing repository settings, branch protection, required reviewers, or secrets.
  - Adding/modifying secrets, credentials, or other sensitive config.
  - Force-pushes, reverting protected history, destructive infra changes affecting production without explicit maintainer approval.
  - Auto-merge for BREAKING CHANGES or major-version bumps — these always require a human maintainer approval.

Branch naming conventions
- feature/<short-desc>[-<ticket>]
- fix/<short-desc>[-<ticket>]
- chore/<short-desc>
- hotfix/<short-desc>

Commit message policy (Conventional Commits)
- Format: <type>(<scope>): <short summary>
- Body: optional longer description and rationale
- Footer: references: Closes #<issue>, BREAKING CHANGE: ...
- Accepted types: feat, fix, docs, style, refactor, perf, test, chore, ci

Automated PR content (agent should populate)
- Title: concise summary (optional prefix feat/fix/ci)
- Body:
  - Summary: what changed and why
  - Implementation notes
  - Test plan
  - Checklist:
    - [ ] Lint passes
    - [ ] Unit tests added/updated
    - [ ] Integration tests (if applicable)
    - [ ] Changelog updated
    - [ ] Version bump (if relevant)
- Labels to apply automatically where applicable:
  - type:feature, type:bug, type:chore, needs:review, needs:tests, blocked

Auto-merge rules
- Agent may auto-merge a PR only when ALL conditions are met:
  - All required CI checks & status checks pass.
  - Required reviews are completed (or no required-review rule is in place).
  - No merge conflicts with base branch.
  - No blocker labels (e.g., blocked).
  - PR does not include BREAKING CHANGE or major version bump.
- When auto-merge is performed, use squash or merge strategy consistent with project policy and include the automation identity in the commit body.

Security & Safety
- Never commit secrets, private keys, tokens, or credentials.
- If a potential secret is detected in any change, open a draft PR and a security issue; stop any auto-merge until secret rotation and removal are complete.
- Run static analysis, dependency vulnerability scanning, and secret scanning on every PR.
- Respect CODEOWNERS and required reviewers; assign code owners automatically when affected.
- Require signed commits or include agent signature metadata in PR/commit message when possible.

Auditability & Traceability
- All automated changes must reference the originating issue or task.
- Include a short changelog entry in CHANGELOG.md and mention it in the PR body.
- Agent identity and rationale must be present in commit messages and PR bodies for audit trails.
- Keep audit logs in repository (e.g., .github/automation/audit.log entries or documented PRs).

Quality & Developer Experience
- Agents must include unit tests and documentation updates with code changes.
- Prefer small, focused PRs. If a large change is necessary, break it into sequenced PRs tied to an umbrella issue.
- Provide reproducible test plans in PR bodies.

Failure & Escalation
- If unsure about behavior or a change touches infra/security/permissions, open an issue and assign maintainers rather than proceeding.
- If automated workflows fail repeatedly, open an issue with logs and disable further retries until a maintainer investigates.

Operational & Token Management
- Automation should use a named repository bot account if possible and include the bot name in commit/PR metadata.
- Track and rotate automation tokens according to organization policy.
- Limit scopes of tokens to least privilege required.

Enforcement via CI
- Required checks (examples — repository should wire these to workflows):
  - commit-message-lint
  - code-style (linters)
  - unit-test
  - integration-test (when applicable)
  - dependency-scan (vulns)
  - secret-scan
  - license-check
- Configure branch protection to require these checks for merges to protected branches.

Templates & Examples
- Example commit:
  feat(auth): add token refresh logic

  Add token refresh logic to handle expired tokens. Includes tests and updates to docs.

  Closes #123

- Example PR body automated population:
  Summary: One-line summary.
  Why: Why the change is necessary.
  What: Key changes.
  Tests: CI jobs that ran and manual test notes.
  Checklist:
  - [ ] Lint passes
  - [ ] Unit tests added
  - [ ] Integration tests (if applicable)
  - [ ] CHANGELOG updated

Revision & Governance
- Agents may propose changes to this file via PR; changes to the automation policy must be reviewed/approved by repo maintainers.
- Maintain a revision history section at the bottom of this file.

Contact & Incident Response
- Tag maintainers in CODEOWNERS for questions about automation behavior.
- Follow repository SECURITY.md for incidents and notify maintainers immediately.

Revision history
- 2025-10-22: Initial full-automation proposal.
