/** Allowed review buttons by role + current case status (mirrors backend workflow). */

const RULES = {
  HOD: {
    FORWARD: ["PENDING", "UNDER_REVIEW"],
    RETURN: ["DEC_REVIEW", "UNDER_REVIEW", "HOD_VERIFICATION"],
  },
  DEC: {
    FORWARD: ["DEC_REVIEW"],
    RETURN: ["DEC_REVIEW", "EXAM_DEPARTMENT_REVIEW"],
  },
  EXAM_DEPARTMENT: {
    FORWARD: ["EXAM_DEPARTMENT_REVIEW"],
    RETURN: ["EXAM_DEPARTMENT_REVIEW", "UFM_COMMITTEE_REVIEW"],
  },
  UFM_COMMITTEE: {
    APPROVE: ["UFM_COMMITTEE_REVIEW"],
    REJECT: ["UFM_COMMITTEE_REVIEW"],
  },
};

export function availableReviewActions(role, status) {
  const roleRules = RULES[role];
  if (!roleRules) return [];
  return Object.entries(roleRules)
    .filter(([, statuses]) => statuses.includes(status))
    .map(([action]) => action);
}
