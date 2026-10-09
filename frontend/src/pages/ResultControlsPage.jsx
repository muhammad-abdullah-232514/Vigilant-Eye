import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import {
  formatResultStatusLabel,
  formatStatusLabel,
} from "../config/casePresentation";
import { penaltyLabel, UFM_PENALTIES } from "../config/ufmPenalties";
import { RESULT_CONTROL_ROLES } from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  fetchResultControls,
  markResultControlFinePaid,
  releaseResultControl,
} from "../services/api";

const CAN_VIEW = new Set(RESULT_CONTROL_ROLES);
const CAN_RELEASE = new Set(RESULT_CONTROL_ROLES);

function ResultStatusBadge({ status }) {
  const held = status === "HELD";
  const released = status === "RELEASED";
  const label = formatResultStatusLabel(status);
  const style = held
    ? "bg-amber-100 text-amber-950 ring-amber-300"
    : released
      ? "bg-emerald-100 text-emerald-950 ring-emerald-300"
      : "bg-slate-100 text-slate-800 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${style}`}
      title={`Result status: ${label}`}
    >
      {label}
    </span>
  );
}

function Field({ label, children }) {
  if (children == null || children === "" || children === "—") return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function studentPrimary(row) {
  return row.student_name || `Student #${row.student_id}`;
}

function rollPrimary(row) {
  return row.student_roll || "—";
}

function casePrimary(row) {
  return row.case_number || `Case #${row.case_id}`;
}

function programLine(row) {
  return [row.student_program, row.student_department].filter(Boolean).join(" · ");
}

function holdSourceLabel(row) {
  if (row.hold_source === "AUTOMATIC_APPROVE") {
    return `Automatic after UFM case approval (${casePrimary(row)})`;
  }
  if (row.hold_source === "MANUAL") {
    return `Manual result control for ${casePrimary(row)}`;
  }
  return casePrimary(row);
}

export default function ResultControlsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "result-hold";
  const canView = CAN_VIEW.has(user?.role);
  const canRelease = CAN_RELEASE.has(user?.role);
  const isResultHoldCategory = category === "result-hold";
  const isTranscriptCategory = category === "transcript-block";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [confirmHold, setConfirmHold] = useState(null);
  const categoryLabel =
    category === "result-hold"
      ? "Result Holds"
      : category === "transcript-block"
        ? "Transcript Blocks"
        : UFM_PENALTIES.find((penalty) => penalty.value === category)?.label ||
          "Result Controls";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const controls = await fetchResultControls();
      const list = Array.isArray(controls) ? controls : [];
      setItems(list);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Unable to load result holds. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      setError("Your role cannot view result holds.");
      return;
    }
    load();
  }, [canView]);

  useEffect(() => {
    if (!confirmHold) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setConfirmHold(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmHold]);

  useEffect(() => {
    setCategoryFilter("ALL");
  }, [category]);

  const categoryItems = useMemo(
    () =>
      items.filter((r) => {
        const recommendations = Array.isArray(r.recommended_penalties)
          ? r.recommended_penalties
          : [];
        const implemented = Array.isArray(r.implemented_penalties)
          ? r.implemented_penalties
          : [];
        if (isResultHoldCategory || isTranscriptCategory) return true;
        return [...recommendations, ...implemented].includes(category);
      }),
    [items, category, isResultHoldCategory, isTranscriptCategory]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return categoryItems.filter((r) => {
      if (isResultHoldCategory && categoryFilter !== "ALL") {
        if (r.result_status !== categoryFilter) return false;
      } else if (isTranscriptCategory && categoryFilter !== "ALL") {
        if (r.transcript_status !== categoryFilter) return false;
      } else if (!isResultHoldCategory && !isTranscriptCategory) {
        const matchesRecommendation =
          Array.isArray(r.recommended_penalties) &&
          r.recommended_penalties.includes(category);
        const matchesImplementation =
          Array.isArray(r.implemented_penalties) &&
          r.implemented_penalties.includes(category);
        if (
          (categoryFilter === "RECOMMENDED" && !matchesRecommendation) ||
          (categoryFilter === "IMPLEMENTED" && !matchesImplementation)
        ) {
          return false;
        }
      }
      if (!term) return true;
      const hay = [
        r.student_name,
        r.student_roll,
        r.student_program,
        r.student_department,
        r.case_number,
        String(r.case_id),
        r.reason,
        r.result_status,
        r.transcript_status,
        r.case_status,
        ...(r.recommended_penalties || []).map(penaltyLabel),
        ...(r.implemented_penalties || []).map(penaltyLabel),
        r.fine_amount == null ? "" : String(r.fine_amount),
        r.fine_paid ? "fine paid" : "fine unpaid",
        r.released_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [
    categoryItems,
    categoryFilter,
    category,
    isResultHoldCategory,
    isTranscriptCategory,
    query,
  ]);

  const selected =
    filtered.find((r) => r.id === selectedId) ||
    filtered[0] ||
    null;

  const heldCount = categoryItems.filter(
    (r) => r.result_status === "HELD"
  ).length;
  const releasedCount = categoryItems.filter(
    (r) => r.result_status === "RELEASED"
  ).length;
  const blockedTranscriptCount = categoryItems.filter(
    (r) => r.transcript_status === "BLOCKED"
  ).length;
  const allowedTranscriptCount = categoryItems.filter(
    (r) => r.transcript_status === "ALLOWED"
  ).length;
  const recommendedCount = categoryItems.filter(
    (r) => r.recommended_penalties?.includes(category)
  ).length;
  const implementedCount = categoryItems.filter(
    (r) => r.implemented_penalties?.includes(category)
  ).length;
  const filterOptions = isResultHoldCategory
    ? [
        { value: "ALL", label: `All (${categoryItems.length})` },
        { value: "HELD", label: `On Hold (${heldCount})` },
        { value: "RELEASED", label: `Released (${releasedCount})` },
      ]
    : isTranscriptCategory
      ? [
          { value: "ALL", label: `All (${categoryItems.length})` },
          { value: "BLOCKED", label: `Blocked (${blockedTranscriptCount})` },
          { value: "ALLOWED", label: `Allowed (${allowedTranscriptCount})` },
        ]
      : [
          { value: "ALL", label: `All (${categoryItems.length})` },
          { value: "RECOMMENDED", label: `Recommended (${recommendedCount})` },
          { value: "IMPLEMENTED", label: `Implemented (${implementedCount})` },
        ];
  const filterLabel = isResultHoldCategory
    ? "Filter result controls by result status"
    : isTranscriptCategory
      ? "Filter result controls by transcript status"
      : "Filter result controls by penalty implementation";

  async function confirmRelease() {
    if (!confirmHold || !canRelease) return;
    const id = confirmHold.id;
    setMessage("");
    setError("");
    setBusyId(id);
    try {
      const updated = await releaseResultControl(id);
      setMessage(
        `RESULT HOLD RELEASED — ${studentPrimary(confirmHold)} (${rollPrimary(
          confirmHold
        )}) · ${casePrimary(confirmHold)} · Result status: ${formatResultStatusLabel(
          updated?.result_status || "RELEASED"
        )}`
      );
      setConfirmHold(null);
      await load();
    } catch (err) {
      setError(err.message || "Unable to release result hold. Please try again.");
      setConfirmHold(null);
    } finally {
      setBusyId(null);
    }
  }

  async function recordFinePayment(row) {
    if (!row || busyId) return;
    setMessage("");
    setError("");
    setBusyId(row.id);
    try {
      await markResultControlFinePaid(row.id);
      setMessage(`Fine payment recorded for ${studentPrimary(row)} (${casePrimary(row)}).`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to record fine payment. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canView && !loading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Result holds are not available</p>
        <p className="mt-1">
          This administrative view is limited to Exam Department accounts.
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
        breadcrumb={`Home / Result Control / ${categoryLabel}`}
        title={categoryLabel}
        description={`Review ${categoryItems.length} matching result ${
          categoryItems.length === 1 ? "control" : "controls"
        }, including held and released records. Data reflects the recorded UFM case decisions and Exam Department implementation.`}
      />

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={`${categoryLabel} summary`}
      >
        {[
          {
            label: "Result controls",
            value: categoryItems.length,
            detail: "In this category",
            tone: "text-au-navy",
          },
          {
            label: "On hold",
            value: heldCount,
            detail: "Awaiting release",
            tone: "text-amber-700",
          },
          {
            label: "Released",
            value: releasedCount,
            detail: "Result hold cleared",
            tone: "text-emerald-700",
          },
          {
            label: "Transcript blocked",
            value: blockedTranscriptCount,
            detail: "Current transcript status",
            tone: "text-rose-700",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {metric.label}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <p className={`text-2xl font-bold tabular-nums ${metric.tone}`}>
                {metric.value}
              </p>
              <p className="text-xs text-slate-500">{metric.detail}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="block min-w-[16rem] flex-1 text-sm text-slate-600">
          <span className="sr-only">Search student, roll, or case</span>
          <input
            type="search"
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student / roll number / case ID"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={filterLabel}
        >
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategoryFilter(opt.value)}
              aria-pressed={categoryFilter === opt.value}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-inset",
                categoryFilter === opt.value
                  ? "bg-au-navy text-white ring-au-navy"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          title="Unable to load result holds."
          message={error}
          onRetry={load}
        />
      ) : null}
      {message ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <LoadingState
          compact
          title="Loading result controls…"
          detail="Retrieving holds linked to UFM cases and students."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No result-control records yet."
          detail="Records appear here when result controls are created from UFM case decisions."
          actions={
            <Link to="/app/cases" className="btn-secondary">
              View UFM cases
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No ${
            categoryFilter === "HELD"
              ? "on-hold"
              : categoryFilter === "RELEASED"
                ? "released"
                : categoryFilter === "BLOCKED"
                  ? "blocked"
                  : categoryFilter === "ALLOWED"
                    ? "allowed"
                    : categoryFilter === "RECOMMENDED"
                      ? "recommended"
                      : categoryFilter === "IMPLEMENTED"
                        ? "implemented"
                        : "matching"
          } records in ${categoryLabel.toLowerCase()}.`}
          detail={
            query
              ? "No records in this category match your search. Clear the search or change the result-status filter."
              : "Try another result-status filter or view all records in this category."
          }
          actions={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQuery("");
                setCategoryFilter("ALL");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="portal-split">
          <div className="portal-split-list min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-au-navy">
                Result controls ({filtered.length})
              </h2>
              <p className="text-xs text-slate-500">
                Select a student to see hold detail, source case, and release
                action.
              </p>
            </div>

            <div className="portal-data-cards">
              {filtered.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={[
                      "portal-case-card w-full text-left",
                      active ? "ring-2 ring-au-blue" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="portal-case-card-title truncate">
                          {studentPrimary(r)}
                        </p>
                        <p className="portal-case-card-meta">
                          Roll {rollPrimary(r)}
                          {programLine(r) ? ` · ${programLine(r)}` : ""}
                        </p>
                      </div>
                      <ResultStatusBadge status={r.result_status} />
                    </div>
                    <p className="portal-case-card-meta mt-2">
                      UFM {casePrimary(r)}
                      {r.case_status
                        ? ` · Case ${formatStatusLabel(r.case_status)}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-600">
                        Transcript: {formatStatusLabel(r.transcript_status)}
                      </span>
                      {r.result_status === "RELEASED" && r.released_at ? (
                        <span className="text-xs text-emerald-700">
                          Released {new Date(r.released_at).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="portal-table-wrap portal-table-desktop">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No.</th>
                    <th className="col-hide-md">Program / Dept</th>
                    <th>UFM Case</th>
                    <th className="col-hide-lg">Case Status</th>
                    <th>Result</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const active = selected?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={active ? "bg-sky-50/80" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className="font-semibold text-au-navy hover:underline"
                          >
                            {studentPrimary(r)}
                          </button>
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {rollPrimary(r)}
                        </td>
                        <td className="col-hide-md text-slate-600">
                          {programLine(r) || "—"}
                        </td>
                        <td>
                          <Link
                            to={`/app/cases/${r.case_id}`}
                            className="font-medium text-au-blue hover:underline"
                          >
                            {casePrimary(r)}
                          </Link>
                        </td>
                        <td className="col-hide-lg">
                          {r.case_status ? (
                            <StatusBadge status={r.case_status} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <ResultStatusBadge status={r.result_status} />
                            <span className="text-xs text-slate-600">
                              Transcript: {formatStatusLabel(r.transcript_status)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            aria-pressed={active}
                            className={[
                              "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-blue",
                              active
                                ? "border-au-blue bg-sky-100 text-au-navy"
                                : "border-slate-200 bg-white text-au-blue hover:border-au-blue hover:bg-sky-50",
                            ].join(" ")}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="portal-split-detail portal-card min-w-0 overflow-hidden">
            {selected ? (
              <>
                <div className="portal-panel-header">
                  <h2 className="portal-section-title">Result control</h2>
                  <ResultStatusBadge status={selected.result_status} />
                </div>
                <div className="portal-panel-body space-y-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Field label="Student">{studentPrimary(selected)}</Field>
                    <Field label="Roll number">{rollPrimary(selected)}</Field>
                    <Field label="Program">{selected.student_program || null}</Field>
                    <Field label="Department">
                      {selected.student_department || null}
                    </Field>
                    <Field label="UFM case">
                      <Link
                        to={`/app/cases/${selected.case_id}`}
                        className="text-au-blue hover:underline"
                      >
                        {casePrimary(selected)}
                      </Link>
                    </Field>
                    <Field label="Case status">
                      {selected.case_status
                        ? formatStatusLabel(selected.case_status)
                        : null}
                    </Field>
                    <Field label="Result status">
                      {formatResultStatusLabel(selected.result_status)}
                    </Field>
                    <Field label="Transcript">
                      {formatStatusLabel(selected.transcript_status)}
                    </Field>
                    <Field label="Hold reason">{selected.reason || null}</Field>
                    <Field label="Committee recommendations">
                      {selected.recommended_penalties?.length
                        ? selected.recommended_penalties
                            .map(penaltyLabel)
                            .join(", ")
                        : null}
                    </Field>
                    <Field label="Fine amount">
                      {selected.fine_amount != null
                        ? Number(selected.fine_amount).toFixed(2)
                        : null}
                    </Field>
                    <Field label="Fine payment">
                      {selected.recommended_penalties?.includes("FINE")
                        ? selected.fine_paid
                          ? "Paid"
                          : "Unpaid"
                        : null}
                    </Field>
                    <Field label="Implemented outcomes">
                      {selected.implemented_penalties?.length
                        ? selected.implemented_penalties
                            .map(penaltyLabel)
                            .join(", ")
                        : null}
                    </Field>
                    <Field label="Source">{holdSourceLabel(selected)}</Field>
                    <Field label="Placed by">
                      {selected.held_by_name ||
                        (selected.held_by != null
                          ? `User #${selected.held_by}`
                          : null)}
                    </Field>
                    <Field label="Placed at">
                      {selected.held_at
                        ? new Date(selected.held_at).toLocaleString()
                        : null}
                    </Field>
                    {selected.result_status === "RELEASED" ? (
                      <>
                        <Field label="Released by">
                          {selected.released_by_name ||
                            (selected.released_by != null
                              ? `User #${selected.released_by}`
                              : null)}
                        </Field>
                        <Field label="Released at">
                          {selected.released_at
                            ? new Date(selected.released_at).toLocaleString()
                            : null}
                        </Field>
                      </>
                    ) : null}
                  </dl>

                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p>
                      <strong className="text-slate-800">Case status</strong>{" "}
                      and <strong className="text-slate-800">result status</strong>{" "}
                      are separate. Approving a case places a hold; rejecting or
                      returning a case does not change an existing result
                      control by itself.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/app/cases/${selected.case_id}`}
                      className="btn-secondary btn-sm"
                    >
                      Open UFM case
                    </Link>
                    <Link to="/app/audit" className="btn-ghost btn-sm">
                      Audit history
                    </Link>
                    {selected.result_status === "HELD" &&
                    selected.recommended_penalties?.includes("FINE") &&
                    !selected.fine_paid &&
                    selected.case_status === "APPROVED" &&
                    selected.implemented_penalties?.includes("FINE") ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => recordFinePayment(selected)}
                        className="btn-secondary btn-sm"
                      >
                        {busyId === selected.id ? "…" : "Record Fine Paid"}
                      </button>
                    ) : null}
                    {selected.result_status === "HELD" && canRelease ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id || !selected.can_release}
                        onClick={() => setConfirmHold(selected)}
                        className="btn-danger btn-sm"
                      >
                        {busyId === selected.id
                          ? "…"
                          : "Release Result Hold"}
                      </button>
                    ) : null}
                    {selected.result_status === "HELD" && !selected.can_release ? (
                      <div className="w-full text-xs text-amber-800">
                        <p>
                          {selected.case_status !== "APPROVED"
                            ? "Release is available after the Exam Department completes implementation."
                            : selected.recommended_penalties?.includes("FINE") &&
                                !selected.fine_paid
                              ? "Record the fine payment before releasing this result hold."
                              : "Complete the implementation record before releasing this result hold."}
                        </p>
                        {selected.case_status === "APPROVED" &&
                        selected.recommended_penalties?.length &&
                        !selected.implemented_penalties?.length ? (
                          <Link
                            to={`/app/cases/${selected.case_id}`}
                            className="mt-1 inline-flex font-semibold text-au-blue underline"
                          >
                            Open case to record implementation
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                    {selected.result_status === "RELEASED" ? (
                      <span className="self-center text-xs font-medium text-slate-500">
                        Hold already released
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="px-5 py-8 text-sm text-slate-500">
                Select a student hold to view details.
              </div>
            )}
          </aside>
        </div>
      )}

      {confirmHold ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-hold-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
          >
            <h3
              id="release-hold-title"
              className="text-lg font-semibold text-au-navy"
            >
              Release result hold for this student?
            </h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="text-slate-400">Student: </span>
                <span className="font-semibold">{studentPrimary(confirmHold)}</span>
              </div>
              <div>
                <span className="text-slate-400">Roll number: </span>
                <span className="font-semibold">{rollPrimary(confirmHold)}</span>
              </div>
              <div>
                <span className="text-slate-400">UFM case: </span>
                <span className="font-semibold">{casePrimary(confirmHold)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Current status: </span>
                <ResultStatusBadge status={confirmHold.result_status} />
              </div>
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              This sets result status to Released and transcript to Allowed.
              Your name and timestamp are recorded for audit.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busyId === confirmHold.id}
                onClick={() => setConfirmHold(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === confirmHold.id}
                onClick={confirmRelease}
                className="btn-danger"
              >
                {busyId === confirmHold.id ? "Releasing…" : "Release Hold"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
