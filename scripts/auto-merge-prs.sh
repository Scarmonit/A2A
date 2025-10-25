#!/bin/bash
set -e

echo '🤖 Automated PR Merge Script'
echo '================================'

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo '❌ Error: GitHub CLI (gh) is not installed'
    echo 'Please run scripts/gh-cli-install.sh first'
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo '❌ Error: Not authenticated with GitHub'
    echo 'Please run: gh auth login'
    exit 1
fi

echo '✓ GitHub CLI authenticated'

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"

# List open PRs
echo ''
echo '📋 Open Pull Requests:'
gh pr list --state open --json number,title,author,headRefName

# Auto-merge eligible PRs
echo ''
echo '🔄 Checking for auto-mergeable PRs...'

# Get all open PRs
PRS=$(gh pr list --state open --json number -q '.[].number')

if [ -z "$PRS" ]; then
    echo '✓ No open PRs to process'
    exit 0
fi

MERGED_COUNT=0

for PR_NUMBER in $PRS; do
    echo ''
    echo "Checking PR #$PR_NUMBER..."
    
    # Get PR details
    PR_INFO=$(gh pr view $PR_NUMBER --json title,state,mergeable,statusCheckRollup,reviewDecision)
    
    MERGEABLE=$(echo "$PR_INFO" | jq -r '.mergeable')
    STATUS=$(echo "$PR_INFO" | jq -r '.statusCheckRollup[0].state // "UNKNOWN"')
    REVIEW=$(echo "$PR_INFO" | jq -r '.reviewDecision // "NONE"')
    TITLE=$(echo "$PR_INFO" | jq -r '.title')
    
    echo "  Title: $TITLE"
    echo "  Mergeable: $MERGEABLE"
    echo "  CI Status: $STATUS"
    echo "  Review Status: $REVIEW"
    
    # Auto-merge if conditions are met
    if [ "$MERGEABLE" = "MERGEABLE" ] && [ "$STATUS" = "SUCCESS" ]; then
        echo "  ✅ Auto-merging PR #$PR_NUMBER..."
        
        if gh pr merge $PR_NUMBER --squash --auto; then
            echo "  ✓ PR #$PR_NUMBER merged successfully"
            MERGED_COUNT=$((MERGED_COUNT + 1))
        else
            echo "  ⚠️  Failed to merge PR #$PR_NUMBER"
        fi
    else
        echo "  ⏭️  Skipping PR #$PR_NUMBER (not ready for auto-merge)"
    fi
done

echo ''
echo '================================'
echo "✓ Processed PRs. Merged: $MERGED_COUNT"
echo '================================'
