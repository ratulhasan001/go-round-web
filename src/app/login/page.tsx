"use client";

import { useEffect, useRef, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Fingerprint, Loader2, LockKeyhole, LockKeyholeOpen, Mail, Smartphone } from "lucide-react";
import { LoginShell, loginButton, loginField, loginInput, loginLabel, loginLink } from "@/components/LoginShell";
import { Turnstile } from "@/components/Turnstile";
import { useClientValue } from "@/components/ui";

type Status = "idle" | "checking" | "error" | "success";

/** Only a path on this site: "/\\evil.com" or "/\tevil.com" would leave it. */
function safeNext(next: string | null) {
  if (!next) return "/";
  try {
    const u = new URL(next, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

const goNext = () => safeNext(new URLSearchParams(window.location.search).get("next"));

const field = loginField;
const inputCls = loginInput;
const linkBtn = loginLink;

interface Answer {
  ok?: boolean;
  error?: string;
  message?: string;
  next?: "code";
  ticket?: string;
  appWorks?: boolean;
  recoveryLeft?: number;
  app?: boolean;
  email?: boolean;
  emailTo?: string;
  emailSent?: boolean;
  sent?: boolean;
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [siteKey, setSiteKey] = useState(""); // Cloudflare's human check, when it is set up
  const [human, setHuman] = useState("");
  const [resetHuman, setResetHuman] = useState(0);
  // two-step login: after a right password, the code from the app (or a recovery code)
  const [ticket, setTicket] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [methods, setMethods] = useState({ app: false, email: false, emailTo: "" }); // which second steps are on
  const [viaEmail, setViaEmail] = useState(false); // typing the code that was emailed
  const codeInput = useRef<HTMLInputElement>(null);
  // "Forgot password?": a reset link sent to the owner's Telegram / email
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState("");
  const passkeys = useClientValue(() => browserSupportsWebAuthn(), false); // this browser can use passkeys

  useEffect(() => {
    // already logged in on this device (a link from another site arrives without the login cookie): carry on
    fetch("/api/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { authed?: boolean; turnstile?: string | null }) => {
        if (b.authed) window.location.replace(goNext());
        else if (b.turnstile) setSiteKey(b.turnstile);
      })
      .catch(() => null);
  }, []);

  const busy = status === "checking" || status === "success";

  const finish = () => {
    setStatus("success");
    navigator.vibrate?.(30);
    setTimeout(() => window.location.replace(goNext()), 650);
  };

  const fail = (message: string) => {
    setStatus("error");
    setError(message);
    navigator.vibrate?.([60, 40, 60]);
    setTimeout(() => setStatus((s) => (s === "error" ? "idle" : s)), 550);
  };

  const post = async (body: Record<string, unknown>) => {
    setStatus("checking");
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const b = res ? ((await res.json().catch(() => ({}))) as Answer) : null;
    return { res, b };
  };

  const backToPassword = (message = "") => {
    setTicket("");
    setCode("");
    setRecovery(false);
    setViaEmail(false);
    setPassword("");
    if (siteKey) setResetHuman((n) => n + 1);
    if (message) fail(message);
    else setStatus("idle");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    if (siteKey && !human) return fail("Please tick “Verify you are human” first.");
    const { res, b } = await post({ password, turnstile: human });
    if (siteKey) setResetHuman((n) => n + 1); // each pass works once
    if (res?.ok && b?.ok) return finish();
    if (res?.ok && b?.next === "code" && b.ticket) {
      setTicket(b.ticket);
      setMethods({ app: !!b.app, email: !!b.email, emailTo: b.emailTo ?? "" });
      setViaEmail(!!b.emailSent);
      setRecovery(!b.app && !b.emailSent);
      setStatus("idle");
      setTimeout(() => codeInput.current?.focus(), 50);
      return;
    }
    setPassword("");
    input.current?.focus();
    fail(b?.message ?? (res ? "Wrong password. Try again." : "Can't connect. Check your internet."));
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    const { res, b } = await post({ ticket, code });
    if (res?.ok && b?.ok) return finish();
    if (b?.error === "expired") return backToPassword(b.message ?? "Please log in again.");
    setCode("");
    codeInput.current?.focus();
    fail(b?.message ?? (res ? "That code isn't right." : "Can't connect. Check your internet."));
  };

  const showForgot = (on: boolean) => {
    setForgot(on);
    setSent("");
    setError("");
    setHuman(""); // the other form has its own human check
    setStatus("idle");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (siteKey && !human) return fail("Please tick “Verify you are human” first.");
    setStatus("checking");
    setError("");
    const res = await fetch("/api/login/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turnstile: human }) }).catch(() => null);
    const b = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; to?: string }) : null;
    if (siteKey) setResetHuman((n) => n + 1);
    if (b?.ok) {
      setStatus("idle");
      return setSent(`A reset link was sent to your ${b.to}. It works for 20 minutes.`);
    }
    if (b?.error === "nochannel") {
      setStatus("idle");
      return setSent(
        "No reset channel (Telegram or email) is set up yet, so a link can't be sent. Whoever manages the website can change APP_PASSWORD in Vercel - the login then goes back to that password.",
      );
    }
    fail(b?.message ?? (res ? "Something went wrong. Try again." : "Can't connect. Check your internet."));
  };

  /** Emails a login code (instead of the app's, or again). */
  const emailCode = async () => {
    if (busy) return;
    const { res, b } = await post({ ticket, send: "email" });
    if (b?.sent) {
      setViaEmail(true);
      setRecovery(false);
      setCode("");
      setStatus("idle");
      setTimeout(() => codeInput.current?.focus(), 30);
      return;
    }
    if (b?.error === "expired") return backToPassword(b.message ?? "Please log in again.");
    fail(b?.message ?? (res ? "The email couldn't be sent." : "Can't connect. Check your internet."));
  };

  const switchWay = (way: "app" | "recovery") => {
    setRecovery(way === "recovery");
    setViaEmail(false);
    setCode("");
    setError("");
    setTimeout(() => codeInput.current?.focus(), 30);
  };

  /** Logs in with a passkey: the device asks for a fingerprint, face or screen lock. */
  const passkeyLogin = async () => {
    if (busy) return;
    setStatus("checking");
    setError("");
    const post2 = (body: unknown) =>
      fetch("/api/login/passkey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => r.json() as Promise<Answer & { options?: Parameters<typeof startAuthentication>[0]["optionsJSON"]; token?: string }>)
        .catch(() => null);
    const o = await post2({ step: "options" });
    if (!o?.options) return fail(o?.message ?? "Can't connect. Check your internet.");
    let response;
    try {
      response = await startAuthentication({ optionsJSON: o.options });
    } catch {
      setStatus("idle");
      return; // cancelled
    }
    const v = await post2({ step: "verify", token: o.token, response });
    if (v?.ok) return finish();
    fail(v?.message ?? "That passkey didn't work. Try again or use your password.");
  };

  const Lock = status === "success" ? LockKeyholeOpen : status === "idle" && ticket ? (viaEmail ? Mail : Smartphone) : LockKeyhole;
  const title =
    status === "success" ? "Welcome back!" : ticket ? (recovery ? "Recovery code" : viaEmail ? "Check your email" : "Enter your code") : forgot ? "Forgot password?" : "Admin login";
  const hint =
    status === "success"
      ? "Unlocking…"
      : ticket
        ? recovery
          ? "Type one of the recovery codes you saved"
          : viaEmail
            ? `We emailed a 6-digit code to ${methods.emailTo || "your email"}. It works for 10 minutes.`
          : "Open your authenticator app and type the 6-digit code"
        : forgot
          ? "We'll send a reset link to the shop owner's Telegram or email"
          : "Enter your password to continue";

  return (
    <LoginShell>
        {/* lock badge */}
        <div className="relative mx-auto mb-5 grid size-16 place-items-center">
          <span
            className={`absolute inset-0 rounded-2xl transition-colors duration-300 ${status === "error" ? "bg-red-400/30" : "bg-[#8cc556]/25"} ${status === "idle" ? "animate-pin-halo" : ""}`}
          />
          <span
            className={`relative grid size-16 place-items-center rounded-2xl text-[#0e2a23] shadow-lg transition-all duration-300 ${
              status === "error" ? "bg-gradient-to-br from-red-300 to-red-400 shadow-red-400/25" : "bg-gradient-to-br from-[#8cc556] to-aqua shadow-[#8cc556]/20"
            } ${status === "success" ? "animate-pin-unlock" : ""} ${status === "error" ? "animate-pin-wobble" : ""}`}
          >
            <Lock className="size-7" strokeWidth={2.2} />
          </span>
        </div>

        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#8cc556]">{ticket ? "Step 2 of 2" : "Restricted access"}</div>
        <h1 className="text-center font-[family-name:var(--font-bricolage)] text-3xl font-extrabold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1.5 text-center text-[14px] text-[#b9d8c9]/75">{hint}</p>

        {ticket ? (
          <form onSubmit={submitCode} className="mt-7">
            <label htmlFor="code" className={loginLabel}>
              {recovery ? "Recovery code" : "6-digit code"}
            </label>
            <div className={`${field} ${status === "error" ? "animate-pin-shake border-red-400" : "border-white/15"}`}>
              <input
                ref={codeInput}
                id="code"
                name="code"
                key={recovery ? "recovery" : "app"}
                inputMode={recovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
                maxLength={recovery ? 20 : 7}
                value={code}
                disabled={busy}
                onChange={(e) => {
                  setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                className={`${inputCls} text-center font-mono text-[22px] tracking-[0.3em]`}
                placeholder={recovery ? "xxxxx-xxxxx" : "000000"}
              />
            </div>
            <div className="min-h-7 pt-2.5 text-center text-[13px] font-semibold text-red-300" role="alert">
              {error}
            </div>
            <SubmitButton status={status} disabled={busy || !code.trim()} label="Verify" />
            <div className="mt-4 flex items-start justify-between gap-3">
              <button type="button" className={`${linkBtn} inline-flex items-center gap-1`} onClick={() => backToPassword()}>
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <div className="flex flex-col items-end gap-1.5 text-right">
                {methods.email && (
                  <button type="button" className={`${linkBtn} inline-flex items-center gap-1.5`} onClick={emailCode} disabled={busy}>
                    <Mail className="size-3.5" /> {viaEmail ? "Send the code again" : "Email me a code"}
                  </button>
                )}
                {methods.app && (viaEmail || recovery) && (
                  <button type="button" className={linkBtn} onClick={() => switchWay("app")}>
                    Use the app code
                  </button>
                )}
                {!recovery && (
                  <button type="button" className={linkBtn} onClick={() => switchWay("recovery")}>
                    Use a recovery code
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : forgot ? (
          <form onSubmit={sendReset} className="mt-7">
            {sent ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-[14px] leading-relaxed text-[#d7ebe1]">{sent}</p>
            ) : (
              <>
                <p className="text-[13.5px] leading-relaxed text-[#b9d8c9]/80">
                  The link only goes to the owner&apos;s own Telegram or email set up in the website settings - never to an address typed here.
                </p>
                <div className="min-h-7 pt-2.5 text-center text-[13px] font-semibold text-red-300" role="alert">
                  {error}
                </div>
                {siteKey && (
                  <div className="mb-3">
                    <Turnstile siteKey={siteKey} action="admin-forgot" onToken={setHuman} reset={resetHuman} />
                  </div>
                )}
                <SubmitButton status={status} disabled={busy || (!!siteKey && !human)} label="Send reset link" />
              </>
            )}
            <div className="mt-4 text-center">
              <button type="button" className={`${linkBtn} inline-flex items-center gap-1`} onClick={() => showForgot(false)}>
                <ArrowLeft className="size-3.5" /> Back to login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitPassword} className="mt-7">
            <label htmlFor="password" className={loginLabel}>
              Password
            </label>
            <div className={`${field} ${status === "error" ? "animate-pin-shake border-red-400" : "border-white/15"}`}>
              <input
                ref={input}
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                disabled={busy}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className={inputCls}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="grid h-14 w-12 shrink-0 place-items-center text-white/50 transition hover:text-white"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>

            <div className="flex min-h-7 items-start justify-between gap-3 pt-2.5">
              <p className="text-[13px] font-semibold text-red-300" role="alert">
                {error}
              </p>
              <button type="button" className={`${linkBtn} shrink-0`} onClick={() => showForgot(true)}>
                Forgot password?
              </button>
            </div>

            {siteKey && (
              <div className="mb-3">
                <Turnstile siteKey={siteKey} action="admin-login" onToken={setHuman} reset={resetHuman} />
              </div>
            )}

            <SubmitButton status={status} disabled={busy || !password || (!!siteKey && !human)} label="Log in" />

            {passkeys && (
              <>
                <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">
                  <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={passkeyLogin}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 text-[15px] font-bold text-white transition hover:border-[#8cc556]/50 hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50"
                >
                  <Fingerprint className="size-5 text-[#8cc556]" /> Log in with a passkey
                </button>
              </>
            )}
          </form>
        )}
    </LoginShell>
  );
}

function SubmitButton({ status, disabled, label }: { status: Status; disabled: boolean; label: string }) {
  return (
    <button type="submit" disabled={disabled} className={loginButton}>
      {status === "checking" ? <Loader2 className="size-5 animate-spin" /> : null}
      {status === "checking" ? "Checking…" : label}
      {status === "idle" || status === "error" ? <ArrowRight className="size-5" /> : null}
    </button>
  );
}
