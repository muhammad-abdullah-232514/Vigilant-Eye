import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCases,
  fetchClarifications,
  submitClarification,
} from "../services/api";

export default function ClarificationPage() {
  const [searchParams] = useSearchParams();
  const presetCaseId = searchParams.get("case_id") || "";
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    case_id: presetCaseId,
    statement: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [caseList, clarifications] = await Promise.all([
        fetchCases(),
        fetchClarifications(),
      ]);
      setCases(Array.isArray(caseList) ? caseList : []);
      setMine(Array.isArray(clarifications) ? clarifications : []);
      setForm((prev) => ({
        ...prev,
        case_id:
          prev.case_id ||
          presetCaseId ||
          (caseList?.[0]?.id ? String(caseList[0].id) : ""),
      }));
    } catch (err) {
      setError(err.message || "Failed to load clarification form");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [presetCaseId]);

  const selectedCase = useMemo(
    () => cases.find((c) => String(c.id) === String(form.case_id)),
    [cases, form.case_id]
  );

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.statement.trim().length < 10) {
      setError("Please write at least 10 characters for your explanation.");
      return;
    }
    setSubmitting(true);
    try {
      await submitClarification({
        case_id: Number(form.case_id),
        statement: form.statement.trim(),
      });
      setMessage("Clarification submitted. HOD and reporter were notified.");
      setForm((prev) => ({ ...prev, statement: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-slate-500">Home / Submit Clarification</p>
        <h1 className="text-2xl font-semibold text-au-navy">
          Submit Clarification
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Explain your side for an open UFM case. Responses are recorded in the
          audit trail.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {cases.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No cases linked to your student profile yet. Your portal account must
          be linked via <code>students.user_id</code>, then an invigilator
          creates a case for your roll (demo: <strong>DEMO001</strong>).
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Case</span>
            <select
              required
              value={form.case_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, case_id: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.violation_type} ({c.status})
                </option>
              ))}
            </select>
          </label>

          {selectedCase ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Status: <strong>{selectedCase.status}</strong> ·{" "}
              <Link
                to={`/app/cases/${selectedCase.id}`}
                className="font-semibold text-au-blue"
              >
                View case
              </Link>
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Your explanation
            </span>
            <textarea
              required
              rows={8}
              value={form.statement}
              onChange={(e) =>
                setForm((p) => ({ ...p, statement: e.target.value }))
              }
              placeholder="Describe what happened, any context, and supporting details..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-au-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Clarification"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/app/cases")}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to Cases
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-au-navy">My Clarifications</h2>
        </div>
        {mine.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">
            You have not submitted any clarifications yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mine.map((c) => (
              <li key={c.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-au-navy">
                    Case #{c.case_id} · {c.status}
                  </p>
                  <p className="text-xs text-slate-400">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleString()
                      : ""}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">
                  {c.statement}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
