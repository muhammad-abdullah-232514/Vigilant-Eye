import PageHeader from "../components/PageHeader";
import PageShell from "../components/PageShell";
import { ROLE_LABELS } from "../config/navByRole";
import { useAuth } from "../context/AuthContext";
import { BadgeCheck, ShieldCheck, UserRound } from "lucide-react";

/**
 * Shared account profile for all portal roles (Google Sign-In explanation).
 */
export default function ProfilePage({ adminBreadcrumb = false }) {
  const { user } = useAuth();
  const role = user?.role || "";
  const displayName = user?.name || "Portal user";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const roleLabel = ROLE_LABELS[role] || role || "—";
  const isActive = user?.is_active !== false;
  const breadcrumb = adminBreadcrumb
    ? "Home / Administration / Profile"
    : "Home / Account / Profile";

  return (
    <PageShell narrow>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Profile & account"
        // description="Your identity is verified with Google Sign-In. VigilantEye authorization comes from your university portal account (email, role, and active status)."
      />

      <section className="profile-hero portal-card profile-motion profile-motion-1">
        <div className="profile-avatar" aria-hidden="true">
          {initials || <UserRound className="h-8 w-8" />}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-au-navy">{displayName}</p>
          <p className="mt-1 text-sm text-slate-500">{user?.email || "—"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="profile-role-badge">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {roleLabel}
            </span>
            <span className={`profile-status-badge ${isActive ? "active" : "inactive"}`}>
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {isActive ? "Active account" : "Inactive account"}
            </span>
          </div>
        </div>
      </section>

      <section className="portal-card overflow-hidden profile-motion profile-motion-2">
        <div className="portal-panel-header">
          <div>
            <h2 className="portal-section-title">Account information</h2>
            <p className="mt-1 text-xs text-slate-500">
              Your verified portal identity and access details.
            </p>
          </div>
        </div>
        <dl className="grid gap-3 p-4 sm:grid-cols-2">
        {[
          ["Display name", displayName],
          ["Email", user?.email || "—"],
          ["Portal role", roleLabel],
          [
            "Account status",
            isActive ? "Active" : "Inactive",
          ],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {k}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-au-navy">
              {v}
            </dd>
          </div>
        ))}
        </dl>
      </section>

    </PageShell>
  );
}
