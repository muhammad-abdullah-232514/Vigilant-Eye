const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-sky-100 text-sky-800",
  HOD_VERIFICATION: "bg-yellow-100 text-yellow-800",
  DEC_REVIEW: "bg-violet-100 text-violet-800",
  EXAM_DEPARTMENT_REVIEW: "bg-indigo-100 text-indigo-800",
  UFM_COMMITTEE_REVIEW: "bg-fuchsia-100 text-fuchsia-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  HELD: "bg-amber-100 text-amber-800",
  RELEASED: "bg-emerald-100 text-emerald-800",
  BLOCKED: "bg-rose-100 text-rose-800",
  ALLOWED: "bg-emerald-100 text-emerald-800",
  SUBMITTED: "bg-sky-100 text-sky-800",
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {(status || "UNKNOWN").replaceAll("_", " ")}
    </span>
  );
}
