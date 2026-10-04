#!/bin/bash
# Double-click in Finder (or `open scripts/start-mac.command`) to start VigilantEye on macOS.
# Runs in Terminal.app, so macOS camera permission is granted to Terminal.
cd "$(dirname "$0")/.." && ./scripts/start-mac.sh -d
./scripts/start-mac.sh status
echo; echo "Portal: http://localhost:5173  (this window can be closed; API keeps running)"
