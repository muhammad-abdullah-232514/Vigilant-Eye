# VigilantEye — FYP Demo Runbook

Short walkthrough for supervisors / evaluators. Password for all demo users: **`Demo@123`**.

---

## 0. Start the stack (before the demo)

**Terminal A — backend**

```powershell
cd "D:\BS CS\Vigilant Eye\backend"
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

**Terminal B — frontend**

```powershell
cd "D:\BS CS\Vigilant Eye\frontend"
npm run dev
```

Open: **http://127.0.0.1:5173**  
API docs (optional): **http://127.0.0.1:8000/docs**

If demo users / DEMO001 student are missing:

```powershell
cd "D:\BS CS\Vigilant Eye\backend"
.\venv\Scripts\Activate.ps1
python seed_demo_users.py
```

---

## 1. Demo accounts

| Role | Email | What to show |
|------|--------|----------------|
| Invigilator | `invigilator@demo.com` | Create case, evidence, detections, monitoring |
| HOD | `hod@demo.com` | Forward case, audit trail |
| DEC | `dec@demo.com` | Investigate / forward |
| Exam Department | `examdept@demo.com` | Forward to committee, result holds |
| UFM Committee | `ufm@demo.com` | APPROVE / REJECT |
| Student | `student@demo.com` | Own cases + clarification |

Login page: click a role card to fill email (password stays `Demo@123`).

**Student portal link:** cases for roll **`DEMO001`** (DB student id usually `2`). Create Case defaults to this roll when present.

---

## 2. Happy-path story (≈ 8–10 minutes)

### A. Invigilator — create a case

1. Login as **invigilator@demo.com**
2. Dashboard → KPIs / camera tiles (**PROTOTYPE** — not live RTSP)
3. **Create Case**
   - Student: **DEMO001**
   - Exam: any listed exam (e.g. CS101)
   - Violation + short description
4. Submit → lands on **Case Detail**
5. Optional: **Evidence Library** → upload a small image for that case

**Talking point:** Case starts as **PENDING**; HOD is notified in-portal.

### B. Student — clarification

1. Logout → login **student@demo.com**
2. Dashboard / **UFM Cases** → only cases for DEMO001
3. Open the case → **Submit Clarification** (10+ characters)
4. Confirm it appears under **My Clarifications** and on case detail

**Talking point:** Clarification notifies HOD + reporting invigilator (portal notifications; email = FUTURE).

### C. HOD → DEC → Exam Dept → UFM

Use **Case Detail → Review Actions** (or open from each role’s queue).

| Step | Login as | Action | New status |
|------|----------|--------|------------|
| 1 | `hod@demo.com` | **FORWARD** | `DEC_REVIEW` |
| 2 | `dec@demo.com` | **FORWARD** | `EXAM_DEPARTMENT_REVIEW` |
| 3 | `examdept@demo.com` | **FORWARD** | `UFM_COMMITTEE_REVIEW` |
| 4 | `ufm@demo.com` | **APPROVE** (or REJECT) | `APPROVED` / `REJECTED` |

On **APPROVE**:

- Result control auto-created: result **HELD**, transcript **BLOCKED**
- Show **Result Control** page as Exam Dept or UFM
- Optional: click **Release** to demonstrate unblocking

### D. Audit Trail

Login as **hod@demo.com** (or DEC / Exam / UFM) → **Audit Trail**

Filter/search for `CASE_CREATED`, `CLARIFICATION_SUBMITTED`, `CASE_REVIEW_*`, `RESULT_HOLD_CREATED`.

---

## 3. Optional AI PoC (if time)

From `ai/` (venv with YOLO deps as already set up for Day 4):

1. Run detector / validate on a sample image or clip
2. Confirm detections → save with `save_confirmed_to_db.py`
3. In portal as invigilator/HOD: **Detections & Alerts** shows rows
4. Optional draft case from detection (API / bridge) if you use that path

**Honest line for evaluators:** pretrained YOLO is a PoC; phones/watches may be missed; custom training / MediaPipe / live RTSP = **FUTURE**.

---

## 4. Role dashboards (30-second tour)

| Role | Highlight |
|------|-----------|
| Invigilator | Cameras + detections + my open cases |
| HOD / DEC / Exam / UFM | Queue KPIs + status/violation charts |
| Student | Cases + guidelines + clarification CTA |
| Reports | PROTOTYPE summaries (no PDF export yet) |
| Live Monitoring | PROTOTYPE tiles only |

---

## 5. What to say is done vs future

### In this prototype

- Auth + RBAC (JWT)
- UFM case workflow with role actions
- Evidence upload (files on disk + DB metadata)
- Portal notifications
- Student clarification
- Result hold on approve + release
- Audit log
- AI PoC → detections table
- Role-based React portal (mockup-inspired)

### FUTURE / out of one-week prototype

- Live RTSP / WebRTC video
- Email / SMS / WebSockets
- Custom YOLO / MediaPipe
- Digital signatures
- Full student SIS integration (beyond DEMO001 link)
- PDF reports / polished analytics

---

## 6. If something breaks mid-demo

| Symptom | Quick fix |
|---------|-----------|
| Login fails | Re-run `python seed_demo_users.py`; password `Demo@123` |
| Student sees 0 cases | Case must use student **DEMO001** |
| Empty Create Case dropdowns | Need ≥1 student and ≥1 exam in DB |
| Audit 403 | Use HOD/DEC/Exam/UFM — not invigilator/student |
| Frontend blank / API errors | Confirm backend on `:8000`, `VITE_API_URL` in `frontend/.env` |
| CORS errors | Use `127.0.0.1:5173` (allowed in backend CORS) |

---

## 7. Suggested closing sentence

> VigilantEye demonstrates an end-to-end institutional UFM pipeline: AI-assisted detection PoC, invigilator case filing, student clarification, multi-role review, automatic result hold, and a full audit trail — with live video and production ML marked as future work.
