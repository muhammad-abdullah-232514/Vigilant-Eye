import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from admin_users_service import build_user_query, user_stats
from models.base import Base
from models.student import Student
from models.user import User
from seed_authorized_users import (
    disable_legacy_demo_accounts,
    load_authorized_users,
    seed_authorized_users,
)
from security import hash_password


@pytest.fixture()
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False)
    db = testing_session()
    yield db
    db.close()
    engine.dispose()


def test_roster_contains_the_configured_authorized_accounts():
    users = load_authorized_users()

    assert len(users) == 7
    assert len({entry["email"] for entry in users}) == len(users)
    assert {
        entry["email"]: entry["role"] for entry in users
    }["232514@students.au.edu.pk"] == "STUDENT"


def test_seed_creates_authorized_users_and_student_link(session):
    roster = [
        {
            "name": "Authorized Student",
            "email": "student@example.com",
            "role": "STUDENT",
            "student_roll": "610100",
        },
        {
            "name": "Authorized HOD",
            "email": "hod@example.com",
            "role": "HOD",
            "student_roll": "",
        },
    ]

    assert seed_authorized_users(session, roster) == (2, 0)
    student_user = session.scalar(
        select(User).where(User.email == "student@example.com")
    )
    linked_student = session.scalar(
        select(Student).where(Student.student_id == "610100")
    )
    assert student_user.role == "STUDENT"
    assert student_user.is_active is True
    assert linked_student.user_id == student_user.id


def test_seed_does_not_overwrite_existing_account_state(session):
    existing = User(
        name="Existing HOD",
        email="hod@example.com",
        password_hash=hash_password("UnusedPassword1!"),
        role="HOD",
        is_active=False,
    )
    session.add(existing)
    session.commit()

    created, skipped = seed_authorized_users(
        session,
        [
            {
                "name": "Authorized HOD",
                "email": "hod@example.com",
                "role": "HOD",
                "student_roll": "",
            }
        ],
    )

    assert (created, skipped) == (0, 1)
    assert existing.role == "HOD"
    assert existing.is_active is False


def test_legacy_demo_accounts_are_hidden_from_user_directory(session):
    for email, role in (
        ("admin@example.com", "ADMINISTRATOR"),
        ("student@demo.com", "STUDENT"),
    ):
        session.add(
            User(
                name=email,
                email=email,
                password_hash=hash_password("UnusedPassword1!"),
                role=role,
                is_active=False,
            )
        )
    session.commit()

    users = session.scalars(
        build_user_query(
            session,
            q=None,
            role=None,
            is_active=None,
            staff_or_student=None,
            linked=None,
        )
    ).all()

    assert [user.email for user in users] == ["admin@example.com"]
    stats = user_stats(session)
    assert stats["total"] == 1
    assert stats["inactive"] == 1
    assert stats["by_role"]["STUDENT"] == 0


def test_bootstrap_disables_legacy_demo_accounts(session):
    demo_user = User(
        name="Legacy Demo",
        email="student@demo.com",
        password_hash=hash_password("UnusedPassword1!"),
        role="STUDENT",
        is_active=True,
    )
    session.add(demo_user)
    session.commit()

    assert disable_legacy_demo_accounts(session) == 1
    assert demo_user.is_active is False
