import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import PageShell from "../components/PageShell";
import StatusBadge from "../components/StatusBadge";
import {
  formatCaseCreatedAt,
  formatStatusLabel,
  formatViolationLabel,
  responsibleLabelForStatus,
} from "../config/casePresentation";
import { CASE_CREATE_ROLES, roleIn } from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import { fetchCases } from "../services/api";

function pageTitle(isStudent, statusFilter) {
  if (isStudent) return "My UFM Cases";
  if (!statusFilter) return "UFM Cases";
  return `UFM Cases · ${formatStatusLabel(statusFilter)}`;
}

function pageDescription(isStudent, statusFilter, filteredCount, totalCount) {
  if (isStudent) {
    return "UFM cases linked to your student profile. Open a case to review details or submit a clarification.";
  }
  if (statusFilter) {
    return `Cases in this queue · ${filteredCount} shown.`;
  }
  return `${totalCount} case${totalCount === 1 ? "" : "s"} on record for your role.`;
}

function emptyMessage(isStudent, statusFilter) {
  if (isStudent) {
    return statusFilter
      ? "No UFM cases match this status for your linked student profile."
      : "You have no UFM cases.";
  }
  if (
    statusFilter === "PENDING" ||
    statusFilter === "UNDER_REVIEW" ||
    statusFilter === "DEC_REVIEW" ||
    statusFilter === "EXAM_DEPARTMENT_REVIEW" ||
    statusFilter === "UFM_COMMITTEE_REVIEW"
  ) {
    return "No UFM cases require your attention in this queue.";
  }
  if (statusFilter) {
    return `No UFM cases with status “${formatStatusLabel(statusFilter)}”.`;
  }
  return "No UFM cases have been filed yet.";
}

function CaseCard({ c, isStudent, from }) {
  return (
    <div className="portal-case-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="portal-case-card-title">{c.case_number}</p>
          {!isStudent ? (
            <p className="portal-case-card-meta">
              {c.student_name || "—"}
              {c.student_roll ? ` · ${c.student_roll}` : ""}
            </p>
          ) : null}
        </div>
        <StatusBadge status={c.status} />
      </div>
      <p className="portal-case-card-meta mt-2">
        {formatViolationLabel(c.violation_type)}
        {c.exam_course_code ? ` · ${c.exam_course_code}` : ""}
      </p>
      {!isStudent && responsibleLabelForStatus(c.status) ? (
        <p className="portal-case-card-meta">
          {responsibleLabelForStatus(c.status)}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          to={`/app/cases/${c.id}`}
          state={{ from }}
          className="portal-text-link text-sm"
        >
          {isStudent ? "View case" : "Open case"}
        </Link>
        {isStudent ? (
          <Link
            to={`/app/clarification?case_id=${c.id}`}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Clarification
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function CasesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const isStudent = user?.role === "STUDENT";
  const canCreate = roleIn(user?.role, CASE_CREATE_ROLES);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCases({
        scope: "dashboard",
        status: statusFilter || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load UFM cases. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const list = !statusFilter
      ? items
      : items.filter((c) => c.status === statusFilter);
    // Keep newest → oldest after status filter (matches API default).
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [items, statusFilter]);

  const statuses = useMemo(() => {
    const set = new Set(items.map((c) => c.status).filter(Boolean));
    return [...set].sort();
  }, [items]);

  function onStatusChange(value) {
    if (!value) setSearchParams({});
    else setSearchParams({ status: value });
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Home / Cases"
        title={pageTitle(isStudent, statusFilter)}
        description={
          loading
            ? isStudent
              ? "UFM cases linked to your student profile."
              : "Review and manage unfair means cases for your role."
            : pageDescription(
                isStudent,
                statusFilter,
                filtered.length,
                items.length
              )
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="sr-only sm:not-sr-only">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                className="portal-select w-auto min-w-[10rem]"
                aria-label="Filter cases by status"
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {isStudent ? (
              <Link to="/app/clarification" className="btn-primary">
                Clarification
              </Link>
            ) : canCreate ? (
              <Link to="/app/cases/new" className="btn-primary">
                Report UFM Incident
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <ErrorBanner
          title="Unable to load UFM cases."
          message={error}
          onRetry={load}
        />
      ) : null}

      <div className="portal-card overflow-hidden">
        {loading ? (
          <LoadingState
            compact
            title="Loading UFM cases…"
            detail="Retrieving case records for your role."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={emptyMessage(isStudent, statusFilter)}
            detail={
              isStudent
                ? statusFilter
                  ? "Try clearing the status filter, or check Notifications for updates."
                  : "When a UFM case is filed against your linked student profile, it will appear here."
                : statusFilter
                  ? "Clear the filter to see all cases available to your role."
                  : null
            }
            actions={
              <>
                {statusFilter ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange("")}
                    className="btn-secondary"
                  >
                    Clear status filter
                  </button>
                ) : null}
                {isStudent ? (
                  <Link to="/app/help" className="btn-secondary">
                    Help & Guidelines
                  </Link>
                ) : canCreate ? (
                  <>
                    <Link to="/app/cases/new" className="btn-primary">
                      Report UFM Incident
                    </Link>
                    <Link to="/app/detections" className="btn-secondary">
                      View Detections
                    </Link>
                  </>
                ) : null}
              </>
            }
          />
        ) : (
          <>
            <div className="portal-case-cards">
              {filtered.map((c) => (
                <CaseCard key={c.id} c={c} isStudent={isStudent} from={from} />
              ))}
            </div>

            <div className="portal-table-wrap portal-table-desktop">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    {!isStudent ? <th>Student</th> : null}
                    <th className="col-hide-md">Examination</th>
                    <th>Violation</th>
                    <th>Status</th>
                    {!isStudent ? (
                      <th className="col-hide-lg">Review state</th>
                    ) : null}
                    <th className="col-hide-sm">Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const responsible = responsibleLabelForStatus(c.status);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="font-semibold text-au-navy">
                            {c.case_number}
                          </div>
                          {!isStudent ? (
                            <div className="text-[11px] text-slate-400">
                              #{c.id}
                            </div>
                          ) : null}
                        </td>
                        {!isStudent ? (
                          <td>
                            <div className="font-medium text-slate-800">
                              {c.student_name || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {c.student_roll || "—"}
                              {c.student_department
                                ? ` · ${c.student_department}`
                                : ""}
                            </div>
                          </td>
                        ) : null}
                        <td className="col-hide-md text-slate-700">
                          <div className="font-medium">
                            {c.exam_course_code || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {[
                              c.exam_course_name || null,
                              c.exam_date || null,
                              c.room_number ? `Room ${c.room_number}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </td>
                        <td>{formatViolationLabel(c.violation_type)}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        {!isStudent ? (
                          <td className="col-hide-lg text-xs text-slate-600">
                            {responsible || "—"}
                          </td>
                        ) : null}
                        <td className="col-hide-sm whitespace-nowrap text-slate-500">
                          {c.created_at
                            ? formatCaseCreatedAt(c.created_at)
                            : "—"}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <Link
                              to={`/app/cases/${c.id}`}
                              state={{ from }}
                              className="portal-text-link whitespace-nowrap"
                            >
                              {isStudent ? "View case" : "Open case"}
                            </Link>
                            {isStudent ? (
                              <Link
                                to={`/app/clarification?case_id=${c.id}`}
                                className="text-xs font-semibold text-slate-600 hover:underline"
                              >
                                Clarification
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
