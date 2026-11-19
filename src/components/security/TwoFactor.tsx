"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { Button, Card, Field, Input, SectionTitle, useToast } from "@/components/ui";
import { api, when } from "./shared";

interface Status {
  on: boolean;
  since: string | null;
  recoveryLeft: number;
  secretReady: boolean;
  secretWorks: boolean;
  db?: boolean;
}

type Mode = { k: "idle" } | { k: "start" } | { k: "scan"; qr: string; secret: string } | { k: "codes"; codes: string[] } | { k: "recovery" } | { k: "off" };

/** Shows recovery codes once, with copy and download. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const toast = useToast();
  const text = `Go Round admin - recovery codes\nEach code works once, in place of the code from your app.\n\n${codes.join("\n")}\n`;
  return (
    <div className="grid gap-3">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
        <b>Save these recovery codes now</b> - they are shown only once. If you lose your phone, each code logs you in one time instead of the app code. Keep them
        somewhere safe, away from this computer (printed, or in a password manager).
      </p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-line bg-white px-4 py-3 font-mono text-[14.5px] font-semibold tracking-wider text-ink sm:max-w-md">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => toast("Copied"));
          }}
        >
          <Copy className="size-4" /> Copy
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            a.download = "go-round-admin-recovery-codes.txt";
            a.click();
          }}
        >
          <Download className="size-4" /> Download
        </Button>
        <Button size="sm" variant="dark" onClick={onDone}>
          <Check className="size-4" /> I saved them
        </Button>
      </div>
    </div>
  );
}

/** Steps to add SESSION_SECRET in Vercel, which two-step login needs. */
export function SecretSteps() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
      <p className="flex items-center gap-2 font-bold">
        <TriangleAlert className="size-4 text-amber-600" /> SESSION_SECRET isn&apos;t set up yet
      </p>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
        <li>
          Make a random secret: on a Mac, open Terminal and run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">openssl rand -base64 48</code>
        </li>
        <li>In Vercel → your project → Settings → Environment Variables, add <b>SESSION_SECRET</b> with that value (Production).</li>
        <li>Redeploy, then come back here. Never change it afterwards - the app codes depend on it.</li>
      </ol>
    </div>
  );
}

/** Turns two-step login (a code from an authenticator app) on or off, and makes new recovery codes. */
export function TwoFactor() {
  const toast = useToast();
  const [s, setS] = useState<Status | null>(null);
  const [mode, setMode] = useState<Mode>({ k: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Status>("2fa").then((b) => !b.error && setS(b)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const go = (m: Mode) => {
    setMode(m);
    setPassword("");
    setCode("");
    setError("");
  };

  const send = async (body: Record<string, string>) => {
    setBusy(true);
    setError("");
    const b = await api<{ qr?: string; secret?: string; codes?: string[] }>("2fa", "POST", body);
    setBusy(false);
    if (!b.ok) {
      setError(b.message ?? "Something went wrong. Try again.");
      return null;
    }
    return b;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode.k === "start") {
      const b = await send({ action: "start", password });
      if (b?.qr) go({ k: "scan", qr: b.qr, secret: b.secret ?? "" });
    } else if (mode.k === "scan") {
      const b = await send({ action: "confirm", code });
      if (b?.codes) {
        go({ k: "codes", codes: b.codes });
        toast("Two-step login is on");
        void load();
      }
    } else if (mode.k === "recovery") {
      const b = await send({ action: "recovery", password, code });
      if (b?.codes) {
        go({ k: "codes", codes: b.codes });
        void load();
      }
    } else if (mode.k === "off") {
      const b = await send({ action: "off", password, code });
      if (b) {
        go({ k: "idle" });
        toast("Two-step login is off");
        void load();
      }
    }
  };

  const passwordField = (
    <Field label="Your password">
      <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
    </Field>
  );
  const codeField = (label: string) => (
    <Field label={label}>
      <Input
        inputMode={mode.k === "scan" ? "numeric" : "text"}
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={mode.k === "scan" ? "123 456" : "123456 or a recovery code"}
        required
        maxLength={20}
        className="font-mono tracking-widest"
      />
    </Field>
  );

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={<Smartphone className="size-4" />}
        title="Two-step login"
        hint="After the password, a 6-digit code from an app on your phone - so a stolen password alone isn't enough"
      />
      {!s ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : mode.k === "codes" ? (
        <RecoveryCodes codes={mode.codes} onDone={() => go({ k: "idle" })} />
      ) : (
        <div className="grid gap-4">
          {s.on ? (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-brand/20 bg-soft px-3.5 py-3 text-[13.5px] text-ink">
              <ShieldCheck className="size-5 text-brand" />
              <span>
                <b>On</b>
                {s.since && <> since {when(s.since)}</>} · {s.recoveryLeft} recovery {s.recoveryLeft === 1 ? "code" : "codes"} left
              </span>
            </div>
          ) : (
            !s.secretReady && <SecretSteps />
          )}
          {s.on && !s.secretWorks && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-800">
              SESSION_SECRET in Vercel has changed, so codes from your app can&apos;t be checked. Put the old value back, or log in with a recovery code, turn two-step
              login off and on again.
            </p>
          )}
          {s.on && s.recoveryLeft <= 3 && <p className="text-[13px] font-semibold text-amber-700">Only {s.recoveryLeft} recovery codes left - make new ones.</p>}

          {mode.k === "idle" ? (
            <div className="flex flex-wrap gap-2">
              {s.on ? (
                <>
                  <Button onClick={() => go({ k: "recovery" })}>New recovery codes</Button>
                  <Button variant="danger" onClick={() => go({ k: "off" })}>
                    Turn off
                  </Button>
                </>
              ) : (
                <Button variant="dark" disabled={!s.secretReady || s.db === false} onClick={() => go({ k: "start" })}>
                  <ShieldCheck className="size-4" /> Turn on two-step login
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-3.5 sm:max-w-md">
              {mode.k === "start" && (
                <>
                  <p className="text-[13px] text-body">
                    You&apos;ll need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or Authy. First, type your password.
                  </p>
                  {passwordField}
                </>
              )}
              {mode.k === "scan" && (
                <>
                  <ol className="list-decimal space-y-1 pl-5 text-[13px] text-body">
                    <li>Open your authenticator app and tap + (add an account).</li>
                    <li>Scan this QR code. Can&apos;t scan? Choose “enter a setup key” and type the key below.</li>
                    <li>Type the 6-digit code the app shows.</li>
                  </ol>
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR code made on the server */}
                  <img src={mode.qr} alt="QR code for your authenticator app" className="size-48 rounded-xl border border-line bg-white p-2" />
                  <p className="text-[12.5px] text-muted">
                    Setup key: <span className="select-all font-mono font-semibold tracking-wider text-ink">{mode.secret}</span>
                  </p>
                  {codeField("Code from the app")}
                </>
              )}
              {(mode.k === "recovery" || mode.k === "off") && (
                <>
                  <p className="text-[13px] text-body">
                    {mode.k === "off" ? "Turning it off means the password alone logs in." : "Your old recovery codes will stop working."} Confirm with your password and
                    a code from your app.
                  </p>
                  {passwordField}
                  {codeField("Code from the app (or a recovery code)")}
                </>
              )}
              {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant={mode.k === "off" ? "danger" : "dark"} loading={busy}>
                  {mode.k === "start" ? "Continue" : mode.k === "scan" ? "Turn on" : mode.k === "off" ? "Turn off two-step login" : "Make new codes"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => go({ k: "idle" })}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
