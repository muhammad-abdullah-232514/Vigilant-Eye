import { getAuthToken } from "../utils/authStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken() {
  return getAuthToken();
}

export async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const rawDetail =
      (data && data.detail) ||
      (typeof data === "string" ? data : null) ||
      null;
    let detail = null;
    if (typeof rawDetail === "string") {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      // FastAPI / Pydantic validation errors
      detail = rawDetail
        .map((item) => {
          if (!item || typeof item !== "object") return String(item);
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((p) => p !== "body").join(".")
            : "";
          const msg = item.msg || item.message || "Invalid value";
          return loc ? `${loc}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join("; ");
    } else if (rawDetail && typeof rawDetail === "object" && rawDetail.msg) {
      detail = String(rawDetail.msg);
    } else if (rawDetail != null) {
      detail = JSON.stringify(rawDetail);
    }

    // Prefer clear, non-technical messages for common HTTP statuses.
    if (response.status === 401) {
      detail =
        detail ||
        "Your session has expired or is invalid. Please sign in again.";
    } else if (response.status === 403) {
      detail =
        detail ||
        "You do not have permission to perform this action.";
    } else if (response.status === 404) {
      detail = detail || "The requested resource was not found.";
    } else if (response.status === 409) {
      detail = detail || "This action conflicts with the current state.";
    } else if (response.status === 422) {
      detail = detail || "Please check the form fields and try again.";
    } else if (response.status === 429) {
      detail = detail || "Too many requests. Please wait and try again.";
    } else if (response.status >= 500) {
      detail =
        "The server encountered an error. Please try again shortly.";
    } else if (!detail) {
      detail = `Request failed (${response.status})`;
    }

    const error = new Error(detail);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function loginRequest(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function googleLoginRequest(idToken) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function fetchAuthConfig() {
  return apiRequest("/auth/config");
}

export async function fetchCurrentUser() {
  return apiRequest("/auth/me");
}

export async function fetchNotifications(unreadOnly = false) {
  const query = unreadOnly ? "?unread_only=true" : "";
  return apiRequest(`/notifications${query}`);
}

export async function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/mark-all-read", { method: "POST" });
}

export async function fetchCases({ scope, status } = {}) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (status) params.set("status", status);
  const qs = params.toString();
  return apiRequest(`/ufm-cases${qs ? `?${qs}` : ""}`);
}

export async function fetchDetections(confirmedOnly = false, unseenOnly = false) {
  const params = new URLSearchParams();
  if (confirmedOnly) params.set("confirmed_only", "true");
  if (unseenOnly) params.set("unseen_only", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/detections${query}`);
}

export async function markDetectionSeen(detectionId) {
  return apiRequest(`/detections/${detectionId}/seen`, { method: "PATCH" });
}

export async function markAllDetectionsSeen() {
  return apiRequest("/detections/mark-all-seen?confirmed_only=true", {
    method: "POST",
  });
}

export async function fetchCameras() {
  return apiRequest("/cameras");
}

export async function fetchStudents(searchQuery = null) {
  const params = new URLSearchParams();
  if (searchQuery != null && String(searchQuery).trim()) {
    params.set("q", String(searchQuery).trim());
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/students${qs}`);
}

export async function fetchExams(searchQuery = null) {
  const params = new URLSearchParams();
  if (searchQuery != null && String(searchQuery).trim()) {
    params.set("q", String(searchQuery).trim());
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/exams${qs}`);
}

export async function fetchEvidenceLibrary(searchQuery = null) {
  const params = new URLSearchParams({ unlinked_only: "true" });
  if (searchQuery != null && String(searchQuery).trim()) {
    params.set("q", String(searchQuery).trim());
  }
  return apiRequest(`/evidence?${params.toString()}`);
}

export async function fetchCase(caseId) {
  return apiRequest(`/ufm-cases/${caseId}`);
}

export async function createCase(payload) {
  const body = { ...payload };
  if (Array.isArray(body.evidence_ids) && body.evidence_ids.length === 0) {
    delete body.evidence_ids;
  }
  return apiRequest("/ufm-cases", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCaseReviews(caseId) {
  return apiRequest(`/ufm-cases/${caseId}/reviews`);
}

export async function fetchHodDashboardAnalytics(year, month) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  return apiRequest(`/dashboard/hod-analytics?${params}`);
}

export async function fetchDecDashboardAnalytics() {
  return apiRequest("/dashboard/dec-analytics");
}

export async function fetchUfmCommitteeDashboardAnalytics(year, month) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString();
  return apiRequest(
    `/dashboard/ufm-committee-analytics${query ? `?${query}` : ""}`
  );
}

export async function createCaseReview(caseId, payload) {
  return apiRequest(`/ufm-cases/${caseId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createDraftCaseFromDetection(detectionId, payload) {
  return apiRequest(`/detections/${detectionId}/create-draft-case`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function casesCsvExportUrl() {
  const token = getToken() || "";
  const params = new URLSearchParams({ token });
  return `${API_URL}/ufm-cases/export.csv?${params.toString()}`;
}

export async function downloadCasesCsv() {
  const token = getToken();
  const response = await fetch(`${API_URL}/ufm-cases/export.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `CSV export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ufm_cases.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function fetchEvidence(caseId = null, detectionId = null) {
  const params = new URLSearchParams();
  if (caseId != null && caseId !== "") params.set("case_id", String(caseId));
  if (detectionId != null && detectionId !== "") {
    params.set("detection_id", String(detectionId));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/evidence${query}`);
}

export async function uploadEvidence(formData) {
  return apiRequest("/evidence", {
    method: "POST",
    body: formData,
  });
}

export async function linkEvidenceToCase(caseId, evidenceIds) {
  return apiRequest(`/ufm-cases/${caseId}/evidence`, {
    method: "POST",
    body: JSON.stringify({ evidence_ids: evidenceIds }),
  });
}

/** Authenticated evidence file URL for <a href> / window.open with token query. */
export function evidenceFileUrl(evidenceId) {
  const token = getToken() || "";
  const params = new URLSearchParams({ token });
  // Prefer Bearer via fetch blob helper for browsers that ignore query auth
  return `${API_URL}/evidence/${evidenceId}/file?${params.toString()}`;
}

/** Fetch evidence bytes as an object URL for inline preview (caller must revoke). */
export async function loadEvidenceObjectUrl(
  evidenceId,
  { preview = false, previewOnly = false } = {}
) {
  const token = getToken();
  const tryPaths = preview
    ? previewOnly
      ? [
          `/evidence/${evidenceId}/preview`,
          `/evidence/${evidenceId}/file?view=true`,
        ]
      : [
          `/evidence/${evidenceId}/preview`,
          `/evidence/${evidenceId}/file?view=true`,
          `/evidence/${evidenceId}/file`,
        ]
    : [`/evidence/${evidenceId}/file`];

  let lastError = null;
  for (const path of tryPaths) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const text = await response.text();
      lastError = new Error(text || `Failed to load evidence (${response.status})`);
      continue;
    }

    const headerType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim();
    const disposition = response.headers.get("content-disposition") || "";
    const nameMatch = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
    let filename = nameMatch
      ? decodeURIComponent(nameMatch[1].replace(/"/g, ""))
      : `evidence-${evidenceId}`;

    const buffer = await response.arrayBuffer();
    const mime =
      headerType && headerType !== "application/octet-stream"
        ? headerType
        : guessMimeFromName(filename);
    if (!/\.[a-z0-9]+$/i.test(filename)) {
      filename += extensionForMime(mime);
    }

    const blob = new Blob([buffer], { type: mime });
    return { url: URL.createObjectURL(blob), mime, filename };
  }
  throw lastError || new Error("Failed to load evidence");
}

function isBrowserViewable(mime) {
  if (!mime) return false;
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  // Browsers generally play these; AVI/MOV often force a download instead of viewing
  if (mime === "video/mp4" || mime === "video/webm") return true;
  return false;
}

function renderEvidenceViewer(win, { url, mime, filename }) {
  const safeName = String(filename || "evidence").replace(/[<>&"]/g, "");
  let content = "";
  if (mime.startsWith("image/")) {
    content = `<img src="${url}" alt="${safeName}"/>`;
  } else if (mime === "video/mp4" || mime === "video/webm") {
    content = `<video src="${url}" controls autoplay></video>`;
  } else if (mime === "application/pdf") {
    content = `<iframe src="${url}" title="${safeName}"></iframe>`;
  } else {
    content = `<p>This file type (<code>${mime || "unknown"}</code>) cannot be shown inline.</p>
<p>Use <strong>Download</strong> to save and open the file locally.</p>`;
  }
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${safeName}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:system-ui,sans-serif}
body{display:flex;flex-direction:column;background:#0f172a;color:#f8fafc}
header{height:56px;flex:0 0 56px;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:0 1rem;background:#fff;color:#0f172a}
header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{border:0;border-radius:6px;padding:.5rem .85rem;background:#e2e8f0;color:#0f172a;font:600 14px system-ui,sans-serif;cursor:pointer}
button:hover{background:#cbd5e1}main{min-height:0;flex:1;display:flex;align-items:center;justify-content:center;padding:1rem}
img,video{display:block;max-width:100%;max-height:100%;object-fit:contain}
iframe{width:100%;height:100%;border:0;background:#fff}
p{max-width:36rem;line-height:1.6}code{overflow-wrap:anywhere}
</style></head>
<body><header><strong>${safeName}</strong><button type="button" aria-label="Close evidence preview" onclick="window.close()">Close preview</button></header>
<main>${content}</main></body></html>`);
  win.document.close();
}

function renderEvidenceMessage(win, title, message) {
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(title)}</title>
<style>body{margin:0;font:16px system-ui,sans-serif;color:#0f172a}header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid #e2e8f0}button{border:0;border-radius:6px;padding:.5rem .85rem;background:#e2e8f0;font:600 14px system-ui,sans-serif;cursor:pointer}main{padding:1.5rem;line-height:1.6}</style></head>
<body><header><strong>${escapeHtml(title)}</strong><button type="button" aria-label="Close evidence preview" onclick="window.close()">Close preview</button></header><main>${escapeHtml(message)}</main></body></html>`);
  win.document.close();
}

export async function openEvidenceFile(evidenceId) {
  // Open blank tab synchronously (user gesture) — never navigate the portal tab,
  // and never trigger a download from Open (Download button is separate).
  const win = window.open("about:blank", "_blank");

  try {
    let loaded = null;
    // 1) Browser-friendly preview (converts AVI/MP4 → animated WebP when needed)
    try {
      loaded = await loadEvidenceObjectUrl(evidenceId, {
        preview: true,
        previewOnly: true,
      });
    } catch {
      loaded = null;
    }
    // 2) Original file only if the browser can actually view it
    if (!loaded || !isBrowserViewable(loaded.mime)) {
      if (loaded?.url) URL.revokeObjectURL(loaded.url);
      const original = await loadEvidenceObjectUrl(evidenceId, { preview: false });
      if (isBrowserViewable(original.mime)) {
        loaded = original;
      } else {
        if (win && !win.closed) {
          renderEvidenceViewer(win, original);
        }
        URL.revokeObjectURL(original.url);
        return;
      }
    }

    if (win && !win.closed) {
      try {
        win.opener = null;
      } catch {
        // ignore
      }
      renderEvidenceViewer(win, loaded);
      setTimeout(() => URL.revokeObjectURL(loaded.url), 180_000);
      return;
    }

    // Popup blocked: do not download — user asked Open ≠ Download
    URL.revokeObjectURL(loaded.url);
    throw new Error(
      "Popup blocked. Allow popups for this site to Open evidence, or use Download."
    );
  } catch (err) {
    if (win && !win.closed) {
      try {
        renderEvidenceMessage(
          win,
          "Could not open evidence",
          err.message || String(err)
        );
      } catch {
        try {
          win.close();
        } catch {
          // ignore
        }
      }
    }
    throw err;
  }
}

export async function downloadEvidenceFile(evidenceId) {
  const { url, filename } = await loadEvidenceObjectUrl(evidenceId, {
    preview: false,
  });
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function guessMimeFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    pdf: "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

function extensionForMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/x-msvideo": ".avi",
    "application/pdf": ".pdf",
  };
  return map[mime] || ".bin";
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchResultControls() {
  return apiRequest("/result-controls");
}

export async function releaseResultControl(controlId) {
  return apiRequest(`/result-controls/${controlId}/release`, {
    method: "PATCH",
  });
}

export async function markResultControlFinePaid(controlId) {
  return apiRequest(`/result-controls/${controlId}/fine-payment`, {
    method: "PATCH",
    body: JSON.stringify({ fine_paid: true }),
  });
}

export async function fetchStudentProfile() {
  return apiRequest("/me/student-profile");
}

export async function fetchClarifications(caseId = null) {
  const query = caseId ? `?case_id=${caseId}` : "";
  return apiRequest(`/clarifications${query}`);
}

export async function submitClarification(payload) {
  return apiRequest("/clarifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAuditLogs() {
  return apiRequest("/audit-logs");
}

export async function downloadAuditLogsCsv({
  action = "",
  entity_type = "",
  q = "",
} = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (entity_type) params.set("entity_type", entity_type);
  if (q) params.set("q", q);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/audit-logs/export.csv${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Audit CSV export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit_logs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function fetchUsers(
  role = null,
  { unlinkedStudentsOnly = false, staffOnly = false } = {}
) {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (unlinkedStudentsOnly) params.set("unlinked_students_only", "true");
  if (staffOnly) params.set("staff_only", "true");
  const query = params.toString() ? `?${params}` : "";
  return apiRequest(`/users${query}`);
}

export async function createUser(payload) {
  return apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchExamRooms() {
  return apiRequest("/exam-rooms");
}

export async function createExamRoom(payload) {
  return apiRequest("/exam-rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCamera(payload) {
  return apiRequest("/cameras", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createExam(payload) {
  return apiRequest("/exams", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateExam(examId, payload) {
  return apiRequest(`/exams/${examId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchExamDetail(examId) {
  return apiRequest(`/exams/${examId}`);
}

export async function enrollExamStudent(examId, studentId) {
  return apiRequest(`/exams/${examId}/enrollments`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId }),
  });
}

export async function fetchExamEnrollments(examId) {
  return apiRequest(`/exams/${examId}/enrollments`);
}

export async function removeExamEnrollment(examId, enrollmentId) {
  return apiRequest(`/exams/${examId}/enrollments/${enrollmentId}`, {
    method: "DELETE",
  });
}

export async function assignExamInvigilator(examId, userId) {
  return apiRequest(`/exams/${examId}/invigilators`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function fetchExamInvigilators(examId) {
  return apiRequest(`/exams/${examId}/invigilators`);
}

export async function removeExamInvigilator(examId, assignmentId) {
  return apiRequest(`/exams/${examId}/invigilators/${assignmentId}`, {
    method: "DELETE",
  });
}

export async function createStudent(payload) {
  return apiRequest("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function linkStudentUser(studentPk, userId) {
  return apiRequest(`/students/${studentPk}/link-user`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function fetchLiveStatus() {
  return apiRequest("/live/status");
}

export async function startLiveCamera(cameraId, payload = {}) {
  return apiRequest(`/live/cameras/${cameraId}/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function stopLiveCamera(cameraId) {
  return apiRequest(`/live/cameras/${cameraId}/stop`, {
    method: "POST",
  });
}

export async function testCameraSource(streamUrl) {
  return apiRequest("/live/test-source", {
    method: "POST",
    body: JSON.stringify({ stream_url: streamUrl }),
  });
}

/** MJPEG URL for <img src> — token query because img cannot set Authorization. */
export function liveMjpegUrl(cameraId, { cacheBust } = {}) {
  const token = getToken() || "";
  const params = new URLSearchParams({ token });
  if (cacheBust) params.set("t", String(cacheBust));
  return `${API_URL}/live/cameras/${cameraId}/mjpeg?${params.toString()}`;
}

export async function fetchAdminUserStats() {
  return apiRequest("/admin/users/stats");
}

export async function fetchAdminUsers(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const qs = q.toString() ? `?${q}` : "";
  return apiRequest(`/admin/users${qs}`);
}

export async function fetchAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}`);
}

export async function createAdminUser(payload) {
  return apiRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchAdminUser(userId, payload) {
  return apiRequest(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function activateAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}/activate`, { method: "POST" });
}

export async function deactivateAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}/deactivate`, { method: "POST" });
}

export async function previewAdminUserImport(file) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/admin/users/import/preview", {
    method: "POST",
    body: form,
  });
}

export async function confirmAdminUserImport(rows) {
  return apiRequest("/admin/users/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export async function fetchAdminAuditLogs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const qs = q.toString() ? `?${q}` : "";
  return apiRequest(`/admin/audit-logs${qs}`);
}

export async function fetchAdminStudents(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const qs = q.toString() ? `?${q}` : "";
  return apiRequest(`/admin/students${qs}`);
}

export async function fetchAdminSystemInfo() {
  return apiRequest("/admin/system-info");
}

export async function sendAdminTestEmail() {
  return apiRequest("/admin/email/test", { method: "POST" });
}

export async function fetchAdminRoles() {
  return apiRequest("/admin/roles");
}

export { API_URL };
