import {
  Activity,
  BadgeCheck,
  BellRing,
  Building2,
  Camera,
  CircleCheck,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Hourglass,
  Inbox,
  SearchCheck,
  Send,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  UsersRound,
} from "lucide-react";

function iconForTitle(title = "") {
  const value = title.toLowerCase();
  if (value === "ufm cases") {
    return { Icon: ShieldCheck, tone: "blue" };
  }
  if (value.includes("pending clarification")) {
    return { Icon: ClipboardCheck, tone: "orange" };
  }
  if (value.includes("resolved cases")) {
    return { Icon: FileText, tone: "purple" };
  }
  if (value.includes("closed cases")) {
    return { Icon: CircleCheck, tone: "green" };
  }
  if (value.includes("cases under review")) {
    return { Icon: FolderOpen, tone: "blue" };
  }
  if (value.includes("at committee")) {
    return { Icon: Building2, tone: "purple" };
  }
  if (value.includes("active result holds")) {
    return { Icon: CircleCheck, tone: "green" };
  }
  if (value.includes("unread notifications")) {
    return { Icon: BellRing, tone: "red" };
  }
  if (value.includes("received from hod")) {
    return { Icon: Inbox, tone: "purple" };
  }
  if (value.includes("under investigation")) {
    return { Icon: SearchCheck, tone: "orange" };
  }
  if (value.includes("forwarded to exam dept")) {
    return { Icon: Send, tone: "blue" };
  }
  if (value.includes("at ufm committee")) {
    return { Icon: ClipboardCheck, tone: "green" };
  }
  if (value.includes("returned to hod")) {
    return { Icon: Undo2, tone: "red" };
  }
  if (value.includes("resolved") || value.includes("closed")) {
    return { Icon: BadgeCheck, tone: "green" };
  }
  if (value.includes("pending review")) {
    return { Icon: Hourglass, tone: "purple" };
  }
  if (value.includes("awaiting implementation")) {
    return { Icon: Hourglass, tone: "orange" };
  }
  if (value.includes("decisions this month")) {
    return { Icon: ClipboardCheck, tone: "blue" };
  }
  if (value.includes("total closed cases")) {
    return { Icon: Activity, tone: "red" };
  }
  if (value.includes("awaiting review")) {
    return { Icon: Hourglass, tone: "purple" };
  }
  if (value.includes("forwarded to dec")) {
    return { Icon: FolderOpen, tone: "orange" };
  }
  if (value.includes("department cases")) {
    return { Icon: FolderOpen, tone: "blue" };
  }
  if (value.includes("unread notification")) {
    return { Icon: BellRing, tone: "red" };
  }
  if (value.includes("active alert")) {
    return { Icon: TriangleAlert, tone: "orange" };
  }
  if (value.includes("live camera")) {
    return { Icon: Camera, tone: "red" };
  }
  if (value.includes("my open cases")) {
    return { Icon: FolderOpen, tone: "blue" };
  }
  if (value.includes("camera") || value.includes("monitor")) {
    return { Icon: Camera, tone: "blue" };
  }
  if (value.includes("notification")) {
    return { Icon: BellRing, tone: "violet" };
  }
  if (value.includes("user") || value.includes("student")) {
    return { Icon: UsersRound, tone: "teal" };
  }
  if (value.includes("approved") || value.includes("active")) {
    return { Icon: BadgeCheck, tone: "green" };
  }
  if (value.includes("detection") || value.includes("alert")) {
    return { Icon: TriangleAlert, tone: "orange" };
  }
  if (value.includes("case") || value.includes("review")) {
    return { Icon: FolderOpen, tone: "purple" };
  }
  if (value.includes("hold") || value.includes("result")) {
    return { Icon: ClipboardCheck, tone: "red" };
  }
  return { Icon: Activity, tone: "blue" };
}

/**
 * Static KPI / statistic card — C13-FIX information-only language.
 * Analytical resting appearance; never navigates.
 */
export default function KpiCard({
  title,
  value,
  hint,
  footer,
  compact = false,
  padValue = compact,
  hintTone = "slate",
  accent = "border-l-slate-400",
}) {
  const { Icon, tone } = iconForTitle(title);
  const formattedValue =
    padValue && typeof value === "number" && value < 10
      ? String(value).padStart(2, "0")
      : value;

  return (
    <div
      className={`portal-kpi ${compact ? "portal-kpi-compact" : ""} ${accent}`}
      data-affordance="static"
      role="group"
      aria-label={`${title}: ${value}`}
    >
      {compact ? (
        <div className="portal-kpi-main">
          <span className={`portal-kpi-icon portal-kpi-icon-${tone}`}>
            <Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="portal-kpi-content">
            <p className="portal-kpi-label">{title}</p>
            <div className="portal-kpi-metric">
              <p className="portal-kpi-value">{formattedValue}</p>
              {hint ? (
                <p className={`portal-kpi-hint portal-kpi-hint-${hintTone}`}>
                  <span aria-hidden="true" className="portal-kpi-hint-dot" />
                  {hint}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="portal-kpi-label">{title}</p>
              <p className="portal-kpi-value">{value}</p>
            </div>
            <span className={`portal-kpi-icon portal-kpi-icon-${tone}`}>
              <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
          </div>
          {hint ? (
            <p className="portal-kpi-hint">
              <span aria-hidden="true" className="portal-kpi-hint-dot" />
              {hint}
            </p>
          ) : null}
        </>
      )}
      {footer ? <p className="portal-kpi-footer">{footer}</p> : null}
    </div>
  );
}
