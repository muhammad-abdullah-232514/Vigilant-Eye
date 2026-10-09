import { Link, useLocation } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import {
  formatCaseCreatedAt,
  formatViolationLabel,
  violationLabelClass,
} from "../config/casePresentation";

function CaseRowMeta({ c }) {
  return (
    <>
      <div className="font-medium text-slate-800">{c.student_name || "—"}</div>
      <div className="text-xs text-slate-500">{c.student_roll || "—"}</div>
    </>
  );
}

export default function CaseQueueTable({
  title,
  cases,
  emptyLabel = "No UFM cases require your attention.",
  actionLabel = "Open",
  viewAllTo = "/app/cases",
  className = "",
}) {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const caseLinkState = { from };

  return (
    <section className={`portal-card case-queue-panel min-w-0 overflow-hidden ${className}`}>
      <div className="portal-panel-header case-queue-header">
        <h2 className="portal-section-title">{title}</h2>
        <Link to={viewAllTo} className="btn-ghost btn-sm shrink-0">
          View all →
        </Link>
      </div>

      {cases.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="portal-case-cards">
            {cases.map((c) => (
              <div key={c.id} className="portal-case-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="portal-case-card-title">
                    {c.case_number || `Case #${c.id}`}
                  </p>
                  <StatusBadge status={c.status} />
                </div>
                <p className="portal-case-card-meta">
                  {c.student_name || "—"}
                  {c.student_roll ? ` · ${c.student_roll}` : ""}
                </p>
                <p className="portal-case-card-meta">
                  <span className={violationLabelClass(c.violation_type)}>
                  {formatViolationLabel(c.violation_type)}
                  </span>
                  {c.exam_course_code ? ` · ${c.exam_course_code}` : ""}
                </p>
                <div className="mt-3">
                  <Link
                    to={`/app/cases/${c.id}`}
                    state={caseLinkState}
                    className="case-open-button"
                  >
                    {actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table — compact six-column summary stays within the panel */}
          <div className="portal-table-wrap portal-table-desktop">
            <table className="portal-table portal-queue-table case-queue-table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Case ID</th>
                  <th>Student</th>
                  <th>Violation</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="col-hide-sm whitespace-nowrap">Created</th>
                  <th className="whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-medium text-au-navy">
                      {c.case_number || `Case #${c.id}`}
                    </td>
                    <td className="min-w-[8rem]">
                      <CaseRowMeta c={c} />
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={violationLabelClass(c.violation_type)}>
                      {formatViolationLabel(c.violation_type)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="col-hide-sm text-xs text-slate-500">
                      {c.created_at
                        ? formatCaseCreatedAt(c.created_at)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link
                        to={`/app/cases/${c.id}`}
                        state={caseLinkState}
                        className="case-open-button"
                      >
                        {actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
