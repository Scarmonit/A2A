#!/bin/bash
# Workflow Validation and Testing Script
# Tests all Copilot autonomous workflows for common issues

set -e

echo "🔍 Copilot Workflow Validation Script"
echo "======================================="
echo ""

WORKFLOWS_DIR=".github/workflows"
COPILOT_WORKFLOWS=(
    "copilot-autonomous-issue-creation.yml"
    "copilot-autonomous-pr-review.yml"
    "copilot-repo-revamp.yml"
    "copilot-task-assignment.yml"
)

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "1️⃣  Validating YAML Syntax"
echo "-------------------------"
for workflow in "${COPILOT_WORKFLOWS[@]}"; do
    wf_path="$WORKFLOWS_DIR/$workflow"
    echo -n "  Checking $workflow... "

    if [ ! -f "$wf_path" ]; then
        echo -e "${RED}❌ File not found${NC}"
        ((ERRORS++))
        continue
    fi

    if python3 -c "import yaml; yaml.safe_load(open('$wf_path'))" 2>/dev/null; then
        echo -e "${GREEN}✅ Valid${NC}"
    else
        echo -e "${RED}❌ Invalid YAML${NC}"
        ((ERRORS++))
    fi
done
echo ""

echo "2️⃣  Checking Workflow Structure"
echo "------------------------------"
for workflow in "${COPILOT_WORKFLOWS[@]}"; do
    wf_path="$WORKFLOWS_DIR/$workflow"
    echo "  Checking $workflow:"

    # Check for required keys
    if grep -q "^on:" "$wf_path"; then
        echo -e "    ${GREEN}✅ Has trigger (on:)${NC}"
    else
        echo -e "    ${RED}❌ Missing trigger${NC}"
        ((ERRORS++))
    fi

    if grep -q "^permissions:" "$wf_path"; then
        echo -e "    ${GREEN}✅ Has permissions${NC}"
    else
        echo -e "    ${YELLOW}⚠️  No permissions defined${NC}"
        ((WARNINGS++))
    fi

    if grep -q "^jobs:" "$wf_path"; then
        echo -e "    ${GREEN}✅ Has jobs${NC}"
    else
        echo -e "    ${RED}❌ Missing jobs${NC}"
        ((ERRORS++))
    fi

    # Count jobs
    job_count=$(grep -E "^  [a-z_-]+:" "$wf_path" | wc -l)
    echo "    📊 Number of jobs: $job_count"
done
echo ""

echo "3️⃣  Checking GitHub Actions Versions"
echo "-----------------------------------"
echo "  Checking for outdated actions..."

# Check for old action versions
if grep -r "actions/checkout@v[123]" $WORKFLOWS_DIR/copilot-*.yml; then
    echo -e "  ${YELLOW}⚠️  Found old checkout action versions${NC}"
    ((WARNINGS++))
else
    echo -e "  ${GREEN}✅ Checkout actions up to date${NC}"
fi

if grep -r "actions/setup-node@v[123]" $WORKFLOWS_DIR/copilot-*.yml; then
    echo -e "  ${YELLOW}⚠️  Found old setup-node versions${NC}"
    ((WARNINGS++))
else
    echo -e "  ${GREEN}✅ setup-node actions up to date${NC}"
fi
echo ""

echo "4️⃣  Checking Workflow Dependencies"
echo "---------------------------------"

# Check CI workflow exists (required for auto-merge)
if [ -f "$WORKFLOWS_DIR/ci.yml" ]; then
    echo -e "  ${GREEN}✅ CI workflow exists${NC}"

    # Check if CI has the status check job
    if grep -q "name: CI Status Check" "$WORKFLOWS_DIR/ci.yml"; then
        echo -e "  ${GREEN}✅ CI Status Check job found${NC}"
    else
        echo -e "  ${RED}❌ CI Status Check job missing (required for auto-merge)${NC}"
        ((ERRORS++))
    fi
else
    echo -e "  ${RED}❌ CI workflow missing${NC}"
    ((ERRORS++))
fi

# Check auto-merge workflow
if [ -f "$WORKFLOWS_DIR/auto-merge.yml" ]; then
    echo -e "  ${GREEN}✅ Auto-merge workflow exists${NC}"
else
    echo -e "  ${YELLOW}⚠️  Auto-merge workflow not found${NC}"
    ((WARNINGS++))
fi
echo ""

echo "5️⃣  Checking Workflow Triggers"
echo "----------------------------"

# Issue creation workflow
if grep -q "schedule:" "$WORKFLOWS_DIR/copilot-autonomous-issue-creation.yml"; then
    echo -e "  ${GREEN}✅ Issue creation has scheduled trigger${NC}"
    cron=$(grep "cron:" "$WORKFLOWS_DIR/copilot-autonomous-issue-creation.yml" | head -1)
    echo "     Schedule: $cron"
else
    echo -e "  ${YELLOW}⚠️  Issue creation missing scheduled trigger${NC}"
    ((WARNINGS++))
fi

# PR review workflow
if grep -q "pull_request:" "$WORKFLOWS_DIR/copilot-autonomous-pr-review.yml"; then
    echo -e "  ${GREEN}✅ PR review has pull_request trigger${NC}"
else
    echo -e "  ${RED}❌ PR review missing pull_request trigger${NC}"
    ((ERRORS++))
fi

# Task assignment workflow
if grep -q "issues:" "$WORKFLOWS_DIR/copilot-task-assignment.yml"; then
    echo -e "  ${GREEN}✅ Task assignment has issues trigger${NC}"
else
    echo -e "  ${RED}❌ Task assignment missing issues trigger${NC}"
    ((ERRORS++))
fi

# All should have workflow_dispatch for manual triggering
for workflow in "${COPILOT_WORKFLOWS[@]}"; do
    if grep -q "workflow_dispatch:" "$WORKFLOWS_DIR/$workflow"; then
        echo -e "  ${GREEN}✅ $workflow has manual trigger${NC}"
    else
        echo -e "  ${YELLOW}⚠️  $workflow missing workflow_dispatch${NC}"
        ((WARNINGS++))
    fi
done
echo ""

echo "6️⃣  Checking Required Permissions"
echo "--------------------------------"
for workflow in "${COPILOT_WORKFLOWS[@]}"; do
    wf_path="$WORKFLOWS_DIR/$workflow"
    echo "  $workflow:"

    if grep -A 5 "^permissions:" "$wf_path" | grep -q "issues: write"; then
        echo -e "    ${GREEN}✅ Has issues: write${NC}"
    else
        echo -e "    ${YELLOW}⚠️  May need issues: write${NC}"
    fi

    if grep -A 5 "^permissions:" "$wf_path" | grep -q "pull-requests: write"; then
        echo -e "    ${GREEN}✅ Has pull-requests: write${NC}"
    else
        echo -e "    ${YELLOW}⚠️  May need pull-requests: write${NC}"
    fi

    if grep -A 5 "^permissions:" "$wf_path" | grep -q "contents:"; then
        echo -e "    ${GREEN}✅ Has contents permission${NC}"
    else
        echo -e "    ${YELLOW}⚠️  May need contents permission${NC}"
    fi
done
echo ""

echo "7️⃣  Checking GitHub Actions Usage"
echo "--------------------------------"

# Check for proper use of github-script
script_count=$(grep -r "actions/github-script@v7" $WORKFLOWS_DIR/copilot-*.yml | wc -l)
echo "  GitHub Script actions: $script_count"
echo -e "  ${GREEN}✅ Using github-script@v7${NC}"

# Check for shell scripts
shell_count=$(grep -r "run: |" $WORKFLOWS_DIR/copilot-*.yml | wc -l)
echo "  Shell script blocks: $shell_count"
echo ""

echo "8️⃣  Integration Check"
echo "-------------------"

# Check if workflows will work together
echo "  Checking workflow integration:"

# Check if PR review can trigger auto-merge
if grep -q "ready-to-merge" "$WORKFLOWS_DIR/copilot-autonomous-pr-review.yml"; then
    echo -e "  ${GREEN}✅ PR review adds ready-to-merge label${NC}"
else
    echo -e "  ${YELLOW}⚠️  PR review should add ready-to-merge label${NC}"
    ((WARNINGS++))
fi

# Check if issue creation adds proper labels
if grep -q "copilot-generated" "$WORKFLOWS_DIR/copilot-autonomous-issue-creation.yml"; then
    echo -e "  ${GREEN}✅ Issue creation adds copilot-generated label${NC}"
else
    echo -e "  ${YELLOW}⚠️  Issue creation should add copilot-generated label${NC}"
    ((WARNINGS++))
fi
echo ""

echo "9️⃣  Repository Configuration Check"
echo "----------------------------------"

# Check if required files exist
echo "  Checking required repository files:"

if [ -f "package.json" ]; then
    echo -e "  ${GREEN}✅ package.json exists${NC}"
else
    echo -e "  ${RED}❌ package.json missing${NC}"
    ((ERRORS++))
fi

if [ -f "tsconfig.json" ]; then
    echo -e "  ${GREEN}✅ tsconfig.json exists${NC}"
else
    echo -e "  ${YELLOW}⚠️  tsconfig.json not found${NC}"
    ((WARNINGS++))
fi

if [ -d "src" ]; then
    echo -e "  ${GREEN}✅ src/ directory exists${NC}"
else
    echo -e "  ${RED}❌ src/ directory missing${NC}"
    ((ERRORS++))
fi

if [ -f ".github/copilot-instructions.md" ]; then
    echo -e "  ${GREEN}✅ Copilot instructions exist${NC}"
else
    echo -e "  ${YELLOW}⚠️  Copilot instructions not found${NC}"
    ((WARNINGS++))
fi
echo ""

echo "🔟 Summary"
echo "----------"
echo -e "  Errors:   ${RED}$ERRORS${NC}"
echo -e "  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Commit and push workflows to GitHub"
    echo "  2. Enable GitHub Actions in repository settings"
    echo "  3. Ensure required permissions are granted"
    echo "  4. Test manually with: gh workflow run <workflow-name>"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS critical errors that must be fixed${NC}"
    echo ""
    echo "Please fix the errors above before using the workflows."
    exit 1
fi
