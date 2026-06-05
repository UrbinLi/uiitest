#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${QA_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"

: "${QA_BASE_URL:?Set QA_BASE_URL to the target local, test, or staging URL.}"

export QA_RUN_ID="$RUN_ID"
export QA_EVIDENCE_DIR="${QA_EVIDENCE_DIR:-$ROOT_DIR/qa/evidence/$RUN_ID}"
export QA_REPORT_DIR="${QA_REPORT_DIR:-$ROOT_DIR/qa/reports/$RUN_ID}"
export QA_ALLOWED_SAFETY="${QA_ALLOWED_SAFETY:-readonly}"

mkdir -p "$QA_EVIDENCE_DIR" "$QA_REPORT_DIR"
cd "$ROOT_DIR"

SYNC_OUTPUT="$(
  pnpm exec tsx src/cli/sync-cases.ts \
    --source "${QA_CASE_SOURCE_TYPE:-local}" \
    --input "${QA_CASE_SOURCE:-cases/examples/content-readonly.case.json}" \
    --run-id "$RUN_ID"
)"
echo "$SYNC_OUTPUT"
export QA_CASE_SNAPSHOT="$(printf '%s\n' "$SYNC_OUTPUT" | awk -F= '/^QA_CASE_SNAPSHOT=/{print $2}')"

echo "QA_RUN_ID=$QA_RUN_ID"
echo "QA_CASE_SNAPSHOT=$QA_CASE_SNAPSHOT"
echo "QA_EVIDENCE_DIR=$QA_EVIDENCE_DIR"
echo "QA_REPORT_DIR=$QA_REPORT_DIR"
echo "QA_ALLOWED_SAFETY=$QA_ALLOWED_SAFETY"

ARGS=("e2e/framework/case-runner.spec.ts")
if [ "${PLAYWRIGHT_HEADED:-0}" = "1" ]; then
  ARGS+=("--headed")
fi

set +e
pnpm exec playwright test --config playwright.framework.config.ts "${ARGS[@]}"
TEST_STATUS=$?
set -e

pnpm exec tsx src/cli/writeback-results.ts --summary "$QA_REPORT_DIR/summary.json"

exit "$TEST_STATUS"
