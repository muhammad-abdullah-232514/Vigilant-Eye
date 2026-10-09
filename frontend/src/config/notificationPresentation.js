/**
 * Presentation helpers for notification records returned by GET /notifications.
 * Categories are derived only from known backend `type` values — never from message text.
 */

import {
  DETECTION_ROLES,
  RESULT_CONTROL_ROLES,
  roleIn,
} from "./roleAccess";
import { formatViolationLabel } from "./casePresentation";

export function formatNotificationType(type) {
  return String(type || "NOTICE").replaceAll("_", " ");
}

export function formatNotificationMessage(note) {
  const message = String(note?.message || "");
  if (note?.type === "CASE_STATUS") {
    return message.replace(/\s+\(was [^)]+\)\.?$/i, "");
  }
  if (
    note?.type === "DETECTION_ALERT" ||
    note?.type === "DETECTION_ALERT_DEMO"
  ) {
    const match = message.match(
      /^(Confirmed AI event|AI review candidate)\s+'([^']+)'\s+\(detection confidence=([\d.]+)\)/i
    );
    if (match) {
      const [, decision, rawType, rawConfidence] = match;
      const category = formatViolationLabel(rawType).toLowerCase();
      const confidence = Number(rawConfidence);
      const confidenceLabel = Number.isFinite(confidence)
        ? ` with ${Math.round(confidence * 100)}% confidence`
        : "";
      return `${decision.toLowerCase() === "confirmed ai event" ? "Detected" : "Possible"} ${category}${confidenceLabel}.`;
    }
    return message
      .replace(/\s+model=[^\s]+/gi, "")
      .replace(/\s+detection_id=\d+/gi, "")
      .trim();
  }
  return message;
}

export function detectionIdForNotification(note) {
  if (
    note?.type !== "DETECTION_ALERT" &&
    note?.type !== "DETECTION_ALERT_DEMO"
  ) {
    return null;
  }
  const match = String(note.message || "").match(/\bdetection_id=(\d+)\b/i);
  return match ? match[1] : null;
}

/** User-facing category from known API type values only. */
export function categoryForNotificationType(type) {
  switch (type) {
    case "CASE_ACTION_REQUIRED":
      return "Action Required";
    case "CASE_CREATED":
    case "CASE_STATUS":
    case "CLARIFICATION":
      return "Case Update";
    case "RESULT_HOLD":
    case "RESULT_RELEASED":
      return "Result Control";
    case "DETECTION_ALERT":
      return "Detection Alert";
    default:
      return "Information";
  }
}

/**
 * Navigation target for a notification, role-aware so users are not
 * sent to pages their C11-B role cannot open.
 */
export function destinationForNotification(note, role) {
  if (!note) return null;
  if (note.case_id) return `/app/cases/${note.case_id}`;

  if (role === "STUDENT") return null;
  if (role === "ADMINISTRATOR") return "/app/notifications";

  if (
    note.type === "DETECTION_ALERT" ||
    note.type === "DETECTION_ALERT_DEMO"
  ) {
    if (!roleIn(role, DETECTION_ROLES)) return null;
    const detectionId = detectionIdForNotification(note);
    return detectionId
      ? `/app/detections?detection_id=${encodeURIComponent(detectionId)}`
      : "/app/detections";
  }
  if (note.type === "RESULT_HOLD" || note.type === "RESULT_RELEASED") {
    return roleIn(role, RESULT_CONTROL_ROLES) ? "/app/result-controls" : null;
  }
  return null;
}

export function actionLabelForNotification(note, role) {
  const dest = destinationForNotification(note, role);
  if (!dest) return null;
  if (note.case_id) return "Open case";
  if (
    note.type === "DETECTION_ALERT" ||
    note.type === "DETECTION_ALERT_DEMO"
  ) {
    return detectionIdForNotification(note) ? "Open detection" : "Open detections";
  }
  if (note.type === "RESULT_HOLD" || note.type === "RESULT_RELEASED") {
    return "Open Result Holds";
  }
  return "Open";
}
