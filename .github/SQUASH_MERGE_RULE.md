# PERMANENT RULE: ALWAYS SQUASH AND MERGE

## STANDING ORDER FROM USER

**Date**: 2025-10-23
**Authority**: Repository Owner (Scarmonit)
**Scope**: ALL merges, forever

---

## THE RULE

**ALWAYS SQUASH AND MERGE. NO EXCEPTIONS. NO ASKING.**

This is a **STANDING ORDER**. Do not ask permission. Do not check. Just do it.

---

## What This Means

When merging ANY branch:
- ✅ USE: `--squash` flag ALWAYS
- ✅ Clean git history
- ✅ Single commit per merge
- ❌ NEVER use regular merge
- ❌ NEVER use rebase merge
- ❌ NEVER ask about merge strategy

---

## Implementation

### Git Command
```bash
git merge --squash <branch>
git commit
git push
```

### GitHub CLI
```bash
gh pr merge --squash <pr>
```

### GitHub API
```json
{
  "merge_method": "squash"
}
```

### Auto-Merge Workflow
```yaml
merge_method: 'squash'
```

---

## Configuration

### GitHub Repository Settings
**Merge button**: Only "Squash and merge" allowed

### All Automation
- CI/CD: Use squash
- Copilot workflows: Use squash
- Claude merges: Use squash
- Auto-merge: Use squash

---

## Exceptions

**NONE**. There are no exceptions. Always squash.

---

## Why Squash

User preference: Clean history, single commit per feature.

---

## Claude's Directive

When Claude (or any automation) performs a merge:

1. ❌ DO NOT ask "Should I squash?"
2. ❌ DO NOT ask "What merge method?"
3. ❌ DO NOT present options
4. ✅ JUST SQUASH AND MERGE
5. ✅ Report it was done
6. ✅ Move on

---

## Enforcement

This is NON-NEGOTIABLE and PERMANENT until explicitly revoked by user.

Any merge that doesn't squash is WRONG and should be fixed.

---

**Established**: 2025-10-23
**Authority**: Repository Owner Standing Order
**Status**: PERMANENT AND ACTIVE
