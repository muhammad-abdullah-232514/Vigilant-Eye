"""Committee penalty recommendations and Exam Department implementation codes."""

PENALTY_LABELS = {
    "F_GRADE": "F grade in the affected course",
    "FINE": "Penalty fine",
    "SEMESTER_RELEGATION": "Relegation for the entire semester",
    "SEMESTER_F_ALL_SUBJECTS": "F grade in all subjects of the semester",
    "EXPULSION": "Expulsion from the university",
}

PENALTY_CODES = frozenset(PENALTY_LABELS)
