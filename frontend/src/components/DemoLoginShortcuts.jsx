/**
 * Development / viva login shortcuts — imported only by Login when demo helpers
 * are enabled. Keep credentials out of the default production UI path.
 */
const ICON_PATHS = {
  clipboard: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6M10 11h4" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
    </>
  ),
  files: (
    <>
      <path d="M15 2H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6z" />
      <path d="M15 2v4h4M11 10h4M11 14h4M5 7v13a2 2 0 0 0 2 2h9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6 6 0 0 1 21.5 20" />
    </>
  ),
  cap: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3 2.5 9 2.5 12 0v-5" />
    </>
  ),
};

const SAMPLE_ACCOUNTS = [
  { role: "Invigilator", email: "invigilator@demo.com", icon: "clipboard" },
  { role: "HOD", email: "hod@demo.com", icon: "building" },
  { role: "DEC", email: "dec@demo.com", icon: "scale" },
  { role: "Exam Dept", email: "examdept@demo.com", icon: "files" },
  { role: "UFM Committee", email: "ufm@demo.com", icon: "users" },
  { role: "Student", email: "student@demo.com", icon: "cap" },
];

const DEMO_PASSWORD = "Demo@123";

export default function DemoLoginShortcuts({
  submitting,
  onSignInAs,
  variant = "desktop",
}) {
  return (
    <div className="relative z-10">
      <p className="text-lg font-semibold text-white lg:text-[clamp(14px,2.3vh,18px)]">Evaluation role shortcuts</p>
      <p className="mt-1.5 text-sm text-slate-400 [@media(min-width:1024px)_and_(max-height:720px)]:hidden">
        For viva walkthroughs. Production users sign in with their own
        credentials on the right.
      </p>
      <div
        className={`mt-5 grid gap-3 lg:mt-[clamp(8px,2vh,20px)] lg:gap-[clamp(6px,1.3vh,12px)] ${variant === "mobile" ? "grid-cols-1" : "grid-cols-2"}`}
      >
        {SAMPLE_ACCOUNTS.map((item) => (
          <button
            key={item.email}
            type="button"
            disabled={submitting}
            onClick={() => onSignInAs(item.email, DEMO_PASSWORD)}
            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left lg:py-[clamp(6px,1.35vh,14px)] transition hover:border-sky-400/40 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50"
          >
            <span className="grid h-10 w-10 lg:h-[clamp(28px,5vh,40px)] lg:w-[clamp(28px,5vh,40px)] shrink-0 place-items-center rounded-lg bg-white/[0.06] text-sky-300">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICON_PATHS[item.icon]}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white lg:text-[clamp(13px,2vh,16px)]">{item.role}</span>
              <span className="block truncate font-mono text-[13px] text-slate-400 lg:text-[clamp(11px,1.65vh,13px)]">
                {item.email}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-sky-300"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
