import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import {
  formatViolationLabel,
  violationLabelClass,
} from "../config/casePresentation";
import {
  CASE_CREATE_ROLES,
  DETECTION_ROLES,
  roleIn,
} from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  fetchDetections,
  markAllDetectionsSeen,
  markDetectionSeen,
} from "../services/api";

/** C26-FIX: detections and case creation are Invigilator-only. */
export default function DetectionsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedDetectionId = searchParams.get("detection_id");
  const canView = roleIn(user?.role, DETECTION_ROLES);
  const canCreateCase = roleIn(user?.role, CASE_CREATE_ROLES);
  const { refreshDetectionsBadge, detectionAlertVersion } =
    useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | new

  const unseenCount = useMemo(
    () => items.filter((d) => !d.is_seen).length,
    [items]
  );

  const visible = useMemo(() => {
    if (filter === "new") return items.filter((d) => !d.is_seen);
    return items;
  }, [items, filter]);

  async function load({ silent = false } = {}) {
    if (!canView) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await fetchDetections(true);
      setItems(Array.isArray(data) ? data : []);
      if (refreshDetectionsBadge) await refreshDetectionsBadge();
    } catch {
      if (!silent) setError("Unable to load detections. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return undefined;
    }
    load();
    const timer = setInterval(() => load({ silent: true }), 4000);
    const onFocus = () => load({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!canView || !detectionAlertVersion) return undefined;
    const timer = setTimeout(() => load({ silent: true }), 350);
    return () => clearTimeout(timer);
    // load uses current auth/context and intentionally runs only for a new alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, detectionAlertVersion]);

  useEffect(() => {
    if (!focusedDetectionId || loading) return;
    const target = document.querySelector(
      `[data-detection-id="${focusedDetectionId}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedDetectionId, loading, items]);

  async function refreshBadge() {
    if (refreshDetectionsBadge) await refreshDetectionsBadge();
  }

  async function onMarkSeen(id) {
    try {
      await markDetectionSeen(id);
      setItems((prev) =>
        prev.map((d) => (d.id === id ? { ...d, is_seen: true } : d))
      );
      await refreshBadge();
    } catch {
      setError("Unable to mark detection as seen. Please try again.");
    }
  }

  async function onMarkAllSeen() {
    try {
      await markAllDetectionsSeen();
      setItems((prev) => prev.map((d) => ({ ...d, is_seen: true })));
      await refreshBadge();
    } catch {
      setError("Unable to mark all detections as seen. Please try again.");
    }
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Detections are not available</p>
        <p className="mt-1">
          Detection alerts are limited to invigilators and authorized monitoring
          staff. This screen is not part of the student portal.
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
    <div className="detections-page space-y-4">
      <PageHeader
        breadcrumb="Home / Detections & Alerts"
        title="Detections & Alerts"
        description={
          unseenCount > 0
            ? `Confirmed detection alerts for examination monitoring · ${unseenCount} unseen.`
            : "Confirmed detection alerts for examination monitoring."
        }
        actions={
          <>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter detections"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All alerts</option>
              <option value="new">Unseen only</option>
            </select>
            <button
              type="button"
              disabled={unseenCount === 0}
              onClick={onMarkAllSeen}
              className="btn-secondary"
            >
              Mark all seen
            </button>
            {canCreateCase ? (
              <>
                <Link to="/app/monitoring" className="btn-secondary">
                  Live Monitoring
                </Link>
                <Link to="/app/cases/new" className="btn-primary">
                  Report UFM Incident
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {error ? (
        <ErrorBanner
          title="Unable to load detections."
          message={error}
          onRetry={() => load()}
        />
      ) : null}

      <div className="detections-table-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <LoadingState
            compact
            title="Loading detections…"
            detail="Retrieving confirmed detection alerts."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              filter === "new"
                ? "No unseen detections."
                : "No confirmed detections."
            }
            detail={
              <>
                Start a session on{" "}
                <Link
                  to="/app/monitoring"
                  className="font-semibold text-au-blue"
                >
                  Live Monitoring
                </Link>{" "}
                to capture incidents.
              </>
            }
          />
        ) : (
          <>
            <div className="portal-data-cards">
              {visible.map((d) => {
                const isNew = !d.is_seen;
                return (
                  <div
                    key={d.id}
                    className={[
                      "portal-case-card",
                      isNew ? "ring-1 ring-rose-200 bg-rose-50/40" : "",
                      String(d.id) === focusedDetectionId
                        ? "ring-2 ring-au-blue bg-sky-50 shadow-md"
                        : "",
                    ].join(" ")}
                    data-affordance="static"
                    data-detection-id={d.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="portal-case-card-title">
                        <span className={violationLabelClass(d.detection_type)}>
                          {formatViolationLabel(d.detection_type)}
                        </span>
                      </p>
                      {isNew ? (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          New
                        </span>
                      ) : (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          Seen
                        </span>
                      )}
                    </div>
                    <p className="portal-case-card-meta">
                      #{d.id} · {(Number(d.confidence || 0) * 100).toFixed(1)}%
                      {d.camera_id != null ? ` · Camera ${d.camera_id}` : ""}
                    </p>
                    <p className="portal-case-card-meta">
                      {d.timestamp
                        ? new Date(d.timestamp).toLocaleString()
                        : "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {isNew ? (
                        <button
                          type="button"
                          onClick={() => onMarkSeen(d.id)}
                          className="text-xs font-semibold text-slate-600 hover:underline"
                        >
                          Mark seen
                        </button>
                      ) : null}
                      <Link
                        to={`/app/evidence?detection_id=${d.id}`}
                        className="text-xs font-semibold text-au-blue hover:underline"
                      >
                        View
                      </Link>
                      {canCreateCase ? (
                        <Link
                          to={`/app/cases/new?detection_id=${d.id}`}
                          onClick={() => {
                            if (isNew) onMarkSeen(d.id);
                          }}
                          className="text-xs font-semibold text-au-blue hover:underline"
                        >
                          File case
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="portal-table-wrap portal-table-desktop">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>ID</th>
                    <th>Type</th>
                    <th className="col-hide-md">Confidence</th>
                    <th className="col-hide-lg">Camera</th>
                    <th className="col-hide-sm">Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const isNew = !d.is_seen;
                    return (
                      <tr
                        key={d.id}
                        data-detection-id={d.id}
                        className={[
                          isNew ? "bg-rose-50/50" : "",
                          String(d.id) === focusedDetectionId
                            ? "detection-focused-row"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td>
                          {isNew ? (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              New
                            </span>
                          ) : (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                              Seen
                            </span>
                          )}
                        </td>
                        <td>{d.id}</td>
                        <td className="font-medium text-au-navy">
                          <span className={violationLabelClass(d.detection_type)}>
                            {formatViolationLabel(d.detection_type)}
                          </span>
                          {!d.is_confirmed ? (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                              review
                            </span>
                          ) : null}
                        </td>
                        <td className="col-hide-md">
                          <div className="detection-confidence">
                            <span>
                              {(Number(d.confidence || 0) * 100).toFixed(1)}%
                            </span>
                            <span className="detection-confidence-track">
                              <span
                                className="detection-confidence-fill"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, Number(d.confidence || 0) * 100)
                                  )}%`,
                                }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="col-hide-lg text-slate-600">
                          {d.camera_id ?? "—"}
                        </td>
                        <td className="col-hide-sm text-xs text-slate-500">
                          {d.timestamp
                            ? new Date(d.timestamp).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          <div className="detection-actions flex flex-wrap gap-2">
                              {isNew ? (
                                <button
                                  type="button"
                                  onClick={() => onMarkSeen(d.id)}
                                  className="detection-action detection-action-muted"
                                >
                                  Mark seen
                                </button>
                              ) : null}
                              <Link
                                to={`/app/evidence?detection_id=${d.id}`}
                                className="detection-action"
                              >
                                View
                              </Link>
                              {canCreateCase ? (
                                <Link
                                  to={`/app/cases/new?detection_id=${d.id}`}
                                  onClick={() => {
                                    if (isNew) onMarkSeen(d.id);
                                  }}
                                  className="detection-action detection-action-primary"
                                >
                                  File case
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

    </div>
  );
}
