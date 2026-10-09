import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CircleCheck,
  Info,
} from "lucide-react";
import CaseQueueTable from "../components/CaseQueueTable";
import DonutChart from "../components/DonutChart";
import ErrorBanner from "../components/ErrorBanner";
import KpiCard from "../components/KpiCard";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import PageShell from "../components/PageShell";
import SectionPanel from "../components/SectionPanel";
import StatusBadge from "../components/StatusBadge";
import {
  buildRoleKpis,
  casesForRoleQueue,
  countByField,
  queueMetaForRole,
  statusChartSegments,
  studentCaseStatusSegments,
  violationChartSegments,
} from "../config/dashboardByRole";
import {
  formatViolationLabel,
  violationTone,
} from "../config/casePresentation";
import { departmentWiseStats } from "../config/reportStats";
import {
  destinationForNotification,
  formatNotificationMessage,
} from "../config/notificationPresentation";
import { dashboardTitle } from "../config/navByRole";
import { isLiveCamera } from "../config/cameraSources";
import {
  DETECTION_ROLES,
  MONITOR_ROLES,
  roleIn,
} from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";
import {
  fetchAdminUserStats,
  fetchCameras,
  fetchCases,
  fetchClarifications,
  fetchDecDashboardAnalytics,
  fetchDetections,
  fetchEvidence,
  fetchExams,
  fetchHodDashboardAnalytics,
  fetchLiveStatus,
  fetchNotifications,
  fetchResultControls,
  fetchUfmCommitteeDashboardAnalytics,
  loadEvidenceObjectUrl,
  markNotificationRead,
} from "../services/api";

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StudentRecentNotifications({ notifications }) {
  function iconForNotification(notification) {
    if (notification.type === "CASE_ACTION_REQUIRED") {
      return {
        Icon: AlertTriangle,
        className: "bg-orange-50 text-orange-500",
      };
    }
    if (notification.type === "CASE_CREATED") {
      return { Icon: Info, className: "bg-blue-50 text-blue-500" };
    }
    return {
      Icon: CircleCheck,
      className: "bg-emerald-50 text-emerald-600",
    };
  }

  return (
    <SectionPanel
      title="Recent Notifications"
      actions={
        <Link
          to="/app/notifications"
          className="text-[0.625rem] font-semibold text-au-blue hover:underline"
        >
          View All
        </Link>
      }
      className="student-recent-notifications"
      bodyClassName="px-3 pb-2 pt-0"
    >
      {notifications.length === 0 ? (
        <p className="py-4 text-xs text-slate-500">
          No notifications yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {notifications.slice(0, 3).map((notification) => {
            const { Icon, className } = iconForNotification(notification);
            const destination =
              destinationForNotification(notification, "STUDENT") ||
              "/app/notifications";
            const createdAt = notification.created_at
              ? new Date(notification.created_at)
              : null;
            return (
              <li key={notification.id}>
                <Link
                  to={destination}
                  className="flex items-center gap-2 py-2"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${className}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.625rem] font-semibold text-au-navy">
                      {notification.title}
                    </span>
                    <span className="block truncate text-[0.5625rem] text-slate-600">
                      {formatNotificationMessage(notification)}
                    </span>
                  </span>
                  <time
                    className="shrink-0 text-right text-[0.5rem] leading-tight text-slate-500"
                    dateTime={createdAt?.toISOString()}
                  >
                    {createdAt ? (
                      <>
                        {createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <br />
                        {createdAt.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : (
                      "—"
                    )}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionPanel>
  );
}

function alertTone(type = "") {
  return violationTone(type);
}

const INVIGILATOR_CASE_STATUS_GROUPS = [
  { label: "Open", statuses: ["PENDING"], color: "#2583e8" },
  { label: "Pending HOD", statuses: ["UNDER_REVIEW"], color: "#f3a51b" },
  { label: "Pending DEC", statuses: ["DEC_REVIEW"], color: "#8852d5" },
  {
    label: "Pending Exam Dept.",
    statuses: ["EXAM_DEPARTMENT_REVIEW", "EXAM_DEPARTMENT_IMPLEMENTATION"],
    color: "#f28c28",
  },
  {
    label: "Pending Committee",
    statuses: ["UFM_COMMITTEE_REVIEW"],
    color: "#24aaa4",
  },
  { label: "Resolved", statuses: ["APPROVED", "REJECTED"], color: "#35a960" },
];

function invigilatorCaseStatusSegments(cases) {
  return INVIGILATOR_CASE_STATUS_GROUPS.map(({ label, statuses, color }) => ({
    label,
    color,
    count: cases.filter((item) => statuses.includes(item.status)).length,
  }));
}

function violationChartColor(type) {
  const tone = violationTone(type);
  return {
    rose: "#be123c",
    amber: "#d97706",
    violet: "#7c3aed",
    emerald: "#047857",
    blue: "#2563eb",
  }[tone];
}

function detectionViolationCategory(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized.includes("phone") || normalized.includes("cell")) {
    return "mobile phone";
  }
  if (
    normalized.includes("laptop") ||
    normalized.includes("electronic_gadget") ||
    normalized.includes("electronic gadget") ||
    normalized.includes("gadget")
  ) {
    return "electronic gadget";
  }
  return formatViolationLabel(type).toLowerCase();
}

function parseDashboardTimestamp(value) {
  if (!value) return null;
  const timestamp =
    typeof value === "string" &&
    !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
      ? `${value.trim()}Z`
      : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DetectionTrendChart({ detections }) {
  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const counts = Array(24).fill(0);
  detections.forEach((detection) => {
    const timestamp = parseDashboardTimestamp(
      detection.timestamp || detection.created_at
    );
    if (!timestamp || timestamp < dayStart || timestamp >= today) return;
    counts[timestamp.getHours()] += 1;
  });
  const points = counts.map((count, hour) => ({ hour, count }));
  const max = Math.max(...points.map((point) => point.count), 1);
  const width = 420;
  const height = 164;
  const coordinates = points.map((point, index) => ({
    x: 30 + (index * (width - 48)) / (points.length - 1),
    y: height - 28 - (point.count / max) * (height - 58),
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `30,${height - 28} ${line} ${width - 18},${height - 28}`;

  return (
    <section className="portal-card min-w-0 overflow-hidden">
      <div className="portal-panel-header">
        <h2 className="portal-section-title">Alert Overview (Today)</h2>
        <span className="text-xs text-slate-500">Today</span>
      </div>
      <div className="px-3 pb-3 pt-2 sm:px-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full"
          role="img"
          aria-label={`Confirmed alerts today, ${detections.filter((detection) => {
            const timestamp = parseDashboardTimestamp(
              detection.timestamp || detection.created_at
            );
            return timestamp && timestamp >= dayStart && timestamp < today;
          }).length} total`}
        >
          {[0, 1, 2, 3, 4].map((step) => {
            const y = 22 + step * 28;
            return (
              <line
                key={step}
                x1="30"
                x2={width - 18}
                y1={y}
                y2={y}
                stroke="#e7edf5"
                strokeWidth="1"
              />
            );
          })}
          <polygon points={area} fill="#ef4444" opacity="0.12" />
          <polyline
            points={line}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coordinates.map((point, index) => (
            <circle
              key={points[index].hour}
              cx={point.x}
              cy={point.y}
              r="2.5"
              fill="#fff"
              stroke="#ef4444"
              strokeWidth="1.5"
            />
          ))}
          {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
            <text
              key={hour}
              x={30 + (hour * (width - 48)) / 24}
              y={height - 7}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {`${String(hour).padStart(2, "0")}:00`}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function smoothTrendPath(points) {
  if (points.length < 3) {
    return points
      .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
      .join(" ");
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const following = points[index + 2] || next;
    const minY = Math.min(current.y, next.y);
    const maxY = Math.max(current.y, next.y);
    const control1Y = Math.max(
      minY,
      Math.min(maxY, current.y + (next.y - previous.y) / 6)
    );
    const control2Y = Math.max(
      minY,
      Math.min(maxY, next.y - (following.y - current.y) / 6)
    );
    const third = (next.x - current.x) / 3;
    path += ` C ${current.x + third} ${control1Y}, ${
      next.x - third
    } ${control2Y}, ${next.x} ${next.y}`;
  }
  return path;
}

function CasesTrendChart({
  analytics,
  month,
  monthOptions,
  onMonthChange,
  loading,
  error,
  seriesConfig,
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const nextMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );
    const timer = window.setTimeout(
      () => setToday(new Date()),
      Math.max(0, nextMidnight.getTime() - Date.now() + 50)
    );
    return () => window.clearTimeout(timer);
  }, [today]);
  const allSeries = seriesConfig || [
    { key: "received", label: "Received", color: "#7c3aed" },
    { key: "forwarded", label: "Forwarded", color: "#f59e0b" },
    { key: "resolved", label: "Resolved", color: "#10b981" },
  ];
  const [activityFilter, setActivityFilter] = useState("all");
  const series =
    activityFilter === "all"
      ? allSeries
      : allSeries.filter(({ key }) => key === activityFilter);
  const valuesBySeries = Object.fromEntries(
    allSeries.map(({ key }) => [
      key,
      Object.fromEntries(
        (analytics?.[key] || []).map(({ date, count }) => [
          Number(date.slice(-2)),
          count,
        ])
      ),
    ])
  );
  const isCurrentMonth =
    year === today.getFullYear() && monthNumber === today.getMonth() + 1;
  const visibleDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const xTickStep = Math.max(1, Math.ceil((visibleDays - 1) / 4));
  const xTicks = Array.from(
    { length: Math.floor((visibleDays - 1) / xTickStep) + 1 },
    (_, index) => 1 + index * xTickStep
  );
  if (xTicks[xTicks.length - 1] !== visibleDays) xTicks.push(visibleDays);
  const highestCount = Math.max(
    1,
    ...series.flatMap(({ key }) =>
      Array.from({ length: visibleDays }, (_, index) =>
        valuesBySeries[key][index + 1] || 0
      )
    )
  );
  const tickStep = Math.max(1, Math.ceil(highestCount / 4));
  const chartMax = tickStep * 4;
  const width = 420;
  const height = 180;
  const left = 34;
  const right = width - 14;
  const top = 12;
  const bottom = height - 30;
  const xForDay = (day) =>
    visibleDays === 1
      ? (left + right) / 2
      : left + ((day - 1) * (right - left)) / (visibleDays - 1);
  const yForCount = (count) =>
    bottom - (count / chartMax) * (bottom - top);
  const monthLabel =
    monthOptions.find((option) => option.value === month)?.label || month;

  return (
    <section className="portal-card min-w-0 overflow-hidden">
      <div className="portal-panel-header">
        <h2 className="portal-section-title">
          Cases Trend ({monthLabel})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter case activity"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
            value={activityFilter}
            onChange={(event) => setActivityFilter(event.target.value)}
          >
            <option value="all">All activities</option>
            {allSeries.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Cases trend month"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="px-4 pt-2 text-xs font-medium text-slate-500">
        {new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
      </p>
      {error ? (
        <p role="alert" className="mx-4 mt-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Loading monthly activity...
        </p>
      ) : (
        <div className="px-3 pb-2 pt-1 sm:px-4">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-52 w-full"
            role="img"
            aria-label={`${series.map(({ label }) => label).join(", ")} case trend for ${monthLabel}`}
          >
            {[0, 1, 2, 3, 4].map((step) => {
              const tick = tickStep * (4 - step);
              const y = yForCount(tick);
              return (
                <g key={step}>
                  <line
                    x1={left}
                    x2={right}
                    y1={y}
                    y2={y}
                    stroke="#e7edf5"
                    strokeWidth="1"
                  />
                  <text
                    x={left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[9px]"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}
            <defs>
              <linearGradient id="hod-trend-received-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.015" />
              </linearGradient>
              <linearGradient id="hod-trend-forwarded-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.005" />
              </linearGradient>
              <linearGradient id="hod-trend-resolved-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.005" />
              </linearGradient>
            </defs>
            {series.map(({ key, color }) => {
              const dailyPoints = Array.from({ length: visibleDays }, (_, index) => {
                const day = index + 1;
                return {
                  day,
                  count: valuesBySeries[key][day] || 0,
                  x: xForDay(day),
                  y: yForCount(valuesBySeries[key][day] || 0),
                };
              });
              const linePath = smoothTrendPath(dailyPoints);
              const firstPoint = dailyPoints[0];
              const lastPoint = dailyPoints[dailyPoints.length - 1];
              const areaPath = `${linePath} L ${lastPoint.x} ${bottom} L ${firstPoint.x} ${bottom} Z`;
              return (
                <g key={key}>
                  <path
                    d={areaPath}
                    fill={`url(#hod-trend-${key}-fill)`}
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {dailyPoints
                    .filter(({ count }) => count > 0)
                    .map(({ day, count, x, y }) => (
                      <circle
                        key={`${key}-${day}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="white"
                        stroke={color}
                        strokeWidth="2"
                      >
                        <title>
                          {`${series.find((item) => item.key === key)?.label}: ${count} on ${monthNumber}/${day}/${year}`}
                        </title>
                      </circle>
                    ))}
                </g>
              );
            })}
            {xTicks.map((day) => (
              <text
                key={day}
                x={xForDay(day)}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-500 text-[9px]"
              >
                {day}
              </text>
            ))}
          </svg>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
            {series.map(({ key, label, color }) => {
              const total = Object.values(valuesBySeries[key]).reduce(
                (sum, count) => sum + count,
                0
              );
              return (
                <li key={key} className="flex items-center">
                  <span className="flex items-center gap-1.5 px-1.5 py-1 text-slate-700">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums text-slate-800">
                      {total}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function CasesByDepartmentChart({ segments }) {
  const visibleSegments = segments.slice(0, 5);
  const remainingCount = segments
    .slice(5)
    .reduce((total, segment) => total + segment.count, 0);
  if (remainingCount > 0) {
    visibleSegments.push({
      label: "Other departments",
      count: remainingCount,
    });
  }

  const maximum = Math.max(1, ...visibleSegments.map(({ count }) => count));
  const total = segments.reduce((sum, { count }) => sum + count, 0);

  return (
    <section className="portal-card min-w-0 overflow-hidden">
      <div className="portal-panel-header">
        <h2 className="portal-section-title">Cases by Department</h2>
      </div>
      {total === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500">
          No department data is available yet.
        </p>
      ) : (
        <ul className="space-y-4 px-4 py-5">
          {visibleSegments.map(({ label, count }, index) => (
            <li
              key={`${label}-${index}`}
              className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_2rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2rem]"
            >
              <span className="truncate text-slate-700" title={label}>
                {label}
              </span>
              <span
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`${label}: ${count} cases`}
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-valuenow={count}
              >
                <span
                  className="block h-full rounded-full bg-blue-500"
                  style={{ width: `${(count / maximum) * 100}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums text-slate-700">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-slate-100 py-3 text-center text-sm">
        <Link
          to="/app/reports"
          className="font-medium text-au-blue hover:underline"
        >
          View Department Report <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function RecentCasesPanel({ cases }) {
  return (
    <section className="portal-card min-w-0 overflow-hidden">
      <div className="portal-panel-header">
        <h2 className="portal-section-title">Recent Cases</h2>
        <Link to="/app/cases" className="btn-ghost btn-sm shrink-0">
          View All
        </Link>
      </div>
      {cases.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No cases have been reported yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cases.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  to={`/app/cases/${item.id}`}
                  className="block truncate text-sm font-semibold text-au-navy hover:text-au-blue"
                >
                  {item.case_number || `Case #${item.id}`}
                </Link>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {item.student_roll
                    ? `Student ID: ${item.student_roll}`
                    : item.student_name || "Student details unavailable"}
                  {item.exam_course_code ? ` · ${item.exam_course_code}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={item.status} />
                <span className="text-[10px] text-slate-500">
                  {formatWhen(item.created_at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { detectionAlertVersion = 0 } = useOutletContext() || {};
  const role = user?.role || "INVIGILATOR";
  const isStudent = role === "STUDENT";
  const canMonitor = roleIn(role, MONITOR_ROLES);
  const canDetect = roleIn(role, DETECTION_ROLES);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cases, setCases] = useState([]);
  const [clarifications, setClarifications] = useState([]);
  const [detections, setDetections] = useState([]);
  const [detectionEvidence, setDetectionEvidence] = useState([]);
  const [evidencePreviewUrls, setEvidencePreviewUrls] = useState({});
  const [cameras, setCameras] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [cameraPage, setCameraPage] = useState(0);
  const [unread, setUnread] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [resultControls, setResultControls] = useState([]);
  const [decAnalytics, setDecAnalytics] = useState(null);
  const [ufmCommitteeAnalytics, setUfmCommitteeAnalytics] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [hodTrendMonth, setHodTrendMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [hodAnalytics, setHodAnalytics] = useState(null);
  const [hodAnalyticsLoading, setHodAnalyticsLoading] = useState(false);
  const [hodAnalyticsError, setHodAnalyticsError] = useState("");
  const [ufmAnalytics, setUfmAnalytics] = useState(null);
  const [ufmAnalyticsLoading, setUfmAnalyticsLoading] = useState(false);
  const [ufmAnalyticsError, setUfmAnalyticsError] = useState("");
  const [todayExamCount, setTodayExamCount] = useState(null);
  const [todayExamCountError, setTodayExamCountError] = useState("");
  const kpiRefreshInFlight = useRef(false);

  const hodTrendMonthOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - index);
        const value = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        return {
          value,
          label:
            index === 0
              ? "This Month"
              : date.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                }),
        };
      }),
    []
  );

  const refreshKpiData = useCallback(async () => {
    if (kpiRefreshInFlight.current) return;
    kpiRefreshInFlight.current = true;
    try {
      const results = await Promise.allSettled([
        fetchCases({ scope: "dashboard" }),
        isStudent ? fetchClarifications() : Promise.resolve(null),
        canDetect ? fetchDetections(true) : Promise.resolve(null),
        canMonitor ? fetchCameras() : Promise.resolve(null),
        canMonitor ? fetchLiveStatus() : Promise.resolve(null),
        fetchNotifications(!isStudent),
      ]);
      const [
        caseResult,
        clarificationResult,
        detectionResult,
        cameraResult,
        liveStatusResult,
        unreadResult,
      ] = results;

      if (
        caseResult.status === "fulfilled" &&
        Array.isArray(caseResult.value)
      ) {
        setCases(caseResult.value);
      }
      if (
        clarificationResult.status === "fulfilled" &&
        Array.isArray(clarificationResult.value)
      ) {
        setClarifications(clarificationResult.value);
      }
      if (
        detectionResult.status === "fulfilled" &&
        Array.isArray(detectionResult.value)
      ) {
        setDetections(detectionResult.value);
      }
      if (
        cameraResult.status === "fulfilled" &&
        Array.isArray(cameraResult.value)
      ) {
        setCameras(cameraResult.value);
      }
      if (
        liveStatusResult.status === "fulfilled" &&
        Array.isArray(liveStatusResult.value?.sessions)
      ) {
        setLiveSessions(liveStatusResult.value.sessions);
      }
      if (
        unreadResult.status === "fulfilled" &&
        Array.isArray(unreadResult.value)
      ) {
        setUnread(
          isStudent
            ? unreadResult.value.filter((notification) => !notification.is_read)
            : unreadResult.value
        );
        if (isStudent) setRecentNotifications(unreadResult.value);
      }
    } finally {
      kpiRefreshInFlight.current = false;
    }
  }, [canDetect, canMonitor, isStudent]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        if (role === "ADMINISTRATOR") {
          const [stats, unreadData] = await Promise.all([
            fetchAdminUserStats(),
            fetchNotifications(true).catch(() => []),
          ]);
          if (cancelled) return;
          setAdminStats(stats || null);
          setCases([]);
          setClarifications([]);
          setDetections([]);
          setDetectionEvidence([]);
          setCameras([]);
          setUnread(Array.isArray(unreadData) ? unreadData : []);
          setRecentNotifications([]);
          setResultControls([]);
          setDecAnalytics(null);
          setUfmCommitteeAnalytics(null);
          return;
        }

        const needResults = role === "EXAM_DEPARTMENT";

        const [
          caseData,
          detectionData,
          evidenceData,
          cameraData,
          liveStatusData,
          unreadData,
          clarificationData,
          resultData,
          decAnalyticsData,
          ufmCommitteeAnalyticsData,
        ] =
          await Promise.all([
            fetchCases({ scope: "dashboard" }),
            canDetect
              ? fetchDetections(true).catch(() => [])
              : Promise.resolve([]),
            canDetect
              ? fetchEvidence().catch(() => [])
              : Promise.resolve([]),
            canMonitor ? fetchCameras().catch(() => []) : Promise.resolve([]),
            canMonitor ? fetchLiveStatus().catch(() => null) : Promise.resolve(null),
            fetchNotifications(!isStudent).catch(() => []),
            isStudent ? fetchClarifications() : Promise.resolve([]),
            needResults
              ? fetchResultControls().catch(() => [])
              : Promise.resolve([]),
            role === "DEC"
              ? fetchDecDashboardAnalytics()
              : Promise.resolve(null),
            role === "UFM_COMMITTEE"
              ? fetchUfmCommitteeDashboardAnalytics()
              : Promise.resolve(null),
          ]);

        if (cancelled) return;
        setCases(Array.isArray(caseData) ? caseData : []);
        setClarifications(
          Array.isArray(clarificationData) ? clarificationData : []
        );
        setDetections(Array.isArray(detectionData) ? detectionData : []);
        setDetectionEvidence(Array.isArray(evidenceData) ? evidenceData : []);
        setCameras(Array.isArray(cameraData) ? cameraData : []);
        setLiveSessions(
          Array.isArray(liveStatusData?.sessions) ? liveStatusData.sessions : []
        );
        setUnread(
          isStudent
            ? unreadData.filter((notification) => !notification.is_read)
            : unreadData
        );
        setRecentNotifications(
          isStudent && Array.isArray(unreadData) ? unreadData : []
        );
        setResultControls(Array.isArray(resultData) ? resultData : []);
        setDecAnalytics(decAnalyticsData);
        setUfmCommitteeAnalytics(ufmCommitteeAnalyticsData);
      } catch {
        if (!cancelled) {
          setError("Unable to load dashboard data. Please try again.");
          setCases([]);
          setClarifications([]);
          setDetections([]);
          setDetectionEvidence([]);
          setCameras([]);
          setLiveSessions([]);
          setUnread([]);
          setRecentNotifications([]);
          setResultControls([]);
          setDecAnalytics(null);
          setUfmCommitteeAnalytics(null);
          setAdminStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role, canDetect, canMonitor, isStudent]);

  useEffect(() => {
    if (role !== "HOD" && role !== "EXAM_DEPARTMENT") return undefined;
    let cancelled = false;
    const [year, month] = hodTrendMonth.split("-").map(Number);

    async function loadHodAnalytics() {
      setHodAnalyticsLoading(true);
      setHodAnalyticsError("");
      setHodAnalytics(null);
      try {
        const data = await fetchHodDashboardAnalytics(year, month);
        if (!cancelled) setHodAnalytics(data);
      } catch {
        if (!cancelled) {
          setHodAnalyticsError(
            "Unable to load monthly case activity. Please try again."
          );
        }
      } finally {
        if (!cancelled) setHodAnalyticsLoading(false);
      }
    }

    loadHodAnalytics();
    return () => {
      cancelled = true;
    };
  }, [role, hodTrendMonth]);

  useEffect(() => {
    if (role !== "UFM_COMMITTEE") return undefined;
    let cancelled = false;
    const [year, month] = hodTrendMonth.split("-").map(Number);

    async function loadUfmAnalytics() {
      setUfmAnalyticsLoading(true);
      setUfmAnalyticsError("");
      try {
        const data = await fetchUfmCommitteeDashboardAnalytics(year, month);
        if (!cancelled) setUfmAnalytics(data);
      } catch (loadError) {
        if (!cancelled) {
          setUfmAnalyticsError(
            loadError.message || "Unable to load committee analytics."
          );
          setUfmAnalytics(null);
        }
      } finally {
        if (!cancelled) setUfmAnalyticsLoading(false);
      }
    }

    void loadUfmAnalytics();
    return () => {
      cancelled = true;
    };
  }, [role, hodTrendMonth]);

  useEffect(() => {
    if (role !== "EXAM_DEPARTMENT") return undefined;
    let cancelled = false;

    async function loadTodayExams() {
      try {
        const exams = await fetchExams();
        if (cancelled) return;
        const today = new Date();
        const todayKey = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, "0"),
          String(today.getDate()).padStart(2, "0"),
        ].join("-");
        const activeStatuses = new Set([
          "DRAFT",
          "SCHEDULED",
          "PUBLISHED",
          "IN_PROGRESS",
        ]);
        setTodayExamCount(
          exams.filter(
            (exam) =>
              exam.exam_date === todayKey && activeStatuses.has(exam.status)
          ).length
        );
        setTodayExamCountError("");
      } catch {
        if (!cancelled) {
          setTodayExamCount(null);
          setTodayExamCountError("Unable to load today's exam count.");
        }
      }
    }

    void loadTodayExams();
    const timer = window.setInterval(loadTodayExams, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role]);

  useEffect(() => {
    if (loading || (!canDetect && !canMonitor && !isStudent)) return undefined;
    let cancelled = false;

    const refresh = () => {
      if (!cancelled && !document.hidden) void refreshKpiData();
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    loading,
    canDetect,
    canMonitor,
    isStudent,
    detectionAlertVersion,
    refreshKpiData,
  ]);

  const kpiCards = useMemo(
    () =>
      buildRoleKpis({
        role,
        cases,
        detections,
        cameras,
        liveSessions,
        unread,
        clarifications,
        resultControls,
        userId: user?.id,
        adminStats,
        decAnalytics,
        ufmCommitteeAnalytics,
      }),
    [
      role,
      cases,
      detections,
      cameras,
      liveSessions,
      unread,
      clarifications,
      resultControls,
      user?.id,
      adminStats,
      decAnalytics,
      ufmCommitteeAnalytics,
    ]
  );

  const queueMeta = useMemo(() => queueMetaForRole(role), [role]);

  const queueCases = useMemo(
    () => casesForRoleQueue(cases, role, user?.id).slice(0, 8),
    [cases, role, user?.id]
  );

  const recentCases = useMemo(
    () =>
      [...cases]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        )
        .slice(0, 5),
    [cases]
  );

  const liveCameras = useMemo(
    () => cameras.filter(isLiveCamera),
    [cameras]
  );

  const statusSegments = useMemo(() => statusChartSegments(cases), [cases]);
  const studentStatusSegments = useMemo(
    () => studentCaseStatusSegments(cases, clarifications),
    [cases, clarifications]
  );
  const invigilatorStatusSegments = useMemo(
    () => invigilatorCaseStatusSegments(cases),
    [cases]
  );
  const violationSegments = useMemo(
    () => violationChartSegments(cases),
    [cases]
  );
  const hodViolationSegments = useMemo(
    () =>
      countByField(cases, "violation_type", {
        formatLabel: formatViolationLabel,
      }).map((segment) => ({
        ...segment,
        color: violationChartColor(segment.label),
      })),
    [cases]
  );
  const hodDepartmentSegments = useMemo(
    () => departmentWiseStats(cases),
    [cases]
  );
  const alertViolationSegments = useMemo(
    () =>
      countByField(
        detections.map((detection) => ({
          violation_type: detectionViolationCategory(
            detection.detection_type
          ),
        })),
        "violation_type",
        { formatLabel: (label) => label }
      ).map((segment) => ({
        ...segment,
        color:
          segment.label === "mobile phone"
            ? "#be123c"
            : segment.label === "electronic gadget"
              ? "#047857"
              : segment.color,
      })),
    [detections]
  );

  const casesById = useMemo(() => {
    const map = {};
    for (const c of cases) map[c.id] = c;
    return map;
  }, [cases]);

  const recentDetections = detections.slice(0, 6);
  const cameraPageSize = 6;
  const cameraPageCount = Math.max(
    1,
    Math.ceil(liveCameras.length / cameraPageSize)
  );
  const visibleCameras = liveCameras.slice(
    cameraPage * cameraPageSize,
    (cameraPage + 1) * cameraPageSize
  );
  const evidenceByDetection = useMemo(() => {
    const map = new Map();
    for (const item of detectionEvidence) {
      if (
        item?.detection_id != null &&
        !map.has(item.detection_id) &&
        String(item.evidence_type || "").toUpperCase() === "SNAPSHOT"
      ) {
        map.set(item.detection_id, item);
      }
    }
    return map;
  }, [detectionEvidence]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    async function loadPreviews() {
      const entries = await Promise.all(
        [...evidenceByDetection.entries()].map(async ([detectionId, evidence]) => {
          try {
            const preview = await loadEvidenceObjectUrl(evidence.id, {
              preview: true,
              previewOnly: true,
            });
            objectUrls.push(preview.url);
            return [detectionId, preview.url];
          } catch {
            return [detectionId, null];
          }
        })
      );
      if (!cancelled) {
        setEvidencePreviewUrls(Object.fromEntries(entries));
      }
    }

    if (evidenceByDetection.size > 0) {
      loadPreviews();
    } else {
      setEvidencePreviewUrls({});
    }

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [evidenceByDetection]);

  useEffect(() => {
    setCameraPage((page) => Math.min(page, cameraPageCount - 1));
  }, [cameraPageCount]);
  const showHolds = role === "EXAM_DEPARTMENT";
  const showCharts =
    !isStudent &&
    role !== "ADMINISTRATOR" &&
    role !== "EXAM_DEPARTMENT" &&
    (role === "INVIGILATOR" ||
      role === "EXAM_DEPARTMENT" ||
      role === "UFM_COMMITTEE" ||
      role === "DEC");
  const showDashboardAnalytics = role === "HOD" || role === "EXAM_DEPARTMENT";
  const showCaseQueue =
    role !== "ADMINISTRATOR" && role !== "INVIGILATOR";
  const showSecondaryQueues =
    role === "DEC" ||
    role === "EXAM_DEPARTMENT" ||
    role === "HOD" ||
    role === "UFM_COMMITTEE";

  const activeHolds = resultControls.filter((r) => r.result_status === "HELD");
  const compactDashboard =
    role === "INVIGILATOR" ||
    role === "HOD" ||
    role === "DEC" ||
    role === "EXAM_DEPARTMENT" ||
    role === "UFM_COMMITTEE" ||
    role === "STUDENT";
  return (
    <PageShell
      className={
        compactDashboard
          ? `compact-kpi-dashboard${
              role === "DEC" ? " dec-kpi-dashboard" : ""
            }${role === "STUDENT" ? " student-kpi-dashboard" : ""}`
          : ""
      }
    >
      <PageHeader
        breadcrumb="Home / Dashboard"
        title={dashboardTitle(role)}
        actions={
          <>
            {role === "EXAM_DEPARTMENT" ? (
              <div
                className="flex items-center gap-2 rounded-md border border-blue-100 bg-white px-3 py-2"
                title={todayExamCountError || undefined}
              >
                <Building2
                  className="h-5 w-5 shrink-0 text-au-blue"
                  aria-hidden
                />
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold text-slate-600">
                    Active Exams Today
                  </p>
                  <p
                    className="text-sm font-bold tabular-nums text-au-blue"
                    aria-live="polite"
                  >
                    {todayExamCount == null
                      ? todayExamCountError
                        ? "Unavailable"
                        : "…"
                      : String(todayExamCount).padStart(2, "0")}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 tabular-nums">
              {new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </>
        }
      />

      {error ? (
        <ErrorBanner
          title="Unable to load dashboard data."
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}

      {loading ? <LoadingState label="Loading dashboard…" /> : null}

      {!loading && !error ? (
        <>
          <div
            className={`grid min-w-0 gap-3 sm:grid-cols-2 ${
              compactDashboard
                ? role === "EXAM_DEPARTMENT" || role === "STUDENT"
                  ? "lg:grid-cols-4"
                  : "lg:grid-cols-5"
                : "xl:grid-cols-4"
            }`}
          >
            {kpiCards.map((card) => (
              <KpiCard key={card.title} {...card} />
            ))}
          </div>

          {showDashboardAnalytics ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <DonutChart
                  title="Violation Type Distribution"
                  segments={hodViolationSegments}
                  emptyLabel="No violation data is available yet."
                />
                <CasesByDepartmentChart segments={hodDepartmentSegments} />
              </div>
              <CasesTrendChart
                analytics={hodAnalytics}
                month={hodTrendMonth}
                monthOptions={hodTrendMonthOptions}
                onMonthChange={setHodTrendMonth}
                loading={hodAnalyticsLoading}
                error={hodAnalyticsError}
              />
            </div>
          ) : null}

          {role === "UFM_COMMITTEE" ? (
            <section aria-label="UFM Committee analytics" className="space-y-3">
              {ufmAnalyticsError ? (
                <ErrorBanner
                  title="Unable to load committee analytics."
                  message={ufmAnalyticsError}
                  onRetry={() => {
                    const [year, month] = hodTrendMonth.split("-").map(Number);
                    setUfmAnalyticsLoading(true);
                    fetchUfmCommitteeDashboardAnalytics(year, month)
                      .then(setUfmAnalytics)
                      .catch((loadError) =>
                        setUfmAnalyticsError(
                          loadError.message ||
                            "Unable to load committee analytics."
                        )
                      )
                      .finally(() => setUfmAnalyticsLoading(false));
                  }}
                />
              ) : null}
              <div className="grid gap-4 lg:grid-cols-3">
                <CasesTrendChart
                  analytics={{
                    received: ufmAnalytics?.received || [],
                    forwarded: ufmAnalytics?.decided || [],
                    resolved: ufmAnalytics?.closed || [],
                  }}
                  month={hodTrendMonth}
                  monthOptions={hodTrendMonthOptions}
                  onMonthChange={setHodTrendMonth}
                  loading={ufmAnalyticsLoading}
                  seriesConfig={[
                    { key: "received", label: "Received", color: "#7c3aed" },
                    { key: "forwarded", label: "Decided", color: "#f59e0b" },
                    { key: "resolved", label: "Closed", color: "#10b981" },
                  ]}
                />
                <DonutChart
                  title="Violation Type Distribution"
                  segments={(ufmAnalytics?.violation_distribution || []).map(
                    ({ label, count }) => ({
                      label: formatViolationLabel(label),
                      count,
                      color: violationChartColor(label),
                    })
                  )}
                  emptyLabel="No committee decisions for this month."
                />
                <DonutChart
                  title="Cases by Outcome (This Month)"
                  segments={[
                    {
                      label: "Penalty Implemented",
                      count: ufmAnalytics?.outcomes?.penalty_implemented || 0,
                      color: "#16a34a",
                    },
                    {
                      label: "Case Dismissed",
                      count: ufmAnalytics?.outcomes?.case_dismissed || 0,
                      color: "#ef4444",
                    },
                  ]}
                  emptyLabel="No finalized outcomes for this month."
                />
              </div>
            </section>
          ) : null}

          {role === "INVIGILATOR" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DetectionTrendChart detections={detections} />
              <DonutChart
                title="Violation distribution"
                segments={alertViolationSegments}
                emptyLabel="No confirmed alerts yet."
              />
              <RecentCasesPanel cases={recentCases} />
              <DonutChart
                title="Case Status Overview"
                segments={invigilatorStatusSegments}
                emptyLabel="No cases have been reported yet."
                percentagePrecision={1}
              />
            </div>
          ) : null}

          {isStudent ? (
            <div className="grid items-stretch gap-3 lg:grid-cols-2">
              <div className="student-status-overview">
                <DonutChart
                  title="Case Status Overview"
                  segments={studentStatusSegments}
                  emptyLabel="No UFM cases have been linked to your profile yet."
                  compact
                />
              </div>
              <StudentRecentNotifications
                notifications={recentNotifications}
              />
            </div>
          ) : null}

          {isStudent && queueCases.length > 0 ? (
            <div className="portal-callout flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                You have <strong>{queueCases.length}</strong> open UFM case
                {queueCases.length === 1 ? "" : "s"}.
              </p>
              <Link to="/app/clarification" className="btn-primary btn-sm">
                Clarification / Required Actions
              </Link>
            </div>
          ) : null}

          {role === "ADMINISTRATOR" && adminStats ? (
            <SectionPanel
              title="Role breakdown"
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(adminStats.by_role || {}).map(([r, n]) => (
                  <div
                    key={r}
                    className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {r.replaceAll("_", " ")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums text-au-navy">
                      {n}
                    </p>
                  </div>
                ))}
              </div>
            </SectionPanel>
          ) : null}

          {canMonitor || canDetect ? (
            <div
              className={[
                "grid gap-4",
                canMonitor && canDetect ? "xl:grid-cols-3" : "",
              ].join(" ")}
            >
              {canMonitor ? (
                <SectionPanel
                  className={canDetect ? "xl:col-span-2" : ""}
                  bodyClassName="camera-panel-body"
                  title="Examination monitoring"
                  actions={
                    <Link to="/app/monitoring" className="btn-ghost btn-sm">
                      Open Live Monitoring
                    </Link>
                  }
                >
                  {liveCameras.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No cameras are registered yet.
                    </p>
                  ) : (
                    <div className="camera-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleCameras.map((cam) => (
                        <Link
                          key={cam.id}
                          to={`/app/monitoring?cameraId=${encodeURIComponent(cam.id)}`}
                          className="portal-media-nav"
                          data-affordance="interactive"
                          aria-label={`Go live on ${cam.name || cam.camera_id}`}
                        >
                          <div className="flex h-24 flex-col items-center justify-center gap-1 px-3 text-center text-slate-400">
                            <span className="text-xs font-medium text-slate-300">
                              {cam.name}
                            </span>
                            <span className="text-[10px] font-semibold text-sky-300">
                              Go live →
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-au-navy">
                                {cam.camera_id}
                              </p>
                            </div>
                            <span
                              className={[
                                "shrink-0 rounded px-2 py-0.5 text-[10px] font-bold text-white",
                                cam.is_active ? "bg-emerald-600" : "bg-rose-500",
                              ].join(" ")}
                            >
                              {cam.is_active ? "READY" : "OFF"}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {cameraPageCount > 1 ? (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        className="camera-page-button"
                        disabled={cameraPage === 0}
                        onClick={() => setCameraPage((page) => page - 1)}
                      >
                        ← Previous
                      </button>
                      <span className="text-xs font-medium text-slate-500">
                        Page {cameraPage + 1} of {cameraPageCount}
                      </span>
                      <button
                        type="button"
                        className="camera-page-button"
                        disabled={cameraPage >= cameraPageCount - 1}
                        onClick={() => setCameraPage((page) => page + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  ) : null}
                </SectionPanel>
              ) : null}

              {canDetect ? (
                <SectionPanel
                  title="Real-time Alerts"
                  className="realtime-alerts-panel"
                >
                  {recentDetections.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No confirmed detections yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {recentDetections.map((d) => (
                        <li
                          key={d.id}
                          className="realtime-alert-row"
                          data-affordance="static"
                          role="link"
                          tabIndex={0}
                          onClick={() =>
                            navigate(`/app/detections?detection_id=${d.id}`)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigate(`/app/detections?detection_id=${d.id}`);
                            }
                          }}
                        >
                          <div className="flex w-full items-center gap-3">
                            {evidencePreviewUrls[d.id] ? (
                              <img
                                src={evidencePreviewUrls[d.id]}
                                alt={`${formatViolationLabel(d.detection_type)} evidence`}
                                className="h-12 w-16 shrink-0 rounded-md border border-slate-200 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span
                                className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                                aria-label="Evidence preview unavailable"
                              >
                                No image
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className={`realtime-alert-label realtime-alert-label-${alertTone(d.detection_type)}`}>
                                  {formatViolationLabel(d.detection_type)}
                                </p>
                                {!d.is_seen ? (
                                  <span className="realtime-alert-new shrink-0 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    NEW
                                  </span>
                                ) : null}
                              </div>
                              <p className="realtime-alert-meta">
                                Camera {d.camera_id ?? "—"} · Confidence{" "}
                                {(Number(d.confidence || 0) * 100).toFixed(0)}%
                              </p>
                              <p className="realtime-alert-time">
                                {formatWhen(d.timestamp)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to="/app/detections" className="realtime-alerts-action">
                    Go to Detections &amp; Alerts
                    <span aria-hidden="true">→</span>
                  </Link>
                </SectionPanel>
              ) : null}
            </div>
          ) : null}

          {showCaseQueue ? (
            <div className="grid gap-4">
              <CaseQueueTable
                title={queueMeta.title}
                cases={queueCases}
                emptyLabel={queueMeta.empty}
                actionLabel={queueMeta.action}
                viewAllTo={queueMeta.viewAll}
              />

              {showHolds ? (
                <SectionPanel
                  title="Result holds"
                  actions={
                    <Link
                      to="/app/result-controls"
                      className="btn-ghost btn-sm"
                    >
                      Open Result Controls →
                    </Link>
                  }
                  bodyClassName="p-0"
                >
                  {activeHolds.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-500">
                      No students currently have an active result hold.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {activeHolds.slice(0, 8).map((r) => {
                        const linked = casesById[r.case_id];
                        const name =
                          r.student_name ||
                          linked?.student_name ||
                          `Student #${r.student_id}`;
                        const roll =
                          r.student_roll || linked?.student_roll || null;
                        const caseNo =
                          r.case_number ||
                          linked?.case_number ||
                          `Case #${r.case_id}`;
                        return (
                          <li key={r.id} className="px-5 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-au-navy">
                                  {name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {roll ? `Roll ${roll} · ` : ""}
                                  <Link
                                    to={`/app/cases/${r.case_id}`}
                                    className="text-au-blue hover:underline"
                                  >
                                    {caseNo}
                                  </Link>
                                </p>
                              </div>
                              <StatusBadge status={r.result_status} />
                            </div>
                            {r.reason ? (
                              <p className="mt-1 line-clamp-2 text-slate-600">
                                {r.reason}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionPanel>
              ) : null}
            </div>
          ) : null}

          {showCharts && role !== "INVIGILATOR" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DonutChart
                title={isStudent ? "My cases by status" : "UFM cases by status"}
                segments={statusSegments}
                emptyLabel="No UFM cases yet — status distribution will appear here."
              />
              <DonutChart
                title="Violation type distribution"
                segments={violationSegments}
                emptyLabel="No violation data yet."
              />
            </div>
          ) : null}

          {showSecondaryQueues ? (
            role === "HOD" || role === "DEC" ? (
              role === "HOD" ? (
                <CaseQueueTable
                  title="Recent UFM cases"
                  cases={[...cases]
                    .sort(
                      (a, b) =>
                        new Date(b.created_at || 0) -
                        new Date(a.created_at || 0)
                    )
                    .slice(0, 6)}
                  emptyLabel="No recent UFM activity."
                  actionLabel="Open"
                  viewAllTo="/app/cases"
                />
              ) : (
                <CaseQueueTable
                  title="Closed / decided"
                  cases={cases
                    .filter(
                      (c) =>
                        c.status === "APPROVED" || c.status === "REJECTED"
                    )
                    .slice(0, 6)}
                  emptyLabel="No final decisions yet."
                  actionLabel="Open"
                  viewAllTo="/app/cases"
                />
              )
            ) : (
              <div className="space-y-4">
                {role === "EXAM_DEPARTMENT" ? (
                  <>
                    <CaseQueueTable
                      title="At UFM Committee"
                      cases={cases
                        .filter((c) => c.status === "UFM_COMMITTEE_REVIEW")
                        .slice(0, 6)}
                      emptyLabel="Nothing forwarded to committee yet."
                      actionLabel="Open"
                      viewAllTo="/app/cases?status=UFM_COMMITTEE_REVIEW"
                    />
                    <CaseQueueTable
                      title="Closed / decided"
                      cases={cases
                        .filter(
                          (c) =>
                            c.status === "APPROVED" || c.status === "REJECTED"
                        )
                        .slice(0, 6)}
                      emptyLabel="No final decisions yet."
                      actionLabel="Open"
                    />
                  </>
                ) : null}
                {role === "UFM_COMMITTEE" ? (
                  <>
                    <CaseQueueTable
                      title="Approved decisions"
                      cases={cases
                        .filter((c) => c.status === "APPROVED")
                        .slice(0, 6)}
                      emptyLabel="No approved decisions yet."
                      actionLabel="Open"
                      viewAllTo="/app/cases?status=APPROVED"
                    />
                    <CaseQueueTable
                      title="Rejected cases"
                      cases={cases
                        .filter((c) => c.status === "REJECTED")
                        .slice(0, 6)}
                      emptyLabel="No rejected decisions yet."
                      actionLabel="Open"
                    />
                  </>
                ) : null}
              </div>
            )
          ) : null}

          {!isStudent && unread.length > 0 ? (
            <SectionPanel
              title="Unread notifications"
              actions={
                <Link to="/app/notifications" className="btn-ghost btn-sm">
                  Open inbox
                </Link>
              }
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-slate-100">
                {unread.slice(0, 5).map((n) => {
                  const dest =
                    destinationForNotification(n, role) || "/app/notifications";
                  return (
                    <li key={n.id}>
                      <Link
                        to={dest}
                        onClick={() => {
                          if (!n.is_read) {
                            markNotificationRead(n.id).catch(() => {});
                          }
                        }}
                        className="portal-option flex items-start justify-between gap-3 px-5 py-3 text-sm hover:bg-sky-200 focus-visible:bg-sky-200"
                        data-affordance="interactive"
                      >
                        <span className="min-w-0">
                          <p className="font-medium text-au-navy">{n.title}</p>
                          <p className="line-clamp-2 text-slate-600">
                            {formatNotificationMessage(n)}
                          </p>
                          {n.case_number ? (
                            <p className="mt-1 text-xs text-au-blue">
                              {n.case_number}
                            </p>
                          ) : null}
                        </span>
                        <span
                          className="shrink-0 text-au-blue"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SectionPanel>
          ) : !isStudent ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-white/60 px-4 py-4 text-sm text-slate-500">
              No unread notifications.
            </div>
          ) : null}

        </>
      ) : null}
    </PageShell>
  );
}
