import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCase, fetchExams, fetchStudents } from "../services/api";

const VIOLATION_TYPES = [
  "MOBILE_PHONE",
  "SMART_WATCH",
  "NOTES_PAPER",
  "ELECTRONIC_GADGET",
  "SUSPICIOUS_OBJECT",
  "OTHER",
];

export default function CreateCasePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    student_id: "",
    exam_id: "",
    violation_type: "MOBILE_PHONE",
    description: "",
    remarks: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, e] = await Promise.all([fetchStudents(), fetchExams()]);
        if (cancelled) return;
        setStudents(Array.isArray(s) ? s : []);
        setExams(Array.isArray(e) ? e : []);
        const demoStudent = (s || []).find((st) => st.student_id === "DEMO001");
        setForm((prev) => ({
          ...prev,
          student_id: demoStudent
            ? String(demoStudent.id)
            : s?.[0]?.id
              ? String(s[0].id)
              : "",
          exam_id: e?.[0]?.id ? String(e[0].id) : "",
        }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load form data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const created = await createCase({
        student_id: Number(form.student_id),
        exam_id: Number(form.exam_id),
        violation_type: form.violation_type,
        description: form.description.trim(),
        remarks: form.remarks.trim() || null,
      });
      navigate(`/app/cases/${created.id}`);
    } catch (err) {
      setError(err.message || "Could not create case");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading form...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm text-slate-500">Home / Cases / Create</p>
        <h1 className="text-2xl font-semibold text-au-navy">Create UFM Case</h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {students.length === 0 || exams.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least one student and one exam in the database before creating
          a case. Add them via API/Postman if lists are empty.
        </div>
      ) : (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Demo tip: prefer student roll <strong>DEMO001</strong> so{" "}
          <code>student@demo.com</code> can see the case and submit a
          clarification.
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Student</span>
          <select
            name="student_id"
            required
            value={form.student_id}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_id} — {s.name} ({s.department})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Exam</span>
          <select
            name="exam_id"
            required
            value={form.exam_id}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.course_code} — {e.course_name} ({e.exam_date})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Violation type
          </span>
          <select
            name="violation_type"
            value={form.violation_type}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
          >
            {VIOLATION_TYPES.map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </span>
          <textarea
            name="description"
            required
            rows={4}
            value={form.description}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
            placeholder="Describe the incident..."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Remarks (optional)
          </span>
          <textarea
            name="remarks"
            rows={2}
            value={form.remarks}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5"
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !students.length || !exams.length}
            className="rounded-xl bg-au-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Case"}
          </button>
          <Link
            to="/app/cases"
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
