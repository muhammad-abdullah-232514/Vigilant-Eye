# VigilantEye

AI-assisted **Unfair Means (UFM)** detection and institutional review portal for Air University (FYP submission build).

Invigilators monitor live feeds → confirmed detections auto-capture evidence → cases with digital sign-off → students clarify → HOD / DEC / Exam Dept / UFM Committee review → approved cases auto-hold results — with portal notifications (optional SMTP / EMAIL_MOCK) and a full audit trail.

**Demo steps:** [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) · **Scope map:** [docs/SCOPE_COVERAGE.md](docs/SCOPE_COVERAGE.md) · **Checklist:** [docs/EVALUATOR_CHECKLIST.md](docs/EVALUATOR_CHECKLIST.md)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind + React Router |
| Backend | FastAPI + SQLAlchemy + JWT + bcrypt |
| Database | PostgreSQL 16 (**Docker Compose service `db`**) |
| AI | Ultralytics YOLO → `detections` + auto evidence |

---

## Repository layout

```text
backend/     FastAPI API, models, auth, workflow, uploads
frontend/    UFM Web Portal (role dashboards)
ai/          Detector scripts, samples, annotated outputs
docs/        Demo runbook, mockups, project brief
```

---

## RECOMMENDED DEVELOPMENT STARTUP

This is the **official FYP demo path**. It does **not** use Windows PostgreSQL 14/18, does **not** need the local `postgres` superuser password, and does **not** require manual DB creation or seeding.

### Required software

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Engine running)
- PowerShell (Windows)
- Git (optional)

### First-time setup

```powershell
cd "C:\Users\KING\Desktop\NEW PROJ\Vigilant Eye"
copy .env.example .env
# Optional: edit .env and change POSTGRES_PASSWORD / JWT_SECRET (local-dev only)
```

`start-dev.ps1` will create `.env` from `.env.example` automatically if `.env` is missing.

### Start (one command)

```powershell
.\start-dev.ps1 -Detach
```

Or equivalently:

```powershell
docker compose up --build -d
```

### What startup does

```text
PostgreSQL container (healthy)
    → API waits for DB
    → Alembic upgrade to head (schema migrations)
    → idempotent demo seed (when ENABLE_DEMO_SEED=1)
    → uvicorn :8000
    → frontend Vite :5173
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |
| Liveness | http://127.0.0.1:8000/health |
| Readiness (DB) | http://127.0.0.1:8000/ready |

### Production (separate stack)

Do **not** merge `docker-compose.prod.yml` with the development compose (ports/volumes would hybridize). Use the standalone production file and [docs/PRODUCTION.md](docs/PRODUCTION.md):

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

Production nginx SPA defaults to host port **8080**; demo login shortcuts and demo seed are off unless explicitly enabled.

Institutional sign-in uses **Google** (`GOOGLE_CLIENT_ID`). See [docs/GOOGLE_AUTH.md](docs/GOOGLE_AUTH.md) and [docs/PRODUCTION.md](docs/PRODUCTION.md).

### Status / stop / restart

```powershell
.\start-dev.ps1 -Status
.\start-dev.ps1 -Stop          # docker compose down (keeps DB volume)
docker compose restart         # quick bounce
docker compose up -d           # start again after stop
```

### Intentional database reset (DESTRUCTIVE)

Deletes the Compose Postgres volume and all demo/case data. **Not** part of normal startup.

```powershell
docker compose down -v
.\start-dev.ps1 -Detach
```

### Host ports

| Service | Host port | Notes |
|---------|-----------|--------|
| Postgres | **15432** | Maps to container `5432`. Avoids conflict with Windows PG on 5432/5433 |
| API | 8000 | |
| Frontend | 5173 | |

Inside Docker, the API uses hostname **`db`** (never `localhost`).

The API image installs **CPU PyTorch** (not CUDA) for reliable demo builds on typical networks. Product behavior is unchanged; YOLO still runs, on CPU.

### Database configuration (canonical)

**Canonical app setting:** `DATABASE_URL`

```text
postgresql+psycopg://vigilant:<password>@db:5432/vigilant_eye
```

Compose builds this for the API container from `POSTGRES_*` in `.env`.

Legacy `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME` / `DATABASE_USER` / `DATABASE_PASSWORD` remain supported as a **fallback** only when `DATABASE_URL` is unset (see `backend/database.py`).

The app user is **`vigilant`** (not the `postgres` superuser). Database name: **`vigilant_eye`**.

---

## macOS — live webcam monitoring (recommended on a Mac)

Docker Desktop on macOS **cannot access the Mac camera**, so on a Mac the API (which owns camera
capture, YOLO and MediaPipe) runs **natively** in a Python 3.12 venv, while PostgreSQL and the
frontend stay in Docker.

```bash
cd "/path/to/Vigilant Eye"
./scripts/start-mac.sh setup     # one-time: installs uv, Python 3.12, .venv, requirements-mac.txt
./scripts/start-mac.sh           # Postgres + frontend in Docker, API natively (Ctrl+C stops the API)
./scripts/start-mac.sh -d        # same, API in background (logs/api-mac.log)
./scripts/start-mac.sh status
./scripts/start-mac.sh stop
```

Open http://localhost:5173 → Live Monitoring → **Start Monitoring** on a camera whose Stream URL is
`webcam:0`. The first time, macOS asks to allow camera access for the app that launched the script
(Terminal / iTerm / VS Code) — allow it, then restart the API. If index 0 fails the API tries index 1.

### AI model selection (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `YOLO_MODEL` | `auto` | `auto` = trained UFM detector if `ai/weights/ufm_od_v1.pt` exists, else COCO; `custom`; `coco` |
| `YOLO_CUSTOM_WEIGHTS` | `ai/weights/ufm_od_v1.pt` | path to the trained detector |
| `LIVE_IMGSZ` | `384` (Mac script) | inference size — lower = faster |
| `UFM_CONFIRM_FRAMES` | `3` | consecutive detections before an alert (persistence) |
| `UFM_PERSIST_COOLDOWN_SEC` | `45` | mute repeat alerts for the same object/place |
| `UFM_CONF_<CLASS>_CONFIRM` | per class | confidence gate, e.g. `UFM_CONF_MOBILE_PHONE_CONFIRM=0.6` |
| `UFM_YAW_ALERT_DEG` | `28` | head-turn angle counted as looking away |

Detector classes: `mobile_phone`, `laptop` (laptop/tablet), `smart_watch`, `normal_watch` (allowed,
never alerts), `notes_paper`, `electronic_gadget` (earbuds/headsets). Head turns toward a neighbour
(MediaPipe Face Mesh yaw) raise `looking_away` **review** alerts. Every alert is a flag for the
Invigilator — UFM case action still requires human review and sign-off.
Training data and licenses: [DATASETS.md](DATASETS.md) · results: [docs/AI_MODEL_RESULTS.md](docs/AI_MODEL_RESULTS.md).

### Connecting CCTV / IP cameras (RTSP)

In **Master Data → Cameras** set the Stream URL to the camera's RTSP URL, e.g.
`rtsp://user:password@192.168.1.64:554/Streaming/Channels/101` (Hikvision) or
`rtsp://user:password@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0` (Dahua).
The API connects over TCP, verifies frames arrive, and reconnects automatically if the stream drops.
Credentials are redacted in the UI/logs. Use the camera's sub-stream (lower resolution) for many
cameras per server.

Test without a real camera (simulated CCTV stream looping the sample clip):

```bash
docker compose -f docker-compose.rtsp-test.yml up -d     # rtsp://127.0.0.1:8554/cam1
docker compose -f docker-compose.rtsp-test.yml down
```

---

## Demo accounts

Password for all: **`Demo@123`**

| Role | Email |
|------|--------|
| Invigilator | `invigilator@demo.com` |
| HOD | `hod@demo.com` |
| DEC | `dec@demo.com` |
| Exam Department | `examdept@demo.com` |
| UFM Committee | `ufm@demo.com` |
| Student | `student@demo.com` |

Student portal is linked to roll **`DEMO001`**. Create cases against that student to demo clarifications.

Demo seed runs automatically on API container start and is **idempotent** (safe to restart).

---

## OPTIONAL LOCAL MODE (advanced)

Use only if you need to run uvicorn/npm on the host. Still prefer Compose Postgres so you do not depend on Windows PostgreSQL passwords.

1. Start DB only: `docker compose up -d db`
2. Copy `backend/.env.example` → `backend/.env` and set `DATABASE_URL` to host port **15432**
3. `cd backend` → venv → `python dev_bootstrap.py` → `uvicorn main:app --reload`
4. `cd frontend` → `npm run dev` with `VITE_API_URL=http://127.0.0.1:8000`

Running against Windows PostgreSQL 14/18 is **unsupported** for demos.

---

## Core workflow (one line)

`PENDING` → (staff open) `UNDER_REVIEW` → HOD FORWARD → `DEC_REVIEW` → DEC FORWARD → `EXAM_DEPARTMENT_REVIEW` → Exam FORWARD → `UFM_COMMITTEE_REVIEW` → APPROVE/REJECT → hold on approve.

Create case and each review require **digital sign-off** (typed full name + acknowledgment checkbox).

---

## Evaluator checklist

Use during a viva / demo. Prefer [docs/EVALUATOR_CHECKLIST.md](docs/EVALUATOR_CHECKLIST.md).

### Honesty check (submission scope)

- [ ] Live Monitoring shown as MJPEG (webcam / sample clip / RTSP URL), not WebRTC mesh  
- [ ] Sign-off described as typed name + ack (not PKI)  
- [ ] Email = SMTP optional / EMAIL_MOCK otherwise  
- [ ] YOLO described honestly (custom train and/or COCO fallback)  
- [ ] SSO / SIS / PDF engine = FUTURE (see SCOPE_COVERAGE)  

---

## Prototype vs future

| In this submission | FUTURE |
|--------------------|--------|
| JWT auth + RBAC | SSO / campus IdP |
| Case workflow + digital sign-off (name/ack) | PKI / cryptographic e-sign |
| Auto SNAPSHOT/CLIP + manual evidence | Cloud evidence vault / CDN |
| Portal notifications + SMTP / EMAIL_MOCK | SMS / push beyond WS |
| Student clarification (DEMO001 link) | Full SIS binding |
| Result hold / release | ERP grade integration |
| Audit log | Advanced forensics export |
| Reports KPIs + CSV | PDF print engine |
| Live MJPEG + YOLO → detections | Multi-cam WebRTC, stronger custom ML |

---

## Useful commands

```powershell
# Recommended demo
.\start-dev.ps1 -Detach
.\start-dev.ps1 -Status
.\start-dev.ps1 -Stop

# Backend tests (host venv or inside API container)
cd backend
.\venv\Scripts\Activate.ps1
pytest -q
# Inside Docker (Compose may set AUTH_MODE=google): tests/conftest.py forces
# AUTH_MODE=both + PASSWORD_LOGIN_ENABLED=1 for the TestClient process only.

# Frontend production build check
cd frontend
npm run build
```

Optional email (otherwise logs `EMAIL_MOCK`). See [docs/EMAIL_NOTIFICATIONS.md](docs/EMAIL_NOTIFICATIONS.md):

```env
EMAIL_ENABLED=1
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@example.com
SMTP_USE_TLS=true
SMTP_TIMEOUT_SECONDS=15
PORTAL_BASE_URL=https://portal.example.edu
```

Do not put SMTP secrets in the frontend. Gmail/Workspace usually needs an App Password or approved relay — not the Google OAuth client secret.

AI scripts live under `ai/` (`train_yolo.py`, `save_confirmed_to_db.py`; Live Monitoring uses the API).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `docker` not found | Install/start Docker Desktop |
| Mac: "Could not read frames from the Mac camera" | System Settings → Privacy & Security → Camera → allow Terminal/iTerm/VS Code; close FaceTime/Zoom; restart `./scripts/start-mac.sh` |
| Mac: "No webcam available inside Docker" | The API is running in Docker — use `./scripts/start-mac.sh` (native API) instead of `docker compose up` |
| RTSP camera "Could not connect" | Check IP/port/path/credentials from the API machine (`ffplay rtsp://…` or VLC); camera must be reachable on the network |
| Backend NOT READY | `docker compose logs api` — wait for bootstrap; check `.env` has `POSTGRES_PASSWORD` + `JWT_SECRET` |
| Port 5173/8000 busy | Stop old `npm run dev` / uvicorn; `.\start-dev.ps1 -Stop` then start again |
| Login fails | Seed runs on API start; use emails above + `Demo@123` |
| Student sees 0 cases | File cases against roll **DEMO001** |
| Want clean DB | **Destructive:** `docker compose down -v` then `.\start-dev.ps1 -Detach` |

---

## Authors

Student FYP team — Air University. Built with Cursor as a development assistant; authors own the project and demo.
