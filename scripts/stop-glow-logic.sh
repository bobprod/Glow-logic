#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMD_PATH="$SCRIPT_DIR/stop-glow-logic.cmd"

if command -v cygpath >/dev/null 2>&1; then
  CMD_PATH="$(cygpath -w "$CMD_PATH")"
fi

cmd.exe /d /c call "$CMD_PATH"
