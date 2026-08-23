import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchNotifications, markNotificationRead } from "../services/api";

export default function NotificationsPage() {
  const { refreshNotifications } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotifications(false);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onMarkRead(id) {
    try {
      await markNotificationRead(id);
      await load();
      if (refreshNotifications) await refreshNotifications();
    } catch (err) {
      setError(err.message || "Could not mark as read");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Home / Notifications</p>
        <h1 className="text-2xl font-semibold text-au-navy">Notifications</h1>
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
          <p className="p-6 text-slate-500">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li
                key={n.id}
                className={[
                  "flex flex-wrap items-start justify-between gap-3 px-5 py-4",
                  n.is_read ? "bg-white" : "bg-sky-50/60",
                ].join(" ")}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {n.type}
                    {!n.is_read ? (
                      <span className="ml-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                        NEW
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 font-semibold text-au-navy">{n.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    {n.case_id ? ` · Case #${n.case_id}` : ""}
                  </p>
                </div>
                {!n.is_read ? (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
