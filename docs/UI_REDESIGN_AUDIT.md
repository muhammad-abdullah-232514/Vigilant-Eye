# VigilantEye UI Redesign Audit

**Phase:** 1 — read-only inspection and redesign planning  
**Date:** 2026-10-09  
**Scope:** Existing frontend, backend role configuration, current API/data surfaces, and visual redesign preparation  
**Implementation status:** No UI redesign or feature work was performed

## 1. Current frontend stack

| Concern | Current implementation | Evidence |
|---|---|---|
| Framework | React `19.2.8` | `frontend/package.json` |
| Build tool | Vite `8.2.0` | `frontend/package.json`, `frontend/vite.config.js` |
| Language | JavaScript with JSX; no TypeScript source | `frontend/src/**/*.jsx`, `*.js` |
| CSS/UI | Tailwind CSS `4.3.3` through `@tailwindcss/vite`, plus shared CSS classes | `frontend/package.json`, `frontend/src/index.css` |
| Routing | React Router DOM `7.18.2` | `frontend/package.json`, `frontend/src/App.jsx` |
| State management | React local state/effects/context; no Redux, Zustand, or other global store | `frontend/src/context/AuthContext.jsx`, page components |
| Charts | No external chart library. `DonutChart.jsx` is an in-house CSS/SVG-style component driven by calculated segments | `frontend/src/components/DonutChart.jsx`, `frontend/src/config/dashboardByRole.js` |
| Icons | No icon package. Header notification and menu icons use inline SVG/CSS | `frontend/src/components/Header.jsx` |
| API client | One native `fetch` wrapper, `apiRequest`, with endpoint helpers | `frontend/src/services/api.js` |
| Authentication provider | `AuthContext` exposes user, token, loading, login/session restore, and logout | `frontend/src/context/AuthContext.jsx` |
| Layout | `AppLayout` with `Header`, `Sidebar`, and nested `<Outlet>` content | `frontend/src/components/AppLayout.jsx` |
| Theme/styles | Tailwind theme tokens and shared portal classes | `frontend/src/index.css` |
| Runtime real-time path | WebSocket alerts in `AppLayout`; live camera stream helpers in `api.js` and `MonitoringPage.jsx` | `frontend/src/components/AppLayout.jsx`, `frontend/src/pages/MonitoringPage.jsx` |

## 2. Current route map

All routes below are declared in `frontend/src/App.jsx`. The `/app` branch is
protected by `ProtectedRoute`; role-specific wrappers add authorization. `/users`
is retained as a redirect route, not an operational page.

| Role/access | Route | Page component | Purpose | Protected? | Actual feature? |
|---|---|---|---|---:|---:|
| Public | `/` | `Navigate` | Redirect to role home or login | No | Yes |
| Public | `/login` | `Login` | Login/authentication entry | No | Yes |
| Public/auth entry | `/student-portal` | `StudentPortalEntry` | Student portal entry flow | No route guard | Yes |
| Any authenticated | `/app` | `AppLayout` + index redirect | Portal shell and role home | Yes | Yes |
| Any authenticated | `/app/dashboard` | `DashboardHome` (administrator redirects) | Role-aware dashboard | Yes | Yes |
| Any authenticated | `/app/notifications` | `NotificationsPage` | Notification inbox/read state | Yes | Yes |
| Operational roles | `/app/cases` | `CasesPage` | Case list and filters | Yes; non-admin operational gate | Yes |
| Invigilator | `/app/cases/new` | `CreateCasePage` | Report UFM incident | Yes; `CASE_CREATE_ROLES` | Yes |
| Operational roles | `/app/cases/:caseId` | `CaseDetailPage` | Case detail, evidence, review workflow | Yes; operational gate | Yes |
| Invigilator | `/app/detections` | `DetectionsPage` | Confirmed detection inbox | Yes; `DETECTION_ROLES` | Yes |
| Invigilator/HOD/Exam/UFM | `/app/evidence` | `EvidencePage` | Evidence library, upload/link/preview | Yes; `EVIDENCE_VIEW_ROLES` | Yes |
| No current role set | `/app/students` | `StudentsPage` | Student directory route | Yes; empty access set | Implemented but currently inaccessible |
| Non-admin redirect | `/app/users` | `Navigate` | Redirects to dashboard | Yes | Compatibility redirect only |
| Administrator | `/app/admin/dashboard` | `AdminDashboardPage` | User/access overview and admin activity | Yes; admin only | Yes |
| Administrator | `/app/admin/users` | `AdminUsersPage` | User management | Yes; admin only | Yes |
| Administrator | `/app/admin/import` | `AdminImportPage` | Bulk user import/validation | Yes; admin only | Yes |
| Administrator | `/app/admin/roles` | `AdminRolesPage` | Roles and permissions view | Yes; admin only | Yes |
| Administrator | `/app/admin/audit` | `AdminAuditPage` | Administrative audit log | Yes; admin only | Yes |
| Administrator | `/app/admin/students` | `AdminStudentsPage` | Administrator student directory | Yes; admin only | Yes |
| Administrator | `/app/admin/system` | `AdminSystemPage` | System/configuration and test email tools | Yes; admin only | Yes |
| Administrator | `/app/admin/profile` | `AdminProfilePage` | Administrator profile | Yes; admin only | Yes |
| DEC | `/app/master-data` | `MasterDataPage` | Exam setup/master data | Yes; `MASTER_DATA_VIEW_ROLES` | Yes |
| Exam Department | `/app/result-controls` | `ResultControlsPage` | Result holds and fine payment controls | Yes; `RESULT_CONTROL_ROLES` | Yes |
| Exam Department | `/app/exam-toolkit` | `ExamToolkitPage` | Exam rooms, exams, invigilators and toolkit | Yes; `EXAM_TOOLKIT_ROLES` | Yes |
| HOD/DEC/Exam/UFM | `/app/audit` | `AuditTrailPage` | Operational audit trail | Yes; `OPERATIONAL_AUDIT_ROLES` | Yes |
| Invigilator | `/app/monitoring` | `MonitoringPage` | Live camera monitoring | Yes; `MONITOR_ROLES` | Yes |
| Invigilator/HOD/DEC/Exam/UFM | `/app/reports` | `ReportsPage` | Case reports and CSV export | Yes; `REPORTS_ROLES` | Yes |
| Student | `/app/clarification` | `ClarificationPage` | Submit one clarification per eligible case | Yes; student only | Yes |
| Any authenticated | `/app/help` | `HelpPage` | Help/support information | Yes | Yes |
| Administrator redirect/other | `/app/profile` | `ProfilePage` or redirect | Shared account profile | Yes | Yes |
| Any unknown | `*` | `NotFoundPage` | 404 and role-home recovery | No | Yes |

There are **32 `<Route>` declarations** in `App.jsx`, including nested/index,
redirect, and wildcard declarations; there are **31 explicit `path` attributes**
because the nested index route has no path.

## 3. Roles and role-wise feature matrix

Backend authority is `backend/portal_roles.py`; frontend labels and menus are in
`frontend/src/config/navByRole.js`. The project has **7 roles**:
`ADMINISTRATOR`, `INVIGILATOR`, `STUDENT`, `HOD`, `DEC`,
`EXAM_DEPARTMENT`, and `UFM_COMMITTEE`.

| Role | Dashboard | Sidebar items | Current actions/pages | Current tables/cards | Notifications/filters/realtime |
|---|---|---|---|---|---|
| Administrator | Admin dashboard with user KPIs, role breakdown and admin activity | Dashboard, Users, Import Users, Audit Log, Roles & Permissions, Students, System, Notifications, Profile | Manage/create/import users, inspect roles, audit/system/profile | User KPI cards, role breakdown, recent admin activity list, admin tables | Notifications; admin audit/user filters; no live detection WebSocket UI |
| Invigilator | Cameras, confirmed detections, own open cases, unread count, queue, charts, unread list | Dashboard, Live Monitoring, Detections & Alerts, My Cases, Report UFM Incident, Evidence Library, Reports, Notifications, Profile | Start/stop monitoring, inspect detections, create cases, manage evidence, reports | Camera cards, detection list, case queue, status/violation donuts, notification rows | Notification polling; detection badge polling; detection WebSocket and live pulse; case/status filters |
| Student | My cases, open cases, decisions recorded, unread count, clarification callout, case queue | Dashboard, My Cases, Clarification / Required Actions, Notifications, Help & Support, Profile | View own cases, submit one clarification per eligible case, read notifications, profile/help | KPI cards, own case queue, status/violation chart only if dashboard logic enables it, notification rows | Notification polling; case/status filters; no camera/detection WebSocket |
| HOD | Review queue, forwarded-to-DEC, open cases, unread count, charts, recent cases | Dashboard, Cases for Review, All UFM Cases, Reports, Audit Trail, Notifications, Profile | Review/forward/return cases through `CaseReviewForm`, inspect reports/audit | KPI cards, review queue, recent cases, status/violation donuts, notifications | Notification polling; case/status filters; no live camera WebSocket |
| DEC | Received cases, forwarded cases, committee cases, unread count, charts, closed/decided queue | Dashboard, Cases Received from HOD, All UFM Cases, Reports, Audit Trail, Notifications, Profile | Review/forward/return cases and inspect records | KPI cards, DEC queue, closed/decided table, status/violation donuts | Notification polling; case/status filters; no live camera WebSocket |
| Exam Department | Processing queue, committee cases, active result holds, unread count, charts and secondary queues | Dashboard, Cases for Processing, At UFM Committee, All Cases, Exam Toolkit, Result Holds, Reports, Audit Trail, Notifications, Profile | Process/implement cases, manage exam toolkit, result holds/fines, reports/audit | KPI cards, case queues, result-hold list, status/violation donuts, notifications | Notification polling; case/status/result filters; no live camera WebSocket |
| UFM Committee | Final review queue, approved, rejected; charts and decision queues | Dashboard, Cases for Final Review, Approved Cases, Rejected Cases, All Cases, Evidence Library, Reports, Audit Trail, Notifications, Profile | Final case review/decision, inspect evidence, reports/audit | KPI cards, final queue, approved/rejected tables, status/violation donuts, notifications | Notification polling; case/status filters; no live camera WebSocket |

Menu visibility is not the security boundary. `App.jsx`, role gates, and backend
authorization enforce access separately.

## 4. Student feature audit

| Requested feature | Status | Evidence/current behavior |
|---|---|---|
| UFM cases | **IMPLEMENTED** | `/app/cases` uses `fetchCases()` and student-scoped backend access; dashboard shows My UFM cases/open cases/decisions |
| Clarification | **IMPLEMENTED** | `/app/clarification`, `fetchClarifications`, `submitClarification`; prevents another clarification for the same case |
| Notifications | **IMPLEMENTED** | Shared `/app/notifications`, unread badge, mark-read and mark-all-read |
| Case status | **IMPLEMENTED** | Case list/detail render status badges and workflow status |
| Grades | **NOT IMPLEMENTED** | No student grades route, page, API helper, or data model surfaced in the frontend audit |
| Attendance | **NOT IMPLEMENTED** | No attendance page/API/data surface found |
| Timetable | **NOT IMPLEMENTED** | No timetable page/API/data surface found |
| Courses | **NOT IMPLEMENTED** | No course page/API/data surface found |
| Academic profile | **PARTIAL** | Shared `/app/profile` shows portal identity, email, role and account status; it is not an academic profile |
| Fees and dues | **NOT IMPLEMENTED** | No student fee/dues page/API/data surface found |
| Documents | **NOT IMPLEMENTED** as a student academic document feature | Evidence/document upload exists for UFM case evidence, not a student document library |

Current student features are therefore UFM case visibility, case status,
clarification submission, notifications, dashboard summaries, profile/account
information, help/support, and case-detail access.

## 5. Sidebar and navigation audit

- **Sidebar:** `frontend/src/components/Sidebar.jsx`
- **Header/top bar:** `frontend/src/components/Header.jsx`
- **Menu configuration:** `frontend/src/config/navByRole.js`
- **Active-route logic:** `frontend/src/config/navActive.js`, used by `Sidebar`
- **Role labels:** `ROLE_LABELS` in `navByRole.js`
- **Role switcher:** None found. The signed-in role is displayed, but there is no role-switch control.
- **Branding:** Header uses an AU text mark and “VigilantEye · UFM Portal”.
- **Logout:** Header logout button and profile sign-out button call `AuthContext.logout`.
- **Notifications:** Header bell links to `/app/notifications`; sidebar notification item has an unread badge.

The exact valid menu items are listed in the role matrix above and are sourced from
`NAV_BY_ROLE`. Empty access sets intentionally make some declared routes
inaccessible (`/app/students` and related student-directory operational access).

## 6. Dashboard data audit

### Shared operational dashboard

`DashboardHome.jsx` loads:

| Widget/data | Source | API/data path |
|---|---|---|
| Cases and queues | API | `fetchCases({ scope: "dashboard" })` → `GET /ufm-cases` |
| Confirmed detections | API | `fetchDetections(true)` → `GET /detections?confirmed_only=true` |
| Cameras | API | `fetchCameras()` → `GET /cameras` |
| Unread notifications | API | `fetchNotifications(true)` → `GET /notifications?unread_only=true` |
| Result holds | API | `fetchResultControls()` → result-control endpoint, Exam Department only |
| Role KPIs | Calculated frontend from API payloads | `buildRoleKpis()` in `dashboardByRole.js` |
| Case queue | Calculated frontend from cases | `casesForRoleQueue()` plus `CaseQueueTable` |
| Status donut | Calculated frontend from cases | `statusChartSegments()` → `DonutChart` |
| Violation donut | Calculated frontend from cases | `violationChartSegments()` → `DonutChart` |
| Live camera cards | API, filtered frontend | `fetchCameras()` + `isLiveCamera()` |
| Recent detections | API, sliced frontend | `fetchDetections(true)` |
| Unread notification rows | API, sliced frontend | `fetchNotifications(true)` |
| Quick actions | Static role configuration | `quickActionsForRole()`; links only, no mock metrics |

`AppLayout` polls notification/detection badges every 5 seconds and receives
detection/suspicion events through `WS /ws/alerts` for detection roles. Dashboard
content itself is loaded on page mount; it is not a continuously updating chart
stream.

### Administrator dashboard

`AdminDashboardPage.jsx` uses:

- `fetchAdminUserStats()` for total/active/inactive/by-role KPI data
- `fetchAdminAuditLogs({ limit: 8, user_admin_only: true })` for recent activity
- Static quick-action links
- Calculated role-distribution cards from `stats.by_role`

### Existing non-dashboard data surfaces

Cases, case detail/reviews, detections, evidence, monitoring, notifications,
reports, audit, result controls, exam toolkit, master data, admin users/import,
admin students, admin roles, admin system, clarification and profiles all use
real endpoint helpers in `frontend/src/services/api.js`. No mock dashboard data
was found in the inspected dashboard paths.

## 7. Safe chart opportunities

| Chart | Role | Data source | Existing API/data | Real-time possible? | Safe to implement? |
|---|---|---|---|---:|---:|
| UFM cases by workflow status | HOD, DEC, Exam Department, UFM Committee, optionally Student | Cases payload, frontend grouping | `fetchCases({ scope: "dashboard" })`, status fields | No; refresh/poll possible | Yes |
| Violation type distribution | Operational roles | Cases payload, frontend grouping | `fetchCases`, violation/category fields | No; refresh/poll possible | Yes |
| Cases over time | Operational roles | Case timestamps | `fetchCases` with available `created_at` | No; refresh/poll possible | Yes, with bounded date range |
| Confirmed detections over time | Invigilator | Detection timestamps | `fetchDetections(true)` | **Yes** for incremental WebSocket updates, but history still needs API data | Yes, if chart is clearly labeled as loaded detection history |
| Result holds by status | Exam Department | Result-control payload | `fetchResultControls()` | No; refresh on page load | Yes |
| Notification read/unread distribution | All roles | Notification payload | `fetchNotifications(false)` | No; polling already exists | Yes, low priority |

Do not propose charts for attendance, grades, timetable, courses, fees, or
academic documents because those data sources do not exist in the current
frontend/backend surface.

There is no external chart library currently installed. If richer charts are
approved in Phase 2, **Recharts** is the proposed library because it fits React
and supports accessible responsive charts; adding it would be a dependency
change. The existing `DonutChart` should remain the lowest-risk option for the
two current distributions.

## 8. Reusable component audit

### Reused shared components

- `AppLayout`, `Header`, `Sidebar`: global chrome
- `PageShell`, `PageHeader`, `SectionPanel`: repeated page composition
- `KpiCard`: dashboard/admin statistic cards
- `CaseQueueTable`: dashboard queues
- `StatusBadge`: case/result/detection statuses
- `DonutChart`: current dashboard distributions
- `ActionNavCard`: dashboard/admin quick actions
- `LoadingState`, `ErrorBanner`, `EmptyState`, `FeedbackBanner`: state feedback
- `ConfirmDialog`, `PortalSearchSelect`, `EvidenceFileActions`,
  `EvidenceLibraryPicker`, `CaseReviewForm`, `UfmFormSection`: workflow/form reuse
- `ProtectedRoute`, `RoleGates`: authentication and authorization wrappers

### Duplicated or locally repeated presentation

Some pages still use local table/card markup instead of a single generic table
component: admin pages, audit, evidence and several case views. This is a visual
consistency opportunity, not proof of safely removable duplicate logic. Phase 2
should restyle shared primitives first and leave behavior-specific markup intact.

### Keep functionally unchanged

`api.js`, `AuthContext`, `RoleGates`, `ProtectedRoute`, `Sidebar` role filtering,
`CaseReviewForm` transitions, `EvidenceFileActions`, and all endpoint helpers
should receive visual changes only unless a separate approved behavior change is
requested.

## 9. Reference design language

The supplied dashboard references should be treated as visual inspiration only.
The safe visual language to carry into this portal is:

- Fixed, clearly separated left navigation with a strong active state
- Compact top header with product identity and account/notification controls
- Clear page title, breadcrumb and supporting description
- KPI cards with a short label, prominent numeric value and restrained accent
- White/surface cards on a pale neutral page background
- Consistent rounded corners, light borders and restrained shadows
- Strong navy primary text with blue interactive accents
- Compact status badges using semantic success/warning/danger colors
- Tables contained in cards with readable column hierarchy and responsive fallback
- Consistent spacing rhythm and grouped quick actions
- Notification rows that visibly distinguish unread items

### Safe to copy as design language

Color hierarchy, card proportions, spacing rhythm, typography hierarchy, active
navigation treatment, KPI emphasis, table-card containment, badge semantics,
button hierarchy, and responsive layout patterns.

### Do not copy as features

Do not add `My Courses`, `Grades`, `Attendance`, `Fees`, `Timetable`, `Documents`,
or any other academic-dashboard module merely because it appears in a reference.
Those features are not implemented in this project. Do not add mock charts,
mock counts, student timetable data, or unrelated navigation items.

## 10. Proposed target design system

### Colors

- Primary navy: `#0b1f3a`
- Deep navy: `#071526`
- Blue accent: `#1a4b8c`
- Interactive blue: `#2563eb`
- Page background: `#f1f4f8`
- Surface: `#ffffff`
- Border: `#d8dee9`
- Text: `#0f172a`
- Muted text: `#64748b`
- Success: emerald scale already used by the portal
- Warning: amber scale already used by the portal
- Danger: rose/red scale already used by the portal
- Purple: violet scale for workflow/administrative emphasis

These values align with the existing theme in `frontend/src/index.css`; Phase 2
should refine, not replace, them.

### Layout and components

- Page padding: current `p-4 sm:p-6 lg:p-8`; retain as baseline
- Card gap: `1rem` baseline, `1.5rem` between major sections
- Sidebar width: current `w-64`; preserve unless a visual measurement requires a small adjustment
- Header height: current `h-14`; preserve
- KPI cards: static, non-button cards with left semantic accent
- Icon boxes: optional neutral/blue square containers, decorative only unless an action
- Tables: card-contained, clear header row, responsive card fallback
- Chart cards: same surface/border/radius as tables, with no invented data
- Buttons: preserve primary/secondary/danger/success hierarchy
- Sidebar items: rounded active navy item, visible focus state, unread badges
- Badges: semantic colors with readable text and no dependence on color alone
- Notification rows: unread emphasis, timestamp, destination/action affordance

## 11. Proposed file change plan

### Shared layout files

| File | Why change | Risk | Functional logic change? |
|---|---|---|---:|
| `frontend/src/components/AppLayout.jsx` | Refine shell spacing/header/sidebar composition | Medium | No |
| `frontend/src/components/Header.jsx` | Restyle top bar/account/notification controls | Low | No |
| `frontend/src/components/Sidebar.jsx` | Restyle navigation, active states and section spacing | Medium | No |
| `frontend/src/components/PageShell.jsx` | Standardize page width/padding | Low | No |
| `frontend/src/components/PageHeader.jsx` | Standardize title/breadcrumb/action layout | Low | No |

### Role dashboard files

| File | Why change | Risk | Functional logic change? |
|---|---|---|---:|
| `frontend/src/pages/DashboardHome.jsx` | Apply role-specific visual hierarchy to existing widgets | Medium | No |
| `frontend/src/pages/AdminDashboardPage.jsx` | Match admin dashboard visual language | Low | No |
| `frontend/src/config/dashboardByRole.js` | Only if visual labels/accent metadata need alignment | Medium | No |

### Shared components

| File | Why change | Risk | Functional logic change? |
|---|---|---|---:|
| `KpiCard.jsx` | Visual KPI treatment/icon container option | Low | No |
| `CaseQueueTable.jsx` | Table-card hierarchy and responsive presentation | Medium | No |
| `DonutChart.jsx` | Chart card styling and legend hierarchy | Low | No |
| `StatusBadge.jsx` | Consistent semantic badges | Low | No |
| `ActionNavCard.jsx` | Quick-action visual treatment | Low | No |
| `SectionPanel.jsx` | Shared panel header/body styling | Low | No |
| `LoadingState.jsx`, `ErrorBanner.jsx`, `EmptyState.jsx` | Consistent state surfaces | Low | No |

### Styles/theme

| File | Why change | Risk | Functional logic change? |
|---|---|---|---:|
| `frontend/src/index.css` | Centralize approved tokens, shadows, radii and chrome styles | Medium | No |
| `frontend/src/config/navByRole.js` | Only if labels/section presentation changes; preserve routes | Medium | No |
| `frontend/src/config/roleAccess.js` | Do not change for visual redesign; only inspect for consistency | High | No |

### Chart components

| File | Why change | Risk | Functional logic change? |
|---|---|---|---:|
| `frontend/src/components/DonutChart.jsx` | Reuse existing real-data chart with new styling | Low | No |
| New chart components, if approved | Add only for case/detection/result data already available | Medium | No, if fed from existing payloads |

### Menu configuration

`frontend/src/config/navByRole.js` should only be changed to correct visual labels
or presentation after approval. No academic/reference features should be added.

## 12. Risks

1. Changing `RoleGates`, `roleAccess.js`, or `navByRole.js` can accidentally expose
   pages; keep role behavior unchanged.
2. Changing `AppLayout` can affect WebSocket lifecycle, badge polling, and mobile
   sidebar accessibility.
3. Replacing table markup can break case/evidence actions and responsive behavior.
4. Adding a chart dependency changes the frontend lockfile and bundle size.
5. Dashboard counts are role-scoped and must not be replaced with global mock data.
6. Student academic modules would create unsupported product claims and should remain
   excluded.
7. Backend API contracts, case workflows, evidence authorization, and notification
   behavior must not be changed during a visual phase.

## 13. Recommended implementation order for Phase 2

1. Confirm this Phase 1 audit and freeze the role/route/data scope.
2. Capture a visual baseline of the current portal at desktop and mobile widths.
3. Restyle theme tokens and shared CSS primitives in `index.css`.
4. Restyle `Header`, `Sidebar`, `PageShell`, and `PageHeader` without changing navigation logic.
5. Restyle `KpiCard`, `SectionPanel`, `CaseQueueTable`, `StatusBadge`, buttons and state components.
6. Restyle `DashboardHome` and `AdminDashboardPage` using only existing data/widgets.
7. Restyle operational pages (cases, detections, evidence, monitoring, reports, audit).
8. Restyle student pages while preserving the limited real student feature set.
9. Add only approved charts backed by existing API payloads; avoid new academic data.
10. Run frontend build, focused route/component tests, authorization checks, and manual role smoke tests.
11. Review desktop/mobile screenshots and accessibility states before any optional behavior changes.

**Approval gate:** Do not begin these implementation steps until the Phase 1 scope
and proposed design system are approved.
