import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";

export default function StudentPortalEntry() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const isStudent = user?.role === "STUDENT";

  useEffect(() => {
    if (!loading && isAuthenticated && !isStudent) {
      logout();
    }
  }, [isAuthenticated, isStudent, loading, logout]);

  if (loading || (isAuthenticated && !isStudent)) {
    return <LoadingState label="Opening student sign-in…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}
