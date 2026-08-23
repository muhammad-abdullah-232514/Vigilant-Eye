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

export { API_URL };
