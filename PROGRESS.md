# VigilantEye — autonomous work log

Machine: MacBook Pro, Intel Core i7 (x86_64), Intel Iris Plus (no CUDA, no Apple-Silicon MPS) → all
training / inference is CPU. 32 GB RAM. Docker Desktop 29.8.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | API (camera + YOLO + MediaPipe) runs natively on macOS (`.venv`, Python 3.12 via uv); Postgres + frontend stay in Docker (`scripts/start-mac.sh`) | Docker Desktop on macOS cannot access the Mac camera |
| D2 | Mac pins in `backend/requirements-mac.txt`: torch 2.2.2, numpy 1.26, OpenCV 4.10, mediapipe 0.10.21 | torch 2.2.2 is the last Intel-Mac build (needs numpy<2); mediapipe 0.10.21 is the last with the FaceMesh `solutions` API used by `ai/posture_analysis.py` |
| D3 | Detector classes: mobile_phone, laptop (laptop+tablet), smart_watch, normal_watch, notes_paper, electronic_gadget | Spec classes + existing ones the code expects; `normal_watch` is trained as an *allowed* class so ordinary watches stop being flagged |
| D4 | Generic "watch" boxes split into smart/normal with CLIP zero-shot (smart ≥0.92) | No large open dataset distinguishes the two; stricter smart threshold avoids false accusations |
| D5 | Webcam sharing: several Master Data cameras may point at one physical webcam (single reader thread) | Only one camera on this Mac; "make both webcams work" |
| D6 | Webcam fallback order: requested index, then 0, 1, 2 | Spec |
| D7 | Head turns (`looking_away`) are REVIEW-only alerts (never auto-confirmed) but persist evidence + notify | Human review rule; head pose is weaker evidence than an object |
| D8 | Local training is time-boxed CPU YOLOv8n; full YOLOv8s run is `ai/colab/train_colab.ipynb` | CPU-only machine |
| D9 | No accounts created. Roboflow downloads use the API key already in `backend/.env` | Boundaries |
| D10 | Rejected sources: cheating-gjiev phone boxes (whole-person boxes), cheating-5fs9b (chit class removed), classroom-phone-detection (tablets labelled phone), Downloads/*.MOV (unrelated coffee-factory clips) | QA grids in `ai/runs/qa/` |

## Log

- Baseline committed (`0d76d15`), alembic revision-length fix (`85c1901`).
- Camera source layer (`backend/capture_source.py`), RTSP reconnect, `start-mac.sh`, RTSP simulator (`c659496`).
- Policy: laptop class, `YOLO_MODEL=auto|custom|coco`, tracker persistence/cooldown fixes, time-based head-turn score (`5ee74e4`).
- Head-turn alerts persist + notify (`52b62aa`); docs (`477f7ff`).
- Backend test suite: 350 passed, 3 skipped (throwaway DB `vigilant_test`).
- RTSP simulator verified: `rtsp://…:8554/cam1` opened, frames at source rate.
- Docker API rebuilt with all changes (live for sample clip / RTSP; webcam needs native API).
- Native venv ready: torch 2.2.2, numpy 1.26.4, OpenCV 4.11, mediapipe 0.10.21 (`solutions` OK), ultralytics 8.4.126.
- `.env` contains `SMTP_FROM_NAME=VigilantEye University Portal` (unquoted spaces) — start-mac.sh now loads .env line-by-line like Compose instead of `source`.
- **Phase 1 webcam: WORKING.** Native API launched via Terminal.app (`scripts/start-mac.command`); camera permission for Terminal was granted on screen.
  `POST /live/cameras/1/start` → `opened_source=webcam:0`; `/live/cameras/1/snapshot` shows the real room (ceiling/fan) — physical camera, not a file.
  Earlier attempt from the Claude app process: "OpenCV: not authorized to capture video (status 0)" → fixed by launching from Terminal.
- Phase 6 RTSP: camera `CAM-A101-03 Hall A CCTV (RTSP test)` = `rtsp://127.0.0.1:8554/cam1` started from the API, `ai_status=active`.
- Open Images V7 train subset: 9,211 images downloaded (+1,796 val/test). Dataset build running.
- Live FPS observed ~0.5–0.8 while the dataset build used ~10 cores in Docker; re-measure after build/training.

## Blockers / things that need you

- (none yet)

- All 3 Master Data cameras set to `webcam:0` (shared MacBook camera) at user request. To restore: camera 2 → `ai/samples/sample_exam_clip.mp4`, camera 3 → `rtsp://127.0.0.1:8554/cam1`.

- Google-only sign-in (user request): AUTH_MODE=google, PASSWORD_LOGIN_ENABLED=0, ENABLE_DEMO_SEED=0 (.env backed up as .env.backup-*). ADMINISTRATOR provisioned: muzzamilwasif.official@gmail.com. The 6 @demo.com users were deactivated (demo.com is a real domain). Revert: AUTH_MODE=demo + `update users set is_active=true where email like '%@demo.com'`.
