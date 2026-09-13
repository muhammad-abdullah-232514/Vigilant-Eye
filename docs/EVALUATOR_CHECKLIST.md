# VigilantEye — Evaluator Checklist

Print or keep open during the viva. Password: **`Demo@123`**.  
Detailed steps: [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) · Project overview: [../README.md](../README.md)

---

## Setup

| # | Check | Pass |
|---|--------|------|
| 1 | Backend `uvicorn` on :8000 | ☐ |
| 2 | Frontend on http://127.0.0.1:5173 | ☐ |
| 3 | Login with any demo account | ☐ |

---

## Story path

| # | Check | Pass |
|---|--------|------|
| 4 | Invigilator creates case for **DEMO001** | ☐ |
| 5 | Evidence upload (optional) | ☐ |
| 6 | Student sees case + submits clarification | ☐ |
| 7 | HOD **FORWARD** → DEC_REVIEW | ☐ |
| 8 | DEC **FORWARD** → Exam Dept | ☐ |
| 9 | Exam **FORWARD** → UFM Committee | ☐ |
| 10 | UFM **APPROVE** or **REJECT** | ☐ |
| 11 | On APPROVE: result hold appears | ☐ |
| 12 | Audit Trail shows key events | ☐ |

---

## Scope honesty

| # | Check | Pass |
|---|--------|------|
| 13 | Live Monitoring shown (webcam / sample clip / RTSP URL) | ☐ |
| 14 | YOLO described honestly (custom train / COCO fallback) | ☐ |
| 15 | Email / WebRTC mesh / full SIS = FUTURE | ☐ |

---

## Demo accounts (quick)

`invigilator@` · `hod@` · `dec@` · `examdept@` · `ufm@` · `student@` — all `@demo.com`
