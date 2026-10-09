/** Presentation helpers for UFM cases — labels only; no API/status changes. */

import { ROLE_LABELS } from "./navByRole";

/**
 * Format a case creation timestamp from the API.
 * Backend stores naive UTC; treat values without an offset as UTC so the
 * displayed local time matches the real creation moment.
 */
export function formatCaseCreatedAt(iso) {
  if (!iso) return "";
  const raw = String(iso).trim();
  if (!raw) return "";
  const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasOffset ? raw : `${raw}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export const STATUS_LABELS = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  DEC_REVIEW: "DEC Review",
  EXAM_DEPARTMENT_REVIEW: "Exam Department Review",
  EXAM_DEPARTMENT_IMPLEMENTATION: "Exam Department Implementation",
  UFM_COMMITTEE_REVIEW: "UFM Committee Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  HELD: "On Hold",
  RELEASED: "Released",
  BLOCKED: "Blocked",
  ALLOWED: "Allowed",
  SUBMITTED: "Submitted",
  CLOSED: "Closed",
};

/** Result-control specific labels (distinct from UFM case status). */
export const RESULT_STATUS_LABELS = {
  HELD: "On Hold",
  RELEASED: "Released",
};

export const REVIEW_ACTION_LABELS = {
  FORWARD: "Forward",
  RETURN: "Return",
  APPROVE: "Approve",
  REJECT: "Reject",
  IMPLEMENT: "Record Implementation",
};

/** Role currently expected to act, based on case status (presentation only). */
export const RESPONSIBLE_BY_STATUS = {
  PENDING: "HOD",
  UNDER_REVIEW: "HOD",
  DEC_REVIEW: "DEC",
  EXAM_DEPARTMENT_REVIEW: "EXAM_DEPARTMENT",
  EXAM_DEPARTMENT_IMPLEMENTATION: "EXAM_DEPARTMENT",
  UFM_COMMITTEE_REVIEW: "UFM_COMMITTEE",
};

export function formatStatusLabel(status) {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] || String(status).replaceAll("_", " ");
}

export function formatResultStatusLabel(status) {
  if (!status) return "Unknown";
  return RESULT_STATUS_LABELS[status] || formatStatusLabel(status);
}

export function formatReviewActionLabel(action) {
  if (!action) return "Action";
  return REVIEW_ACTION_LABELS[action] || String(action).replaceAll("_", " ");
}

export function formatViolationLabel(type) {
  if (!type) return "—";
  return String(type).replaceAll("_", " ");
}

export function violationTone(type = "") {
  const value = String(type).toLowerCase();
  if (value.includes("phone")) return "rose";
  if (value.includes("watch")) return "amber";
  if (value.includes("note") || value.includes("paper")) return "violet";
  if (value.includes("gadget")) return "emerald";
  return "blue";
}

export function violationLabelClass(type) {
  return `violation-label violation-label-${violationTone(type)}`;
}

export function formatRoleLabel(role) {
  if (!role) return "—";
  return ROLE_LABELS[role] || String(role).replaceAll("_", " ");
}

export function responsibleLabelForStatus(status) {
  const role = RESPONSIBLE_BY_STATUS[status];
  if (!role) {
    if (status === "APPROVED" || status === "REJECTED") return "Decision recorded";
    return null;
  }
  return formatRoleLabel(role);
}

export function fileNameFromPath(path) {
  if (!path) return null;
  const parts = String(path).replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

/** Human-readable evidence type (API values unchanged). */
export function formatEvidenceTypeLabel(type) {
  return formatViolationLabel(type);
}

/**
 * Source label from real evidence fields only.
 * Does not invent provenance beyond detection / camera / manual upload.
 */
export function evidenceSourceLabel(evidence) {
  if (!evidence) return "—";
  if (evidence.detection_id != null) {
    const conf =
      evidence.confidence != null
        ? ` · ${(Number(evidence.confidence) * 100).toFixed(0)}% confidence (system)`
        : "";
    return `AI detection #${evidence.detection_id}${conf}`;
  }
  if (evidence.camera_id != null) return `Camera ${evidence.camera_id}`;
  return "Manual upload";
}

export function evidenceHasAiSignal(evidence) {
  return (
    evidence &&
    (evidence.detection_id != null || evidence.confidence != null)
  );
}

/** Reviewer display: prefer typed sign-off name; never invent a display name. */
export function reviewActorLabel(review) {
  if (!review) return "—";
  if (review.signer_name) return review.signer_name;
  if (review.reviewer_id != null) return `User #${review.reviewer_id}`;
  return "—";
}

export function formatAuditActionLabel(action) {
  if (!action) return "—";
  const labels = {
    CASE_REVIEW_FORWARD: "Case Forwarded",
    CASE_REVIEW_APPROVE: "Committee Approved",
    CASE_REVIEW_REJECT: "Committee Rejected",
    CASE_REVIEW_RETURN: "Case Returned",
    CASE_REVIEW_IMPLEMENT: "Implementation Recorded",
    CASE_OPENED: "Case Opened for Review",
    CASE_CREATED: "Case Filed",
    CASE_SIGNED: "Case Sign-off Recorded",
    CASE_DRAFT_FROM_DETECTION: "Draft Case Created from Detection",
    MONITORING_START: "Monitoring Started",
    MONITORING_STOP: "Monitoring Stopped",
    RESULT_HOLD_CREATED: "Result Hold Applied",
    RESULT_RELEASED: "Result Hold Released",
    UFM_FINE_PAYMENT_RECORDED: "Fine Payment Recorded",
    EVIDENCE_UPLOADED: "Evidence Uploaded",
    EVIDENCE_LINKED: "Evidence Linked to Case",
    CLARIFICATION_SUBMITTED: "Student Clarification Submitted",
    ROOM_CREATED: "Exam Room Created",
    CAMERA_CREATED: "Camera Registered",
    EXAM_CREATED: "Exam Created",
    EXAM_UPDATED: "Exam Updated",
    EXAM_ENROLLMENT_CREATED: "Student Enrolled in Exam",
    EXAM_ENROLLMENT_REMOVED: "Exam Enrollment Removed",
    EXAM_INVIGILATOR_ASSIGNED: "Invigilator Assigned",
    EXAM_INVIGILATOR_UNASSIGNED: "Invigilator Assignment Removed",
    STUDENT_REGISTERED_FOR_FILING: "Student Registered for Case Filing",
    EXAM_CREATED_FOR_FILING: "Exam Record Created for Case Filing",
    USER_CREATED: "User Account Created",
    USER_BULK_IMPORTED: "User Accounts Imported",
    USER_ROLE_CHANGED: "User Role Updated",
    USER_STUDENT_LINKED: "Student Account Linked",
    USER_STUDENT_UNLINKED: "Student Account Unlinked",
    USER_REACTIVATED: "User Account Reactivated",
    USER_DEACTIVATED: "User Account Deactivated",
    ADMIN_EMAIL_TEST: "Notification Email Test",
  };
  const normalized = String(action).toUpperCase();
  return (
    labels[normalized] ||
    normalized
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  );
}

export function formatEntityTypeLabel(entityType) {
  if (!entityType) return "—";
  const map = {
    ufm_case: "UFM Case",
    result_control: "Result Hold",
    evidence: "Evidence",
    clarification: "Clarification",
    detection: "Detection",
    user: "User",
  };
  return map[entityType] || String(entityType).replaceAll("_", " ");
}

/** Numeric actor ids only — do not invent names. */
export function formatUserIdLabel(userId) {
  if (userId == null || userId === "") return "—";
  return `User #${userId}`;
}

/**
 * Build a chronological timeline from real case / review / evidence / clarification data.
 * Does not invent stages that have no backing records.
 */
export function buildCaseTimeline({
  caseData,
  reviews = [],
  evidence = [],
  clarifications = [],
  includeEvidence = true,
  includeClarifications = true,
  includeReviews = true,
  includeCreateSignOff = true,
  includeReporterDetail = true,
  includeResponsibleDetail = true,
}) {
  if (!caseData) return [];
  const events = [];

  events.push({
    id: `created-${caseData.id}`,
    at: caseData.created_at,
    title: "Case created",
    detail: includeReporterDetail ? caseData.reporter_name || null : null,
  });

  if (
    includeCreateSignOff &&
    (caseData.signed_at || caseData.signer_name)
  ) {
    events.push({
      id: `create-signoff-${caseData.id}`,
      at: caseData.signed_at || caseData.created_at,
      title: "Create sign-off recorded",
      detail: caseData.signer_name || null,
    });
  }

  if (includeEvidence) {
    for (const e of evidence) {
      events.push({
        id: `evidence-${e.id}`,
        at: e.created_at || e.timestamp,
        title: "Evidence attached",
        detail: [
          e.evidence_type ? formatEvidenceTypeLabel(e.evidence_type) : null,
          e.detection_id != null ? `Linked detection #${e.detection_id}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  if (includeClarifications) {
    for (const c of clarifications) {
      events.push({
        id: `clarification-${c.id}`,
        at: c.created_at,
        title: "Student clarification submitted",
        detail: c.status ? formatStatusLabel(c.status) : null,
      });
    }
  }

  if (includeReviews) {
    for (const r of reviews) {
      events.push({
        id: `review-${r.id}`,
        at: r.created_at || r.signed_at,
        title: `${formatReviewActionLabel(r.action)} · ${formatRoleLabel(r.reviewer_role)}`,
        detail: [
          r.remarks || null,
          r.signer_name ? `Signed: ${r.signer_name}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  events.push({
    id: `status-${caseData.id}-${caseData.status}`,
    at: caseData.updated_at || caseData.created_at,
    title: `Current status: ${formatStatusLabel(caseData.status)}`,
    detail: includeResponsibleDetail
      ? responsibleLabelForStatus(caseData.status)
      : null,
    current: true,
  });

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}
