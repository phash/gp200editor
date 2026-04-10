#!/usr/bin/env bash
#
# Local CI pipeline — replacement for the removed GitHub Actions workflow.
#
# Stages (fail fast):
#   1. lint       — ESLint via `next lint`
#   2. typecheck  — `tsc --noEmit`
#   3. test       — Vitest unit tests
#   4. build      — `next build` (catches SSR/bundler errors)
#
# Usage:
#   bash scripts/local-ci.sh            # all stages
#   bash scripts/local-ci.sh lint       # one stage
#   bash scripts/local-ci.sh lint test  # a subset (order preserved)
#
# Exit codes:
#   0  all requested stages passed
#   >0 first failing stage's exit code
#
set -euo pipefail

cd "$(dirname "$0")/.."

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

log_stage() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
log_ok()    { printf '%s✔ %s%s\n' "$GREEN" "$1" "$RESET"; }
log_fail()  { printf '%s✘ %s%s\n' "$RED" "$1" "$RESET"; }
log_warn()  { printf '%s! %s%s\n' "$YELLOW" "$1" "$RESET"; }

run_lint() {
  log_stage "Lint (next lint)"
  npx --no-install next lint
  log_ok "Lint"
}

run_typecheck() {
  log_stage "Typecheck (tsc --noEmit)"
  npx --no-install tsc --noEmit
  log_ok "Typecheck"
}

run_test() {
  log_stage "Unit tests (vitest run)"
  # usePreset.test.ts is excluded in the original CI because jsdom fails on
  # an obscure indexeddb-in-workers edge case; keep the exclusion to match.
  npx --no-install vitest run --exclude tests/unit/usePreset.test.ts
  log_ok "Tests"
}

run_build() {
  log_stage "Build (next build)"
  # Skip prisma generate — the dev environment already has it.
  SKIP_ENV_VALIDATION=1 npx --no-install next build
  log_ok "Build"
}

stages=("$@")
if [ ${#stages[@]} -eq 0 ]; then
  stages=(lint typecheck test build)
fi

start_ts=$SECONDS
for stage in "${stages[@]}"; do
  case "$stage" in
    lint)      run_lint ;;
    typecheck) run_typecheck ;;
    test)      run_test ;;
    build)     run_build ;;
    *)
      log_fail "Unknown stage: $stage"
      echo "Valid stages: lint, typecheck, test, build"
      exit 2
      ;;
  esac
done

elapsed=$((SECONDS - start_ts))
printf '\n%s==> Local CI passed in %ds%s\n' "$BOLD$GREEN" "$elapsed" "$RESET"
