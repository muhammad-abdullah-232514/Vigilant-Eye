import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import DemoLoginShortcuts from "../components/DemoLoginShortcuts";
import { DEMO_HELPERS_ENABLED } from "../config/demoMode";
import { homePathForRole } from "../config/roleHome";
import { useAuth } from "../context/AuthContext";
import { fetchAuthConfig } from "../services/api";

const LOGIN_FONT =
  '"Plus Jakarta Sans", "Source Sans 3", "Segoe UI", ui-sans-serif, system-ui, sans-serif';

function useLoginFont() {
  useEffect(() => {
    if (document.getElementById("login-font")) return;
    const link = document.createElement("link");
    link.id = "login-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-gsi");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-In"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

export default function Login() {
  const { login, loginWithGoogle, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [authConfig, setAuthConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const googleBtnRef = useRef(null);
  useLoginFont();

  const mode = authConfig?.auth_mode || "demo";
  const passwordEnabled = Boolean(authConfig?.password_login_enabled);
  const googleEnabled = Boolean(authConfig?.google_auth_enabled);
  const googleClientId = authConfig?.google_client_id || "";
  // Server may disable shortcuts (AUTH_MODE=google); outer DEMO_HELPERS_ENABLED
  // stays compile-time so production builds can tree-shake demo credentials.
  const serverDemoHelpers = Boolean(authConfig?.demo_helpers_enabled);
  const institutionalGoogleOnly = mode === "google" && googleEnabled;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchAuthConfig();
        if (!cancelled) setAuthConfig(cfg);
      } catch {
        if (!cancelled) {
          setAuthConfig({
            auth_mode: "demo",
            password_login_enabled: DEMO_HELPERS_ENABLED,
            google_auth_enabled: false,
            google_client_id: null,
            demo_helpers_enabled: DEMO_HELPERS_ENABLED,
          });
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || !googleBtnRef.current) return undefined;
    let cancelled = false;

    (async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response?.credential) {
              setFormError("Google did not return a credential");
              return;
            }
            setSubmitting(true);
            setFormError("");
            try {
              const loggedIn = await loginWithGoogle(response.credential);
              navigate(homePathForRole(loggedIn?.role), { replace: true });
            } catch (err) {
              setFormError(err.message || "Google sign-in failed");
            } finally {
              setSubmitting(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 320,
        });
      } catch (err) {
        if (!cancelled) {
          setFormError(err.message || "Google Sign-In unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googleEnabled, googleClientId, loginWithGoogle, navigate]);

  if (!loading && isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!passwordEnabled) return;
    setFormError("");
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      navigate(homePathForRole(loggedIn?.role), { replace: true });
    } catch (err) {
      setFormError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function signInAs(accountEmail, demoPassword) {
    if (!DEMO_HELPERS_ENABLED || !serverDemoHelpers) return;
    setEmail(accountEmail);
    setPassword(demoPassword);
    setSubmitting(true);
    setFormError("");
    try {
      const loggedIn = await login(accountEmail, demoPassword);
      navigate(homePathForRole(loggedIn?.role), { replace: true });
    } catch (err) {
      setFormError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const showShortcuts = DEMO_HELPERS_ENABLED && serverDemoHelpers;

  return (
    <div
      className="min-h-[100dvh] bg-au-surface lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:overflow-hidden"
      style={{ fontFamily: LOGIN_FONT }}
    >
      {/* Brand panel */}
      <section className="relative overflow-hidden bg-[#081a33] px-6 pb-24 pt-8 text-white sm:px-10 lg:flex lg:h-full lg:flex-col lg:px-[clamp(32px,5vw,72px)] lg:py-[clamp(20px,4.5vh,56px)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(30,64,120,0.55),transparent_55%)]"
        />
        <img
          src="/au-logo-white.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 top-10 w-[520px] max-w-none opacity-[0.045] lg:-right-40 lg:top-[-40px] lg:w-[820px]"
        />
        {["left-5 top-5 border-l-2 border-t-2", "right-5 top-5 border-r-2 border-t-2", "bottom-5 left-5 border-b-2 border-l-2", "bottom-5 right-5 border-b-2 border-r-2"].map(
          (pos) => (
            <span
              key={pos}
              aria-hidden="true"
              className={`pointer-events-none absolute hidden h-7 w-7 border-white/25 lg:block ${pos}`}
            />
          )
        )}

        <div className="relative z-10">
          <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:gap-6">
            <img src="/au-logo-white.png" alt="Air University" className="h-16 w-auto lg:h-[clamp(40px,8vh,72px)]" />
            <span aria-hidden="true" className="hidden h-[clamp(28px,5vh,48px)] w-px bg-white/20 lg:block" />
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-slate-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Air University · Examination Integrity
            </span>
          </div>
          <h1 className="mt-8 text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:mt-[clamp(14px,4.5vh,56px)] lg:text-[clamp(44px,10vh,92px)]">
            Vigilant<span className="text-sky-400">Eye</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 lg:mt-[clamp(8px,2.2vh,28px)] lg:text-[clamp(14px,2.3vh,20px)]">
            Institutional UFM portal — live monitoring, AI-assisted detections,
            case review, student clarification, and result controls.
          </p>
        </div>

        {showShortcuts ? (
          <div className="relative z-10 mt-auto hidden border-t border-white/10 pt-[clamp(12px,3vh,32px)] lg:block">
            <DemoLoginShortcuts submitting={submitting} onSignInAs={signInAs} variant="desktop" />
          </div>
        ) : (
          <p className="relative z-10 mt-auto hidden pt-8 text-sm text-slate-400 lg:block">
            {institutionalGoogleOnly
              ? "Use your authorized Google account to continue."
              : "Sign in using your university-authorized Google account."}
          </p>
        )}
      </section>

      {/* Sign-in card */}
      <section className="relative z-10 -mt-14 px-4 pb-10 sm:px-8 lg:mt-0 lg:flex lg:h-full lg:items-center lg:justify-center lg:overflow-y-auto lg:px-[clamp(20px,3vw,48px)] lg:py-[clamp(12px,3vh,40px)]">
        <div className="mx-auto w-full max-w-[460px] rounded-2xl border border-au-border/70 bg-white px-6 py-8 shadow-[0_24px_60px_rgba(8,26,51,0.12)] sm:px-10 sm:py-11 lg:px-[clamp(24px,2.6vw,40px)] lg:py-[clamp(16px,3.6vh,44px)]">
          <img src="/au-logo-blue.png" alt="Air University" className="h-14 w-auto lg:h-[clamp(36px,6.5vh,56px)] [@media(min-width:1024px)_and_(max-height:700px)]:hidden" />
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.28em] text-[#0b4f91] lg:mt-[clamp(0px,2vh,20px)] lg:text-[clamp(11px,1.6vh,14px)]">
            Air University
          </p>
          <h2 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-au-navy lg:mt-[clamp(2px,0.8vh,8px)] lg:text-[clamp(26px,5vh,40px)]">
            {institutionalGoogleOnly ? "Sign in to the UFM Portal" : "Sign in"}
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-slate-600 lg:mt-[clamp(4px,1.2vh,12px)] lg:text-[clamp(13px,2.1vh,17px)]">
            {institutionalGoogleOnly
              ? "Use your authorized Google account to continue."
              : googleEnabled
                ? "Sign in using your university-authorized Google account."
                : passwordEnabled
                  ? "Enter your portal email and password to continue."
                  : "Authentication is not configured. Contact IT support."}
          </p>

          {configLoading ? (
            <p className="mt-6 text-sm text-slate-500" role="status">
              Loading sign-in options…
            </p>
          ) : null}

          {googleEnabled ? (
            <div className="mt-7 space-y-3 lg:mt-[clamp(10px,2.6vh,28px)] lg:space-y-[clamp(6px,1.2vh,12px)]">
              <p className="text-[15px] font-semibold text-au-navy [@media(min-width:1024px)_and_(max-height:760px)]:hidden">Continue with Google</p>
              <div
                ref={googleBtnRef}
                className="flex min-h-[44px] items-center justify-center"
                aria-label="Continue with Google"
              />
              {submitting ? (
                <p className="text-center text-xs text-slate-500" role="status">
                  Signing in…
                </p>
              ) : null}
            </div>
          ) : null}

          {googleEnabled && passwordEnabled ? (
            <div className="mt-7 space-y-2 lg:mt-[clamp(10px,2.6vh,28px)]">
              <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span className="h-px flex-1 bg-slate-200" />
                Development options
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <p className="text-center text-[13px] text-slate-500">
                Password / evaluation logins are for local testing only (
                <code className="rounded bg-slate-100 px-1 font-mono text-[12px] text-au-navy">
                  AUTH_MODE=both
                </code>
                ).
              </p>
            </div>
          ) : null}

          {passwordEnabled ? (
            <form className="mt-6 space-y-5 lg:mt-[clamp(10px,2.2vh,24px)] lg:space-y-[clamp(8px,2vh,20px)]" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-[15px] font-semibold text-au-navy lg:mb-[clamp(4px,1vh,8px)] lg:text-[clamp(13px,1.9vh,15px)]">Email</span>
                <span className="relative block">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-3 text-[16px] lg:py-[clamp(7px,1.5vh,12px)] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0b4f91] focus:bg-white focus:ring-4 focus:ring-[#0b4f91]/10"
                    placeholder="you@university.edu"
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-[15px] font-semibold text-au-navy lg:mb-[clamp(4px,1vh,8px)] lg:text-[clamp(13px,1.9vh,15px)]">Password</span>
                <span className="relative block">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-3 text-[16px] lg:py-[clamp(7px,1.5vh,12px)] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0b4f91] focus:bg-white focus:ring-4 focus:ring-[#0b4f91]/10"
                  />
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0b4f91] px-4 py-4 text-[17px] font-bold lg:py-[clamp(10px,1.9vh,16px)] lg:text-[clamp(15px,2vh,17px)] text-white shadow-[0_10px_24px_rgba(11,79,145,0.3)] transition hover:bg-[#09437c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in to Portal"}
                {submitting ? null : <span aria-hidden="true">→</span>}
              </button>
            </form>
          ) : null}

          {formError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          ) : null}
        </div>
      </section>

      {/* Mobile: shortcuts below the card */}
      {showShortcuts ? (
        <section className="bg-[#081a33] px-5 pb-12 pt-10 lg:hidden">
          <DemoLoginShortcuts submitting={submitting} onSignInAs={signInAs} variant="mobile" />
        </section>
      ) : null}
    </div>
  );
}
