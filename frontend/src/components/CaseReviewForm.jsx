import { Link } from "react-router-dom";
import { useState } from "react";
import EvidenceFileActions from "./EvidenceFileActions";
import FormSection from "./UfmFormSection";
import StatusBadge from "./StatusBadge";
import {
  evidenceSourceLabel,
  fileNameFromPath,
  formatCaseCreatedAt,
  formatEvidenceTypeLabel,
  formatReviewActionLabel,
  formatRoleLabel,
  formatStatusLabel,
  formatViolationLabel,
  reviewActorLabel,
} from "../config/casePresentation";
import {
  RECOVERED_MATERIALS,
  UFM_FORM_INSTITUTION,
  UFM_FORM_TITLE,
  recoveredMaterialLabel,
} from "../config/ufmOfficialForm";
import { penaltyLabel, UFM_PENALTIES } from "../config/ufmPenalties";
import {
  actionButtonHint,
  actionMeaning,
} from "../config/workflowPresentation";
import { submitClarification } from "../services/api";

function FormValue({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="portal-meta-label">{label}</dt>
      <dd className="portal-meta-value whitespace-pre-wrap">
        {children || "—"}
      </dd>
    </div>
  );
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : null;
}

export default function CaseReviewForm({
  caseData,
  evidence,
  reviews,
  user,
  stage,
  responsible,
  actions,
  actionOutcomes,
  remarks,
  setRemarks,
  signerName,
  setSignerName,
  signatureAck,
  setSignatureAck,
  actionError,
  busy,
  requestAction,
  canUploadEvidence,
  onError,
  isStudent,
  clarifications,
  onClarificationSubmitted,
}) {
  const [clarificationText, setClarificationText] = useState("");
  const [clarificationError, setClarificationError] = useState("");
  const [clarificationBusy, setClarificationBusy] = useState(false);
  const [recommendedPenalties, setRecommendedPenalties] = useState([]);
  const [implementationConfirmed, setImplementationConfirmed] = useState(false);
  const [fineAmount, setFineAmount] = useState("");
  const [finePaid, setFinePaid] = useState(false);
  const committeeDecision = [...reviews]
    .reverse()
    .find((review) => review.action === "APPROVE" && review.recommended_penalties);
  const isCommitteeDecision =
    user?.role === "UFM_COMMITTEE" &&
    caseData.status === "UFM_COMMITTEE_REVIEW" &&
    actions.includes("APPROVE");
  const isExamImplementation =
    user?.role === "EXAM_DEPARTMENT" &&
    actions.includes("IMPLEMENT") &&
    (caseData.status === "EXAM_DEPARTMENT_IMPLEMENTATION" ||
      (caseData.status === "APPROVED" &&
        committeeDecision?.recommended_penalties?.length > 0 &&
        !caseData.result_control?.implemented_penalties?.length));
  const committeePenalties = committeeDecision?.recommended_penalties || [];

  async function handleClarificationSubmit(event) {
    event.preventDefault();
    const statement = clarificationText.trim();
    setClarificationError("");
    if (statement.length < 10) {
      setClarificationError(
        "Please write at least 10 characters for your explanation."
      );
      return;
    }
    setClarificationBusy(true);
    let submitted = false;
    try {
      await submitClarification({
        case_id: Number(caseData.id),
        statement,
      });
      submitted = true;
      setClarificationText("");
      await onClarificationSubmitted();
    } catch (error) {
      setClarificationError(
        submitted
          ? "Your clarification was submitted, but the form could not refresh. Reload the case to see the latest record."
          : error.message || "Unable to submit clarification. Please try again."
      );
    } finally {
      setClarificationBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-sm border border-slate-400 bg-white shadow-sm print:border-black print:shadow-none">
      <header className="border-b-2 border-au-navy bg-slate-50 px-4 py-6 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-au-blue">
          {UFM_FORM_INSTITUTION}
        </p>
        <h2 className="mt-2 text-lg font-bold uppercase leading-snug text-au-navy sm:text-xl">
          {UFM_FORM_TITLE}
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          Case {caseData.case_number}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <StatusBadge status={caseData.status} />
          {responsible ? (
            <span className="self-center text-xs text-slate-600">
              Current review: {responsible}
            </span>
          ) : null}
        </div>
      </header>

      <FormSection letter="A" title="Student Information">
        <dl className="grid gap-3 sm:grid-cols-2">
          <FormValue label="Student name">{caseData.student_name}</FormValue>
          <FormValue label="Roll number">{caseData.student_roll}</FormValue>
          <FormValue label="Department">{caseData.student_department}</FormValue>
          <FormValue label="Program">{caseData.student_program}</FormValue>
        </dl>
      </FormSection>

      <FormSection letter="B" title="Incident / Examination Information">
        <dl className="grid gap-3 sm:grid-cols-2">
          <FormValue label="Course code">{caseData.exam_course_code}</FormValue>
          <FormValue label="Course name">{caseData.exam_course_name}</FormValue>
          <FormValue label="Semester">{caseData.exam_semester}</FormValue>
          <FormValue label="Exam date">{caseData.exam_date}</FormValue>
          <FormValue label="Start time">
            {formatTime(caseData.exam_start_time)}
          </FormValue>
          <FormValue label="End time">
            {formatTime(caseData.exam_end_time)}
          </FormValue>
          <FormValue label="Examination room">
            {[
              caseData.room_number ? `Room ${caseData.room_number}` : null,
              caseData.room_building,
            ]
              .filter(Boolean)
              .join(" · ")}
          </FormValue>
          <FormValue label="Camera">
            {caseData.camera_code || caseData.camera_name
              ? [caseData.camera_code, caseData.camera_name]
                  .filter(Boolean)
                  .join(" — ")
              : caseData.camera_id != null
                ? `Camera #${caseData.camera_id}`
                : "Not recorded"}
          </FormValue>
        </dl>
      </FormSection>

      <FormSection letter="C" title="Details of UFM Incident">
        <dl className="grid gap-3 sm:grid-cols-2">
          <FormValue label="Violation type">
            {formatViolationLabel(caseData.violation_type)}
          </FormValue>
          <FormValue label="Incident recorded">
            {caseData.created_at
              ? formatCaseCreatedAt(caseData.created_at)
              : null}
          </FormValue>
          <FormValue label="Description" className="sm:col-span-2">
            {caseData.description}
          </FormValue>
          <FormValue
            label="Original remarks / additional staff details"
            className="sm:col-span-2"
          >
            {caseData.remarks}
          </FormValue>
        </dl>
      </FormSection>

      <FormSection letter="D" title="Recovered / Confiscated Material">
        <ul className="grid gap-2 sm:grid-cols-2">
          {RECOVERED_MATERIALS.map(({ code }) => {
            const checked = caseData.recovered_materials?.includes(code);
            return (
              <li key={code} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(checked)}
                  disabled
                  readOnly
                  aria-label={`${recoveredMaterialLabel(code)}${checked ? ", selected" : ", not selected"}`}
                  className="mt-0.5"
                />
                <span>{recoveredMaterialLabel(code)}</span>
              </li>
            );
          })}
        </ul>
        {caseData.recovered_other_detail ? (
          <p className="mt-3 text-sm">
            <span className="font-semibold">Other material details: </span>
            {caseData.recovered_other_detail}
          </p>
        ) : null}
      </FormSection>

      <FormSection letter="E" title="Invigilator / Examination Staff Information">
        <dl className="grid gap-3 sm:grid-cols-2">
          <FormValue label="Reporting invigilator">
            {[caseData.reporter_name, !isStudent && caseData.reporter_email]
              .filter(Boolean)
              .join(" · ")}
          </FormValue>
          <FormValue label="Reported at">
            {caseData.created_at
              ? new Date(caseData.created_at).toLocaleString()
              : null}
          </FormValue>
        </dl>
      </FormSection>

      <FormSection letter="F" title="Supporting Evidence">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {evidence.length} evidence record{evidence.length === 1 ? "" : "s"}{" "}
            attached to this report.
          </p>
          <Link
            to={`/app/evidence?case_id=${caseData.id}`}
            className="text-xs font-semibold text-au-blue hover:underline print:hidden"
          >
            {canUploadEvidence ? "Manage evidence" : "View evidence"}
          </Link>
        </div>
        {evidence.length === 0 ? (
          <p className="text-sm text-slate-500">
            No evidence is attached to this case.
          </p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th className="col-hide-md">Source</th>
                  <th className="col-hide-lg">File</th>
                  <th>Captured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-au-navy">#{item.id}</td>
                    <td>{formatEvidenceTypeLabel(item.evidence_type)}</td>
                    <td className="col-hide-md cell-wrap text-xs text-slate-600">
                      {evidenceSourceLabel(item)}
                    </td>
                    <td
                      className="col-hide-lg cell-clip text-xs text-slate-600"
                      title={fileNameFromPath(item.file_path) || ""}
                    >
                      {fileNameFromPath(item.file_path) || "—"}
                    </td>
                    <td className="text-xs text-slate-500">
                      {item.timestamp
                        ? new Date(item.timestamp).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <EvidenceFileActions
                        evidenceId={item.id}
                        onError={onError}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection letter="G" title="Student Clarification">
        {clarifications.length === 0 ? (
          <p className="text-sm text-slate-500">
            No student clarification has been submitted for this case.
          </p>
        ) : (
          <ol className="space-y-3">
            {clarifications.map((clarification) => (
              <li
                key={clarification.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={clarification.status} />
                  <span className="text-xs text-slate-500">
                    {clarification.created_at
                      ? new Date(clarification.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                  {clarification.statement}
                </p>
              </li>
            ))}
          </ol>
        )}
        {isStudent && clarifications.length === 0 ? (
          <form className="mt-4 space-y-3" onSubmit={handleClarificationSubmit}>
            <p className="text-sm text-slate-600">
              You may submit one written explanation for this case. It will be
              added to the case form and shared with the reviewing staff.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Your explanation
              </span>
              <textarea
                rows={4}
                minLength={10}
                maxLength={5000}
                required
                value={clarificationText}
                onChange={(event) => setClarificationText(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Write your explanation (at least 10 characters)"
                disabled={clarificationBusy}
              />
            </label>
            {clarificationError ? (
              <p className="text-sm text-red-700" role="alert">
                {clarificationError}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn-primary"
              disabled={clarificationBusy}
            >
              {clarificationBusy ? "Submitting…" : "Submit clarification"}
            </button>
          </form>
        ) : isStudent ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
            Clarification submitted. You cannot submit another response for
            this case.
          </p>
        ) : null}
      </FormSection>

      {!isStudent ? (
      <>
      <FormSection letter="H" title="Recommendations / Committee Review">
        <p className="mb-3 text-sm text-slate-600">
          Current stage:{" "}
          <span className="font-semibold text-au-navy">
            {stage.statusLabel}
          </span>
          {" · "}
          Current responsibility:{" "}
          <span className="font-semibold text-au-navy">
            {stage.responsibility}
          </span>
        </p>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No role review remarks have been recorded yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-au-navy">
                    {formatReviewActionLabel(review.action)}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {formatRoleLabel(review.reviewer_role)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Reviewed by {reviewActorLabel(review)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                  {review.remarks || "No remarks entered for this action."}
                </p>
                {review.recommended_penalties?.length ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Committee-recommended penalties
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-amber-950">
                      {review.recommended_penalties.map((penalty) => (
                        <li key={penalty}>{penaltyLabel(penalty)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {review.signer_name ? (
                  <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    Digital sign-off:{" "}
                    <span className="font-semibold text-slate-800">
                      {review.signer_name}
                    </span>
                    {review.signed_at
                      ? ` · ${new Date(review.signed_at).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {stage.note ? (
          <p className="mt-3 text-xs text-slate-500">{stage.note}</p>
        ) : null}
      </FormSection>

      <FormSection
        letter="I"
        title="Remarks / Signatures / Submission"
        className="border-b-0"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Original invigilator sign-off
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {caseData.signer_name || caseData.reporter_name || "—"}
              {caseData.signed_at
                ? ` · ${new Date(caseData.signed_at).toLocaleString()}`
                : ""}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4 print:hidden">
            <p className="mb-3 text-sm text-slate-600">
              Reviewing as{" "}
              <span className="font-semibold text-slate-800">
                {user?.name || "Current user"}
              </span>{" "}
              ({formatRoleLabel(user?.role)}). Remarks and digital sign-off are
              recorded in this case&apos;s review history.
            </p>
            {actionError ? (
              <div
                id="case-review-action-error"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {actionError}
              </div>
            ) : null}
            {actions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No workflow actions are available for your role on this status.
                {stage.isFinal
                  ? " A final decision is already recorded."
                  : responsible
                    ? ` Current responsibility: ${responsible}.`
                    : ""}
              </p>
            ) : (
              <div className="space-y-3">
                {isCommitteeDecision ? (
                  <fieldset className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <legend className="px-1 text-sm font-semibold text-au-navy">
                      Committee recommended penalties
                    </legend>
                    <p className="mb-2 text-xs text-slate-600">
                      Select one or more outcomes. The Exam Department will record their implementation.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {UFM_PENALTIES.map(({ value, label }) => (
                        <label key={value} className="flex items-start gap-2 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={recommendedPenalties.includes(value)}
                            onChange={(event) => {
                              setRecommendedPenalties((current) =>
                                event.target.checked
                                  ? [...current, value]
                                  : current.filter((item) => item !== value)
                              );
                            }}
                            className="mt-0.5"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    {recommendedPenalties.length === 0 ? (
                      <p className="mt-2 text-xs text-rose-700">
                        Choose at least one outcome to enable Committee approval.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}

                {isExamImplementation ? (
                  <fieldset className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <legend className="px-1 text-sm font-semibold text-au-navy">
                      Exam Department implementation
                    </legend>
                    <p className="text-xs text-slate-700">
                      Committee decision to apply:
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
                      {committeePenalties.map((penalty) => (
                        <li key={penalty}>{penaltyLabel(penalty)}</li>
                      ))}
                    </ul>
                    <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={implementationConfirmed}
                        onChange={(event) =>
                          setImplementationConfirmed(event.target.checked)
                        }
                        className="mt-0.5"
                      />
                      <span>
                        I confirm the Exam Department has applied all listed outcomes.
                      </span>
                    </label>
                    {committeePenalties.includes("FINE") ? (
                      <div className="mt-3 space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Fine amount
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={fineAmount}
                            onChange={(event) => setFineAmount(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="flex items-start gap-2 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={finePaid}
                            onChange={(event) => setFinePaid(event.target.checked)}
                            className="mt-0.5"
                          />
                          <span>Fine has already been paid</span>
                        </label>
                        <p className="text-xs text-slate-600">
                          If unpaid, the result hold remains until payment is recorded in Result Controls.
                        </p>
                      </div>
                    ) : null}
                    {!implementationConfirmed ? (
                      <p className="mt-2 text-xs text-rose-700">
                        Confirm the implementation before completing this stage.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Your remarks / reason
                  </span>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Enter remarks to be added to the case form"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  />
                </label>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Digital sign-off
                  </p>
                  <p className="text-xs text-slate-500">
                    Required before submitting a review action.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Full name for digital sign-off
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={150}
                      value={signerName}
                      onChange={(event) => setSignerName(event.target.value)}
                      placeholder="Type your full name"
                      autoComplete="name"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      required
                      checked={signatureAck}
                      onChange={(event) => setSignatureAck(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I certify this review action and accept audit recording of
                      my name and timestamp.
                    </span>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {actionOutcomes.map(({ action, outcome }) => (
                    <button
                      key={action}
                      type="button"
                      disabled={
                        busy ||
                        (action === "APPROVE" &&
                          isCommitteeDecision &&
                          recommendedPenalties.length === 0) ||
                        (action === "IMPLEMENT" &&
                          isExamImplementation &&
                          (!implementationConfirmed ||
                            (committeePenalties.includes("FINE") &&
                              (!fineAmount || Number(fineAmount) <= 0))))
                      }
                      onClick={() =>
                        requestAction(
                          action,
                          action === "APPROVE" && isCommitteeDecision
                            ? { recommended_penalties: recommendedPenalties }
                            : action === "IMPLEMENT" && isExamImplementation
                              ? {
                                  implemented_penalties: committeePenalties,
                                  fine_amount: committeePenalties.includes("FINE")
                                    ? fineAmount
                                    : null,
                                  fine_paid: committeePenalties.includes("FINE")
                                    ? finePaid
                                    : false,
                                }
                              : {}
                        )
                      }
                      className={[
                        "portal-review-action rounded-lg px-4 py-3 text-left text-sm font-semibold text-white disabled:opacity-60",
                        action === "REJECT" || action === "RETURN"
                          ? "bg-rose-600 hover:bg-rose-500"
                          : action === "APPROVE"
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : "bg-au-navy hover:bg-sky-800",
                      ].join(" ")}
                    >
                      <span className="block">
                        {formatReviewActionLabel(action)}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-white/90">
                        {actionButtonHint(action, user?.role) ||
                          actionMeaning(action).slice(0, 72)}
                      </span>
                      {outcome ? (
                        <span className="mt-1 block text-[11px] font-normal text-white/80">
                          {action === "RETURN" ? (
                            <>
                              → {formatStatusLabel(outcome.nextStatus)}
                              {outcome.nextRole
                                ? ` · ${formatRoleLabel(outcome.nextRole)}`
                                : ""}
                            </>
                          ) : (
                            <>
                              → {formatStatusLabel(outcome.nextStatus)}
                              {outcome.nextRole
                                ? ` · ${formatRoleLabel(outcome.nextRole)}`
                                : ""}
                            </>
                          )}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {caseData.result_control ? (
        <FormSection letter="J" title="Exam Department Implementation / Result Control">
          <dl className="grid gap-3 sm:grid-cols-2">
            <FormValue label="Result status">
              {formatStatusLabel(caseData.result_control.result_status)}
            </FormValue>
            <FormValue label="Transcript status">
              {formatStatusLabel(caseData.result_control.transcript_status)}
            </FormValue>
            <FormValue label="Implemented outcomes" className="sm:col-span-2">
              {caseData.result_control.implemented_penalties?.length
                ? caseData.result_control.implemented_penalties
                    .map(penaltyLabel)
                    .join("; ")
                : "Awaiting Exam Department implementation"}
            </FormValue>
            {committeePenalties.includes("FINE") ? (
              <>
                <FormValue label="Fine amount">
                  {caseData.result_control.fine_amount != null
                    ? Number(caseData.result_control.fine_amount).toFixed(2)
                    : "Not recorded"}
                </FormValue>
                <FormValue label="Fine payment">
                  {caseData.result_control.fine_paid ? "Paid" : "Unpaid"}
                </FormValue>
              </>
            ) : null}
            {!caseData.result_control.can_release ? (
              <p className="text-sm text-amber-800 sm:col-span-2">
                Result release is waiting for Exam Department implementation
                {committeePenalties.includes("FINE")
                  ? " and fine payment."
                  : "."}
              </p>
            ) : caseData.result_control.result_status === "RELEASED" ? (
              <p className="text-sm text-emerald-800 sm:col-span-2">
                The Exam Department has released the result hold.
              </p>
            ) : (
              <p className="text-sm text-sky-800 sm:col-span-2">
                Implementation conditions are satisfied. The Exam Department
                may now release the result hold.
              </p>
            )}
          </dl>
        </FormSection>
      ) : null}
      </>
      ) : null}
    </article>
  );
}
