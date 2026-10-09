"""
Simple UFM case status workflow for the submission build.

Chain:
PENDING
  → (staff open) → UNDER_REVIEW (optional)
  → (HOD FORWARD) → DEC_REVIEW
  → (DEC FORWARD) → EXAM_DEPARTMENT_REVIEW
  → (EXAM_DEPARTMENT FORWARD) → UFM_COMMITTEE_REVIEW
  → (UFM_COMMITTEE REJECT) → REJECTED
  → (UFM_COMMITTEE APPROVE) → EXAM_DEPARTMENT_IMPLEMENTATION
  → (EXAM_DEPARTMENT IMPLEMENT) → APPROVED

HOD and DEC may RETURN cases to PENDING while their own stage is active.
Exam Department may RETURN its review to DEC_REVIEW. Once forwarded, the
previous role cannot act on the case.
"""

from fastapi import HTTPException, status

# role -> action -> (allowed_current_statuses, new_status)
WORKFLOW: dict[str, dict[str, tuple[set[str], str]]] = {
    "HOD": {
        "FORWARD": ({"PENDING", "UNDER_REVIEW"}, "DEC_REVIEW"),
        "RETURN": ({"UNDER_REVIEW"}, "PENDING"),
    },
    "DEC": {
        "FORWARD": ({"DEC_REVIEW"}, "EXAM_DEPARTMENT_REVIEW"),
        "RETURN": ({"DEC_REVIEW"}, "PENDING"),
    },
    "EXAM_DEPARTMENT": {
        "FORWARD": ({"EXAM_DEPARTMENT_REVIEW"}, "UFM_COMMITTEE_REVIEW"),
        "RETURN": ({"EXAM_DEPARTMENT_REVIEW"}, "DEC_REVIEW"),
        "IMPLEMENT": (
            {"EXAM_DEPARTMENT_IMPLEMENTATION", "APPROVED"},
            "APPROVED",
        ),
    },
    "UFM_COMMITTEE": {
        "APPROVE": ({"UFM_COMMITTEE_REVIEW"}, "EXAM_DEPARTMENT_IMPLEMENTATION"),
        "REJECT": ({"UFM_COMMITTEE_REVIEW"}, "REJECTED"),
    },
}


def next_status(*, role: str, action: str, current_status: str) -> str:
    role_rules = WORKFLOW.get(role)
    if role_rules is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' cannot review cases",
        )

    action_key = action.strip().upper()
    rule = role_rules.get(action_key)
    if rule is None:
        allowed = ", ".join(sorted(role_rules.keys()))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{action}' not allowed for role '{role}'. Allowed: {allowed}",
        )

    allowed_statuses, new_status = rule
    if current_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot '{action_key}' from status '{current_status}'. "
                f"Allowed current statuses: {', '.join(sorted(allowed_statuses))}"
            ),
        )
    return new_status
