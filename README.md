# VigilantEye

AI-assisted **Unfair Means (UFM)** detection PoC and institutional review portal for Air University (FYP prototype).

Invigilators file cases → students clarify → HOD / DEC / Exam Dept / UFM Committee review → approved cases auto-hold results — with a full audit trail.

**Full live demo steps:** [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind + React Router |
| Backend | FastAPI + SQLAlchemy + JWT + bcrypt |
| Database | PostgreSQL |
| AI PoC | Ultralytics YOLO (pretrained) → `detections` table |

---

## Repository layout

```text
backend/     FastAPI API, models, auth, workflow, uploads
frontend/    UFM Web Portal (role dashboards)
ai/          Detector scripts, samples, annotated outputs
docs/        Demo runbook, mockups
```

---

## Quick start

### 1. Database

Create a PostgreSQL database named `vigilant_eye` and put credentials in `backend/.env` (do not commit secrets):

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/vigilant_eye
JWT_SECRET=your-long-random-secret
JWT_EXPIRE_MINUTES=480
```

### 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed_all_demo.py
uvicorn main:app --reload
```

API: http://127.0.0.1:8000 · Docs: http://127.0.0.1:8000/docs

`seed_all_demo.py` creates demo users (DEMO001 link), room A-101, webcam + sample-clip cameras, and exam CS101.

### 3. Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Portal: http://127.0.0.1:5173

`frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
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

---

## Core workflow (one line)

`PENDING` → HOD FORWARD → `DEC_REVIEW` → DEC FORWARD → `EXAM_DEPARTMENT_REVIEW` → Exam FORWARD → `UFM_COMMITTEE_REVIEW` → APPROVE/REJECT → hold on approve.

---

## Evaluator checklist

Use during a viva / demo. Tick as you go.

### Environment

- [ ] Backend running (`uvicorn`) without errors  
- [ ] Frontend opens at http://127.0.0.1:5173  
- [ ] Login works with a demo account  

### Invigilator

- [ ] Dashboard loads with live KPIs  
- [ ] Create Case for **DEMO001** succeeds  
- [ ] Evidence upload attaches to the case  
- [ ] (Optional) Detections page shows AI-confirmed rows  

### Student

- [ ] `student@demo.com` sees only DEMO001 cases  
- [ ] Clarification submits and appears on case detail  
- [ ] Help & Support page opens  

### Review chain

- [ ] HOD can **FORWARD** from PENDING  
- [ ] DEC can **FORWARD** from DEC_REVIEW  
- [ ] Exam Dept can **FORWARD** to committee  
- [ ] UFM can **APPROVE** or **REJECT**  

### Aftermath

- [ ] APPROVED case creates a result **HELD** / transcript **BLOCKED**  
- [ ] Exam/UFM can **Release** a hold  
- [ ] Audit Trail shows create / review / clarification / hold events (HOD+)  

### Honesty check (prototype scope)

- [ ] Live Monitoring shown as MJPEG (webcam / sample clip / RTSP URL), not WebRTC mesh  
- [ ] YOLO described honestly (custom train and/or COCO fallback)  
- [ ] Email / WebSockets / digital signatures = FUTURE  

---

## Prototype vs future

| In this prototype | FUTURE |
|-------------------|--------|
| JWT auth + RBAC | SSO / campus IdP |
| Case workflow + reviews | Digital signatures |
| Evidence files on disk | Secure evidence vault / CDN |
| Portal notifications | Email / SMS / WebSockets |
| Student clarification (DEMO001 link) | Full SIS binding |
| Result hold / release | ERP grade integration |
| Audit log | Advanced forensics export |
| Live MJPEG + YOLO → detections | Multi-cam WebRTC, stronger custom ML |

---

## Useful commands

```powershell
# Full demo seed (users + cameras + CS101)
cd backend
.\venv\Scripts\Activate.ps1
python seed_all_demo.py

# Frontend production build check
cd frontend
npm run build
```

AI scripts live under `ai/` (`train_yolo.py`, `save_confirmed_to_db.py`, Live Monitoring uses the API).

---

## Authors

Student FYP team — Air University. Built with Cursor as a development assistant; authors own the project and demo.
