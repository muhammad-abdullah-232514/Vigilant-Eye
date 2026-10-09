import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Search } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import {
  formatAuditActionLabel,
  formatEntityTypeLabel,
  formatRoleLabel,
  formatStatusLabel,
} from "../config/casePresentation";
import {
  OPERATIONAL_AUDIT_ROLES,
} from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import { downloadAuditLogsCsv, fetchAuditLogs } from "../services/api";

const CAN_VIEW = new Set(OPERATIONAL_AUDIT_ROLES);

const ACTION_TONES = {
  CASE_REVIEW_FORWARD: "border-blue-200 bg-blue-50 text-blue-700",
  CASE_REVIEW_APPROVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CASE_REVIEW_REJECT: "border-rose-200 bg-rose-50 text-rose-700",
  CASE_REVIEW_RETURN: "border-amber-200 bg-amber-50 text-amber-700",
  CASE_REVIEW_IMPLEMENT: "border-teal-200 bg-teal-50 text-teal-700",
  CASE_OPENED: "border-violet-200 bg-violet-50 text-violet-700",
  CASE_CREATED: "border-sky-200 bg-sky-50 text-sky-700",
  CASE_SIGNED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CASE_DRAFT_FROM_DETECTION:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  MONITORING_START: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MONITORING_STOP: "border-orange-200 bg-orange-50 text-orange-700",
  RESULT_HOLD_CREATED: "border-rose-200 bg-rose-50 text-rose-700",
  RESULT_RELEASED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  UFM_FINE_PAYMENT_RECORDED:
    "border-lime-200 bg-lime-50 text-lime-700",
  EVIDENCE_UPLOADED: "border-purple-200 bg-purple-50 text-purple-700",
  EVIDENCE_LINKED: "border-pink-200 bg-pink-50 text-pink-700",
  CLARIFICATION_SUBMITTED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  ROOM_CREATED: "border-sky-200 bg-sky-50 text-sky-700",
  CAMERA_CREATED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  EXAM_CREATED: "border-violet-200 bg-violet-50 text-violet-700",
  EXAM_UPDATED: "border-blue-200 bg-blue-50 text-blue-700",
  EXAM_ENROLLMENT_CREATED:
    "border-teal-200 bg-teal-50 text-teal-700",
  EXAM_ENROLLMENT_REMOVED:
    "border-orange-200 bg-orange-50 text-orange-700",
  EXAM_INVIGILATOR_ASSIGNED:
    "border-green-200 bg-green-50 text-green-700",
  EXAM_INVIGILATOR_UNASSIGNED:
    "border-amber-200 bg-amber-50 text-amber-700",
  STUDENT_REGISTERED_FOR_FILING:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  EXAM_CREATED_FOR_FILING:
    "border-purple-200 bg-purple-50 text-purple-700",
  USER_CREATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  USER_BULK_IMPORTED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  USER_ROLE_CHANGED: "border-violet-200 bg-violet-50 text-violet-700",
  USER_STUDENT_LINKED: "border-teal-200 bg-teal-50 text-teal-700",
  USER_STUDENT_UNLINKED: "border-orange-200 bg-orange-50 text-orange-700",
  USER_REACTIVATED: "border-green-200 bg-green-50 text-green-700",
  USER_DEACTIVATED: "border-rose-200 bg-rose-50 text-rose-700",
  ADMIN_EMAIL_TEST: "border-blue-200 bg-blue-50 text-blue-700",
};

const FALLBACK_ACTION_TONES = [
  "border-slate-200 bg-slate-50 text-slate-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-lime-200 bg-lime-50 text-lime-700",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  "border-cyan-200 bg-cyan-50 text-cyan-700",
  "border-indigo-200 bg-indigo-50 text-indigo-700",
  "border-pink-200 bg-pink-50 text-pink-700",
];

function actionTone(action = "") {
  const value = action.toUpperCase();
  if (ACTION_TONES[value]) return ACTION_TONES[value];
  const hash = [...value].reduce(
    (total, character) => total * 31 + character.charCodeAt(0),
    0
  );
  return FALLBACK_ACTION_TONES[Math.abs(hash) % FALLBACK_ACTION_TONES.length];
}

function formatAuditTimestamp(value) {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function formatAuditDescription(row) {
  const description = String(row.description || "").trim();
  if (!description) return "No additional details were recorded.";

  const review = description.match(
    /^([A-Z_]+)\s+(FORWARD|APPROVE|REJECT|RETURN|IMPLEMENT)\s+on\s+([^;]+)(?:;\s*status\s*→\s*([A-Z_]+))?(?:;\s*signed by\s+(.+))?$/i
  );
  if (review) {
    const [, rawRole, rawAction, caseNumber, nextStatus, signer] = review;
    const role = formatRoleLabel(rawRole);
    const action = rawAction.toUpperCase();
    const actionText = {
      FORWARD: "forwarded",
      APPROVE: "approved",
      REJECT: "rejected",
      RETURN: "returned",
      IMPLEMENT: "recorded implementation for",
    }[action];
    const transition = nextStatus
      ? ` Status updated to ${formatStatusLabel(nextStatus)}.`
      : "";
    const signed = signer ? ` Recorded by ${signer}.` : "";
    return `${role} ${actionText} case ${caseNumber}.${transition}${signed}`;
  }

  const opened = description.match(
    /^([A-Z_]+)\s+opened\s+(.+?);\s*status\s*→\s*([A-Z_]+)$/i
  );
  if (opened) {
    return `${formatRoleLabel(opened[1])} opened case ${opened[2]}. Status updated to ${formatStatusLabel(opened[3])}.`;
  }

  const monitoringStart = description.match(
    /^(?:PROD|DEMO)\s+start camera\s+(\S+)\s+detect=(true|false)\s+persist=(true|false)$/i
  );
  if (row.action === "MONITORING_START" && monitoringStart) {
    const [, camera, detect, persist] = monitoringStart;
    const options = [
      detect === "true" ? "detection enabled" : "detection disabled",
      persist === "true" ? "case saving enabled" : "case saving disabled",
    ];
    return `Live monitoring started on camera ${camera} (${options.join(", ")}).`;
  }

  const cameraStop = description.match(/^Stop live session camera_id=(\d+)$/i);
  if (row.action === "MONITORING_STOP" && cameraStop) {
    return `Live monitoring stopped for camera #${cameraStop[1]}.`;
  }

  return description
    .replace(/\bcase_id=(\d+)\b/gi, "Case #$1")
    .replace(/\bcamera_id=(\d+)\b/gi, "Camera #$1")
    .replace(/\bstudent_id=(\d+)\b/gi, "Student #$1")
    .replace(/\bexam_id=(\d+)\b/gi, "Exam #$1")
    .replace(/\buser_id=(\d+)\b/gi, "User #$1")
    .replace(/\bstatus\s*→\s*([A-Z_]+)/gi, (_, status) =>
      `status updated to ${formatStatusLabel(status)}`
    )
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, ".");
}

export default function AuditTrailPage() {
  const { user } = useAuth();
  const canView = CAN_VIEW.has(user?.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!canView) {
      setLoading(false);
      setError("Your role cannot view the audit trail.");
      return undefined;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAuditLogs();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setError("Unable to load audit trail. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const actions = useMemo(() => {
    const set = new Set(items.map((i) => i.action).filter(Boolean));
    return [...set].sort();
  }, [items]);

  const entityTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.entity_type).filter(Boolean));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (actionFilter && row.action !== actionFilter) return false;
      if (entityFilter && row.entity_type !== entityFilter) return false;
      if (!q) return true;
      const hay = [
        row.action,
        row.entity_type,
        row.description,
        String(row.user_id ?? ""),
        String(row.entity_id ?? ""),
        row.user_role,
        formatRoleLabel(row.user_role),
        formatAuditActionLabel(row.action),
        formatEntityTypeLabel(row.entity_type),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, actionFilter, entityFilter, query]);

  function entityCell(row) {
    const label = formatEntityTypeLabel(row.entity_type);
    if (row.entity_id == null) return label;
    if (row.entity_type === "ufm_case") return label;
    return (
      <span>
        {label} <span className="text-slate-500">#{row.entity_id}</span>
      </span>
    );
  }

  async function onExportCsv() {
    setExporting(true);
    setError("");
    try {
      await downloadAuditLogsCsv({
        action: actionFilter,
        entity_type: entityFilter,
        q: query,
      });
    } catch (err) {
      setError(err.message || "Unable to export audit CSV.");
    } finally {
      setExporting(false);
    }
  }

  if (!canView && !loading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Audit trail is not available</p>
        <p className="mt-1">
          This administrative log is limited to HOD, DEC, Exam Department, and
          UFM Committee roles.
        </p>
        <Link
          to="/app/dashboard"
          className="mt-3 inline-flex text-sm font-semibold text-au-blue"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Home / Audit Trail"
        title="Audit Trail"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {filtered.length} of {items.length} events
            </p>
            <button
              type="button"
              disabled={exporting || loading}
              onClick={onExportCsv}
              className="btn-primary"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        }
      >
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Review recorded actions across cases, evidence, reviews, and result
          holds. Audit records are read-only.
        </p>
      </PageHeader>

      {error ? (
        <ErrorBanner
          title="Unable to load audit trail."
          message={error}
          onRetry={() => {
            setLoading(true);
            setError("");
            fetchAuditLogs()
              .then((data) => setItems(Array.isArray(data) ? data : []))
              .catch(() =>
                setError("Unable to load audit trail. Please try again.")
              )
              .finally(() => setLoading(false));
          }}
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filter events
          </p>
          {actionFilter || entityFilter || query ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-au-blue hover:underline"
              onClick={() => {
                setActionFilter("");
                setEntityFilter("");
                setQuery("");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_15rem_13rem]">
          <label className="relative block sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Search audit trail</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="audit-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, cases, users, or details..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-au-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label>
            <span className="sr-only">Filter by action</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-au-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {formatAuditActionLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by entity</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              aria-label="Filter by entity"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-au-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All entities</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {formatEntityTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <LoadingState
            compact
            title="Loading audit trail…"
            detail="Retrieving historical administrative events."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No audit events to show"
            detail={
              items.length === 0
                ? "No audit records have been returned for your role yet."
                : "No audit events match the current filters."
            }
            actions={
              actionFilter || entityFilter || query ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setActionFilter("");
                    setEntityFilter("");
                    setQuery("");
                  }}
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold text-au-navy">
                  Event history
                </p>
                <p className="text-xs text-slate-500">
                  Recorded case and operational activity, newest first
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {filtered.length} {filtered.length === 1 ? "event" : "events"}
              </p>
            </div>
            <div className="portal-data-cards">
              {filtered.map((row) => (
                <div key={row.id} className="portal-case-card" data-affordance="static">
                  <div className="flex items-start justify-between gap-2">
                    <p className="portal-case-card-title capitalize">
                      {formatAuditActionLabel(row.action)}
                    </p>
                    <time className="shrink-0 text-right text-xs text-slate-500">
                      {formatAuditTimestamp(row.timestamp).date}
                      <span className="block tabular-nums">
                        {formatAuditTimestamp(row.timestamp).time}
                      </span>
                    </time>
                  </div>
                  <p className="portal-case-card-meta">
                    {formatRoleLabel(row.user_role)} · {entityCell(row)}
                  </p>
                  {row.entity_type === "ufm_case" && row.entity_id != null ? (
                    <p className="portal-case-card-meta">
                      <Link
                        to={`/app/cases/${row.entity_id}`}
                        className="font-medium text-au-blue hover:underline"
                      >
                        Case #{row.entity_id}
                      </Link>
                    </p>
                  ) : null}
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                    {formatAuditDescription(row)}
                  </p>
                </div>
              ))}
            </div>

            <div className="portal-table-wrap portal-table-desktop">
              <table className="portal-table audit-trail-table">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[17%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[38%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th className="col-hide-sm">User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th className="col-hide-md">Case</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs text-slate-500">
                        <time className="whitespace-nowrap">
                          {formatAuditTimestamp(row.timestamp).date}
                          <span className="mt-0.5 block tabular-nums text-slate-400">
                            {formatAuditTimestamp(row.timestamp).time}
                          </span>
                        </time>
                      </td>
                      <td className="col-hide-sm text-slate-700">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {formatRoleLabel(row.user_role)}
                        </span>
                      </td>
                      <td>
                        <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold capitalize leading-snug ${actionTone(row.action)}`}>
                          {formatAuditActionLabel(row.action)}
                        </span>
                      </td>
                      <td className="cell-wrap text-slate-700">
                        {entityCell(row)}
                      </td>
                      <td className="col-hide-md">
                        {row.entity_type === "ufm_case" &&
                        row.entity_id != null ? (
                          <Link
                            to={`/app/cases/${row.entity_id}`}
                            className="font-medium text-au-blue hover:underline"
                          >
                            Case #{row.entity_id}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="text-slate-700">
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                          {formatAuditDescription(row)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
