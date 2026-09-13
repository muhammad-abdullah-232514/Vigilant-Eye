const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("ve_token");
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
    const detail =
      (data && data.detail) ||
      (typeof data === "string" ? data : null) ||
      `Request failed (${response.status})`;
    const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
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

export async function fetchCases() {
  return apiRequest("/ufm-cases");
}

export async function fetchDetections(confirmedOnly = false) {
  const query = confirmedOnly ? "?confirmed_only=true" : "";
  return apiRequest(`/detections${query}`);
}

export async function fetchCameras() {
  return apiRequest("/cameras");
}

export async function fetchStudents() {
  return apiRequest("/students");
}

export async function fetchExams() {
  return apiRequest("/exams");
}

export async function fetchCase(caseId) {
  return apiRequest(`/ufm-cases/${caseId}`);
}

export async function createCase(payload) {
  return apiRequest("/ufm-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCaseReviews(caseId) {
  return apiRequest(`/ufm-cases/${caseId}/reviews`);
}

export async function createCaseReview(caseId, payload) {
  return apiRequest(`/ufm-cases/${caseId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEvidence(caseId = null) {
  const query = caseId ? `?case_id=${caseId}` : "";
  return apiRequest(`/evidence${query}`);
}

export async function uploadEvidence(formData) {
  return apiRequest("/evidence", {
    method: "POST",
    body: formData,
  });
}

/** Authenticated evidence file URL for <a href> / window.open with token query. */
export function evidenceFileUrl(evidenceId) {
  const token = getToken() || "";
  const params = new URLSearchParams({ token });
  // Prefer Bearer via fetch blob helper for browsers that ignore query auth
  return `${API_URL}/evidence/${evidenceId}/file?${params.toString()}`;
}

export async function openEvidenceFile(evidenceId) {
  const token = getToken();
  const response = await fetch(`${API_URL}/evidence/${evidenceId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to open evidence (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke later to avoid leaking memory
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchResultControls() {
  return apiRequest("/result-controls");
}

export async function releaseResultControl(controlId) {
  return apiRequest(`/result-controls/${controlId}/release`, {
    method: "PATCH",
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

/** MJPEG URL for <img src> — token query because img cannot set Authorization. */
export function liveMjpegUrl(cameraId, { cacheBust } = {}) {
  const token = getToken() || "";
  const params = new URLSearchParams({ token });
  if (cacheBust) params.set("t", String(cacheBust));
  return `${API_URL}/live/cameras/${cameraId}/mjpeg?${params.toString()}`;
}

export { API_URL };
