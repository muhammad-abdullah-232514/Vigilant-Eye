import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { DETECTION_ROLES, roleIn } from "../config/roleAccess";
import { API_URL, fetchDetections, fetchNotifications } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Header from "./Header";
import Sidebar from "./Sidebar";

function wsAlertsUrl(token) {
  const base = (API_URL || "http://127.0.0.1:8000").replace(/^http/, "ws");
  const params = new URLSearchParams({ token: token || "" });
  return `${base}/ws/alerts?${params.toString()}`;
}

export default function AppLayout() {
  const { user, token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenDetections, setUnseenDetections] = useState(0);
  const [detectionAlertVersion, setDetectionAlertVersion] = useState(0);

  const showDetectionBadge = roleIn(user?.role, DETECTION_ROLES);

  async function loadBadges() {
    try {
      const unread = await fetchNotifications(true);
      setUnreadCount(Array.isArray(unread) ? unread.length : 0);
    } catch {
      setUnreadCount(0);
    }
    if (showDetectionBadge) {
      try {
        const unseen = await fetchDetections(true, true);
        setUnseenDetections(Array.isArray(unseen) ? unseen.length : 0);
      } catch {
        setUnseenDetections(0);
      }
    } else {
      setUnseenDetections(0);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadBadges();
    })();
    const timer = setInterval(() => {
      if (!cancelled) loadBadges();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.role, showDetectionBadge]);

  // WebSocket push for monitoring/detection roles (C26)
  useEffect(() => {
    if (!token || !user) return undefined;
    if (!roleIn(user.role, DETECTION_ROLES)) {
      return undefined;
    }
    let ws;
    let closed = false;
    let retry;
    let badgeRefresh;
    let authFailed = false;
    function connect() {
      if (closed || authFailed) return;
      try {
        ws = new WebSocket(wsAlertsUrl(token));
      } catch {
        retry = setTimeout(connect, 5000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (
            msg.type === "DETECTION_ALERT" ||
            msg.type === "DETECTION_ALERT_DEMO" ||
            msg.type === "SUSPICION_ALERT" ||
            msg.type === "CONNECTED"
          ) {
            if (msg.type !== "CONNECTED") {
              if (
                msg.type === "DETECTION_ALERT" ||
                msg.type === "SUSPICION_ALERT"
              ) {
                setDetectionAlertVersion((version) => version + 1);
                if (badgeRefresh) clearTimeout(badgeRefresh);
                badgeRefresh = setTimeout(loadBadges, 350);
              }
            }
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = (ev) => {
        // 4401/4403 = auth rejection — do not reconnect storm
        if (ev.code === 4401 || ev.code === 4403) {
          authFailed = true;
          return;
        }
        if (!closed) retry = setTimeout(connect, 4000);
      };
    }
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (badgeRefresh) clearTimeout(badgeRefresh);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [token, user?.role]);

  const badges = {
    notifications: unreadCount,
    detections: unseenDetections,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-au-surface">
      <Header
        unreadCount={unreadCount}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          badges={badges}
          onNavigate={() => setSidebarOpen(false)}
        />
        <main
          className={[
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
            user?.role === "INVIGILATOR" ? "invigilator-shell" : "",
          ].join(" ")}
        >
          <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
            <Outlet
              context={{
                refreshNotifications: async () => {
                  try {
                    const unread = await fetchNotifications(true);
                    setUnreadCount(Array.isArray(unread) ? unread.length : 0);
                  } catch {
                    /* ignore */
                  }
                },
                refreshDetectionsBadge: async () => {
                  if (!showDetectionBadge) return;
                  try {
                    const unseen = await fetchDetections(true, true);
                    setUnseenDetections(Array.isArray(unseen) ? unseen.length : 0);
                  } catch {
                    /* ignore */
                  }
                },
                detectionAlertVersion,
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
