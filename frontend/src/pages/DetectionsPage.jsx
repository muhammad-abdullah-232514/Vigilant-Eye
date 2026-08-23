import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { fetchDetections } from "../services/api";

export default function DetectionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDetections(true);
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load detections");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Home / Detections & Alerts</p>
        <h1 className="text-2xl font-semibold text-au-navy">
          Detections & Alerts
        </h1>
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
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Confirmed</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    No confirmed detections.
                  </td>
                </tr>
              ) : (
                items.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{d.id}</td>
                    <td className="px-4 py-3 font-medium text-rose-600">
                      {d.detection_type}
                    </td>
                    <td className="px-4 py-3">
                      {(d.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      {d.is_confirmed ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {d.timestamp
                        ? new Date(d.timestamp).toLocaleString()
                        : "—"}
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
