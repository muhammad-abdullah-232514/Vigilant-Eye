import { Link } from "react-router-dom";
import {
  BarChart3,
  BellRing,
  Camera,
  CircleHelp,
  ClipboardCheck,
  FilePlus2,
  FolderKanban,
  Image,
  ListChecks,
  MessageCircleQuestion,
  MonitorPlay,
  Plus,
  ShieldCheck,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";

const ICON_PROPS = {
  className: "h-[18px] w-[18px]",
  strokeWidth: 1.9,
  "aria-hidden": true,
};

const ICONS = {
  cases: FolderKanban,
  queue: ListChecks,
  evidence: Image,
  reports: BarChart3,
  audit: ShieldCheck,
  monitor: MonitorPlay,
  detections: Camera,
  results: ClipboardCheck,
  clarification: MessageCircleQuestion,
  notifications: BellRing,
  help: CircleHelp,
  users: UsersRound,
  import: Upload,
  roles: UserRound,
  create: FilePlus2,
  default: Plus,
};

export function resolveActionIcon(to = "", label = "") {
  const hay = `${to} ${label}`.toLowerCase();
  if (
    hay.includes("cases/new") ||
    hay.includes("create ufm") ||
    (hay.includes("report") && (hay.includes("ufm") || hay.includes("incident")))
  )
    return "create";
  if (hay.includes("pending") || hay.includes("queue") || hay.includes("review"))
    return "queue";
  if (hay.includes("evidence")) return "evidence";
  if (hay.includes("report") && !hay.includes("ufm") && !hay.includes("incident"))
    return "reports";
  if (hay.includes("audit") || hay.includes("security")) return "audit";
  if (hay.includes("monitor")) return "monitor";
  if (hay.includes("detection")) return "detections";
  if (hay.includes("result")) return "results";
  if (hay.includes("clarification")) return "clarification";
  if (hay.includes("notification")) return "notifications";
  if (hay.includes("help")) return "help";
  if (hay.includes("import")) return "import";
  if (hay.includes("role")) return "roles";
  if (hay.includes("student")) return "users";
  if (hay.includes("user") || hay.includes("add user")) return "users";
  if (hay.includes("case") || hay.includes("incident") || hay.includes("ufm"))
    return "cases";
  return "default";
}

/**
 * Clickable navigation/action card — C13-FIX resting-state interactive language.
 * Structure: [icon] title + action hint [chevron]
 * Do not use for KPI/statistics (see KpiCard).
 */
export default function ActionNavCard({
  to,
  label,
  primary = false,
  icon,
  className = "",
}) {
  const iconKey = icon || resolveActionIcon(to, label);
  const Icon = ICONS[iconKey] || ICONS.default;

  return (
    <Link
      to={to}
      className={["portal-action-tile", primary ? "primary" : "", className]
        .filter(Boolean)
        .join(" ")}
      data-affordance="interactive"
    >
      <span className="tile-icon" aria-hidden="true">
        <Icon {...ICON_PROPS} />
      </span>
      <span className="tile-body">
        <span className="tile-label">{label}</span>
      </span>
      <span className="tile-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
