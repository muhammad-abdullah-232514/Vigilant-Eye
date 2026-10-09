/**
 * Live Monitoring — production screen.
 * Start Monitoring always enables AI detection + validated incident persistence.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { isLiveCamera } from "../config/cameraSources";
import {
  MASTER_DATA_VIEW_ROLES,
  MONITOR_ROLES,
  roleIn,
} from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  fetchCameras,
  fetchLiveStatus,
  liveMjpegUrl,
  startLiveCamera,
  stopLiveCamera,
} from "../services/api";

function isCameraError(errorKind, error) {
  return (
    errorKind === "CAMERA_ERROR" ||
    /webcam|camera|rtsp\/ip/i.test(String(error || ""))
  );
}

function aiBadge(status, errorKind, error) {
  if (isCameraError(errorKind, error)) {
    return { label: "Camera Error", className: "bg-rose-600" };
  }
  const map = {
    active: { label: "AI Active", className: "bg-emerald-600" },
    starting: { label: "AI Starting", className: "bg-sky-600" },
    unavailable: { label: "AI Unavailable", className: "bg-slate-500" },
    error: { label: "AI Error", className: "bg-rose-600" },
    idle: { label: "AI Idle", className: "bg-slate-400" },
  };
  return map[status] || map.idle;
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedCameraId = searchParams.get("cameraId");
  const [cameras, setCameras] = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [streamKey, setStreamKey] = useState({});
  const [toast, setToast] = useState("");
  const [fullscreenCameraId, setFullscreenCameraId] = useState("");

  const canControl = roleIn(user?.role, MONITOR_ROLES);
  const canOpenExamSetup = roleIn(user?.role, MASTER_DATA_VIEW_ROLES);

  useEffect(() => {
    function syncFullscreenCamera() {
      setFullscreenCameraId(document.fullscreenElement?.dataset.cameraId || "");
    }
    document.addEventListener("fullscreenchange", syncFullscreenCamera);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenCamera);
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchLiveStatus();
      const map = {};
      for (const s of status.sessions || []) {
        if (s.is_demo) continue;
        map[s.camera_id] = s;
      }
      setSessions(map);
      return map;
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCameras();
        if (!cancelled) {
          setCameras((Array.isArray(data) ? data : []).filter(isLiveCamera));
        }
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
  const selectedCameraExists = cameras.some(
    (camera) => String(camera.id) === requestedCameraId
  );
  const visibleCameras = requestedCameraId
    ? cameras.filter((camera) => String(camera.id) === requestedCameraId)
    : cameras;

  if (!canControl) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (user?.role === "STUDENT") {
    return <Navigate to="/app/help" replace />;
  }

  async function handleStart(cam) {
    setBusyId(cam.id);
    setError("");
    setToast("");
    try {
      const res = await startLiveCamera(cam.id, { mode: "production" });
      setStreamKey((p) => ({ ...p, [cam.id]: Date.now() }));
      // Poll briefly so webcam open failures are not toasted as success
      let map = await refreshStatus();
      for (let i = 0; i < 6; i += 1) {
        const s = map[cam.id];
        if (s?.running || s?.error) break;
        await new Promise((r) => setTimeout(r, 400));
        map = await refreshStatus();
      }
      const s = map[cam.id] || {};
      if (s.error && !s.running) {
        setError(s.error);
        setToast("");
        return;
      }
      if (!s.running && !res.running) {
        setError(
          res.error ||
            "Camera did not start. Check that a live webcam, RTSP, or HTTP camera source is configured in Exam Setup."
        );
        return;
      }
      const ai = s.ai_status || res.ai_status || "starting";
      setToast(
        `Monitoring started on ${cam.name}. AI: ${ai}${
          s.model_ready || res.model_ready
            ? ""
            : " (model still loading or degraded)"
        }. Validated incidents will save automatically.`
      );
    } catch (err) {
      setError(err.message || "Failed to start monitoring");
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
      setToast(`Stopped monitoring ${cam.name}`);
    } catch (err) {
      setError(err.message || "Failed to stop monitoring");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCameraFullscreen(event) {
    const screen = event.currentTarget.closest("[data-camera-screen]");
    if (!screen) return;
    try {
      if (document.fullscreenElement === screen) {
        await document.exitFullscreen();
      } else if (screen.requestFullscreen) {
        await screen.requestFullscreen();
      } else {
        setError("Fullscreen is not supported by this browser.");
      }
    } catch (err) {
      setError(err.message || "Could not change camera screen size.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Home / Live Monitoring"
        title="Live Monitoring"
        description="Start monitoring to begin live video with automatic AI detection and validated incident persistence."
        actions={
          <>
            <div className="portal-card px-4 py-2 text-sm">
              Active:{" "}
              <span className="font-semibold tabular-nums text-au-navy">
                {activeCount}
              </span>
            </div>
          </>
        }
      />

      {toast ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {activeCount > 0 ? (
        <div className="portal-card space-y-2 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            AI engine status
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {(() => {
              const live = Object.values(sessions).find((s) => s.running);
              if (!live) return <span>No active inference session</span>;
              const ms = live.infer_latency_ms;
              const fps = live.infer_fps;
              return (
                <>
                  <span>
                    Model:{" "}
                    <span className="font-semibold text-slate-800">
                      {live.model_version || live.weights_mode || "—"}
                    </span>
                  </span>
                  <span>
                    Device:{" "}
                    <span className="font-semibold text-slate-800">
                      {live.device || "cpu"}
                    </span>
                  </span>
                  <span>
                    Inference:{" "}
                    <span className="font-semibold text-slate-800">
                      {ms != null ? `${ms} ms` : "—"}
                      {fps != null ? ` · ~${fps} FPS` : ""}
                    </span>
                  </span>
                  <span>
                    Status:{" "}
                    <span className="font-semibold text-slate-800">
                      {aiBadge(
                        live.ai_status || "idle",
                        live.error_kind,
                        live.error
                      ).label}
                    </span>
                  </span>
                </>
              );
            })()}
          </div>
          <p className="text-[11px] text-slate-500">
            Detection confidence is model certainty for the detected class — not
            a measure of student guilt. Confirmed AI events still require human
            review before any UFM case action.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading cameras...</p>
      ) : requestedCameraId && !selectedCameraExists ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">This camera is not configured for live monitoring</p>
          <p className="mt-1">
            Sample clips are available in Demo / Testing Mode, not Live Monitoring.
          </p>
          <Link to="/app/monitoring" className="mt-3 inline-block font-semibold text-au-blue">
            Show all live cameras
          </Link>
        </div>
      ) : cameras.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">No live cameras available</p>
          <p className="mt-1">
            {canOpenExamSetup ? (
              <>
                Register an active webcam, RTSP, or HTTP camera source under{" "}
                <Link
                  to="/app/master-data"
                  className="font-semibold text-au-blue"
                >
                  Exam Setup
                </Link>
                . Sample clips are not shown in Live Monitoring.
              </>
            ) : (
              <>
                No live camera sources are configured. Ask authorized staff to
                configure a webcam, RTSP, or HTTP camera source.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requestedCameraId ? (
            <Link to="/app/monitoring" className="inline-block text-sm font-semibold text-au-blue">
              ← Show all live cameras
            </Link>
          ) : null}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {visibleCameras.map((cam) => {
            const sess = sessions[cam.id];
            const running = Boolean(sess?.running);
            const camFailed =
              Boolean(sess?.error) && !running;
            const busy = busyId === cam.id;
            const mjpeg =
              running &&
              liveMjpegUrl(cam.id, { cacheBust: streamKey[cam.id] || 0 });
            const ai = aiBadge(
              sess?.ai_status || (running ? "starting" : "idle"),
              sess?.error_kind,
              sess?.error
            );
            const watchHits = (sess?.latest_labels || []).filter(
              (l) => l.decision === "CONFIRM" || l.decision === "REVIEW"
            );
            const hall =
              cam.room_label ||
              sess?.room_label ||
              (cam.room_id ? `Room #${cam.room_id}` : "Hall");
            const camBadge = running
              ? { label: "LIVE", className: "bg-emerald-500" }
              : camFailed
                ? { label: "ERROR", className: "bg-rose-600" }
                : cam.is_active
                  ? { label: "READY", className: "bg-amber-500" }
                  : { label: "OFFLINE", className: "bg-rose-500" };

            return (
              <div
                key={cam.id}
                className="portal-card overflow-hidden"
              >
                <div
                  data-camera-screen
                  data-camera-id={cam.id}
                  className="relative flex h-56 items-center justify-center bg-slate-900 text-slate-400"
                  style={
                    fullscreenCameraId === String(cam.id)
                      ? { height: "100dvh", width: "100vw" }
                      : undefined
                  }
                >
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
                        : canControl
                          ? "Not monitoring — press Start Monitoring"
                          : "Not monitoring"}
                    </span>
                  )}
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${camBadge.className}`}
                  >
                    {camBadge.label}
                  </span>
                  <button
                    type="button"
                    onClick={toggleCameraFullscreen}
                    aria-label={
                      fullscreenCameraId === String(cam.id)
                        ? "Exit camera fullscreen"
                        : "Maximize camera"
                    }
                    title={
                      fullscreenCameraId === String(cam.id)
                        ? "Exit fullscreen"
                        : "Maximize camera"
                    }
                    className="absolute right-3 top-10 rounded bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    {fullscreenCameraId === String(cam.id)
                      ? "Exit fullscreen"
                      : "Maximize"}
                  </button>
                  {running ||
                  sess?.error ||
                  sess?.model_error ||
                  sess?.ai_status === "error" ? (
                    <span
                      className={`absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold text-white ${ai.className}`}
                    >
                      {ai.label}
                    </span>
                  ) : null}
                  {watchHits.length ? (
                    <span
                      className={[
                        "absolute bottom-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold text-white",
                        watchHits.some((l) => l.decision === "CONFIRM")
                          ? "bg-rose-600"
                          : "bg-amber-500",
                      ].join(" ")}
                    >
                      {watchHits.some((l) => l.decision === "CONFIRM")
                        ? "UFM"
                        : "REVIEW"}
                      :{" "}
                      {watchHits
                        .map((l) => l.category || l.label)
                        .slice(0, 3)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {hall}
                    </p>
                    <p className="font-semibold text-au-navy">{cam.name}</p>
                    <p className="text-xs text-slate-500">{cam.camera_id}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Source: {cam.source_kind || "configured"}
                      {cam.stream_display ? ` · ${cam.stream_display}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Monitoring:{" "}
                      <span className="font-semibold text-slate-700">
                        {sess?.monitoring_status || (running ? "monitoring" : "stopped")}
                      </span>
                      {sess?.weights_mode ? (
                        <span className="ml-2">
                          · weights{" "}
                          <span className="font-semibold text-slate-700">
                            {sess.weights_mode}
                          </span>
                        </span>
                      ) : null}
                      {sess?.infer_latency_ms != null ? (
                        <span className="ml-2">
                          · {sess.infer_latency_ms} ms
                        </span>
                      ) : null}
                      {sess?.persist_error ? (
                        <span className="ml-2 font-semibold text-rose-600">
                          Save failed
                          {sess.pending_persists
                            ? ` (${sess.pending_persists} pending retry)`
                            : ""}
                        </span>
                      ) : null}
                      {sess?.error_kind === "CAMERA_ERROR" && sess?.error ? (
                        <span className="ml-2 font-semibold text-rose-600">
                          {sess.error}
                        </span>
                      ) : null}
                      {sess?.model_error ? (
                        <span className="ml-2 font-semibold text-rose-600">
                          {sess.model_error}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canControl ? (
                      running ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStop(cam)}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {busy ? "…" : "Stop Monitoring"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || !cam.is_active}
                          onClick={() => handleStart(cam)}
                          className="rounded-lg bg-au-navy px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busy ? "Starting…" : "Start Monitoring"}
                        </button>
                      )
                    ) : (
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        View only
                      </span>
                    )}
                    <Link
                      to="/app/detections"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Alerts
                    </Link>
                    <Link
                      to="/app/evidence"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Evidence
                    </Link>
                  </div>

                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
