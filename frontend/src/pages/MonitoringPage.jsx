/**
 * Live Monitoring — FYP demo page.
 * Webcam / sample clip / RTSP via backend MJPEG + optional YOLO + DB persist.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCameras,
  fetchLiveStatus,
  liveMjpegUrl,
  startLiveCamera,
  stopLiveCamera,
} from "../services/api";

const SAMPLE_CLIP = "ai/samples/sample_exam_clip.mp4";

export default function MonitoringPage() {
  const [cameras, setCameras] = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [detectById, setDetectById] = useState({});
  const [persistById, setPersistById] = useState({});
  const [overrideById, setOverrideById] = useState({});
  const [streamKey, setStreamKey] = useState({});
  const [toast, setToast] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchLiveStatus();
      const map = {};
      for (const s of status.sessions || []) {
        map[s.camera_id] = s;
      }
      setSessions(map);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCameras();
        if (!cancelled) setCameras(Array.isArray(data) ? data : []);
        await refreshStatus();
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load cameras");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  useEffect(() => {
    const id = setInterval(refreshStatus, 2500);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const activeCount = useMemo(
    () => Object.values(sessions).filter((s) => s.running).length,
    [sessions]
  );

  const sampleCam = useMemo(
    () =>
      cameras.find((c) =>
        String(c.stream_url || "").includes("sample_exam_clip")
      ) || cameras[0],
    [cameras]
  );

  async function handleStart(cam, sourceOverride = null, opts = {}) {
    setBusyId(cam.id);
    setError("");
    setToast("");
    try {
      const detect =
        opts.detect !== undefined
          ? opts.detect
          : detectById[cam.id] !== false;
      const persist =
        opts.persist !== undefined
          ? opts.persist
          : Boolean(persistById[cam.id]);
      const override =
        sourceOverride ??
        (overrideById[cam.id] || "").trim() ||
        null;
      const res = await startLiveCamera(cam.id, {
        detect,
        persist,
        source_override: override,
      });
      setStreamKey((p) => ({ ...p, [cam.id]: Date.now() }));
      setDetectById((p) => ({ ...p, [cam.id]: detect }));
      setPersistById((p) => ({ ...p, [cam.id]: persist }));
      await refreshStatus();
      setToast(
        `Live on ${cam.name} · YOLO ${detect ? "on" : "off"} · mode ${
          res.weights_mode || "—"
        }`
      );
    } catch (err) {
      setError(err.message || "Failed to start live session");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStop(cam) {
    setBusyId(cam.id);
    setError("");
    try {
      await stopLiveCamera(cam.id);
      await refreshStatus();
      setToast(`Stopped ${cam.name}`);
    } catch (err) {
      setError(err.message || "Failed to stop live session");
    } finally {
      setBusyId(null);
    }
  }

  async function runDemoClip() {
    if (!sampleCam) {
      setError("No cameras found. Run: python seed_demo_cameras.py");
      return;
    }
    await handleStart(sampleCam, SAMPLE_CLIP, { detect: true, persist: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Home / Live Monitoring</p>
          <h1 className="text-2xl font-semibold text-au-navy">Live Monitoring</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Live MJPEG from webcam, sample clip, or RTSP (backend proxy). Enable
            YOLO + Persist to write confirmed alerts into Detections.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
          Active sessions:{" "}
          <span className="font-semibold text-au-navy">{activeCount}</span>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-semibold">FYP demo path</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sky-900/90">
          <li>
            Click <strong>Demo: sample clip + detect</strong> (or Start webcam).
          </li>
          <li>Watch boxes / labels on the LIVE tile.</li>
          <li>
            Open{" "}
            <Link to="/app/detections" className="font-semibold underline">
              Detections & Alerts
            </Link>{" "}
            → then{" "}
            <Link to="/app/cases/new" className="font-semibold underline">
              Create Case
            </Link>{" "}
            for DEMO001.
          </li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!sampleCam || busyId != null}
            onClick={runDemoClip}
            className="rounded-lg bg-au-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Demo: sample clip + detect
          </button>
          {sampleCam ? (
            <button
              type="button"
              disabled={busyId != null}
              onClick={() =>
                handleStart(sampleCam, "webcam:0", {
                  detect: true,
                  persist: false,
                })
              }
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            >
              Demo: webcam (no persist)
            </button>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading cameras...</p>
      ) : cameras.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">No cameras registered</p>
          <p className="mt-1">
            From the backend folder run{" "}
            <code className="rounded bg-white px-1">python seed_demo_cameras.py</code>{" "}
            (or add a room/camera in{" "}
            <Link to="/app/master-data" className="font-semibold text-au-blue">
              Master Data
            </Link>{" "}
            as HOD / Exam Dept), then refresh.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((cam) => {
            const sess = sessions[cam.id];
            const running = Boolean(sess?.running);
            const detectOn = detectById[cam.id] !== false;
            const persistOn = Boolean(persistById[cam.id]);
            const busy = busyId === cam.id;
            const mjpeg =
              running &&
              liveMjpegUrl(cam.id, { cacheBust: streamKey[cam.id] || 0 });
            const watchHits = (sess?.latest_labels || []).filter(
              (l) => l.watchlist
            );

            return (
              <div
                key={cam.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative flex h-56 items-center justify-center bg-slate-900 text-slate-400">
                  {mjpeg ? (
                    <img
                      src={mjpeg}
                      alt={cam.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="px-4 text-center text-sm">
                      {sess?.error
                        ? sess.error
                        : "Stopped — use Demo buttons or Start below"}
                    </span>
                  )}
                  <span
                    className={[
                      "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                      running
                        ? "bg-emerald-500"
                        : cam.is_active
                          ? "bg-amber-500"
                          : "bg-rose-500",
                    ].join(" ")}
                  >
                    {running ? "LIVE" : cam.is_active ? "READY" : "OFFLINE"}
                  </span>
                  {watchHits.length ? (
                    <span className="absolute left-3 top-3 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      UFM: {watchHits.map((l) => l.label).join(", ")}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3 px-4 py-3">
                  <div>
                    <p className="font-semibold text-au-navy">{cam.name}</p>
                    <p className="text-xs text-slate-500">{cam.camera_id}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {cam.stream_url}
                    </p>
                    {sess?.weights_mode ? (
                      <p className="mt-1 text-xs text-slate-500">
                        YOLO: {sess.weights_mode}
                        {sess.opened_source ? ` · ${sess.opened_source}` : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={detectOn}
                        disabled={running || busy}
                        onChange={(e) =>
                          setDetectById((p) => ({
                            ...p,
                            [cam.id]: e.target.checked,
                          }))
                        }
                      />
                      YOLO detect
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={persistOn}
                        disabled={running || busy}
                        onChange={(e) =>
                          setPersistById((p) => ({
                            ...p,
                            [cam.id]: e.target.checked,
                          }))
                        }
                      />
                      Persist → DB
                    </label>
                  </div>

                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Override (webcam:0 or file path)"
                    value={overrideById[cam.id] || ""}
                    disabled={running || busy}
                    onChange={(e) =>
                      setOverrideById((p) => ({
                        ...p,
                        [cam.id]: e.target.value,
                      }))
                    }
                  />

                  <div className="flex flex-wrap gap-2">
                    {running ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStop(cam)}
                        className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {busy ? "…" : "Stop"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStart(cam)}
                          className="rounded bg-au-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStart(cam, "webcam:0")}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Webcam
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStart(cam, SAMPLE_CLIP)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Sample clip
                        </button>
                      </>
                    )}
                  </div>

                  {sess?.recent_events?.length ? (
                    <ul className="max-h-24 space-y-1 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                      {sess.recent_events
                        .slice()
                        .reverse()
                        .slice(0, 6)
                        .map((ev, i) => (
                          <li key={`${ev.timestamp}-${i}`}>
                            <span className="font-medium text-rose-600">
                              {ev.label}
                            </span>{" "}
                            ({ev.confidence.toFixed(2)})
                            {ev.persisted_id
                              ? ` → detection #${ev.persisted_id}`
                              : ""}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Related:{" "}
        <Link to="/app/detections" className="font-semibold text-au-blue">
          Detections & Alerts
        </Link>
        {" · "}
        <Link to="/app/cases/new" className="font-semibold text-au-blue">
          Create Case
        </Link>
        {" · "}
        <Link to="/app/master-data" className="font-semibold text-au-blue">
          Master Data
        </Link>
      </p>
    </div>
  );
}
