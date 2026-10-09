"""C17 — Workflow presentation mirrors backend; Return/Forward destinations."""

from __future__ import annotations

from pathlib import Path

from workflow import WORKFLOW, next_status


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"


def test_frontend_workflow_rules_match_backend():
    """Static mirror in workflowPresentation.js must match workflow.py."""
    text = (FRONTEND / "config" / "workflowPresentation.js").read_text(
        encoding="utf-8"
    )
    for role, actions in WORKFLOW.items():
        assert role in text
        for action, (statuses, new_status) in actions.items():
            assert action in text
            assert new_status in text
            for st in statuses:
                assert st in text


def test_return_routes_to_the_intended_review_stage():
    import pytest
    from fastapi import HTTPException

    assert next_status(role="HOD", action="RETURN", current_status="UNDER_REVIEW") == "PENDING"
    assert next_status(role="DEC", action="RETURN", current_status="DEC_REVIEW") == "PENDING"
    assert next_status(
        role="EXAM_DEPARTMENT",
        action="RETURN",
        current_status="EXAM_DEPARTMENT_REVIEW",
    ) == "DEC_REVIEW"

    for role, status in (
        ("HOD", "DEC_REVIEW"),
        ("DEC", "EXAM_DEPARTMENT_REVIEW"),
        ("EXAM_DEPARTMENT", "UFM_COMMITTEE_REVIEW"),
    ):
        with pytest.raises(HTTPException) as exc:
            next_status(role=role, action="RETURN", current_status=status)
        assert exc.value.status_code == 400


def test_forward_destinations():
    assert next_status(role="HOD", action="FORWARD", current_status="PENDING") == "DEC_REVIEW"
    assert (
        next_status(role="DEC", action="FORWARD", current_status="DEC_REVIEW")
        == "EXAM_DEPARTMENT_REVIEW"
    )
    assert (
        next_status(
            role="EXAM_DEPARTMENT",
            action="FORWARD",
            current_status="EXAM_DEPARTMENT_REVIEW",
        )
        == "UFM_COMMITTEE_REVIEW"
    )


def test_final_decisions():
    assert (
        next_status(
            role="UFM_COMMITTEE",
            action="APPROVE",
            current_status="UFM_COMMITTEE_REVIEW",
        )
        == "EXAM_DEPARTMENT_IMPLEMENTATION"
    )
    assert (
        next_status(
            role="EXAM_DEPARTMENT",
            action="IMPLEMENT",
            current_status="EXAM_DEPARTMENT_IMPLEMENTATION",
        )
        == "APPROVED"
    )
    assert (
        next_status(
            role="UFM_COMMITTEE",
            action="REJECT",
            current_status="UFM_COMMITTEE_REVIEW",
        )
        == "REJECTED"
    )


def test_case_detail_keeps_actions_on_shared_form_without_duplicate_panel():
    detail = (FRONTEND / "pages" / "CaseDetailPage.jsx").read_text(encoding="utf-8")
    review_form = (FRONTEND / "components" / "CaseReviewForm.jsx").read_text(
        encoding="utf-8"
    )
    assert "What happens next?" not in detail
    assert "resolveReviewOutcome" in detail
    assert "workflowPresentation" in detail
    assert "After this action" in detail
    assert "Result control:" not in detail
    assert "actionOutcomes.map" in review_form
    assert "RETURN" in review_form
    # Must not invent previous-reviewer-only return
    assert "previous reviewer" not in detail.lower()


def test_frontend_hides_return_after_role_forwards_case():
    wp = (FRONTEND / "config" / "workflowPresentation.js").read_text(
        encoding="utf-8"
    )
    assert 'from: ["DEC_REVIEW"],\n      to: "PENDING"' in wp
    assert 'from: ["EXAM_DEPARTMENT_REVIEW"],\n      to: "DEC_REVIEW"' in wp


def test_workflow_presentation_explains_return_and_approve():
    wp = (FRONTEND / "config" / "workflowPresentation.js").read_text(
        encoding="utf-8"
    )
    assert "preceding review stage" in wp
    assert "Back to DEC" in wp
    assert "result hold" in wp.lower() or "On Hold" in wp
    assert "RETURN" in wp
    assert "APPROVE" in wp
    assert "does not create or release" in wp.lower() or "Does not create" in wp
