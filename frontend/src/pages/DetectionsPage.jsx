import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Home / Detections & Alerts</p>
          <h1 className="text-2xl font-semibold text-au-navy">
            Detections & Alerts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Confirmed AI alerts from live monitoring or offline validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/monitoring"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Live Monitoring
          </Link>
          <Link
            to="/app/cases/new"
            className="rounded-lg bg-au-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Create Case
          </Link>
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
        ) : items.length === 0 ? (
          <div className="space-y-2 p-6 text-sm text-slate-600">
            <p className="font-semibold text-au-navy">No confirmed detections</p>
            <p>
              Demo tip: open{" "}
              <Link to="/app/monitoring" className="font-semibold text-au-blue">
                Live Monitoring
              </Link>
              , click <strong>Demo: sample clip + detect</strong> (Persist on),
              wait for UFM labels, then refresh this page.
            </p>
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Camera</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{d.id}</td>
                  <td className="px-4 py-3 font-medium text-rose-600">
                    {d.detection_type}
                  </td>
                  <td className="px-4 py-3">
                    {(d.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.camera_id ?? "—"}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-xs text-slate-500">
                    {d.source_path || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.timestamp
                      ? new Date(d.timestamp).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/app/cases/new"
                      className="text-xs font-semibold text-au-blue hover:underline"
                    >
                      File case
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
