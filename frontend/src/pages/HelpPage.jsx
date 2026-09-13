import { Link } from "react-router-dom";

const GUIDELINES = [
  "Respond to clarification requests within 3 working days when notified.",
  "Provide accurate information — false statements may worsen the case.",
  "All portal communications are recorded in the audit trail.",
  "Attach only truthful context; evidence uploads are handled by staff.",
  "Contact your department office if you cannot access a listed case.",
];

const FAQ = [
  {
    q: "Why do I see a UFM case?",
    a: "An invigilator or detection review created a case involving your student record. You can view status and submit a clarification.",
  },
  {
    q: "Who reads my clarification?",
    a: "HOD and the reporting invigilator are notified. Further reviewers (DEC, Exam Dept, UFM Committee) can also see case history.",
  },
  {
    q: "Can I delete a clarification?",
    a: "Not in this prototype. Submissions are permanent for demo integrity.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-slate-500">Home / Help & Support</p>
        <h1 className="text-2xl font-semibold text-au-navy">Help & Support</h1>
        <p className="mt-1 text-sm text-slate-600">
          Student portal guidance for UFM cases (prototype).
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-au-navy px-5 py-3">
          <h2 className="font-semibold text-white">Important Guidelines</h2>
        </div>
        <ul className="space-y-3 px-5 py-4 text-sm text-slate-700">
          {GUIDELINES.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-au-blue" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-au-navy">Quick Links</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to="/app/cases"
            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800"
          >
            My UFM Cases
          </Link>
          <Link
            to="/app/clarification"
            className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800"
          >
            Submit Clarification
          </Link>
          <Link
            to="/app/notifications"
            className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800"
          >
            Notifications
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-au-navy">FAQ</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {FAQ.map((item) => (
            <li key={item.q} className="px-5 py-4 text-sm">
              <p className="font-semibold text-au-navy">{item.q}</p>
              <p className="mt-1 text-slate-600">{item.a}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-slate-400">
        Demo link: <code>student@demo.com</code> linked to roll <code>DEMO001</code> via{" "}
        <code>students.user_id</code> (seed script).
      </p>
    </div>
  );
}
