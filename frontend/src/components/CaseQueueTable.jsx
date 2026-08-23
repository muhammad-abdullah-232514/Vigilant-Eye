import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function CaseQueueTable({
  title,
  cases,
  emptyLabel = "No cases in this queue",
  actionLabel = "Open",
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-au-navy">{title}</h2>
        <Link to="/app/cases" className="text-xs font-semibold text-au-blue">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Case</th>
              <th className="px-4 py-2">Violation</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-au-navy">
                    {c.case_number}
                  </td>
                  <td className="px-4 py-2">{c.violation_type}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/app/cases/${c.id}`}
                      className="font-semibold text-au-blue hover:underline"
                    >
                      {actionLabel}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
