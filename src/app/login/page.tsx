"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { WAVE_BACK, WAVE_FRONT } from "@/lib/theme";

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

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // already logged in on this device (a link from another site arrives without the login cookie): carry on
    fetch("/api/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { authed?: boolean }) => b.authed && window.location.replace(goNext()))
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setStatus("checking");
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
    const b = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }) : null;
    if (res?.ok && b?.ok) return finish();
    setPassword("");
    input.current?.focus();
    fail(b?.message ?? (res ? "Wrong password. Try again." : "Can't connect. Check your internet."));
  };

  const Lock = status === "success" ? LockKeyholeOpen : LockKeyhole;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0e2a23] px-5 py-10 text-white">
      {/* soft background light */}
      <div className="animate-drift pointer-events-none absolute -left-32 -top-32 size-[420px] rounded-full bg-aqua/20 blur-3xl" />
      <div className="animate-drift-slow pointer-events-none absolute -bottom-40 -right-24 size-[460px] rounded-full bg-[#8cc556]/15 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />
      <svg viewBox="0 0 595 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full" aria-hidden>
        <path d={WAVE_BACK} className="fill-aqua/15" />
        <path d={WAVE_FRONT} className="fill-[#8cc556]/20" />
      </svg>

      <section className="animate-fade-up relative w-full max-w-[380px] rounded-[32px] border border-white/10 bg-white/[0.06] px-6 pb-7 pt-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-8">
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

        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#8cc556]">Restricted access</div>
        <h1 className="text-center font-[family-name:var(--font-bricolage)] text-3xl font-extrabold tracking-[-0.02em]">{status === "success" ? "Welcome back!" : "Admin login"}</h1>
        <p className="mt-1.5 text-center text-[14px] text-[#b9d8c9]/75">{status === "success" ? "Unlocking…" : "Enter your password to continue"}</p>

        <form onSubmit={submit} className="mt-7">
          <label htmlFor="password" className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.14em] text-white/55">
            Password
          </label>
          <div
            className={`flex items-center rounded-2xl border-2 bg-black/20 transition-colors focus-within:border-[#8cc556] ${
              status === "error" ? "animate-pin-shake border-red-400" : "border-white/15"
            }`}
          >
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
              className="h-14 min-w-0 flex-1 bg-transparent px-4 text-[17px] font-semibold tracking-wide text-white outline-none placeholder:text-white/25"
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

          <div className="min-h-7 pt-2.5 text-center text-[13px] font-semibold text-red-300" role="alert">
            {error}
          </div>

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-1 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8cc556] to-aqua py-3.5 text-[16px] font-extrabold text-[#0e2a23] shadow-lg shadow-[#8cc556]/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {status === "checking" ? <Loader2 className="size-5 animate-spin" /> : null}
            {status === "checking" ? "Checking…" : "Log in"}
            {status === "idle" || status === "error" ? <ArrowRight className="size-5" /> : null}
          </button>
        </form>
      </section>
    </main>
  );
}
