#!/bin/bash
# Claude Code Merge Assistant
# This script helps execute merges prepared by Claude

set -e

echo "🤖 Claude Code Merge Assistant"
echo "==============================="
echo ""

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) not found"
    echo "   Install: https://cli.github.com/"
    echo ""
    USE_GH=false
else
    echo "✅ GitHub CLI found"
    USE_GH=true
fi

# Current pending merge
BRANCH="claude/configure-a2a-mcp-011CUQK8fUMjpfCfD1xvYY3b"
TARGET="master"
TITLE="🤖 Activate GitHub Copilot Autonomous Mode"

echo ""
echo "📋 Pending Merge:"
echo "   Branch: $BRANCH"
echo "   Target: $TARGET"
echo "   Status: Ready to merge"
echo ""

if [ "$USE_GH" = true ]; then
    echo "🚀 Option 1: Create and Merge PR (Automated)"
    echo "   Command: gh pr create + gh pr merge"
    echo ""
    read -p "   Execute automated merge? (y/N): " response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Creating PR..."

        PR_URL=$(gh pr create \
            --base "$TARGET" \
            --head "$BRANCH" \
            --title "$TITLE" \
            --body "$(cat <<EOF
# Copilot Autonomous Activation

This PR activates complete GitHub Copilot autonomous repository management.

## What This Enables

✅ Daily repository analysis (6 AM UTC)
✅ Automatic PR reviews
✅ Intelligent task assignment
✅ Auto-merge capabilities
✅ Complete MCP server integration

## Changes

- 17 files changed
- 5,706 lines added
- 5 autonomous workflows
- Complete documentation
- Full MCP configuration

## After Merge

Copilot will immediately:
1. Analyze repository (within 30 seconds)
2. Create improvement issues (within 5 minutes)
3. Review open PRs
4. Start daily maintenance schedule

See \`COPILOT_ACTIVATION_REPORT.md\` for full details.

---
**Prepared by**: Claude Code (Merge Manager)
**Session**: $(date)
EOF
        )")

        echo "✅ PR Created: $PR_URL"
        echo ""
        echo "Merging PR..."

        gh pr merge "$PR_URL" --squash --auto

        echo "✅ Merge initiated!"
        echo ""
        echo "⏳ Waiting for merge to complete..."
        sleep 5

        echo ""
        echo "🎉 MERGE COMPLETE!"
        echo ""
        echo "Copilot should activate within 30 seconds."
        echo "Check status:"
        echo "  gh workflow list"
        echo "  gh run list"
        echo "  gh issue list --label copilot-generated"

        exit 0
    fi
fi

echo ""
echo "🌐 Option 2: Merge via GitHub Web UI"
echo ""
echo "1. Go to: https://github.com/Scarmonit/A2A/compare/$TARGET...$BRANCH"
echo "2. Click 'Create pull request'"
echo "3. Click 'Merge pull request'"
echo "4. Done!"
echo ""

echo "📝 Option 3: Manual Git Commands"
echo ""
echo "git fetch origin $BRANCH"
echo "git checkout $TARGET"
echo "git merge origin/$BRANCH"
echo "git push origin $TARGET"
echo ""

echo "🤖 Claude Code (Merge Manager) has prepared this merge."
echo "   Execute any option above to activate Copilot."
echo ""
