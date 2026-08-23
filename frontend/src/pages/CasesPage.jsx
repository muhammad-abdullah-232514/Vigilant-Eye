import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { fetchCases } from "../services/api";

export default function CasesPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCases();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load cases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((c) => c.status === statusFilter);
  }, [items, statusFilter]);

  const statuses = useMemo(() => {
    const set = new Set(items.map((c) => c.status));
    return [...set].sort();
  }, [items]);

  function onStatusChange(value) {
    if (!value) {
      setSearchParams({});
    } else {
      setSearchParams({ status: value });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Home / Cases</p>
          <h1 className="text-2xl font-semibold text-au-navy">
            {isStudent ? "My UFM Cases" : "UFM Cases"}
          </h1>
          {statusFilter ? (
            <p className="mt-1 text-sm text-slate-600">
              Filtered by status:{" "}
              <span className="font-semibold text-au-navy">{statusFilter}</span>
            </p>
          ) : null}
          {isStudent ? (
            <p className="mt-1 text-sm text-slate-500">
              Showing cases linked to your student profile (roll DEMO001).
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Status
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {isStudent ? (
            <Link
              to="/app/clarification"
              className="rounded-lg bg-au-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Submit Clarification
            </Link>
          ) : (
            <Link
              to="/app/cases/new"
              className="rounded-lg bg-au-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Create Case
            </Link>
          )}
        </div>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Case No.</th>
                <th className="px-4 py-3">Violation</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No cases{statusFilter ? ` with status ${statusFilter}` : ""}.
                    {isStudent
                      ? " Create a case for roll DEMO001 while logged in as invigilator."
                      : ""}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-au-navy">
                      {c.case_number}
                    </td>
                    <td className="px-4 py-3">{c.violation_type}</td>
                    <td className="px-4 py-3">{c.student_id}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/cases/${c.id}`}
                        className="font-semibold text-au-blue hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
