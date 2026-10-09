/** Role-aware dashboard KPIs, queues, and quick actions — derived from real API data only. */

import {
  formatStatusLabel,
  formatViolationLabel,
} from "./casePresentation";
import { isLiveCamera } from "./cameraSources";

export const OPEN_STATUSES = new Set([
  "PENDING",
  "UNDER_REVIEW",
  "DEC_REVIEW",
  "EXAM_DEPARTMENT_REVIEW",
  "EXAM_DEPARTMENT_IMPLEMENTATION",
  "UFM_COMMITTEE_REVIEW",
]);

/** Primary status(es) each reviewing role acts on */
export const ROLE_QUEUE_STATUSES = {
  HOD: ["PENDING", "UNDER_REVIEW"],
  DEC: ["DEC_REVIEW"],
  EXAM_DEPARTMENT: [
    "EXAM_DEPARTMENT_REVIEW",
    "EXAM_DEPARTMENT_IMPLEMENTATION",
  ],
  UFM_COMMITTEE: ["UFM_COMMITTEE_REVIEW"],
};

export function casesForRoleQueue(cases, role, userId) {
  let list;
  if (role === "INVIGILATOR") {
    list = cases.filter(
      (c) => c.reported_by === userId && OPEN_STATUSES.has(c.status)
    );
  } else if (role === "STUDENT") {
    list = cases.filter((c) => OPEN_STATUSES.has(c.status));
  } else {
    const statuses = ROLE_QUEUE_STATUSES[role];
    list = statuses
      ? cases.filter((c) => statuses.includes(c.status))
      : cases.filter((c) => OPEN_STATUSES.has(c.status));
  }
  // Preserve latest-first even if upstream order changes (created_at DESC, id DESC).
  return [...list].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    if (tb !== ta) return tb - ta;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

function byStatus(cases, status) {
  return cases.filter((c) => c.status === status);
}

function heldControls(resultControls) {
  return (resultControls || []).filter((r) => r.result_status === "HELD");
}

function isToday(value) {
  if (!value) return false;
  const timestamp =
    typeof value === "string" && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
      ? `${value.trim()}Z`
      : value;
  const date = new Date(timestamp);
  const today = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function buildRoleKpis({
  role,
  cases,
  detections,
  cameras,
  liveSessions,
  unread,
  clarifications,
  resultControls,
  userId,
  adminStats,
  decAnalytics,
  ufmCommitteeAnalytics,
}) {
  const open = cases.filter((c) => OPEN_STATUSES.has(c.status));
  const approved = byStatus(cases, "APPROVED");
  const rejected = byStatus(cases, "REJECTED");
  const runningCameraIds = new Set(
    liveSessions
      .filter((session) => session.running && !session.is_demo)
      .map((session) => Number(session.camera_id))
  );
  const liveCameraIds = new Set(
    cameras
      .filter((camera) => camera.is_active && isLiveCamera(camera))
      .map((camera) => Number(camera.id))
  );
  const online = [...runningCameraIds].filter((id) => liveCameraIds.has(id)).length;
  const offline = Math.max(0, liveCameraIds.size - online);
  const detectionsToday = detections.filter((d) =>
    isToday(d.timestamp || d.created_at)
  ).length;
  const myCases = cases.filter((c) => c.reported_by === userId);
  const myOpen = myCases.filter((c) => OPEN_STATUSES.has(c.status));
  const pendingReviews = myCases.filter((c) =>
    ["PENDING", "UNDER_REVIEW", "DEC_REVIEW"].includes(c.status)
  );
  const myResolved = myCases.filter(
    (c) =>
      (c.status === "APPROVED" || c.status === "REJECTED") &&
      isToday(c.updated_at || c.created_at)
  );
  const myClosed = myCases.filter(
    (c) => c.status === "APPROVED" || c.status === "REJECTED"
  );
  const held = heldControls(resultControls);
  const clarifiedCaseIds = new Set(
    (clarifications || []).map((clarification) => Number(clarification.case_id))
  );

  if (role === "ADMINISTRATOR") {
    const s = adminStats || {};
    const by = s.by_role || {};
    return [
      {
        title: "Total portal users",
        value: s.total ?? 0,
        accent: "border-l-slate-600",
      },
      {
        title: "Active",
        value: s.active ?? 0,
        accent: "border-l-emerald-500",
      },
      {
        title: "Students",
        value: by.STUDENT ?? 0,
        accent: "border-l-sky-500",
      },
      {
        title: "Administrators",
        value: by.ADMINISTRATOR ?? 0,
        accent: "border-l-violet-500",
      },
    ];
  }

  if (role === "HOD") {
    const pending = cases.filter((c) =>
      ROLE_QUEUE_STATUSES.HOD.includes(c.status)
    );
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(
      startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)
    );
    const startOfNextWeek = new Date(startOfWeek);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
    const forwardedThisWeek = cases.filter((c) => {
      if (c.status !== "DEC_REVIEW") return false;
      const updatedAt = c.updated_at || c.created_at;
      if (!updatedAt) return false;
      const timestamp =
        typeof updatedAt === "string" &&
        !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(updatedAt.trim())
          ? `${updatedAt.trim()}Z`
          : updatedAt;
      const date = new Date(timestamp);
      return (
        !Number.isNaN(date.getTime()) &&
        date >= startOfWeek &&
        date < startOfNextWeek
      );
    });
    const resolvedThisMonth = cases.filter((c) => {
      if (c.status !== "APPROVED" && c.status !== "REJECTED") return false;
      const updatedAt = c.updated_at || c.created_at;
      if (!updatedAt) return false;
      const timestamp =
        typeof updatedAt === "string" &&
        !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(updatedAt.trim())
          ? `${updatedAt.trim()}Z`
          : updatedAt;
      const date = new Date(timestamp);
      const now = new Date();
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    });
    return [
      {
        title: "Cases Awaiting Review",
        value: pending.length,
        hint: "From Invigilators",
        footer: `Total ${pending.length} awaiting HOD`,
        hintTone: "purple",
        compact: true,
        accent: "border-l-violet-500",
      },
      {
        title: "Forwarded to DEC",
        value: forwardedThisWeek.length,
        hint: "This Week",
        footer: `${byStatus(cases, "DEC_REVIEW").length} currently with DEC`,
        hintTone: "orange",
        compact: true,
        accent: "border-l-sky-500",
      },
      {
        title: "Total Department Cases",
        value: cases.length,
        hint: "Visible to HOD",
        footer: `${open.length} active cases`,
        hintTone: "blue",
        compact: true,
        accent: "border-l-blue-500",
      },
      {
        title: "Resolved Cases",
        value: resolvedThisMonth.length,
        hint: "This Month",
        footer: `${approved.length + rejected.length} resolved overall`,
        hintTone: "green",
        compact: true,
        accent: "border-l-emerald-500",
      },
      {
        title: "Unread Notifications",
        value: unread.length,
        hint: "Awaiting Attention",
        footer: "Unread in your inbox",
        hintTone: "orange",
        compact: true,
        accent: "border-l-rose-500",
      },
    ];
  }

  if (role === "DEC") {
    return [
      {
        title: "Received from HOD",
        value: decAnalytics?.received_this_month ?? 0,
        hint: "This Month",
        hintTone: "purple",
        compact: true,
        accent: "border-l-violet-500",
      },
      {
        title: "Under Investigation",
        value: byStatus(cases, "DEC_REVIEW").length,
        hint: "In Progress",
        hintTone: "orange",
        compact: true,
        accent: "border-l-orange-500",
      },
      {
        title: "Forwarded to Exam Dept.",
        value: decAnalytics?.forwarded_this_week ?? 0,
        hint: "This Week",
        hintTone: "blue",
        compact: true,
        padValue: false,
        accent: "border-l-sky-500",
      },
      {
        title: "At UFM Committee",
        value: byStatus(cases, "UFM_COMMITTEE_REVIEW").length,
        hint: "Awaiting Committee",
        hintTone: "green",
        compact: true,
        accent: "border-l-emerald-500",
      },
      {
        title: "Returned to HOD",
        value: decAnalytics?.returned_this_month ?? 0,
        hint: "This Month",
        hintTone: "red",
        compact: true,
        accent: "border-l-rose-500",
      },
    ];
  }

  if (role === "EXAM_DEPARTMENT") {
    return [
      {
        title: "Cases Under Review",
        value:
          byStatus(cases, "EXAM_DEPARTMENT_REVIEW").length +
          byStatus(cases, "EXAM_DEPARTMENT_IMPLEMENTATION").length,
        hint: "Awaiting action",
        hintTone: "purple",
        compact: true,
        accent: "border-l-violet-500",
      },
      {
        title: "At committee",
        value: byStatus(cases, "UFM_COMMITTEE_REVIEW").length,
        hint: "Awaiting decision",
        hintTone: "blue",
        compact: true,
        accent: "border-l-sky-500",
      },
      {
        title: "Active result holds",
        value: held.length,
        hint: "Currently active",
        hintTone: "orange",
        compact: true,
        accent: "border-l-rose-500",
      },
      {
        title: "Unread notifications",
        value: unread.length,
        hint: "Awaiting attention",
        hintTone: "green",
        compact: true,
        accent: "border-l-orange-500",
      },
    ];
  }

  if (role === "UFM_COMMITTEE") {
    return [
      {
        title: "Cases for Final Review",
        value: ufmCommitteeAnalytics?.cases_for_final_review ?? 0,
        hint: "Awaiting decision",
        hintTone: "purple",
        compact: true,
        accent: "border-l-violet-500",
      },
      {
        title: "Awaiting Implementation",
        value: ufmCommitteeAnalytics?.awaiting_implementation ?? 0,
        hint: "Approved by committee",
        hintTone: "orange",
        compact: true,
        padValue: false,
        accent: "border-l-orange-500",
      },
      {
        title: "Decisions This Month",
        value: ufmCommitteeAnalytics?.decisions_this_month ?? 0,
        hint: "Committee actions",
        hintTone: "blue",
        compact: true,
        accent: "border-l-sky-500",
      },
      {
        title: "Closed Cases This Month",
        value: ufmCommitteeAnalytics?.closed_cases_this_month ?? 0,
        hint: "Finalized",
        hintTone: "green",
        compact: true,
        accent: "border-l-emerald-500",
      },
      {
        title: "Total Closed Cases",
        value: ufmCommitteeAnalytics?.total_closed_cases ?? 0,
        hint: "All time",
        hintTone: "red",
        compact: true,
        accent: "border-l-rose-500",
      },
    ];
  }

  if (role === "STUDENT") {
    const resolved = cases.filter(
      (c) => c.status === "APPROVED" || c.status === "REJECTED"
    );
    const now = new Date();
    const currentSemester = `${now.getMonth() < 6 ? "Spring" : "Fall"} ${now.getFullYear()}`;

    return [
      {
        title: "UFM Cases",
        value: cases.length,
        hint: "Total Cases",
        hintTone: "blue",
        compact: true,
        accent: "border-l-sky-500",
      },
      {
        title: "Pending Clarification",
        value: cases.filter((c) => !clarifiedCaseIds.has(Number(c.id))).length,
        hint: "Requires Your Response",
        hintTone: "orange",
        compact: true,
        accent: "border-l-orange-500",
      },
      {
        title: "Resolved Cases",
        value: resolved.filter(
          (c) =>
            c.exam_semester?.trim().toLowerCase() ===
            currentSemester.toLowerCase()
        ).length,
        hint: "This Semester",
        hintTone: "purple",
        compact: true,
        padValue: false,
        accent: "border-l-violet-500",
      },
      {
        title: "Closed Cases",
        value: resolved.length,
        hint: "All Time",
        hintTone: "green",
        compact: true,
        padValue: false,
        accent: "border-l-emerald-500",
      },
    ];
  }

  // INVIGILATOR
  return [
    {
      title: "Live Cameras",
      value: online,
      hint: "Online",
      footer: `${offline} Offline`,
      hintTone: "green",
      compact: true,
      accent: "border-l-emerald-500",
    },
    {
      title: "Active Alerts",
      value: detectionsToday,
      hint: "New Today",
      footer: `Total ${detections.length} confirmed`,
      hintTone: "orange",
      compact: true,
      accent: "border-l-orange-500",
    },
    {
      title: "My Open Cases",
      value: myOpen.length,
      hint: "Awaiting review",
      footer: `Total ${myCases.length} reported`,
      hintTone: "blue",
      compact: true,
      accent: "border-l-sky-500",
    },
    {
      title: "Pending Reviews",
      value: pendingReviews.length,
      hint: "From HOD / DEC",
      footer: `Total ${myOpen.length} open`,
      hintTone: "purple",
      compact: true,
      accent: "border-l-purple-500",
    },
    {
      title: "Resolved Today",
      value: myResolved.length,
      hint: "Closed Today",
      footer: `Total ${myClosed.length} closed`,
      hintTone: "green",
      compact: true,
      accent: "border-l-emerald-500",
    },
  ];
}

export function queueMetaForRole(role) {
  if (role === "ADMINISTRATOR") {
    return {
      title: "Authorization overview",
      empty: "No portal users.",
      action: "Open",
      viewAll: "/app/admin/users",
    };
  }
  if (role === "INVIGILATOR") {
    return {
      title: "My open UFM cases",
      empty: "You have no open UFM cases.",
      action: "Open",
      viewAll: "/app/cases",
    };
  }
  if (role === "STUDENT") {
    return {
      title: "My UFM cases needing attention",
      empty: "No open UFM cases on your profile.",
      action: "View case",
      viewAll: "/app/cases",
    };
  }
  if (role === "HOD") {
    return {
      title: "Pending department review",
      empty: "No UFM cases require HOD attention.",
      action: "Review",
      viewAll: "/app/cases?scope=active",
    };
  }
  if (role === "DEC") {
    return {
      title: "Cases Received from HOD",
      empty: "No UFM cases require DEC attention.",
      action: "Review",
      viewAll: "/app/cases?status=DEC_REVIEW",
    };
  }
  if (role === "EXAM_DEPARTMENT") {
    return {
      title: "Cases Under Review",
      empty: "No UFM cases are currently under review by the Exam Department.",
      action: "Open",
      viewAll: "/app/cases?scope=active",
    };
  }
  if (role === "UFM_COMMITTEE") {
    return {
      title: "Final review queue",
      empty: "No UFM cases await committee decision.",
      action: "Decide",
      viewAll: "/app/cases?status=UFM_COMMITTEE_REVIEW",
    };
  }
  return {
    title: "Review queue",
    empty: "No UFM cases require your attention.",
    action: "Open",
    viewAll: "/app/cases",
  };
}

export function quickActionsForRole(role) {
  if (role === "ADMINISTRATOR") {
    return [
      { to: "/app/admin/users", label: "Manage Users", tone: "violet" },
      { to: "/app/admin/import", label: "Import CSV", tone: "sky" },
      { to: "/app/admin/audit", label: "Admin Audit Log", tone: "slate" },
    ];
  }
  if (role === "INVIGILATOR") {
    return [
      { to: "/app/cases/new", label: "Create UFM Case", tone: "sky" },
      { to: "/app/cases", label: "My Cases", tone: "slate" },
      { to: "/app/evidence", label: "Evidence Library", tone: "violet" },
      { to: "/app/monitoring", label: "Live Monitoring", tone: "emerald" },
      { to: "/app/detections", label: "Detections & Alerts", tone: "orange" },
      { to: "/app/reports", label: "Reports", tone: "sky" },
    ];
  }
  if (role === "HOD") {
    return [
      {
        to: "/app/cases?scope=active",
        label: "Cases for Review",
        tone: "violet",
      },
      { to: "/app/cases", label: "All UFM Cases", tone: "slate" },
      { to: "/app/reports", label: "Reports", tone: "orange" },
      { to: "/app/audit", label: "Audit Trail", tone: "emerald" },
    ];
  }
  if (role === "DEC") {
    return [
      {
        to: "/app/cases?status=DEC_REVIEW",
        label: "Cases Received from HOD",
        tone: "violet",
      },
      { to: "/app/cases", label: "All UFM Cases", tone: "slate" },
      { to: "/app/reports", label: "Reports", tone: "sky" },
      { to: "/app/audit", label: "Audit Trail", tone: "orange" },
    ];
  }
  if (role === "EXAM_DEPARTMENT") {
    return [
      {
        to: "/app/cases?scope=active",
        label: "Cases Under Review",
        tone: "violet",
      },
      { to: "/app/exam-toolkit", label: "Exam Toolkit", tone: "sky" },
      { to: "/app/result-controls", label: "Result Holds", tone: "rose" },
      { to: "/app/cases", label: "All Cases", tone: "slate" },
      { to: "/app/reports", label: "Reports", tone: "orange" },
      { to: "/app/audit", label: "Audit Trail", tone: "emerald" },
    ];
  }
  if (role === "UFM_COMMITTEE") {
    return [
      {
        to: "/app/cases?status=UFM_COMMITTEE_REVIEW",
        label: "Final Review",
        tone: "violet",
      },
      { to: "/app/cases", label: "All Cases", tone: "slate" },
      { to: "/app/evidence", label: "Evidence", tone: "emerald" },
      { to: "/app/audit", label: "Audit Trail", tone: "orange" },
    ];
  }
  return [
    { to: "/app/cases", label: "My Cases", tone: "violet" },
    {
      to: "/app/clarification",
      label: "Clarification / Required Actions",
      tone: "orange",
    },
    { to: "/app/notifications", label: "Notifications", tone: "emerald" },
    { to: "/app/help", label: "Help & Support", tone: "sky" },
  ];
}

export const ACTION_TONES = {
  sky: "border-sky-300 bg-sky-50 text-sky-800",
  orange: "border-orange-300 bg-orange-50 text-orange-800",
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  violet: "border-violet-300 bg-violet-50 text-violet-800",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
  rose: "border-rose-300 bg-rose-50 text-rose-800",
};

const CHART_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#ea580c",
  "#059669",
  "#e11d48",
  "#0891b2",
  "#ca8a04",
];

export function countByField(items, field, { formatLabel } = {}) {
  const map = new Map();
  for (const item of items) {
    const raw = item[field] || "Unknown";
    map.set(raw, (map.get(raw) || 0) + 1);
  }
  return [...map.entries()]
    .map(([raw, count], i) => ({
      label: formatLabel ? formatLabel(raw) : String(raw).replaceAll("_", " "),
      count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);
}

export function statusChartSegments(cases) {
  return countByField(cases, "status", { formatLabel: formatStatusLabel });
}

export function violationChartSegments(cases) {
  return countByField(cases, "violation_type", {
    formatLabel: formatViolationLabel,
  });
}

export function studentCaseStatusSegments(cases, clarifications) {
  const clarifiedCaseIds = new Set(
    (clarifications || []).map((clarification) => Number(clarification.case_id))
  );
  const pendingClarification = cases.filter(
    (c) => !clarifiedCaseIds.has(Number(c.id))
  );
  const closed = cases.filter(
    (c) => c.status === "APPROVED" || c.status === "REJECTED"
  );
  const resolved = cases.filter(
    (c) => c.status === "EXAM_DEPARTMENT_IMPLEMENTATION"
  );
  const excludedIds = new Set([
    ...pendingClarification.map((c) => Number(c.id)),
    ...closed.map((c) => Number(c.id)),
    ...resolved.map((c) => Number(c.id)),
  ]);

  return [
    {
      label: "Pending Clarification",
      count: pendingClarification.length,
      color: "#f59e0b",
    },
    {
      label: "Under Review",
      count: cases.filter((c) => !excludedIds.has(Number(c.id))).length,
      color: "#2563eb",
    },
    { label: "Resolved", count: resolved.length, color: "#16a34a" },
    { label: "Closed", count: closed.length, color: "#94a3b8" },
  ];
}
