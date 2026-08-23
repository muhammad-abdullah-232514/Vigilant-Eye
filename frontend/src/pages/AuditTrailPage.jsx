import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuditLogs } from "../services/api";

export default function AuditTrailPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAuditLogs();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load audit logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useMemo(() => {
    const set = new Set(items.map((i) => i.action));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (actionFilter && row.action !== actionFilter) return false;
      if (!q) return true;
      const hay = [
        row.action,
        row.entity_type,
        row.description,
        String(row.user_id ?? ""),
        String(row.entity_id ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, actionFilter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Home / Audit Trail</p>
          <h1 className="text-2xl font-semibold text-au-navy">Audit Trail</h1>
          <p className="mt-1 text-sm text-slate-600">
            Immutable activity log for cases, evidence, reviews, and holds.
            Available to HOD / DEC / Exam Dept / UFM Committee.
          </p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {filtered.length} of {items.length} events
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {String(error).toLowerCase().includes("forbidden") ||
          String(error).includes("403") ? (
            <p className="mt-1">
              Your role cannot view audit logs. Use a HOD/DEC/Exam/UFM demo
              account.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, action, ids…"
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
                      No audit events match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {row.timestamp
                          ? new Date(row.timestamp).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-au-navy">
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.entity_type}
                        {row.entity_id != null ? (
                          <>
                            {" "}
                            {row.entity_type === "ufm_case" ? (
                              <Link
                                to={`/app/cases/${row.entity_id}`}
                                className="font-medium text-au-blue"
                              >
                                #{row.entity_id}
                              </Link>
                            ) : (
                              <span>#{row.entity_id}</span>
                            )}
                          </>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.user_id ?? "—"}
                      </td>
                      <td className="max-w-md px-4 py-3 text-slate-700">
                        {row.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
