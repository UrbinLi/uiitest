#!/usr/bin/env bash
set -euo pipefail

SUITE="${1:-smoke}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${QA_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"

: "${QA_BASE_URL:?Set QA_BASE_URL to the target local, test, or staging URL.}"

export QA_RUN_ID="$RUN_ID"
export QA_EVIDENCE_DIR="${QA_EVIDENCE_DIR:-$ROOT_DIR/qa/evidence/$RUN_ID}"
export QA_REPORT_DIR="${QA_REPORT_DIR:-$ROOT_DIR/qa/reports/$RUN_ID}"

mkdir -p "$QA_EVIDENCE_DIR" "$QA_REPORT_DIR"
cd "$ROOT_DIR"

case "$SUITE" in
  smoke)
    TEST_TARGET="e2e/smoke/login.spec.ts"
    CONFIG_FILE="playwright.config.ts"
    ;;
  ai)
    : "${MIDSCENE_MODEL_BASE_URL:?Set MIDSCENE_MODEL_BASE_URL before running AI QA.}"
    : "${MIDSCENE_MODEL_NAME:?Set MIDSCENE_MODEL_NAME before running AI QA.}"
    : "${MIDSCENE_MODEL_FAMILY:?Set MIDSCENE_MODEL_FAMILY before running AI QA.}"
    TEST_TARGET="e2e/ai/login-semantic.spec.ts"
    CONFIG_FILE="playwright.midscene.config.ts"
    ;;
  ai-codex)
    export MIDSCENE_MODEL_BASE_URL="${MIDSCENE_MODEL_BASE_URL:-codex://app-server}"
    export MIDSCENE_MODEL_NAME="${MIDSCENE_MODEL_NAME:-gpt-5.4}"
    export MIDSCENE_MODEL_FAMILY="${MIDSCENE_MODEL_FAMILY:-gpt-5}"
    TEST_TARGET="e2e/ai/login-semantic.spec.ts"
    CONFIG_FILE="playwright.midscene.config.ts"
    ;;
  *)
    echo "Unknown suite: $SUITE" >&2
    exit 2
    ;;
esac

echo "WEB_QA_RUN_ID=$QA_RUN_ID"
echo "WEB_QA_SUITE=$SUITE"
echo "WEB_QA_BASE_URL=$QA_BASE_URL"
echo "WEB_QA_EVIDENCE_DIR=$QA_EVIDENCE_DIR"
echo "WEB_QA_REPORT_DIR=$QA_REPORT_DIR"

ARGS=("$TEST_TARGET")
if [ "${PLAYWRIGHT_HEADED:-0}" = "1" ]; then
  ARGS+=("--headed")
fi

pnpm exec playwright test --config "$CONFIG_FILE" "${ARGS[@]}"
