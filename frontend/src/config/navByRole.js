/** Role-based sidebar menus inspired by docs/mockups. */

export const ROLE_LABELS = {
  STUDENT: "Student",
  INVIGILATOR: "Invigilator",
  HOD: "HOD",
  DEC: "DEC",
  EXAM_DEPARTMENT: "Exam Department",
  UFM_COMMITTEE: "UFM Committee",
};

export const SWITCHABLE_ROLES = [
  "INVIGILATOR",
  "HOD",
  "DEC",
  "EXAM_DEPARTMENT",
  "UFM_COMMITTEE",
];

const commonStaff = [
  { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
  { to: "/app/evidence", label: "Evidence Library" },
  { to: "/app/students", label: "Students" },
  { to: "/app/reports", label: "Reports" },
  { to: "/app/audit", label: "Audit Trail" },
];

export const NAV_BY_ROLE = {
  INVIGILATOR: [
    { to: "/app/dashboard", label: "Dashboard" },
    { to: "/app/monitoring", label: "Live Monitoring" },
    { to: "/app/detections", label: "Detections & Alerts", badgeKey: "detections" },
    { to: "/app/cases", label: "My Cases" },
    { to: "/app/cases/new", label: "Create Case" },
    ...commonStaff,
  ],
  HOD: [
    { to: "/app/dashboard", label: "Dashboard" },
    {
      to: "/app/cases?status=PENDING",
      label: "Cases for Review",
      badgeKey: "pending",
    },
    {
      to: "/app/cases?status=DEC_REVIEW",
      label: "Forwarded to DEC",
    },
    { to: "/app/cases", label: "All Department Cases" },
    ...commonStaff.filter((i) => i.label !== "Students"),
    { to: "/app/students", label: "Students Involved" },
    { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
    { to: "/app/audit", label: "Audit Trail" },
    { to: "/app/reports", label: "Reports" },
  ],
  DEC: [
    { to: "/app/dashboard", label: "Dashboard" },
    {
      to: "/app/cases?status=DEC_REVIEW",
      label: "Cases Received from HOD",
      badgeKey: "pending",
    },
    {
      to: "/app/cases?status=DEC_REVIEW",
      label: "My Investigations",
    },
    {
      to: "/app/cases?status=EXAM_DEPARTMENT_REVIEW",
      label: "Forwarded to Exam Dept.",
    },
    { to: "/app/cases", label: "All Department Cases" },
    { to: "/app/evidence", label: "Evidence Library" },
    { to: "/app/students", label: "Students Involved" },
    { to: "/app/reports", label: "Reports" },
    { to: "/app/audit", label: "Audit Trail" },
    { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
  ],
  EXAM_DEPARTMENT: [
    { to: "/app/dashboard", label: "Dashboard" },
    {
      to: "/app/cases?status=EXAM_DEPARTMENT_REVIEW",
      label: "Cases from Departments",
      badgeKey: "pending",
    },
    { to: "/app/result-controls", label: "Result Control" },
    {
      to: "/app/cases?status=UFM_COMMITTEE_REVIEW",
      label: "Forward to Committee",
    },
    { to: "/app/cases", label: "All Cases" },
    { to: "/app/audit", label: "Audit Trail" },
    { to: "/app/reports", label: "Reports" },
    { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
    { to: "/app/students", label: "Students" },
  ],
  UFM_COMMITTEE: [
    { to: "/app/dashboard", label: "Dashboard" },
    {
      to: "/app/cases?status=UFM_COMMITTEE_REVIEW",
      label: "Cases for Final Review",
      badgeKey: "pending",
    },
    {
      to: "/app/cases?status=APPROVED",
      label: "Committee Decisions",
    },
    { to: "/app/cases", label: "All Committee Cases" },
    { to: "/app/result-controls", label: "Result Holds" },
    { to: "/app/students", label: "Students Involved" },
    { to: "/app/evidence", label: "Evidence Library" },
    { to: "/app/audit", label: "Audit Trail" },
    { to: "/app/reports", label: "Reports" },
    { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
  ],
  STUDENT: [
    { to: "/app/dashboard", label: "Dashboard" },
    { to: "/app/cases", label: "UFM Cases", badgeKey: "pending" },
    { to: "/app/clarification", label: "Submit Clarification" },
    { to: "/app/notifications", label: "Notifications", badgeKey: "notifications" },
    { to: "/app/help", label: "Help & Support" },
  ],
};

export function getNavForRole(role) {
  return NAV_BY_ROLE[role] || NAV_BY_ROLE.INVIGILATOR;
}

export function dashboardTitle(role) {
  const label = ROLE_LABELS[role] || role;
  return `${label} Dashboard`;
}
