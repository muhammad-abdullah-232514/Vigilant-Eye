import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { fetchNotifications } from "../services/api";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadBadges() {
      try {
        const unread = await fetchNotifications(true);
        if (!cancelled) setUnreadCount(Array.isArray(unread) ? unread.length : 0);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    }

    loadBadges();
    const timer = setInterval(loadBadges, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const badges = { notifications: unreadCount };

  return (
    <div className="min-h-screen bg-au-surface">
      <Header
        unreadCount={unreadCount}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar
          open={sidebarOpen}
          badges={badges}
          onNavigate={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6">
          <Outlet context={{ refreshNotifications: async () => {
            try {
              const unread = await fetchNotifications(true);
              setUnreadCount(Array.isArray(unread) ? unread.length : 0);
            } catch {
              /* ignore */
            }
          } }} />
        </main>
      </div>
    </div>
  );
}
