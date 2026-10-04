#!/usr/bin/env bash
# VigilantEye on macOS: Postgres + frontend in Docker, API + live camera AI native.
#
# Docker Desktop on macOS cannot access the built-in camera, so the FastAPI
# process (which owns camera capture, YOLO and MediaPipe) runs in a native
# Python 3.12 venv (.venv) and talks to the Compose Postgres on 127.0.0.1:15432.
#
#   ./scripts/start-mac.sh setup     # one-time: Python 3.12 venv + dependencies
#   ./scripts/start-mac.sh           # start (API in foreground, Ctrl+C to stop)
#   ./scripts/start-mac.sh -d        # start with API in background (logs/api-mac.log)
#   ./scripts/start-mac.sh status
#   ./scripts/start-mac.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
VENV="$ROOT/.venv"
PY="$VENV/bin/python"
LOG_DIR="$ROOT/logs"
PID_FILE="$LOG_DIR/api-mac.pid"
mkdir -p "$LOG_DIR"

[ -f .env ] || cp .env.example .env
# Load .env like Docker Compose does (values may contain spaces; no shell evaluation)
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  key="${line%%=*}"; val="${line#*=}"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  val="${val%$'\r'}"; val="${val#\"}"; val="${val%\"}"; val="${val#\'}"; val="${val%\'}"
  export "$key=$val"
done < .env
export DATABASE_URL="postgresql+psycopg://${POSTGRES_USER:-vigilant}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT:-15432}/${POSTGRES_DB:-vigilant_eye}"
export PYTHONPATH="$ROOT/backend:$ROOT/ai"
export YOLO_CONFIG_DIR="$LOG_DIR/ultralytics"
# Real-time defaults for a laptop CPU (override in .env)
export LIVE_IMGSZ="${LIVE_IMGSZ:-480}"
export LIVE_DETECT_EVERY="${LIVE_DETECT_EVERY:-1}"
export UFM_POSTURE_EVERY="${UFM_POSTURE_EVERY:-2}"

api_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

setup() {
  local uv
  uv="$(command -v uv || echo "$HOME/.local/bin/uv")"
  if [ ! -x "$uv" ]; then
    echo "Installing uv (Python toolchain manager)…"
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  "$uv" python install 3.12
  [ -x "$PY" ] || "$uv" venv --python 3.12 "$VENV"
  VIRTUAL_ENV="$VENV" "$uv" pip install -r backend/requirements-mac.txt
  "$PY" -c "import cv2, torch, mediapipe, ultralytics; print('venv OK:', torch.__version__, mediapipe.__version__)"
}

wait_db() {
  echo -n "Waiting for Postgres"
  for _ in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-vigilant}" >/dev/null 2>&1; then
      echo " ✓"; return 0
    fi
    echo -n "."; sleep 2
  done
  echo; echo "Postgres did not become ready"; exit 1
}

start() {
  [ -x "$PY" ] || { echo "Python venv missing — running setup first"; setup; }
  docker info >/dev/null 2>&1 || { echo "Start Docker Desktop first."; exit 1; }
  # The Docker API container would hold port 8000 and cannot see the camera.
  docker compose stop api >/dev/null 2>&1 || true
  docker compose up -d db
  wait_db
  docker compose up -d --no-deps frontend
  (cd backend && "$PY" dev_bootstrap.py)
  local cmd=("$PY" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir "$ROOT/backend")
  echo "Portal:   http://localhost:5173"
  echo "API:      http://127.0.0.1:8000/docs"
  if [ "${1:-}" = "-d" ]; then
    api_running && { echo "API already running (pid $(cat "$PID_FILE"))"; return; }
    nohup "${cmd[@]}" >"$LOG_DIR/api-mac.log" 2>&1 &
    echo $! >"$PID_FILE"
    echo "API started in background (pid $!, log: logs/api-mac.log)"
  else
    exec "${cmd[@]}"
  fi
}

stop() {
  if api_running; then kill "$(cat "$PID_FILE")" && echo "API stopped"; fi
  rm -f "$PID_FILE"
  docker compose stop frontend db
}

status() {
  api_running && echo "API: running (pid $(cat "$PID_FILE"))" || echo "API: not running (background mode)"
  curl -fsS http://127.0.0.1:8000/ready 2>/dev/null && echo || echo "API /ready: not reachable"
  docker compose ps
}

case "${1:-}" in
  setup) setup ;;
  stop) stop ;;
  status) status ;;
  -d|"") start "${1:-}" ;;
  *) echo "usage: $0 [setup|-d|status|stop]"; exit 1 ;;
esac
