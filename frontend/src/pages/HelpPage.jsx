import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { MONITOR_ROLES, roleIn } from "../config/roleAccess";
import { useAuth } from "../context/AuthContext";

const STUDENT_GUIDELINES = [
  "Submit a clarification when the portal prompts you — only one clarification is accepted per case.",
  "Provide accurate information — false statements may worsen the case.",
  "All portal communications are recorded in the audit trail.",
  "You can view your own cases and submit clarifications; you cannot access camera monitoring.",
  "Contact your department office if you cannot access a listed case.",
];

const STUDENT_FAQ = [
  {
    q: "What can I see about my UFM case?",
    a: "You can open cases linked to your student profile and review the information shown on the case page — including the current status, examination details, evidence on record, any clarification you submitted, and result-control status when a hold applies. You cannot perform staff review actions such as Forward, Return, Approve, or Reject.",
  },
  {
    q: "How do I know the current status of my case?",
    a: "Open the case from My Cases. The status label on the case page shows where it is in the UFM review workflow — for example Pending, Under Review, DEC Review, Exam Department Review, UFM Committee Review, Approved, or Rejected. That status is the current stage of the case.",
  },
  {
    q: "Can I submit a clarification for my case?",
    a: "Yes, when the case is linked to your account and you have not already submitted one. Use Clarification / Required Actions, or open the case and follow the clarification prompt there. Your written explanation is recorded on that case.",
  },
  {
    q: "Can I submit clarification more than once?",
    a: "No. Each case allows one clarification from you. After it is submitted, it remains on the case record and the portal will not accept another submission for the same case.",
  },
  {
    q: "What happens after I submit my clarification?",
    a: "Your clarification is saved on the case and relevant staff are notified that you responded. Submitting a clarification does not by itself finalize the case. Continue to check the case status and your Notifications for updates as the review proceeds.",
  },
];

const STAFF_GUIDELINES = [
  "Live Monitoring and Detections are Invigilator-only operational tools.",
  "Invigilators file UFM cases and upload evidence; reviewing roles verify and advance the workflow.",
  "Use Demo / Testing Mode only for development trials; demo records stay out of production case queues.",
  "Confirm detections before filing cases; draft case from a detection attaches saved evidence when available.",
  "Digital sign-off (typed name + acknowledgment) is required on case create and reviews.",
  "All portal actions are recorded in the audit trail appropriate to your role.",
];

const ADMIN_GUIDELINES = [
  "This workspace manages portal authorization — users, roles, import, and administrative audit.",
  "Administrators do not perform operational UFM monitoring, case review, or result-hold actions.",
  "Use Admin Audit Log for security/admin events; operational staff use the separate Audit Trail.",
  "Google authenticates identity; VigilantEye database roles control access.",
];

const STAFF_FAQ = [
  {
    q: "What is digital sign-off?",
    a: "Staff type their full name and acknowledge a certificate checkbox. This is an auditable acknowledgment (name + timestamp), not a PKI e-signature.",
  },
  {
    q: "How does live monitoring create evidence?",
    a: "In normal monitoring, validated incidents (after temporal confirmation) save automatically with a JPEG snapshot and short clip when buffered. Raw frame predictions are not saved as cases. Draft/create case attaches that evidence.",
  },
  {
    q: "Who can use Live Monitoring?",
    a: "Invigilator only. HOD, DEC, Exam Department, UFM Committee, Students, and Administrators cannot operate live monitoring.",
  },
  {
    q: "What is Demo / Testing Mode?",
    a: "An authorized screen with YOLO/persist toggles and source overrides. Saved demo detections are marked is_demo and never enter production case queues or institutional notifications.",
  },
  {
    q: "Why does AI show Error or Unavailable while video plays?",
    a: "Camera connection and AI health are separate. A live feed alone does not mean detection is active — check the AI status badge on each card.",
  },
];

const ADMIN_FAQ = [
  {
    q: "Can I open UFM cases or monitoring?",
    a: "No. Administrator is isolated from operational UFM pages. Use Users, Import, Roles, Admin Audit, and System screens.",
  },
  {
    q: "Where is the audit log?",
    a: "Administrators use Security & Audit at /app/admin/audit. Operational staff use /app/audit.",
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  const role = user?.role || "";
  const isStudent = role === "STUDENT";
  const isAdmin = role === "ADMINISTRATOR";
  const canMonitor = roleIn(role, MONITOR_ROLES);
  const guidelines = isStudent
    ? STUDENT_GUIDELINES
    : isAdmin
      ? ADMIN_GUIDELINES
      : STAFF_GUIDELINES;
  const faq = isStudent ? STUDENT_FAQ : isAdmin ? ADMIN_FAQ : STAFF_FAQ;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumb="Home / Help & Support"
        title="Help & Support"
        description={
          isStudent
            ? "Guidance for using the student UFM portal — your cases, clarifications, and notifications."
            : isAdmin
              ? "Guidance for portal administration and authorization."
              : "Guidance for staff using the UFM portal."
        }
      />

      <section className="portal-card overflow-hidden">
        <div className="bg-au-navy px-5 py-3">
          <h2 className="font-semibold text-white">
            {isStudent
              ? "Student guidelines"
              : isAdmin
                ? "Administrator guidelines"
                : "Important guidelines"}
          </h2>
        </div>
        <ol className="list-decimal space-y-3 px-5 py-4 pl-10 text-sm text-slate-700">
          {guidelines.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      {!isStudent ? (
        <section className="portal-card p-5">
          <h2 className="portal-section-title">Quick links</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shortcuts to pages available for your role.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {isAdmin ? (
              <>
                <Link to="/app/admin/dashboard" className="btn-secondary">
                  Admin Dashboard
                </Link>
                <Link to="/app/admin/users" className="btn-secondary">
                  Manage Users
                </Link>
                <Link to="/app/admin/audit" className="btn-secondary">
                  Admin Audit
                </Link>
              </>
            ) : (
              <Link to="/app/cases" className="btn-secondary">
                UFM Cases
              </Link>
            )}
            {canMonitor ? (
              <Link to="/app/monitoring" className="btn-secondary">
                Live Monitoring
              </Link>
            ) : null}
            <Link to="/app/notifications" className="btn-secondary">
              Notifications
            </Link>
            <Link
              to={isAdmin ? "/app/admin/dashboard" : "/app/dashboard"}
              className="btn-secondary"
            >
              Dashboard
            </Link>
          </div>
        </section>
      ) : null}

      <section className="portal-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="portal-section-title">FAQ</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {faq.map((item) => (
            <li key={item.q} className="px-5 py-4">
              <p className="font-medium text-au-navy">{item.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {item.a}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
