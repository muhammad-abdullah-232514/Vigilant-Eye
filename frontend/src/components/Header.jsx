import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Bell, Menu, UserCircle, X } from "lucide-react";

export default function Header({
  unreadCount = 0,
  onToggleSidebar,
  sidebarOpen = false,
}) {
  const { user } = useAuth();
  const compactRole = user?.role === "INVIGILATOR";

  return (
    <header
      data-portal-chrome
      className={[
        "app-chrome z-30 flex shrink-0 items-center justify-between border-b border-white/10 bg-au-navy px-4 text-white shadow-lg shadow-slate-950/10 sm:px-6",
        compactRole ? "h-[60px]" : "h-16",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls="portal-sidebar"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          <img
            src="/au-logo-white.png"
            alt="Air University"
            className="h-10 w-auto object-contain"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">
              Air University
            </p>
            <p className="text-base font-semibold leading-tight tracking-tight">
              UFM Web Portal
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/app/notifications"
          className="relative rounded-full p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          title="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4"
              aria-hidden
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <div className="hidden max-w-[16rem] text-right sm:block">
          <p className="truncate text-sm font-medium leading-tight" title={user?.name || ""}>
            {user?.name}
          </p>
          <p className="truncate text-xs text-blue-200" title={user?.email || ""}>
            {(user?.role || "").replaceAll("_", " ") || "—"}
          </p>
        </div>
        <UserCircle className="hidden h-9 w-9 text-blue-100 sm:block" />
      </div>
    </header>
  );
}
