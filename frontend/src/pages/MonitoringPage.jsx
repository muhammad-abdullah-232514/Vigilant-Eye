import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCameras } from "../services/api";

export default function MonitoringPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCameras();
        if (!cancelled) setCameras(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load cameras");
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
        <p className="text-sm text-slate-500">Home / Live Monitoring</p>
        <h1 className="text-2xl font-semibold text-au-navy">Live Monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
            PROTOTYPE
          </span>{" "}
          Camera names from the API. Real RTSP / WebRTC video is FUTURE work.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading cameras...</p>
      ) : cameras.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No cameras registered. Add some via{" "}
          <code className="rounded bg-slate-100 px-1">POST /cameras</code> as an
          authorized role, then refresh.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((cam) => (
            <div
              key={cam.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black text-slate-400">
                <span className="text-sm">Simulated CCTV tile</span>
                <span
                  className={[
                    "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                    cam.is_active ? "bg-emerald-500" : "bg-rose-500",
                  ].join(" ")}
                >
                  {cam.is_active ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="font-semibold text-au-navy">{cam.name}</p>
                <p className="text-xs text-slate-500">{cam.camera_id}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Room DB id: {cam.room_id}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Related:{" "}
        <Link to="/app/detections" className="font-semibold text-au-blue">
          Detections & Alerts
        </Link>
      </p>
    </div>
  );
}
