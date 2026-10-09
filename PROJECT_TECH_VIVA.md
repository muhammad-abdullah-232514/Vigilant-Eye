# VigilantEye FYP Viva Cheat Sheet

This guide is based on the code and configuration currently present in this repository. It does not treat planned, commented, or blocked work as completed.

## 1. One-minute project overview

VigilantEye is a browser-based university UFM (unfair-means) monitoring and case-management portal. The frontend provides role-specific dashboards and forms. The FastAPI backend authenticates users, authorizes roles, manages UFM cases/evidence/results, runs live camera inference, and stores operational records in PostgreSQL. The live monitoring path uses OpenCV capture, Ultralytics YOLO inference, temporal confirmation, optional MediaPipe posture analysis, suspicion scoring, database persistence, and WebSocket alerts.

## 2. Technology stack

| Area | Technology/version | Where used | Purpose |
|---|---|---|---|
| Frontend | React 19.2.8 | `frontend/package.json`, `frontend/src/` | UI and dashboards |
| Frontend build | Vite 8.2.0 | `frontend/package.json`, `frontend/vite.config.js` | Dev server and production build |
| Routing | react-router-dom 7.18.2 | `frontend/src/main.jsx`, `frontend/src/App.jsx` | Client-side routes and guards |
| Styling | Tailwind CSS 4.3.3 | `frontend/package.json`, `frontend/src/index.css`, JSX classes | Utility-first styling |
| Frontend language | JavaScript/JSX | `frontend/src/` | No TypeScript application source is used |
| Backend | Python 3.12 Docker base; local environment may differ | `Dockerfile`, `backend/` | API and application services |
| API framework | FastAPI 0.141.1 | `backend/main.py`, `backend/routers/` | REST APIs and WebSocket routes |
| ORM | SQLAlchemy 2.0.52 | `backend/database.py`, `backend/models/` | Database sessions, models, queries |
| Database | PostgreSQL 16 Alpine in Compose | `docker-compose.yml` | Persistent relational storage |
| Driver | psycopg 3.3.4 | `backend/requirements.txt` | PostgreSQL connection |
| Migrations | Alembic 1.16.5 | `backend/alembic/` | Schema versioning |
| Object detection | Ultralytics 8.4.126 / YOLO | `backend/live_stream.py`, `ai/` | Object detection |
| Computer vision | OpenCV 5.0.0.93 | `backend/capture_source.py`, `backend/live_stream.py`, `ai/posture_analysis.py` | Capture, image operations, overlays |
| Numerical processing | NumPy 2.5.2 | capture/inference/posture modules | Frame and geometry arrays |
| Deep-learning runtime | PyTorch 2.13.0, torchvision 0.28.0 | requirements and live model device checks | YOLO runtime |
| Optional posture | MediaPipe 0.10.21 on Mac requirements | `ai/posture_analysis.py` | Face Mesh/head orientation when available |
| Authentication | PyJWT 2.13.0, Google Auth 2.40.3 | `backend/security.py`, `backend/google_auth.py` | Application JWT and Google ID-token verification |
| Password hashing | bcrypt 5.0.0 | `backend/security.py` | Password storage/comparison for enabled password mode |
| Containers | Docker Compose, PostgreSQL, Python API, Nginx frontend | `docker-compose.yml`, `docker-compose.prod.yml` | Repeatable development/production topology |

## 3. Frontend

### Main locations

- **Entry point:** `frontend/src/main.jsx`
- **Main application/router:** `frontend/src/App.jsx`
- **Login page:** `frontend/src/pages/Login.jsx`
- **Authentication provider:** `frontend/src/context/AuthContext.jsx`
- **API client:** `frontend/src/services/api.js`
- **Token storage:** `frontend/src/utils/authStorage.js`
- **Protected route:** `frontend/src/components/ProtectedRoute.jsx`
- **Role gates:** `frontend/src/components/RoleGates.jsx`
- **Admin dashboard:** `frontend/src/pages/AdminDashboardPage.jsx`
- **Invigilator dashboard:** `frontend/src/pages/DashboardHome.jsx` plus `MonitoringPage.jsx`, `DetectionsPage.jsx`, and `CreateCasePage.jsx`
- **Student portal:** `frontend/src/pages/StudentPortalEntry.jsx` and student routes in `App.jsx`
- **API environment variable:** `VITE_API_URL` in `frontend/.env.example`

### Frontend behavior

- React is mounted with `createRoot`, `StrictMode`, `BrowserRouter`, and `AuthProvider`.
- `AuthContext` stores the access token and user in browser `sessionStorage`.
- On startup, the provider calls `/auth/me` to restore/validate the session.
- `apiRequest` uses browser `fetch`, not Axios.
- Requests include `Authorization: Bearer <token>` when a token exists.
- `ProtectedRoute` redirects unauthenticated users to `/login`.
- `RoleGates.jsx`, `roleAccess.js`, `roleHome.js`, and `App.jsx` implement client-side role-aware navigation.
- Backend dependencies enforce the same access rules; frontend gates are UX protection, not the security boundary.
- Forms use native HTML constraints and backend response errors. Examples include `required`, `pattern`, `minLength`, `maxLength`, and Pydantic validation responses.
- Reusable UI includes `AppLayout`, `Sidebar`, `Header`, `PageShell`, `PageHeader`, `SectionPanel`, `KpiCard`, `StatusBadge`, `CaseQueueTable`, `CaseReviewForm`, `ConfirmDialog`, and `ErrorBanner`.
- The project includes a custom `DonutChart.jsx`; no external chart library is declared.
- No separate Redux/Zustand store is declared. Shared auth state uses React Context; page-local state uses React hooks.
- Icons are implemented through project assets/markup; no icon package is declared in `package.json`.
- Frontend real-time support includes live monitoring endpoints and WebSocket alert consumption in the monitoring area. The backend WebSocket endpoint is `/ws/alerts`.

## 4. Backend architecture

### Important components

| Feature | File | Function/class | Purpose |
|---|---|---|---|
| FastAPI application | `backend/main.py` | `app = FastAPI(...)` | Main API application and core routes |
| API routers | `backend/routers/live.py` | `router` | Live camera and MJPEG/snapshot endpoints |
| WebSocket router | `backend/routers/ws_alerts.py` | `alerts_socket` | Authenticated real-time detection/suspicion alerts |
| Admin router | `backend/routers/admin_users.py` | `router` | Administrator-only user management |
| DB engine | `backend/database.py` | `_build_database_url`, `engine`, `get_db` | PostgreSQL connection and per-request sessions |
| Models | `backend/models/*.py` | SQLAlchemy `Base` models | Relational tables |
| Auth dependency | `backend/deps.py` | `get_current_user` | Bearer/JWT verification and active-user lookup |
| Role dependency | `backend/deps.py` | `require_roles` | Role-based route authorization |
| Auth security | `backend/security.py` | `create_access_token`, `decode_access_token` | JWT signing and verification |
| Google auth | `backend/google_auth.py` | `verify_google_id_token` | Google OIDC ID-token validation |
| Case authorization | `backend/case_access.py` | `user_can_access_case`, `assert_can_access_case` | Case visibility and ownership rules |
| Live engine | `backend/live_stream.py` | live manager/session loop | Capture, inference, temporal events, persistence |
| Capture layer | `backend/capture_source.py` | `open_capture` | Webcam, file, RTSP/stream source handling |
| Notifications | `backend/notify_helpers.py` | notification/email helpers | In-app notifications and asynchronous email dispatch |

### Request validation and errors

FastAPI/Pydantic request models validate JSON, query, multipart, and form inputs. `main.py` installs exception handling for HTTP and validation errors. Database request sessions roll back on exceptions and always close in `database.py`. SQLAlchemy parameterized statements are used rather than string-built SQL for application queries.

### File uploads

Evidence uploads are handled by multipart endpoints in `main.py`, persisted under the configured uploads area, and represented by the `Evidence` model. Evidence preview/file routes are `/evidence/{evidence_id}/preview` and `/evidence/{evidence_id}/file`.

## 5. Authentication and authorization

### Complete password-login flow

```text
Login.jsx
  -> loginRequest() in frontend/src/services/api.js
  -> POST /auth/login in backend/main.py
  -> normalize email and query User
  -> verify_password() in backend/security.py
  -> create_access_token()
  -> JWT returned in LoginResponse
  -> AuthContext stores token in sessionStorage
  -> apiRequest sends Authorization: Bearer <token>
  -> get_current_user() extracts and verifies token
  -> database User is loaded and is_active is checked
  -> require_roles() checks the database role
  -> route is allowed or returns 401/403
```

Password login is configuration-controlled and is disabled in production by `validate_production_settings()` unless the configuration is unsafe, in which case startup validation rejects it. Google login is implemented separately at `POST /auth/google`.

### Exact security locations

| Feature | File | Function/constant | Approx. line |
|---|---|---|---:|
| JWT creation | `backend/security.py` | `create_access_token` | 34 |
| JWT signing | `backend/security.py` | `jwt.encode(...)` | 43 |
| Algorithm | `backend/security.py` | `JWT_ALGORITHM = "HS256"` | 15 |
| Secret load | `backend/security.py` | `JWT_SECRET = os.getenv(...)` | 10 |
| Expiry | `backend/security.py` | `JWT_EXPIRE_MINUTES`, `timedelta` | 12, 36 |
| Production expiry validation | `backend/app_config.py` | `validate_production_settings` | 170+ |
| JWT verification | `backend/security.py` | `decode_access_token` | 46 |
| Authorization header | `backend/deps.py` | `HTTPBearer`, `get_current_user` | 8, 13 |
| Bearer extraction | `backend/deps.py` | `credentials.credentials` | 20+ |
| Active user authentication | `backend/deps.py` | `get_current_user` | 13 |
| Role authorization | `backend/deps.py` | `require_roles` | 45 |
| Password hashing | `backend/security.py` | `hash_password` | 20 |
| Password comparison | `backend/security.py` | `verify_password` | 26 |
| Password login | `backend/main.py` | `login` | 364 |
| Google login | `backend/main.py` | `login_with_google` | 386 |
| Google token verification | `backend/google_auth.py` | `verify_google_id_token` | 29 |
| Frontend logout | `frontend/src/context/AuthContext.jsx` | `logout` | 99 |
| Refresh token | Not implemented | No refresh endpoint/model/rotation found | — |

**Authentication** answers “who is this user?” The project verifies a password or Google identity, issues a JWT, and reloads the corresponding active database user.

**Authorization** answers “what may this user do?” The project checks the active database user’s role through `require_roles`, case-access helpers, and route-specific role sets.

**HS256:** HMAC-SHA256 signs and verifies a JWT with one shared server secret. It is used here through PyJWT. The secret must be kept private because anyone with it could create valid tokens.

**Logout:** There is no backend logout/revocation route. `AuthContext.logout()` removes the token and cached user from session storage. A copied token remains valid until expiry unless the user is deactivated or the secret is changed.

## 6. Roles

The allowlist is in `backend/portal_roles.py`:

```text
ADMINISTRATOR, STUDENT, INVIGILATOR, HOD, DEC, EXAM_DEPARTMENT, UFM_COMMITTEE
```

- **ADMINISTRATOR:** administrator-only user management, roles, imports, admin audit, system information. It is intentionally excluded from operational UFM queues.
- **INVIGILATOR:** monitoring, detections, case creation, evidence upload, and own/submitted case activity.
- **STUDENT:** own linked student profile, own UFM cases, clarification/notifications, and student portal access.
- **HOD:** HOD-stage review, evidence viewing, institutional reports/audit subject to route rules.
- **DEC:** DEC review and case workflow actions.
- **EXAM_DEPARTMENT:** institution-wide processing, result controls, reports, and case exports.
- **UFM_COMMITTEE:** final committee review and approve/reject workflow actions.

The frontend mirrors these restrictions in `frontend/src/config/roleAccess.js`, `RoleGates.jsx`, and `App.jsx`; the backend is authoritative.

## 7. Database

The canonical setting is `DATABASE_URL`, normally:

```text
postgresql+psycopg://user:password@host:port/database
```

`backend/database.py` creates a SQLAlchemy engine with `pool_pre_ping`, configurable pool size/overflow/timeout/recycle, and `SessionLocal`. `get_db()` supplies one request session, rolls back on error, and closes it.

### Main models/tables

`backend/models/` contains the SQLAlchemy models. Important tables include:

- `users`: portal identity, email, role, password hash, active state
- `students`: student master data and roll/link information
- `ufm_cases`: UFM case lifecycle, reporter/student/exam references, status
- `case_reviews`: review actions and reviewer roles
- `evidence`: uploaded/attached evidence metadata
- `detections`: AI/live detection records and model version
- `notifications`: user notifications
- `audit_logs`: operational/admin audit events
- `exams`, `exam_rooms`, `exam_enrollments`, `exam_invigilators`: exam setup and assignment
- `cameras`: camera/source configuration
- `result_controls`: result holds/releases
- `clarifications`: student clarification submissions

Foreign keys are represented in the model files and connect users, students, cases, exams, reviews, evidence, detections, notifications, and audit records. Indexes include primary keys, unique user email, role and model-specific indexes from migration files. Alembic migrations are under `backend/alembic/versions/`.

### Database request flow

```text
React fetch()
  -> FastAPI route and Pydantic request model
  -> Depends(get_db) SQLAlchemy Session
  -> select()/insert/update/delete against PostgreSQL
  -> commit/rollback
  -> Pydantic response model
  -> JSON response to React
```

Seed/bootstrap scripts include `backend/dev_bootstrap.py`, `backend/seed_demo_users.py`, and authorized-user provisioning scripts. Demo seeding is configuration-controlled and is not a production feature.

## 8. AI stack and actual status

### Libraries

| Library | Version | Purpose | Main location |
|---|---:|---|---|
| Ultralytics | 8.4.126 | YOLO loading, prediction, tracking/inference | `backend/live_stream.py`, `ai/` |
| PyTorch | 2.13.0 in `requirements.txt` | YOLO runtime/device checks | `backend/live_stream.py`, training scripts |
| torchvision | 0.28.0 | PyTorch vision dependency | requirements |
| OpenCV | 5.0.0.93 | VideoCapture, frame conversion, boxes, JPEG encoding, Haar fallback | `backend/capture_source.py`, `backend/live_stream.py`, `ai/posture_analysis.py` |
| NumPy | 2.5.2 | Image arrays and geometry | backend/AI modules |
| MediaPipe | 0.10.21 in Mac requirements; optional in Docker | Face Mesh/head orientation | `ai/posture_analysis.py` |

### YOLO facts

- Runtime inference is in `backend/live_stream.py`, especially `_ensure_model()` and `_run_loop()`.
- Weight selection is delegated to the project’s `ufm_classes`/weight-resolution code used by `live_stream.py`.
- The repository contains `yolov8n.pt`, `backend/yolov8n.pt`, and documented custom checkpoints/weights.
- The current live default is documented as the COCO YOLOv8n baseline; custom `ufm_custom` merging is opt-in with `YOLO_MERGE_CUSTOM=1` because the existing custom checkpoint has taxonomy/quality problems.
- The evaluated `ufm-od-v1` report documents six classes: `mobile_phone`, `laptop`, `smart_watch`, `normal_watch`, `notes_paper`, and `electronic_gadget`.
- Historical `ufm_custom/best.pt` documentation describes a different five-class taxonomy. This mismatch means the custom model must not be presented as the current validated production default.
- A class is mapped to portal detection types in `backend/detection_bridge.py`; confirmed detections can create a draft UFM case, but human review is still required.

### Reported evaluation metrics

`docs/AI_MODEL_RESULTS.md` reports held-out test metrics for the documented `ufm-od-v1` checkpoint:

| Class | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|
| mobile_phone | 0.870 | 0.687 | 0.788 | 0.551 |
| laptop | 0.735 | 0.716 | 0.754 | 0.554 |
| smart_watch | 0.895 | 0.886 | 0.944 | 0.678 |
| normal_watch | 0.737 | 0.810 | 0.845 | 0.601 |
| notes_paper | 0.716 | 0.474 | 0.569 | 0.210 |
| electronic_gadget | 0.592 | 0.453 | 0.533 | 0.311 |
| all | 0.758 | 0.671 | 0.739 | 0.484 |

The same report says CPU inference was 85.4 ms/image. `docs/AI_TRAINING_REPORT.md` separately states that a historical custom checkpoint lacks preserved `results.csv` metrics and has known taxonomy/quality blockers. Do not combine these two model records as if they were one experiment.

### Detection, temporal validation, and alerts

- `backend/live_stream.py` reads a frame, runs YOLO every configured detection interval, and reuses last boxes for cheaper redraw between inference frames.
- Object observations are passed through a session tracker for repeated-frame confirmation.
- `backend/detection_bridge.py` persists detection records and may create a draft case for confirmed detections.
- Suspicion scoring is implemented by `ai/suspicion_score.py` and imported by the live engine.
- `NORMAL`, `OBSERVE`, and `REVIEW_REQUIRED` are the actual suspicion levels in `ai/suspicion_score.py`. `SUSPICIOUS` and `HIGH_RISK` are not the names used by that score engine.
- Default score thresholds are `OBSERVE >= 25` and `REVIEW_REQUIRED >= 55`; these are environment-configurable.
- A turned-head episode requires approximately 1.2 seconds by default before credit; repeated turns are tracked over 12 seconds; alert cooldown defaults to 40 seconds.
- Object events add configured score values for `CONFIRM` or `REVIEW`.
- WebSocket alerts are broadcast through `backend/ws_hub.py` and `backend/routers/ws_alerts.py`.

### Behavior analysis

`ai/posture_analysis.py` is implemented as a candidate head/posture estimator:

- MediaPipe Face Mesh is used when importable.
- Six landmarks are passed to OpenCV `solvePnP` for approximate yaw, pitch, and roll.
- If MediaPipe is unavailable/fails, OpenCV Haar face detection provides a low-quality geometric fallback.
- Downward pitch alone is treated as likely writing and does not add suspicion in the score engine.
- This is head orientation, not precise eye-gaze tracking.
- Peer interaction, true hand behavior, and learned cheating behavior classification are not implemented as a complete independent model. They should be described as future/partial work unless a specific route/module is demonstrated.

## 9. Camera and real-time flow

### Sources

`backend/capture_source.py` supports webcam indexes, video files, RTSP URLs, and stream URLs through `cv2.VideoCapture`. The source is classified by `classify_source()` and opened by `open_capture()`. Files loop when they reach the end; network sources retry after failures.

### Live flow

```text
Camera/webcam/video/RTSP
  -> open_capture()
  -> live_stream session loop
  -> YOLO inference at configured interval
  -> boxes/labels and temporal tracker
  -> optional posture/head analysis
  -> suspicion score
  -> detection/event persistence
  -> WebSocket alert broadcast
  -> frontend monitoring/detections UI
```

Live API routes are in `backend/routers/live.py`:

- `GET /live/status`
- `POST /live/cameras/{camera_id}/start`
- `POST /live/cameras/{camera_id}/stop`
- `POST /live/test-source`
- `GET /live/cameras/{camera_id}/snapshot`
- `GET /live/cameras/{camera_id}/mjpeg`

The authenticated WebSocket is `WS /ws/alerts`. It receives a JWT in the query string, checks the active database user and detection-staff role, then registers the socket.

## 10. Docker

### Development Compose

`docker-compose.yml` defines:

- `db`: PostgreSQL 16 Alpine, host port 15432, persistent `ve_pg` volume
- `api`: Python image built from root `Dockerfile`, port 8000, uploads and AI mounts, healthcheck `/health`
- `frontend`: Node 22 Alpine/Vite dev server, port 5173, source mount and node_modules volume

### Production Compose

`docker-compose.prod.yml` defines:

- PostgreSQL 16 with `ve_pg_prod`
- API image with persistent uploads volume
- Frontend image built from `frontend/Dockerfile`, served by Nginx on port 80 and published on host port 8080
- No development source mounts or Vite dev server in the production frontend

Docker is used for repeatable dependencies, a consistent PostgreSQL service, isolated API/frontend processes, health-checked startup, persistent volumes, and a production topology. The project can run without Docker in local hybrid mode if PostgreSQL and the required Python/Node dependencies are installed and environment variables are configured.

**Docker vs VM viva answer:** a container shares the host kernel and packages the application/dependencies, so it is lighter and starts faster than a complete virtual machine. A VM virtualizes a whole guest operating system.

## 11. Important API catalogue

The complete route source is `backend/main.py`, `backend/routers/live.py`, `backend/routers/admin_users.py`, and `backend/routers/ws_alerts.py`.

| Category | Method/route | Auth/role | Purpose |
|---|---|---|---|
| Auth | `POST /auth/login` | Password mode | Password login and JWT issue |
| Auth | `POST /auth/google` | Google credential | Google login and JWT issue |
| Auth | `GET /auth/me` | Any active user | Current user |
| Auth | `GET /auth/config` | Public | Login feature flags |
| Admin | `GET/POST/PATCH /admin/users...` | ADMINISTRATOR | User administration |
| Admin | `POST /admin/users/import` | ADMINISTRATOR | Bulk import |
| Admin | `GET /admin/audit-logs` | ADMINISTRATOR | Admin audit |
| Admin | `GET /admin/roles` | ADMINISTRATOR | Role catalogue |
| Exam | `/exam-rooms`, `/cameras`, `/exams` | Route-specific staff roles | Master data |
| UFM | `POST /ufm-cases` | INVIGILATOR | Create a case |
| UFM | `GET /ufm-cases` and `GET /ufm-cases/{case_id}` | Route-specific roles | Case queues/details |
| UFM | `POST .../reviews` | HOD/DEC/Exam/UFM roles as configured | Review actions |
| Evidence | `GET /evidence`, file/preview routes | Evidence roles | Evidence access |
| Student | `GET /me/student-profile` | STUDENT | Current student profile |
| Student | clarification routes | STUDENT/route-specific | Clarifications |
| AI/live | `/live/*` | Monitor/camera-admin roles | Start/stop/status/capture |
| Detection | `GET/PATCH/POST /detections...` | Detection staff | Detection inbox and seen state |
| Result | `/result-controls` | Result-control roles | Hold/release result controls |
| Reports | `/ufm-cases/export.csv`, `/audit-logs/export.csv` | Reports roles | CSV exports |
| Notifications | `/notifications...` | Authenticated user | Notifications/read state |
| Real-time | `WS /ws/alerts` | Active detection-staff JWT | Alert stream |

## 12. Security inspection

### Implemented

- HS256 JWT signing and expiry using PyJWT.
- JWT secret loaded from environment and production checks for length/placeholder values.
- bcrypt password hashing/comparison.
- Google ID-token signature, audience, issuer, expiry, and email verification checks.
- Active-user check on every authenticated request.
- Database role, not only the JWT role claim, is authoritative for route authorization.
- Pydantic validation and FastAPI request parsing.
- SQLAlchemy parameterized database access.
- Configurable CORS with production wildcard rejection.
- Secrets are represented by environment variables and are not reported in this guide.
- Upload and evidence access are protected by route dependencies/case access checks.

### Not implemented or limitations

- No server-side JWT revocation/logout endpoint.
- No refresh-token mechanism.
- Browser token is in JavaScript-accessible `sessionStorage`, not an HttpOnly cookie.
- No application-wide rate limiter was found.
- No dedicated security-header middleware such as a CSP policy was found in the inspected backend.
- XSS prevention is primarily delegated to React escaping and normal frontend behavior; no separate CSP/security sanitizer layer was found.
- The current WebSocket token is passed as a query parameter because browser WebSocket clients cannot use a normal Authorization header in the same way; the endpoint validates it and closes unauthorized sockets.
- Custom AI model quality/taxonomy is not fully production-certified; the repository documents blockers and keeps custom merging opt-in.

## 13. Architecture diagram

```text
Browser
  React/Vite frontend
  React Router + AuthContext + fetch API client
        |
        | REST JSON / multipart / MJPEG / WebSocket alerts
        v
FastAPI API
  JWT/Google authentication
  role and case authorization
  UFM workflow, reports, evidence, notifications
        |
        +--> SQLAlchemy + psycopg --> PostgreSQL
        |
        +--> OpenCV capture --> YOLO/PyTorch inference
        |                         + optional MediaPipe posture
        |                         + temporal tracker/suspicion score
        |                         + detection/event persistence
        |                         + WebSocket alert hub
        |
        +--> filesystem/volume for uploaded evidence
        +--> SMTP email notifications when configured
```

## 14. Supported end-to-end flows

### Flow 1: User login

`Login.jsx` submits credentials or a Google ID token to `/auth/login` or `/auth/google`. The backend verifies identity, loads an authorized active `User`, signs a JWT, and returns it. `AuthContext` stores it in session storage. Later requests attach it as a Bearer token.

### Flow 2: Admin API request

The frontend calls an `/admin/...` endpoint with the Bearer token. `get_current_user()` validates the JWT and active user. `_admin = require_roles("ADMINISTRATOR")` checks the database role. The request proceeds or receives 401/403.

### Flow 3: Invigilator monitoring

The frontend calls live start/status APIs. `backend/routers/live.py` checks a monitor role. `live_stream` opens the configured camera source, starts a session thread, generates JPEG snapshots/MJPEG, and emits detection/suspicion alerts.

### Flow 4: Camera frame to AI

`VideoCapture.read()` produces a frame. The live loop periodically calls YOLO, draws/reuses labels, optionally calls posture analysis, updates suspicion state, encodes the latest JPEG, and stores recent labels/events.

### Flow 5: Phone detection

YOLO produces a label/confidence/box. The project maps phone-like labels to `MOBILE_PHONE`, applies configured confidence/policy and multi-frame tracking, records the detection, and can create a draft case from a confirmed detection. It does not automatically declare a final academic violation.

### Flow 6: UFM event creation

Confirmed live events are enqueued for persistence. `detection_bridge.py` can create a draft UFM case when the required student/exam context is available. Human workflow review remains separate.

### Flow 7: Event shown in frontend

The backend broadcasts an event through `ws_hub` to authenticated `/ws/alerts` clients. The frontend monitoring/detection pages update their live view and can also read persisted detections through REST APIs.

## 15. Training and dataset facts

Training/evaluation scripts are under `ai/`, including `train_yolo.py` as referenced by `docs/AI_TRAINING_REPORT.md`, `evaluate_model.py`, `benchmark_inference.py`, dataset-quality scripts, and split utilities.

The repository contains YOLO dataset YAML files under `ai/dataset/ufm/`, annotation classes under `ai/annotation/`, sample media, and training reports. The reports explicitly document multiple dataset/checkpoint taxonomies and warn against claiming the historical custom checkpoint as a validated current model.

The reported historical training configuration includes YOLOv8n, 15 epochs, image size 416, batch 1, CPU, and deterministic seed 0 for `ufm_custom`. A separate `ufm-od-v1` report documents a held-out six-class evaluation. Because the records describe different class maps/checkpoints, the safe viva answer is: “The repository contains both a COCO YOLOv8n runtime baseline and custom UFM experiments; the custom model is not the unconditional production default and its records must be identified by checkpoint/version.”

Simple metric explanations:

- **Precision:** Of the detections called positive, how many were correct.
- **Recall:** Of the real objects present, how many were found.
- **mAP50:** Average precision using IoU 0.50.
- **mAP50-95:** Average precision averaged over stricter IoU thresholds from 0.50 to 0.95.

## 16. Completed vs partial vs future

### Completed in code

- React/Vite role-based portal UI.
- FastAPI REST API and SQLAlchemy/PostgreSQL persistence.
- JWT and Google authentication paths.
- Database-backed role authorization.
- UFM case/review/evidence/notification/result-control workflows.
- Admin user and role management.
- Webcam/file/RTSP-capable capture layer.
- YOLO live inference path and persisted detection records.
- Temporal object confirmation and suspicion score engine.
- Optional MediaPipe posture/head-orientation path with OpenCV fallback.
- Authenticated WebSocket alert path.
- Development and production Docker Compose topologies.
- Alembic migration structure.

### Partially completed or conditional

- Password login is configuration-controlled and intended for demo/development; production configuration requires Google mode.
- MediaPipe posture is optional; Docker documents it as not installed by default and uses an OpenCV fallback.
- Custom YOLO weights exist, but the reports identify taxonomy and quality blockers; custom merge is opt-in.
- Email notification delivery is optional/configured by SMTP and is dispatched asynchronously after database work.
- WebSocket alert fan-out is in-process, so it is not a multi-instance message broker architecture.
- Full peer-interaction, hand-behavior, and eye-gaze cheating analysis is not a complete validated model.

### Remaining/future or not implemented

- Refresh tokens and server-side token revocation.
- A persistent distributed WebSocket/event broker for horizontally scaled live alerts.
- A fully retrained, taxonomy-aligned, independently validated custom UFM model.
- Learned paper exchange/hand interaction model.
- Precise calibrated eye-gaze tracking.
- Application-wide rate limiting and a dedicated CSP/security-header layer.

## 17. Forty likely viva questions

| # | Question | Short viva answer | File/function to show |
|---:|---|---|---|
| 1 | Frontend kis technology me bana hai? | React with Vite and JSX. | `frontend/src/main.jsx` |
| 2 | Backend kis technology me bana hai? | Python FastAPI. | `backend/main.py` |
| 3 | Database kya hai? | PostgreSQL accessed through SQLAlchemy/psycopg. | `backend/database.py` |
| 4 | React kyun use kiya? | Reusable components and role-specific interactive dashboards. | `frontend/src/App.jsx` |
| 5 | Vite ka role kya hai? | Frontend development server and production bundler. | `frontend/package.json` |
| 6 | Routing kaise hoti hai? | React Router nested routes in `App.jsx`. | `frontend/src/App.jsx` |
| 7 | State management kya hai? | React Context for auth and component hooks for local state. | `AuthContext.jsx` |
| 8 | Protected route kaise hota hai? | `ProtectedRoute` redirects if there is no valid authenticated session. | `ProtectedRoute.jsx` |
| 9 | API calls kis library se hoti hain? | Native `fetch` through `apiRequest`. | `frontend/src/services/api.js` |
| 10 | Authentication kya hai? | Verifying identity through password or Google ID token. | `main.py`, `google_auth.py` |
| 11 | Authorization kya hai? | Checking permissions after authentication, mainly by database role. | `deps.py` |
| 12 | JWT kahan create hota hai? | `create_access_token` in `security.py`. | `backend/security.py` |
| 13 | JWT algorithm kya hai? | HS256, HMAC-SHA256. | `security.py` |
| 14 | JWT expire kab hota hai? | `JWT_EXPIRE_MINUTES`, default 60. | `security.py` |
| 15 | JWT verify kahan hota hai? | `decode_access_token`, called by `get_current_user`. | `security.py`, `deps.py` |
| 16 | Password kaise store hota hai? | As a bcrypt hash, never as plaintext. | `hash_password` |
| 17 | Password comparison kaise hota hai? | `bcrypt.checkpw` in `verify_password`. | `security.py` |
| 18 | Refresh token hai? | No, not implemented. | No refresh route/model |
| 19 | Logout kaise hota hai? | Frontend clears session storage and React auth state. | `AuthContext.logout` |
| 20 | Admin authorization kaise hoti hai? | `_admin = require_roles("ADMINISTRATOR")`. | `routers/admin_users.py` |
| 21 | Student ko staff pages se kaise roka hai? | Frontend role gates plus backend role dependencies. | `roleAccess.js`, `deps.py` |
| 22 | PostgreSQL kyun? | Relational integrity for cases, users, exams, reviews, and evidence metadata. | `database.py`, `models/` |
| 23 | ORM kya hai? | SQLAlchemy 2.0. | `backend/models/` |
| 24 | Migrations kaise manage hain? | Alembic revision files. | `backend/alembic/versions/` |
| 25 | Docker kyun use kiya? | Reproducible API, frontend, and PostgreSQL deployment. | `docker-compose.yml` |
| 26 | Docker vs VM? | Containers share the host kernel and are lighter than full guest OS VMs. | Compose files |
| 27 | YOLO kya karta hai? | Detects objects and returns labels, confidence, and boxes. | `backend/live_stream.py` |
| 28 | YOLO model kaunsa hai? | Runtime baseline is documented as YOLOv8n/COCO; custom checkpoints are optional and separately documented. | `live_stream.py`, AI reports |
| 29 | `best.pt` kya hai? | A trained checkpoint file, not automatically proof of production quality. | `docs/AI_TRAINING_REPORT.md` |
| 30 | Confidence threshold kya hai? | Live start defaults to `conf=0.28`; policy and multi-frame persistence further reduce alerts. | `backend/routers/live.py` |
| 31 | Temporal validation kyun? | One frame can be false; repeated observations make alerts more stable. | `live_stream.py`, tracker |
| 32 | Suspicion score kya karta hai? | Combines sustained head-turn and confirmed/review object events. | `ai/suspicion_score.py` |
| 33 | Score levels kya hain? | `NORMAL`, `OBSERVE`, `REVIEW_REQUIRED`. | `level_for` |
| 34 | MediaPipe ka role kya hai? | Optional face landmarks for approximate head orientation. | `ai/posture_analysis.py` |
| 35 | Kya it is eye-gaze tracking? | No; the code explicitly describes approximate head orientation, not precise gaze. | `posture_analysis.py` |
| 36 | Camera input kaise aata hai? | Webcam, file, RTSP, or stream through OpenCV `VideoCapture`. | `capture_source.py` |
| 37 | Real-time communication hai? | Yes, authenticated WebSocket alerts plus MJPEG/snapshot live views. | `ws_alerts.py`, `live.py` |
| 38 | Phone detection se final violation hoti hai? | No; it creates detection/draft-case evidence and still requires workflow review. | `detection_bridge.py` |
| 39 | Database transaction handling kya hai? | Per-request sessions rollback on exceptions and close in `get_db`. | `database.py` |
| 40 | Main AI limitation kya hai? | Custom checkpoint taxonomy/quality is not fully aligned or production-certified. | `AI_TRAINING_REPORT.md`, `AI_MODEL_RESULTS.md` |

## 18. Final quick answers

- **Frontend:** React 19 + Vite 8 + JSX + Tailwind CSS 4.
- **Backend:** Python FastAPI 0.141.1.
- **Database:** PostgreSQL 16 in Docker, SQLAlchemy 2.0, psycopg 3.
- **AI stack:** Ultralytics YOLO, PyTorch, OpenCV, NumPy, optional MediaPipe.
- **Authentication:** Google ID-token authentication and configuration-controlled bcrypt password login, followed by an application JWT.
- **Authorization:** Database-backed role checks through FastAPI dependencies plus case-access rules.
- **Docker:** PostgreSQL/API/frontend development and production Compose topologies.
- **API style:** REST JSON/multipart APIs, CSV exports, MJPEG/snapshot live endpoints, and an authenticated WebSocket alert stream.
- **Model name:** Runtime baseline documented as YOLOv8n/COCO; custom UFM checkpoints are opt-in and versioned separately.
- **Model classes:** The documented `ufm-od-v1` report lists `mobile_phone`, `laptop`, `smart_watch`, `normal_watch`, `notes_paper`, `electronic_gadget`; historical custom checkpoints have a different taxonomy.
- **Security technologies:** PyJWT HS256, bcrypt, Google Auth, FastAPI/Pydantic validation, SQLAlchemy parameterized queries, CORS validation, active-user and role checks.
- **Main frontend file:** `frontend/src/App.jsx` (application routes); bootstrap is `frontend/src/main.jsx`.
- **Main backend file:** `backend/main.py`.
- **Main AI/live file:** `backend/live_stream.py`; posture analysis is `ai/posture_analysis.py`.

## 19. Top 15 files to keep open during viva

1. `README.md`
2. `frontend/package.json`
3. `frontend/src/main.jsx`
4. `frontend/src/App.jsx`
5. `frontend/src/context/AuthContext.jsx`
6. `frontend/src/services/api.js`
7. `backend/main.py`
8. `backend/security.py`
9. `backend/deps.py`
10. `backend/google_auth.py`
11. `backend/database.py`
12. `backend/portal_roles.py`
13. `backend/live_stream.py`
14. `backend/capture_source.py`
15. `ai/suspicion_score.py`

