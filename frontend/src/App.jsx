import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { DenyAdministrator, RequireAdministrator, RequireRoles } from "./components/RoleGates";
import { useAuth } from "./context/AuthContext";
import { homePathForRole } from "./config/roleHome";
import {
  CASE_CREATE_ROLES,
  DETECTION_ROLES,
  EXAM_TOOLKIT_ROLES,
  EVIDENCE_VIEW_ROLES,
  MASTER_DATA_VIEW_ROLES,
  MONITOR_ROLES,
  OPERATIONAL_AUDIT_ROLES,
  REPORTS_ROLES,
  RESULT_CONTROL_ROLES,
  STUDENT_DIRECTORY_VIEW_ROLES,
} from "./config/roleAccess";
import NotFoundPage from "./components/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminImportPage from "./pages/AdminImportPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import AdminSystemPage from "./pages/AdminSystemPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import DashboardHome from "./pages/DashboardHome";
import DetectionsPage from "./pages/DetectionsPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import CasesPage from "./pages/CasesPage";
import CreateCasePage from "./pages/CreateCasePage";
import AuditTrailPage from "./pages/AuditTrailPage";
import ClarificationPage from "./pages/ClarificationPage";
import EvidencePage from "./pages/EvidencePage";
import HelpPage from "./pages/HelpPage";
import Login from "./pages/Login";
import MasterDataPage from "./pages/MasterDataPage";
import MonitoringPage from "./pages/MonitoringPage";
import NotificationsPage from "./pages/NotificationsPage";
import ReportsPage from "./pages/ReportsPage";
import ResultControlsPage from "./pages/ResultControlsPage";
import StudentsPage from "./pages/StudentsPage";
import ExamToolkitPage from "./pages/ExamToolkitPage";
import StudentPortalEntry from "./pages/StudentPortalEntry";
// Operational /app/users removed (C11-B) — staff provisioning is Administrator-only.

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathForRole(user?.role)} replace />;
}

function Operational({ children }) {
  return <DenyAdministrator>{children}</DenyAdministrator>;
}

function AdminOnly({ children }) {
  return <RequireAdministrator>{children}</RequireAdministrator>;
}

function OpsRoles({ roles, children }) {
  return (
    <Operational>
      <RequireRoles roles={roles}>{children}</RequireRoles>
    </Operational>
  );
}

export default function App() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading session…
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={
              isAuthenticated
                ? homePathForRole(user?.role)
                : "/login"
            }
            replace
          />
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/student-portal" element={<StudentPortalEntry />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />
        <Route
          path="dashboard"
          element={
            user?.role === "ADMINISTRATOR" ? (
              <Navigate to="/app/admin/dashboard" replace />
            ) : (
              <DashboardHome />
            )
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="cases"
          element={
            <Operational>
              <CasesPage />
            </Operational>
          }
        />
        <Route
          path="cases/new"
          element={
            <OpsRoles roles={CASE_CREATE_ROLES}>
              <CreateCasePage />
            </OpsRoles>
          }
        />
        <Route
          path="cases/:caseId"
          element={
            <Operational>
              <CaseDetailPage />
            </Operational>
          }
        />
        <Route
          path="detections"
          element={
            <OpsRoles roles={DETECTION_ROLES}>
              <DetectionsPage />
            </OpsRoles>
          }
        />
        <Route
          path="evidence"
          element={
            <OpsRoles roles={EVIDENCE_VIEW_ROLES}>
              <EvidencePage />
            </OpsRoles>
          }
        />
        <Route
          path="students"
          element={
            <OpsRoles roles={STUDENT_DIRECTORY_VIEW_ROLES}>
              <StudentsPage />
            </OpsRoles>
          }
        />
        <Route
          path="users"
          element={
            <Operational>
              <Navigate to="/app/dashboard" replace />
            </Operational>
          }
        />
        <Route
          path="admin/dashboard"
          element={
            <AdminOnly>
              <AdminDashboardPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminOnly>
              <AdminUsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/import"
          element={
            <AdminOnly>
              <AdminImportPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/roles"
          element={
            <AdminOnly>
              <AdminRolesPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/audit"
          element={
            <AdminOnly>
              <AdminAuditPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/students"
          element={
            <AdminOnly>
              <AdminStudentsPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/system"
          element={
            <AdminOnly>
              <AdminSystemPage />
            </AdminOnly>
          }
        />
        <Route
          path="admin/profile"
          element={
            <AdminOnly>
              <AdminProfilePage />
            </AdminOnly>
          }
        />
        <Route
          path="master-data"
          element={
            <OpsRoles roles={MASTER_DATA_VIEW_ROLES}>
              <MasterDataPage />
            </OpsRoles>
          }
        />
        <Route
          path="result-controls"
          element={
            <OpsRoles roles={RESULT_CONTROL_ROLES}>
              <ResultControlsPage />
            </OpsRoles>
          }
        />
        <Route
          path="exam-toolkit"
          element={
            <OpsRoles roles={EXAM_TOOLKIT_ROLES}>
              <ExamToolkitPage />
            </OpsRoles>
          }
        />
        <Route
          path="audit"
          element={
            <OpsRoles roles={OPERATIONAL_AUDIT_ROLES}>
              <AuditTrailPage />
            </OpsRoles>
          }
        />
        <Route
          path="monitoring"
          element={
            <OpsRoles roles={MONITOR_ROLES}>
              <MonitoringPage />
            </OpsRoles>
          }
        />
        <Route
          path="reports"
          element={
            <OpsRoles roles={REPORTS_ROLES}>
              <ReportsPage />
            </OpsRoles>
          }
        />
        <Route
          path="clarification"
          element={
            <OpsRoles roles={["STUDENT"]}>
              <ClarificationPage />
            </OpsRoles>
          }
        />
        <Route path="help" element={<HelpPage />} />
        <Route
          path="profile"
          element={
            user?.role === "ADMINISTRATOR" ? (
              <Navigate to="/app/admin/profile" replace />
            ) : (
              <ProfilePage />
            )
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
