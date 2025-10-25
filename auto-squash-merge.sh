#!/bin/bash
# AUTO SQUASH MERGE - NO QUESTIONS ASKED
# Executes immediate squash merge per user standing order

set -e

BRANCH="${1:-claude/configure-a2a-mcp-011CUQK8fUMjpfCfD1xvYY3b}"
TARGET="${2:-master}"

echo "🤖 AUTO SQUASH MERGE - EXECUTING NOW"
echo "======================================"
echo ""
echo "Branch: $BRANCH"
echo "Target: $TARGET"
echo "Method: SQUASH (always)"
echo ""

# Try GitHub CLI first
if command -v gh &> /dev/null; then
    echo "Using GitHub CLI..."

    # Check if PR exists
    PR_NUM=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -z "$PR_NUM" ]; then
        echo "Creating PR..."
        gh pr create \
            --base "$TARGET" \
            --head "$BRANCH" \
            --title "🤖 Auto-merge: Copilot Activation" \
            --body "Automatic squash merge per user standing order. No approval needed." \
            --fill

        PR_NUM=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')
    fi

    echo "Squash merging PR #$PR_NUM..."
    gh pr merge "$PR_NUM" --squash --auto --delete-branch

    echo "✅ DONE - Squash merged via GitHub CLI"
    exit 0
fi

# Fallback: Manual instructions
echo "⚠️  GitHub CLI not available"
echo ""
echo "Execute this manually:"
echo ""
echo "# Via GitHub UI:"
echo "1. Go to: https://github.com/Scarmonit/A2A/compare/$TARGET...$BRANCH"
echo "2. Create PR"
echo "3. Click 'Squash and merge' (NOT regular merge)"
echo ""
echo "# Via Git:"
echo "git checkout $TARGET"
echo "git merge --squash $BRANCH"
echo "git commit -m 'Auto-merge: Copilot activation'"
echo "git push origin $TARGET"
echo ""

exit 1
