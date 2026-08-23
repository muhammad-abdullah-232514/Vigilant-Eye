import uuid
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import engine, get_db
from deps import get_current_user, require_roles
from detection_bridge import create_draft_case_from_detection
from models.audit_log import AuditLog  # registers audit_logs table on Base
from models.base import Base
from models.camera import Camera  # registers cameras table on Base
from models.case_review import CaseReview  # registers case_reviews table on Base
from models.clarification import Clarification  # registers clarifications table on Base
from models.detection import Detection  # registers detections table on Base
from models.exam import Exam  # registers exams table on Base
from models.exam_room import ExamRoom  # registers exam_rooms table on Base
from models.evidence import Evidence  # registers evidence table on Base
from models.notification import Notification  # registers notifications table on Base
from models.result_control import ResultControl  # registers result_controls table on Base
from models.student import Student  # registers students table on Base
from models.ufm_case import UfmCase  # registers ufm_cases table on Base
from models.user import User
from schemas.audit_log import AuditLogOut
from schemas.auth import LoginRequest, LoginResponse
from schemas.camera import CameraCreate, CameraOut
from schemas.case_review import CaseReviewCreate, CaseReviewOut
from schemas.clarification import ClarificationCreate, ClarificationOut
from schemas.detection import DetectionOut, DraftCaseFromDetection
from schemas.exam import ExamCreate, ExamOut
from schemas.exam_room import ExamRoomCreate, ExamRoomOut
from schemas.evidence import EvidenceOut
from schemas.notification import NotificationOut
from schemas.result_control import ResultControlCreate, ResultControlOut
from schemas.student import StudentCreate, StudentOut
from schemas.ufm_case import UfmCaseCreate, UfmCaseOut
from schemas.user import UserCreate, UserOut
from security import create_access_token, hash_password, verify_password
from student_portal import DEMO_STUDENT_ROLL, resolve_linked_student
from workflow import next_status

app = FastAPI(title="VigilantEye API", version="0.1.0")

# Allow local React/Vite frontend (Day 5) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

EVIDENCE_UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "evidence"
EVIDENCE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def write_audit_log(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None,
    description: str,
    user_id: int | None = None,
) -> None:
    """Save one audit trail row. Caller must commit."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    )


def create_notification(
    db: Session,
    *,
    user_id: int,
    case_id: int | None,
    type: str,
    title: str,
    message: str,
) -> None:
    """Create one portal notification. Caller must commit."""
    db.add(
        Notification(
            user_id=user_id,
            case_id=case_id,
            type=type,
            title=title,
            message=message,
            is_read=False,
        )
    )


def notify_users_with_role(
    db: Session,
    *,
    role: str,
    case_id: int,
    type: str,
    title: str,
    message: str,
) -> None:
    users = db.scalars(
        select(User).where(User.role == role, User.is_active.is_(True))
    ).all()
    for user in users:
        create_notification(
            db,
            user_id=user.id,
            case_id=case_id,
            type=type,
            title=title,
            message=message,
        )


# After a status change, notify the role that should act next (or the reporter).
STATUS_NEXT_ROLE = {
    "PENDING": "HOD",
    "DEC_REVIEW": "DEC",
    "EXAM_DEPARTMENT_REVIEW": "EXAM_DEPARTMENT",
    "UFM_COMMITTEE_REVIEW": "UFM_COMMITTEE",
}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "project": "VigilantEye",
    }


@app.post("/auth/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == credentials.email))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    return LoginResponse(
        message="Login successful",
        access_token=create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
        ),
        token_type="bearer",
        user=user,
    )


@app.get("/auth/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Protected route: requires Authorization: Bearer <token>."""
    return current_user


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "HOD")),
):
    existing = db.scalar(select(User).where(User.email == user_in.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.scalars(select(User).order_by(User.id)).all()
    return users


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@app.post("/students", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("INVIGILATOR", "HOD", "EXAM_DEPARTMENT")
    ),
):
    existing = db.scalar(
        select(Student).where(Student.student_id == student_in.student_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID already registered",
        )

    student = Student(
        student_id=student_in.student_id,
        name=student_in.name,
        department=student_in.department,
        program=student_in.program,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@app.get("/students", response_model=list[StudentOut])
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    students = db.scalars(select(Student).order_by(Student.id)).all()
    return students


@app.post("/exam-rooms", response_model=ExamRoomOut, status_code=status.HTTP_201_CREATED)
def create_exam_room(
    room_in: ExamRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "HOD")),
):
    existing = db.scalar(
        select(ExamRoom).where(ExamRoom.room_number == room_in.room_number)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room number already registered",
        )

    room = ExamRoom(
        room_number=room_in.room_number,
        building=room_in.building,
        capacity=room_in.capacity,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@app.get("/exam-rooms", response_model=list[ExamRoomOut])
def list_exam_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rooms = db.scalars(select(ExamRoom).order_by(ExamRoom.id)).all()
    return rooms


@app.post("/cameras", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(
    camera_in: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "HOD")),
):
    room = db.get(ExamRoom, camera_in.room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam room not found for room_id",
        )

    existing = db.scalar(
        select(Camera).where(Camera.camera_id == camera_in.camera_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Camera ID already registered",
        )

    camera = Camera(
        camera_id=camera_in.camera_id,
        name=camera_in.name,
        room_id=camera_in.room_id,
        stream_url=camera_in.stream_url,
        is_active=camera_in.is_active,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@app.get("/cameras", response_model=list[CameraOut])
def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cameras = db.scalars(select(Camera).order_by(Camera.id)).all()
    return cameras


@app.post("/exams", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(
    exam_in: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "HOD")),
):
    room = db.get(ExamRoom, exam_in.room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam room not found for room_id",
        )

    if exam_in.end_time <= exam_in.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be after start_time",
        )

    exam = Exam(
        course_code=exam_in.course_code,
        course_name=exam_in.course_name,
        semester=exam_in.semester,
        exam_date=exam_in.exam_date,
        start_time=exam_in.start_time,
        end_time=exam_in.end_time,
        room_id=exam_in.room_id,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@app.get("/exams", response_model=list[ExamOut])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exams = db.scalars(select(Exam).order_by(Exam.id)).all()
    return exams


def _next_case_number(db: Session) -> str:
    """Build a simple unique case number, e.g. UFM-20260822-0001."""
    today = datetime.utcnow().strftime("%Y%m%d")
    total = db.scalar(select(func.count()).select_from(UfmCase)) or 0
    return f"UFM-{today}-{total + 1:04d}"


@app.post("/ufm-cases", response_model=UfmCaseOut, status_code=status.HTTP_201_CREATED)
def create_ufm_case(
    case_in: UfmCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("INVIGILATOR", "HOD")),
):
    if db.get(Student, case_in.student_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student not found for student_id",
        )
    if db.get(Exam, case_in.exam_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam not found for exam_id",
        )

    case = UfmCase(
        case_number=_next_case_number(db),
        student_id=case_in.student_id,
        exam_id=case_in.exam_id,
        reported_by=current_user.id,
        violation_type=case_in.violation_type,
        description=case_in.description,
        remarks=case_in.remarks,
        status="PENDING",
    )
    db.add(case)
    db.flush()  # get case.id before commit
    write_audit_log(
        db,
        user_id=current_user.id,
        action="CASE_CREATED",
        entity_type="ufm_case",
        entity_id=case.id,
        description=f"Created case {case.case_number} ({case.violation_type})",
    )
    notify_users_with_role(
        db,
        role="HOD",
        case_id=case.id,
        type="CASE_CREATED",
        title="New UFM case",
        message=f"{case.case_number} created and awaits HOD review.",
    )
    db.commit()
    db.refresh(case)
    return case


@app.get("/ufm-cases", response_model=list[UfmCaseOut])
def list_ufm_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(UfmCase).order_by(UfmCase.id)
    if current_user.role == "STUDENT":
        linked = resolve_linked_student(db, current_user)
        if linked is None:
            return []
        query = query.where(UfmCase.student_id == linked.id)
    cases = db.scalars(query).all()
    return cases


@app.get("/ufm-cases/{case_id}", response_model=UfmCaseOut)
def get_ufm_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.get(UfmCase, case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UFM case not found",
        )
    if current_user.role == "STUDENT":
        linked = resolve_linked_student(db, current_user)
        if linked is None or case.student_id != linked.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own UFM cases",
            )
    return case


@app.get("/me/student-profile", response_model=StudentOut | None)
def my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
):
    """Linked student record for the logged-in demo student portal user."""
    return resolve_linked_student(db, current_user)


@app.post(
    "/ufm-cases/{case_id}/reviews",
    response_model=CaseReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_case_review(
    case_id: int,
    review_in: CaseReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HOD", "DEC", "EXAM_DEPARTMENT", "UFM_COMMITTEE")
    ),
):
    case = db.get(UfmCase, case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UFM case not found",
        )

    new_status = next_status(
        role=current_user.role,
        action=review_in.action,
        current_status=case.status,
    )

    review = CaseReview(
        case_id=case.id,
        reviewer_id=current_user.id,
        reviewer_role=current_user.role,
        action=review_in.action.strip().upper(),
        remarks=review_in.remarks,
    )
    case.status = new_status
    case.updated_at = datetime.utcnow()

    db.add(review)
    db.flush()
    write_audit_log(
        db,
        user_id=current_user.id,
        action=f"CASE_REVIEW_{review.action}",
        entity_type="ufm_case",
        entity_id=case.id,
        description=(
            f"{current_user.role} {review.action} on {case.case_number}; "
            f"status → {new_status}"
        ),
    )

    # Notify reporter about every status change
    create_notification(
        db,
        user_id=case.reported_by,
        case_id=case.id,
        type="CASE_STATUS",
        title="Case status updated",
        message=f"{case.case_number} is now {new_status}.",
    )

    # Notify next role in the chain (if any)
    next_role = STATUS_NEXT_ROLE.get(new_status)
    if next_role:
        notify_users_with_role(
            db,
            role=next_role,
            case_id=case.id,
            type="CASE_ACTION_REQUIRED",
            title="Case needs your action",
            message=f"{case.case_number} moved to {new_status}.",
        )

    # On APPROVED: auto-hold result/transcript for the student (scope demo story)
    if new_status == "APPROVED":
        existing_hold = db.scalar(
            select(ResultControl).where(ResultControl.case_id == case.id)
        )
        if existing_hold is None:
            hold = ResultControl(
                student_id=case.student_id,
                case_id=case.id,
                result_status="HELD",
                transcript_status="BLOCKED",
                reason=f"Automatic hold after UFM decision on {case.case_number}",
            )
            db.add(hold)
            write_audit_log(
                db,
                user_id=current_user.id,
                action="RESULT_HOLD_CREATED",
                entity_type="result_control",
                entity_id=case.id,
                description=f"Result/transcript hold applied for case {case.case_number}",
            )
            notify_users_with_role(
                db,
                role="EXAM_DEPARTMENT",
                case_id=case.id,
                type="RESULT_HOLD",
                title="Result hold applied",
                message=f"{case.case_number}: student result held / transcript blocked.",
            )

    db.commit()
    db.refresh(review)
    return review


@app.get("/ufm-cases/{case_id}/reviews", response_model=list[CaseReviewOut])
def list_case_reviews(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.get(UfmCase, case_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UFM case not found",
        )
    reviews = db.scalars(
        select(CaseReview)
        .where(CaseReview.case_id == case_id)
        .order_by(CaseReview.id)
    ).all()
    return reviews


@app.post(
    "/evidence",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_evidence(
    case_id: int = Form(...),
    evidence_type: str = Form(...),
    file: UploadFile = File(...),
    camera_id: int | None = Form(None),
    seat_location: str | None = Form(None),
    confidence: float | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("INVIGILATOR", "HOD")),
):
    if db.get(UfmCase, case_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="UFM case not found for case_id",
        )
    if camera_id is not None and db.get(Camera, camera_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Camera not found for camera_id",
        )

    original_name = Path(file.filename or "evidence.bin").name
    stored_name = f"{uuid.uuid4().hex}_{original_name}"
    destination = EVIDENCE_UPLOAD_DIR / stored_name

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    destination.write_bytes(content)

    # Store a portable relative path in the database
    relative_path = f"uploads/evidence/{stored_name}"

    evidence = Evidence(
        case_id=case_id,
        detection_id=None,
        evidence_type=evidence_type,
        file_path=relative_path,
        camera_id=camera_id,
        seat_location=seat_location,
        confidence=confidence,
        uploaded_by=current_user.id,
    )
    db.add(evidence)
    db.flush()
    write_audit_log(
        db,
        user_id=current_user.id,
        action="EVIDENCE_UPLOADED",
        entity_type="evidence",
        entity_id=evidence.id,
        description=f"Uploaded {evidence_type} for case_id={case_id}: {relative_path}",
    )
    db.commit()
    db.refresh(evidence)
    return evidence


@app.get("/evidence", response_model=list[EvidenceOut])
def list_evidence(
    case_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Evidence).order_by(Evidence.id)
    if case_id is not None:
        query = query.where(Evidence.case_id == case_id)
    return db.scalars(query).all()


@app.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HOD", "DEC", "EXAM_DEPARTMENT", "UFM_COMMITTEE")
    ),
):
    logs = db.scalars(select(AuditLog).order_by(AuditLog.id.desc())).all()
    return logs


@app.get("/detections", response_model=list[DetectionOut])
def list_detections(
    confirmed_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Detection).order_by(Detection.id.desc())
    if confirmed_only:
        query = query.where(Detection.is_confirmed.is_(True))
    return db.scalars(query).all()


@app.post(
    "/detections/{detection_id}/create-draft-case",
    response_model=UfmCaseOut,
    status_code=status.HTTP_201_CREATED,
)
def create_draft_case_from_detection_api(
    detection_id: int,
    body: DraftCaseFromDetection,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("INVIGILATOR", "HOD")),
):
    detection = db.get(Detection, detection_id)
    if detection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detection not found",
        )

    case = create_draft_case_from_detection(
        db,
        detection=detection,
        student_id=body.student_id,
        exam_id=body.exam_id,
        reported_by=current_user.id,
    )
    db.commit()
    db.refresh(case)
    return case


@app.get("/notifications", response_model=list[NotificationOut])
def list_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.id.desc())
    )
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    return db.scalars(query).all()


@app.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.get(Notification, notification_id)
    if note is None or note.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    note.is_read = True
    db.commit()
    db.refresh(note)
    return note


@app.post(
    "/result-controls",
    response_model=ResultControlOut,
    status_code=status.HTTP_201_CREATED,
)
def create_result_control(
    body: ResultControlCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "UFM_COMMITTEE")),
):
    if db.get(Student, body.student_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student not found for student_id",
        )
    case = db.get(UfmCase, body.case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="UFM case not found for case_id",
        )
    existing = db.scalar(
        select(ResultControl).where(ResultControl.case_id == body.case_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Result control already exists for this case",
        )

    control = ResultControl(
        student_id=body.student_id,
        case_id=body.case_id,
        result_status=body.result_status,
        transcript_status=body.transcript_status,
        reason=body.reason,
    )
    db.add(control)
    db.flush()
    write_audit_log(
        db,
        user_id=current_user.id,
        action="RESULT_HOLD_CREATED",
        entity_type="result_control",
        entity_id=control.id,
        description=f"Manual result control for case_id={body.case_id}",
    )
    db.commit()
    db.refresh(control)
    return control


@app.get("/result-controls", response_model=list[ResultControlOut])
def list_result_controls(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EXAM_DEPARTMENT", "UFM_COMMITTEE", "HOD", "DEC")
    ),
):
    return db.scalars(select(ResultControl).order_by(ResultControl.id.desc())).all()


@app.patch(
    "/result-controls/{control_id}/release",
    response_model=ResultControlOut,
)
def release_result_control(
    control_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("EXAM_DEPARTMENT", "UFM_COMMITTEE")),
):
    control = db.get(ResultControl, control_id)
    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result control not found",
        )
    if control.result_status == "RELEASED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Result control already released",
        )

    control.result_status = "RELEASED"
    control.transcript_status = "ALLOWED"
    control.released_at = datetime.utcnow()
    control.released_by = current_user.id

    write_audit_log(
        db,
        user_id=current_user.id,
        action="RESULT_RELEASED",
        entity_type="result_control",
        entity_id=control.id,
        description=f"Released result/transcript for case_id={control.case_id}",
    )
    create_notification(
        db,
        user_id=db.get(UfmCase, control.case_id).reported_by,
        case_id=control.case_id,
        type="RESULT_RELEASED",
        title="Result released",
        message=f"Result/transcript released for case_id={control.case_id}.",
    )
    db.commit()
    db.refresh(control)
    return control


@app.post(
    "/clarifications",
    response_model=ClarificationOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_clarification(
    body: ClarificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
):
    linked = resolve_linked_student(db, current_user)
    if linked is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No linked student profile. Seed demo student roll {DEMO_STUDENT_ROLL}."
            ),
        )

    case = db.get(UfmCase, body.case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UFM case not found",
        )
    if case.student_id != linked.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only clarify your own cases",
        )

    clarification = Clarification(
        case_id=case.id,
        student_user_id=current_user.id,
        statement=body.statement.strip(),
        status="SUBMITTED",
    )
    db.add(clarification)
    db.flush()
    write_audit_log(
        db,
        user_id=current_user.id,
        action="CLARIFICATION_SUBMITTED",
        entity_type="clarification",
        entity_id=clarification.id,
        description=f"Student clarification for {case.case_number}",
    )
    notify_users_with_role(
        db,
        role="HOD",
        case_id=case.id,
        type="CLARIFICATION",
        title="Student clarification received",
        message=f"{case.case_number}: student submitted an explanation.",
    )
    create_notification(
        db,
        user_id=case.reported_by,
        case_id=case.id,
        type="CLARIFICATION",
        title="Clarification submitted",
        message=f"Student responded on {case.case_number}.",
    )
    db.commit()
    db.refresh(clarification)
    return clarification


@app.get("/clarifications", response_model=list[ClarificationOut])
def list_clarifications(
    case_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Clarification).order_by(Clarification.id.desc())

    if current_user.role == "STUDENT":
        query = query.where(Clarification.student_user_id == current_user.id)
        if case_id is not None:
            query = query.where(Clarification.case_id == case_id)
    else:
        if case_id is not None:
            query = query.where(Clarification.case_id == case_id)
        elif current_user.role not in {
            "HOD",
            "DEC",
            "EXAM_DEPARTMENT",
            "UFM_COMMITTEE",
            "INVIGILATOR",
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to list clarifications",
            )

    return db.scalars(query).all()
