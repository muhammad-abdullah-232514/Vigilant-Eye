"""
Create demo users for every VigilantEye role (safe to re-run).

Usage (from backend folder, venv active):
    python seed_demo_users.py

Default password for all demo users: Demo@123

Also ensures a linked student row (roll DEMO001) for student@demo.com portal demos.
"""

from sqlalchemy import select

from database import SessionLocal
from models.student import Student
from models.user import User
from security import hash_password
from student_portal import DEMO_STUDENT_ROLL

DEMO_PASSWORD = "Demo@123"

DEMO_USERS = [
    ("Demo Student", "student@demo.com", "STUDENT"),
    ("Demo Invigilator", "invigilator@demo.com", "INVIGILATOR"),
    ("Demo HOD", "hod@demo.com", "HOD"),
    ("Demo DEC", "dec@demo.com", "DEC"),
    ("Demo Exam Department", "examdept@demo.com", "EXAM_DEPARTMENT"),
    ("Demo UFM Committee", "ufm@demo.com", "UFM_COMMITTEE"),
]


def seed() -> None:
    db = SessionLocal()
    try:
        created = 0
        skipped = 0
        for name, email, role in DEMO_USERS:
            existing = db.scalar(select(User).where(User.email == email))
            if existing:
                print(f"SKIP  {email} (already exists, role={existing.role})")
                skipped += 1
                continue

            db.add(
                User(
                    name=name,
                    email=email,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=role,
                    is_active=True,
                )
            )
            print(f"CREATE {email}  role={role}")
            created += 1

        linked = db.scalar(
            select(Student).where(Student.student_id == DEMO_STUDENT_ROLL)
        )
        if linked:
            print(
                f"SKIP  student roll {DEMO_STUDENT_ROLL} "
                f"(already exists, id={linked.id})"
            )
        else:
            linked = Student(
                student_id=DEMO_STUDENT_ROLL,
                name="Demo Student",
                department="Computer Science",
                program="BSCS",
            )
            db.add(linked)
            print(
                f"CREATE student roll {DEMO_STUDENT_ROLL} "
                "(linked to student@demo.com portal)"
            )

        db.commit()
        print()
        print(f"Done. created={created}, skipped={skipped}")
        print(f"Password for all demo accounts: {DEMO_PASSWORD}")
        print(
            f"Student portal cases must use student_id FK for roll {DEMO_STUDENT_ROLL}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
