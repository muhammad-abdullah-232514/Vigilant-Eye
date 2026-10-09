"""Seed the repository's authorized Google accounts on a fresh database."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from admin_users_service import (
    LEGACY_DEMO_USER_EMAILS,
    create_authorized_user,
)
from google_auth import normalize_email
from models.user import User
from portal_roles import PORTAL_ROLES

ROSTER_PATH = Path(__file__).with_name("authorized_users.json")


def disable_legacy_demo_accounts(db: Session) -> int:
    """Disable old demo accounts without deleting historical references."""
    users = db.scalars(
        select(User).where(func.lower(User.email).in_(LEGACY_DEMO_USER_EMAILS))
    ).all()
    disabled = 0
    for user in users:
        if user.is_active:
            user.is_active = False
            disabled += 1
    return disabled


def load_authorized_users(path: Path = ROSTER_PATH) -> list[dict[str, str]]:
    """Load and validate the tracked authorized-account roster."""
    try:
        data: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not load authorized-user roster: {path}") from exc

    if not isinstance(data, list):
        raise ValueError("Authorized-user roster must be a JSON list")

    users: list[dict[str, str]] = []
    seen_emails: set[str] = set()
    seen_student_rolls: set[str] = set()
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Authorized-user entry {index} must be an object")
        raw_email = item.get("email")
        raw_role = item.get("role")
        raw_name = item.get("name")
        raw_student_roll = item.get("student_roll", "")
        raw_department = item.get("department", "")
        raw_program = item.get("program", "")
        if not all(
            isinstance(value, str)
            for value in (
                raw_email,
                raw_role,
                raw_name,
                raw_student_roll,
                raw_department,
                raw_program,
            )
        ):
            raise ValueError(f"Authorized-user entry {index} has invalid field types")
        email = normalize_email(raw_email)
        role = raw_role.strip().upper()
        name = raw_name.strip()
        student_roll = raw_student_roll.strip()
        department = raw_department.strip()
        program = raw_program.strip()

        if not email or "@" not in email:
            raise ValueError(f"Authorized-user entry {index} has an invalid email")
        if email in seen_emails:
            raise ValueError(f"Duplicate authorized email: {email}")
        if role not in PORTAL_ROLES:
            raise ValueError(f"Authorized-user entry {index} has invalid role: {role}")
        if not name:
            raise ValueError(f"Authorized-user entry {index} is missing a name")
        if role == "STUDENT" and not student_roll:
            raise ValueError(
                f"Authorized student entry {index} requires student_roll"
            )
        if role != "STUDENT" and student_roll:
            raise ValueError(
                f"Authorized-user entry {index} may only set student_roll for STUDENT"
            )
        if role != "STUDENT" and (department or program):
            raise ValueError(
                f"Authorized-user entry {index} may only set department/program for STUDENT"
            )
        if student_roll in seen_student_rolls:
            raise ValueError(f"Duplicate authorized student roll: {student_roll}")

        seen_emails.add(email)
        if student_roll:
            seen_student_rolls.add(student_roll)
        users.append(
            {
                "name": name,
                "email": email,
                "role": role,
                "student_roll": student_roll,
                "department": department,
                "program": program,
            }
        )
    return users


def seed_authorized_users(
    db: Session, users: list[dict[str, str]]
) -> tuple[int, int]:
    """Create missing allowlisted accounts without changing existing access."""
    created = 0
    skipped = 0
    for entry in users:
        email = entry["email"]
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            print(
                f"Authorized user: SKIP {email} "
                f"(already exists, role={existing.role}, active={existing.is_active})"
            )
            skipped += 1
            continue

        create_authorized_user(
            db,
            email=email,
            role=entry["role"],
            name=entry["name"],
            student_roll=entry.get("student_roll") or None,
            actor_id=None,
            department=entry.get("department") or None,
            program=entry.get("program") or None,
        )
        print(f"Authorized user: CREATE {email} role={entry['role']}")
        created += 1
    return created, skipped
