export default function KpiCard({ title, value, hint, accent = "border-l-au-blue" }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 ${accent} bg-white p-4 shadow-sm`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-au-navy">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
