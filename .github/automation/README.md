# Automation Directory

This directory contains files related to repository automation and bot activities.

## Files

### audit.log
Tracks all automated actions performed by Copilot and other automation tools. Each entry includes:
- Timestamp
- Agent/Bot name
- Action performed
- Related PR/Issue
- Status and notes

## Purpose

This directory serves as:
1. **Audit Trail**: Maintain a record of all automated changes
2. **Transparency**: Allow reviewers to understand automation decisions
3. **Debugging**: Help troubleshoot automation issues
4. **Compliance**: Meet audit and governance requirements

## Adding Entries

When automation tools perform actions, they should add entries to `audit.log` following the format defined in that file.

## Review Process

Maintainers should periodically review this log to:
- Verify automation is working as expected
- Identify patterns or issues
- Adjust automation policies if needed
