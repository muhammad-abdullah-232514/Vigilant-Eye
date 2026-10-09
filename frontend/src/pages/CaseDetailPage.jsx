import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import CaseReviewForm from "../components/CaseReviewForm";
import {
  buildCaseTimeline,
  formatReviewActionLabel,
  formatRoleLabel,
  formatCaseCreatedAt,
  formatStatusLabel,
  responsibleLabelForStatus,
} from "../config/casePresentation";
import { availableReviewActions } from "../config/reviewActions";
import { homePathForRole } from "../config/roleHome";
import {
  EVIDENCE_UPLOAD_ROLES,
  roleIn,
} from "../config/roleAccess";
import {
  currentStageSummary,
  resolveReviewOutcome,
} from "../config/workflowPresentation";
import { useAuth } from "../context/AuthContext";
import {
  createCaseReview,
  fetchCase,
  fetchCaseReviews,
  fetchClarifications,
  fetchEvidence,
} from "../services/api";

function Field({ label, children }) {
  return (
    <div>
      <dt className="portal-meta-label">{label}</dt>
      <dd className="portal-meta-value">{children || "—"}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="portal-card p-5">
      <h2 className="mb-3 text-base font-semibold text-au-navy">{title}</h2>
      {children}
    </section>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";
  const canUploadEvidence = roleIn(user?.role, EVIDENCE_UPLOAD_ROLES);
  const [caseData, setCaseData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [clarifications, setClarifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [remarks, setRemarks] = useState("");
  const [signerName, setSignerName] = useState(user?.name || "");
  const [signatureAck, setSignatureAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reviewPayload, setReviewPayload] = useState({});
  const reviewDialogRef = useRef(null);
  const reviewCancelRef = useRef(null);
  const previouslyFocused = useRef(null);

  function leaveAfterReviewAction() {
    const from = location.state?.from;
    if (typeof from === "string" && from.startsWith("/app")) {
      navigate(from, { replace: true });
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(homePathForRole(user?.role), { replace: true });
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const casePromise = fetchCase(caseId);
      const evidencePromise = fetchEvidence(caseId);
      const clarPromise = fetchClarifications(caseId).catch(() => []);
      const reviewsPromise = isStudent
        ? Promise.resolve([])
        : fetchCaseReviews(caseId);

      const [c, r, e, clar] = await Promise.all([
        casePromise,
        reviewsPromise,
        evidencePromise,
        clarPromise,
      ]);
      setCaseData(c);
      setReviews(Array.isArray(r) ? r : []);
      setEvidence(Array.isArray(e) ? e : []);
      setClarifications(Array.isArray(clar) ? clar : []);
    } catch {
      setError("Unable to load this UFM case. Please try again.");
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshClarifications() {
    const rows = await fetchClarifications(caseId);
    setClarifications(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, isStudent]);

  useEffect(() => {
    if (user?.name) setSignerName((prev) => prev || user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!confirmAction) return undefined;
    previouslyFocused.current = document.activeElement;
    const panel = reviewDialogRef.current;
    const cancelBtn = reviewCancelRef.current;
    const focusTimer = window.setTimeout(() => cancelBtn?.focus(), 0);

    function onKey(e) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        setConfirmAction(null);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusable).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [confirmAction, busy]);

  const actions = caseData
    ? availableReviewActions(user?.role, caseData.status)
    : [];

  const timeline = useMemo(
    () =>
      buildCaseTimeline({
        caseData,
        reviews,
        evidence,
        clarifications,
        includeReviews: !isStudent,
        includeEvidence: true,
        includeClarifications: true,
        includeCreateSignOff: !isStudent,
        includeReporterDetail: !isStudent,
        includeResponsibleDetail: !isStudent,
      }),
    [caseData, reviews, evidence, clarifications, isStudent]
  );

  async function runAction(action) {
    setActionError("");
    if (!signatureAck || signerName.trim().length < 2) {
      setActionError("Digital sign-off (name + acknowledgment) is required.");
      setConfirmAction(null);
      return;
    }
    setBusy(true);
    try {
      await createCaseReview(caseId, {
        action,
        ...reviewPayload,
        remarks: remarks.trim() || `${action} from portal`,
        signer_name: signerName.trim(),
        signature_ack: true,
      });
      setRemarks("");
      setSignatureAck(false);
      setConfirmAction(null);
      setReviewPayload({});
      if (action === "FORWARD" || action === "RETURN") {
        leaveAfterReviewAction();
        return;
      }
      await load();
    } catch (err) {
      setActionError(err.message || "Review action failed. Please try again.");
      setConfirmAction(null);
      setReviewPayload({});
    } finally {
      setBusy(false);
    }
  }

  function requestAction(action, payload = {}) {
    setActionError("");
    if (!signerName.trim() || !signatureAck) {
      setActionError(
        "Complete digital sign-off (typed name and acknowledgment) before continuing."
      );
      requestAnimationFrame(() => {
        document
          .getElementById("case-review-action-error")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setReviewPayload(payload);
    setConfirmAction(action);
  }

  if (loading) {
    return <LoadingState label="Loading UFM case…" />;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorBanner title="Unable to load UFM case." message={error} onRetry={load} />
        <Link to="/app/cases" className="btn-ghost">
          ← Back to cases
        </Link>
      </div>
    );
  }

  if (!caseData) return null;

  const responsible = responsibleLabelForStatus(caseData.status);
  const stage = currentStageSummary(caseData.status);
  const confirmLabel = confirmAction
    ? formatReviewActionLabel(confirmAction)
    : "";
  const confirmOutcome =
    confirmAction && user?.role
      ? resolveReviewOutcome(user.role, caseData.status, confirmAction)
      : null;
  const actionOutcomes = actions.map((action) => ({
    action,
    outcome: resolveReviewOutcome(user?.role, caseData.status, action),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        breadcrumb={`Home / ${isStudent ? "My Cases" : "Cases"} / ${caseData.case_number}`}
        title={caseData.case_number}
        description={
          !isStudent && responsible
            ? `Current review responsibility: ${responsible}`
            : "Case identity, evidence, workflow history, and available actions."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={caseData.status} />
            <Link to="/app/cases" className="btn-secondary btn-sm">
              Back to list
            </Link>
          </div>
        }
      />

      {location.state?.evidenceUploadWarning ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p>{location.state.evidenceUploadWarning}</p>
          <Link
            to={`/app/evidence?case_id=${caseData.id}`}
            className="mt-2 inline-flex font-semibold text-au-blue hover:underline"
          >
            Open Evidence Library
          </Link>
        </div>
      ) : null}

      {/* CASE IDENTITY */}
      <div className="portal-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Case identity
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={caseData.status} />
              {!isStudent && responsible ? (
                <span className="text-xs text-slate-600">
                  Current review:{" "}
                  <span className="font-semibold text-slate-800">
                    {responsible}
                  </span>
                </span>
              ) : null}
            </div>
            <dl className="portal-meta-grid mt-4">
              <Field label="Created">
                {caseData.created_at
                  ? formatCaseCreatedAt(caseData.created_at)
                  : null}
              </Field>
              <Field label="Last updated">
                {caseData.updated_at
                  ? new Date(caseData.updated_at).toLocaleString()
                  : null}
              </Field>
              {!isStudent ? (
                <Field label="Reported by">
                  {caseData.reporter_name || null}
                </Field>
              ) : null}
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            {isStudent ? (
              <span className="text-sm text-slate-600">
                Student clarification is available on the UFM form below.
              </span>
            ) : (
              <Link
                to={`/app/evidence?case_id=${caseData.id}`}
                className="btn-secondary"
              >
                {canUploadEvidence ? "Manage evidence" : "View evidence"}
              </Link>
            )}
          </div>
        </div>
      </div>

      <CaseReviewForm
        caseData={caseData}
        evidence={evidence}
        reviews={reviews}
        user={user}
        stage={stage}
        responsible={isStudent ? null : responsible}
        actions={actions}
        actionOutcomes={actionOutcomes}
        remarks={remarks}
        setRemarks={setRemarks}
        signerName={signerName}
        setSignerName={setSignerName}
        signatureAck={signatureAck}
        setSignatureAck={setSignatureAck}
        actionError={actionError}
        busy={busy}
        requestAction={requestAction}
        canUploadEvidence={canUploadEvidence}
        onError={setActionError}
        isStudent={isStudent}
        clarifications={clarifications}
        onClarificationSubmitted={refreshClarifications}
      />

      <Section title="Case timeline">
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline events available.</p>
        ) : (
          <ol className="relative ml-2 space-y-0 border-l border-slate-200">
            {timeline.map((ev) => (
              <li key={ev.id} className="relative pb-5 pl-5 last:pb-0">
                <span
                  className={[
                    "absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white",
                    ev.current ? "bg-au-navy" : "bg-slate-300",
                  ].join(" ")}
                />
                <p className="text-sm font-semibold text-au-navy">{ev.title}</p>
                {ev.detail ? (
                  <p className="mt-0.5 text-sm text-slate-600">{ev.detail}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-slate-400">
                  {ev.at ? new Date(ev.at).toLocaleString() : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Confirmation dialog */}
      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={reviewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-review-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
          >
            <h3
              id="confirm-review-title"
              className="text-lg font-semibold text-au-navy"
            >
              {confirmLabel} UFM Case {caseData.case_number}?
            </h3>
            {confirmOutcome ? (
              <p className="mt-2 text-sm text-slate-600">
                {confirmOutcome.meaning}
              </p>
            ) : null}
            <dl className="mt-3 space-y-1 text-sm text-slate-600">
              <div>
                <span className="text-slate-400">Action: </span>
                <span className="font-semibold text-slate-800">
                  {confirmLabel}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Case: </span>
                <span className="font-semibold text-slate-800">
                  {caseData.case_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Current status: </span>
                {formatStatusLabel(caseData.status)}
              </div>
              {confirmOutcome ? (
                <>
                  <div>
                    <span className="text-slate-400">After this action: </span>
                    <span className="font-semibold text-slate-800">
                      {formatStatusLabel(confirmOutcome.nextStatus)}
                      {confirmOutcome.isFinal ? " (final)" : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Next responsible: </span>
                    <span className="font-semibold text-slate-800">
                      {confirmOutcome.nextRole
                        ? formatRoleLabel(confirmOutcome.nextRole)
                        : "None — workflow complete"}
                    </span>
                  </div>
                </>
              ) : null}
              <div>
                <span className="text-slate-400">Performed by: </span>
                {signerName.trim()} ({formatRoleLabel(user?.role)})
              </div>
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              The reporter and linked student receive a status notification.
              Digital sign-off is stored for audit.
            </p>
            {remarks.trim() ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold">Remarks: </span>
                {remarks.trim()}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                No remarks entered — a default audit note will be stored.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={reviewCancelRef}
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(confirmAction)}
                className={[
                  confirmAction === "REJECT" || confirmAction === "RETURN"
                    ? "btn-danger"
                    : confirmAction === "APPROVE"
                      ? "btn-success"
                      : "btn-primary",
                ].join(" ")}
              >
                {busy ? "Submitting…" : `Confirm ${confirmLabel}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
