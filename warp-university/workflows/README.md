# Workflows

This directory contains battle-tested Warp Terminal workflows, SQL REPL commands, testing prompts, PR review templates, and agent profile configurations for consistent and efficient development.

## Contents

- **SQL REPL Commands**: Pre-configured database interaction templates
- **Testing Prompts**: Automated testing frameworks and prompt patterns
- **PR Review Templates**: Standardized pull request review workflows
- **Agent Profiles**: AI assistant configurations for consistent interactions

## SQL REPL Commands

### Database Query Templates

```sql
-- Quick schema inspection
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Performance analysis
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Active connections
SELECT pid, usename, application_name, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

### Database Optimization Queries

```sql
-- Find missing indexes
SELECT schemaname, tablename, 
       seq_scan, seq_tup_read,
       idx_scan, idx_tup_fetch,
       seq_tup_read / seq_scan AS avg_seq_tup
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 25;

-- Vacuum and analyze recommendations
SELECT schemaname, tablename,
       n_dead_tup,
       n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_percentage,
       last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## Testing Prompts

### Unit Test Generation Prompt

```markdown
Generate comprehensive unit tests for the following code:

[PASTE CODE HERE]

Requirements:
- Cover all public methods and functions
- Include edge cases and error conditions
- Use descriptive test names following the pattern: test_<method>_<condition>_<expected_result>
- Mock external dependencies
- Aim for >90% code coverage
- Include setup and teardown when necessary

Test framework: [Jest/PyTest/JUnit/etc]
```

### Integration Test Prompt

```markdown
Create integration tests for the following API endpoints:

[LIST ENDPOINTS]

Test scenarios:
1. Happy path - valid requests with expected responses
2. Authentication/authorization failures
3. Invalid input validation
4. Rate limiting behavior
5. Error handling and recovery
6. Concurrent request handling

Include:
- Test data fixtures
- API client setup
- Assertion helpers
- Cleanup procedures
```

### E2E Test Scenario Prompt

```markdown
Design end-to-end test scenarios for the following user journey:

[DESCRIBE USER JOURNEY]

Include:
- Step-by-step user actions
- Expected system responses
- Data setup requirements
- Validation checkpoints
- Teardown procedures

Tool: [Playwright/Cypress/Selenium]
```

## PR Review Templates

### Standard PR Review Checklist

```markdown
## Code Review Checklist

### Functionality
- [ ] Code accomplishes the intended purpose
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive
- [ ] No obvious bugs or logic errors

### Code Quality
- [ ] Code is readable and well-structured
- [ ] Functions/methods are appropriately sized
- [ ] Variable and function names are descriptive
- [ ] Comments explain "why" not "what"
- [ ] No code duplication
- [ ] Follows project coding standards

### Testing
- [ ] Unit tests cover new functionality
- [ ] Integration tests added where appropriate
- [ ] All tests pass
- [ ] Edge cases are tested
- [ ] Test coverage meets project standards

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation is present
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention
- [ ] CSRF protection where applicable
- [ ] Authentication/authorization checks

### Performance
- [ ] No obvious performance bottlenecks
- [ ] Database queries are optimized
- [ ] Caching used appropriately
- [ ] No N+1 query problems

### Documentation
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Inline documentation for complex logic
- [ ] Migration guides if breaking changes

### Dependencies
- [ ] New dependencies justified and secure
- [ ] Dependencies up to date
- [ ] License compatibility checked
```

### AI-Assisted Review Prompt

```markdown
Review the following pull request and provide detailed feedback:

PR Title: [TITLE]
Description: [DESCRIPTION]
Files Changed: [LIST FILES]

[PASTE DIFF]

Provide feedback on:
1. Code quality and maintainability
2. Potential bugs or issues
3. Security concerns
4. Performance implications
5. Test coverage
6. Documentation completeness
7. Suggested improvements

Format feedback as:
- 🔴 Critical: Must be fixed
- 🟡 Important: Should be addressed
- 🟢 Suggestion: Nice to have
```

## Agent Profiles Configuration

### Senior Developer Profile

```yaml
name: "Senior Developer Assistant"
context:
  role: "Experienced software engineer with 10+ years"
  expertise:
    - System architecture
    - Code review
    - Performance optimization
    - Best practices
  
default_behaviors:
  - Suggest architectural improvements
  - Identify potential scalability issues
  - Recommend design patterns
  - Focus on maintainability
  - Consider security implications
  
code_review_focus:
  - SOLID principles adherence
  - DRY violations
  - Performance bottlenecks
  - Security vulnerabilities
  - Test coverage

response_style:
  - Detailed explanations
  - Include trade-offs
  - Provide alternatives
  - Reference best practices
```

### DevOps Engineer Profile

```yaml
name: "DevOps Engineer Assistant"
context:
  role: "Infrastructure and deployment specialist"
  expertise:
    - CI/CD pipelines
    - Container orchestration
    - Cloud infrastructure
    - Monitoring and logging
  
default_behaviors:
  - Optimize deployment workflows
  - Suggest infrastructure improvements
  - Focus on automation
  - Consider scalability
  - Emphasize observability
  
review_focus:
  - Dockerfile best practices
  - CI/CD configuration
  - Resource optimization
  - Security hardening
  - Backup and recovery

response_style:
  - Practical, actionable advice
  - Include monitoring strategies
  - Suggest automation opportunities
```

### Security Engineer Profile

```yaml
name: "Security Engineer Assistant"
context:
  role: "Application security specialist"
  expertise:
    - OWASP Top 10
    - Secure coding practices
    - Vulnerability assessment
    - Compliance requirements
  
default_behaviors:
  - Identify security vulnerabilities
  - Suggest secure alternatives
  - Validate input/output handling
  - Check authentication/authorization
  - Review dependency security
  
review_focus:
  - SQL injection risks
  - XSS vulnerabilities
  - CSRF protection
  - Secrets management
  - Access control

response_style:
  - Risk-focused analysis
  - Include severity ratings
  - Provide remediation steps
  - Reference security standards
```

## Usage Examples

### Warp Workflow: Database Debug Session

```bash
# Start interactive SQL session
warp workflow run db-debug

# Run schema inspection
@sql-inspect-schema

# Analyze slow queries
@sql-performance-analysis

# Check connection pool status
@sql-active-connections
```

### Warp Workflow: PR Review Session

```bash
# Open PR review workflow
warp workflow run pr-review

# Load review template
@pr-review-checklist

# Run AI-assisted review
@ai-code-review [PR_URL]

# Generate review summary
@pr-review-summary
```

### Warp Workflow: Test Generation

```bash
# Start test generation workflow
warp workflow run test-gen

# Generate unit tests
@generate-unit-tests [FILE_PATH]

# Generate integration tests
@generate-integration-tests [API_SPEC]

# Run test coverage analysis
@test-coverage-report
```

## Best Practices

1. **SQL Commands**:
   - Always use parameterized queries
   - Test on non-production data first
   - Include LIMIT clauses for large result sets
   - Document complex queries

2. **Testing Prompts**:
   - Be specific about test framework and conventions
   - Include context about the application domain
   - Specify coverage requirements
   - Request both positive and negative test cases

3. **PR Reviews**:
   - Use templates consistently across team
   - Customize checklists for project needs
   - Combine manual review with AI assistance
   - Document rationale for significant changes

4. **Agent Profiles**:
   - Maintain separate profiles for different contexts
   - Update profiles based on team feedback
   - Include project-specific conventions
   - Balance detail with flexibility

## Customization

All workflows can be customized for your specific needs:

1. Copy the template
2. Modify queries, prompts, or checklists
3. Save as a new workflow
4. Share with your team

## Contributing

To add new workflows:

1. Create a descriptive filename
2. Include comprehensive documentation
3. Add usage examples
4. Test thoroughly before committing

---

*These workflows are continuously refined based on real-world usage and feedback.*
