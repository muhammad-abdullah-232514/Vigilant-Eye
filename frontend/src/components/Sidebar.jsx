import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isSidebarNavActive } from "../config/navActive";
import { ROLE_LABELS, getNavForRole } from "../config/navByRole";
import { useAuth } from "../context/AuthContext";
import {
  Activity, Bell, BookOpen, ClipboardCheck, FileArchive, FileBarChart,
  ChevronDown, FilePlus2, FolderKanban, Gauge, KeyRound, LayoutDashboard, LogOut,
  MonitorPlay, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Upload,
  UserRound, Users, Wrench,
} from "lucide-react";

const NAV_ICONS = [
  ["/dashboard", LayoutDashboard], ["/monitoring", MonitorPlay], ["/detections", Activity],
  ["/cases/new", FilePlus2], ["/cases", FolderKanban], ["/evidence", FileArchive],
  ["/reports", FileBarChart], ["/notifications", Bell], ["/audit", ScrollText],
  ["/admin/users", Users], ["/admin/import", Upload], ["/admin/roles", KeyRound],
  ["/admin/students", UserRound], ["/admin/system", Settings], ["/admin/profile", UserRound],
  ["/master-data", SlidersHorizontal], ["/result-controls", ClipboardCheck],
  ["/exam-toolkit", Wrench], ["/clarification", FilePlus2], ["/profile", UserRound],
];

function iconForPath(path) {
  const match = NAV_ICONS.find(([needle]) => path.includes(needle));
  const Icon = match?.[1] || ShieldCheck;
  return <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} aria-hidden />;
}

function iconForItem(item) {
  if (item.children) {
    return (
      <ClipboardCheck
        className="h-[17px] w-[17px] shrink-0"
        strokeWidth={1.8}
        aria-hidden
      />
    );
  }
  if (item.label === "Cases for Review") {
    return (
      <ClipboardCheck
        className="h-[17px] w-[17px] shrink-0"
        strokeWidth={1.8}
        aria-hidden
      />
    );
  }
  return iconForPath(item.to);
}

function linkClass(active) {
  return [
    "portal-option flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none",
    active
      ? "bg-au-navy font-semibold text-white shadow-md shadow-au-navy/15"
      : "text-slate-700 hover:bg-sky-200 hover:text-au-navy",
  ].join(" ");
}

export default function Sidebar({ open, badges = {}, onNavigate }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const role = typeof user?.role === "string" ? user.role.trim().toUpperCase() : "";
  const compactRole = role === "INVIGILATOR" || role === "HOD" || role === "DEC";
  const sections = getNavForRole(role);
  const roleUnresolved = Boolean(user) && !role;
  const unsupportedRole = Boolean(role) && sections.length === 0;
  const [systemTime, setSystemTime] = useState(() => new Date());
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true
  );
  const [expandedResultControl, setExpandedResultControl] = useState(
    location.pathname === "/app/result-controls"
  );

  useEffect(() => {
    const timer = window.setInterval(() => setSystemTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (location.pathname === "/app/result-controls") {
      setExpandedResultControl(true);
    }
  }, [location.pathname]);

  // Off-canvas mobile drawer must not remain keyboard-focusable when closed.
  const drawerHidden = !isDesktop && !open;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close sidebar"
          onClick={onNavigate}
        />
      ) : null}

      <aside
        id="portal-sidebar"
        data-portal-chrome
        className={[
          "sidebar fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white pt-16 transition-transform duration-200",
          "lg:static lg:inset-auto lg:h-full lg:min-h-0 lg:shrink-0 lg:translate-x-0 lg:pt-0",
          compactRole ? "w-[248px]" : "w-72",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Main navigation"
        aria-hidden={drawerHidden ? true : undefined}
        inert={drawerHidden ? true : undefined}
      >
        <div className={`shrink-0 border-b border-slate-100 ${compactRole ? "px-4 py-3" : "px-5 py-5"}`}>
          <div className={`flex items-center gap-3 rounded-xl bg-slate-50 px-3 ${compactRole ? "py-2" : "py-3"}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-au-accent"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-au-navy" title={user?.name || ""}>{user?.name || "User"}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[role] || role || (loading ? "…" : "—")}</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
          {loading && !user ? (
            <p className="px-3 text-sm text-slate-500">Resolving session…</p>
          ) : null}
          {roleUnresolved || unsupportedRole ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Access denied: unrecognized portal role
              {role ? ` (${role})` : ""}. Contact an administrator.
            </div>
          ) : null}
          {sections.map((group) => (
            <div key={group.section}>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  if (item.children) {
                    const childIsActive = item.children.some((child) =>
                      isSidebarNavActive(location, child.to)
                    );
                    const expanded = expandedResultControl;
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          className={linkClass(childIsActive)}
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedResultControl((current) => !current)
                          }
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={childIsActive ? "text-blue-200" : "text-slate-400"}>
                              {iconForItem(item)}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              expanded ? "rotate-180" : ""
                            }`}
                            aria-hidden
                          />
                        </button>
                        {expanded ? (
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
                            {item.children.map((child) => {
                              const childActive = isSidebarNavActive(
                                location,
                                child.to
                              );
                              return (
                                <Link
                                  key={child.to}
                                  to={child.to}
                                  className={[
                                    "portal-option flex items-center rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                                    childActive
                                      ? "bg-blue-50 font-semibold text-au-blue"
                                      : "text-slate-600 hover:bg-sky-100 hover:text-au-navy",
                                  ].join(" ")}
                                  aria-current={childActive ? "page" : undefined}
                                  onClick={onNavigate}
                                >
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  const active = isSidebarNavActive(location, item.to);
                  return (
                    <Link
                      key={`${item.to}-${item.label}`}
                      to={item.to}
                      className={linkClass(active)}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      data-nav-to={item.to}
                      data-nav-active={active ? "true" : "false"}
                    >
                      <span className="flex min-w-0 items-center gap-3"><span className={active ? "text-blue-200" : "text-slate-400"}>{iconForItem(item)}</span><span className="truncate">{item.label}</span></span>
                      {item.badgeKey && badges[item.badgeKey] > 0 ? (
                        <span className="min-w-[1.25rem] rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                          {badges[item.badgeKey] > 99
                            ? "99+"
                            : badges[item.badgeKey]}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`shrink-0 border-t border-slate-100 text-xs text-slate-500 ${compactRole ? "p-3" : "p-4"}`}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="font-semibold text-slate-700">System time</p>
            <p className="mt-0.5 tabular-nums">
              {systemTime.toLocaleDateString()} · {systemTime.toLocaleTimeString()}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-[17px] w-[17px]" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
