const TOKEN_KEY = "ve_token";
const USER_KEY = "ve_user";

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getAuthUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeAuthUser() {
  sessionStorage.removeItem(USER_KEY);
}

export function clearAuthSession() {
  removeAuthToken();
  removeAuthUser();
}

export function removeLegacyAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
