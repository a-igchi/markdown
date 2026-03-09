#!/usr/bin/env bash
# fuzz-loop.sh — run model-based fuzz tests repeatedly and report failures with seed info
#
# Usage:
#   ./test/fuzz-loop.sh [NUM_RUNS]
#
# Examples:
#   ./test/fuzz-loop.sh        # default 20 runs
#   ./test/fuzz-loop.sh 50     # 50 runs

set -euo pipefail

NUM_RUNS="${1:-20}"
PASS=0
FAIL=0
FAILED_SEEDS=()

echo "Running fuzz test ${NUM_RUNS} times..."
echo ""

for i in $(seq 1 "$NUM_RUNS"); do
  output=$(pnpm --filter editor-cst run test:fuzz 2>&1)

  if echo "$output" | grep -q "failed"; then
    FAIL=$((FAIL + 1))

    # Extract seed from "{ seed: <N>, path: ..." line
    seed=$(echo "$output" | grep -oP '(?<=seed: )-?\d+' | head -1)
    counterex=$(echo "$output" | grep "Counterexample:" | head -1 | sed 's/^.*Counterexample: //')
    cause=$(echo "$output" | grep "Caused by:" | head -1 | sed 's/^.*Caused by: //')

    echo "Run ${i}: FAIL  seed=${seed}"
    echo "  Counterexample: ${counterex}"
    echo "  Caused by: ${cause}"
    echo ""

    FAILED_SEEDS+=("$seed")
  else
    PASS=$((PASS + 1))
    echo "Run ${i}: PASS"
  fi
done

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed out of ${NUM_RUNS} runs"

if [ ${#FAILED_SEEDS[@]} -gt 0 ]; then
  echo ""
  echo "To replay a failed run:"
  for s in "${FAILED_SEEDS[@]}"; do
    echo "  FC_SEED=${s} pnpm --filter editor-cst run test:fuzz"
  done
  exit 1
fi
