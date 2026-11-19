import { WAVE_BACK, WAVE_FRONT } from "@/lib/theme";

/** The dark, glowing backdrop and glass card of the login pages. */
export function LoginShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </section>
    </main>
  );
}

export const loginField = "flex items-center rounded-2xl border-2 bg-black/20 transition-colors focus-within:border-[#8cc556]";
export const loginInput = "h-14 min-w-0 flex-1 bg-transparent px-4 text-[17px] font-semibold tracking-wide text-white outline-none placeholder:text-white/25";
export const loginLabel = "mb-1.5 block text-[12px] font-bold uppercase tracking-[0.14em] text-white/55";
export const loginLink = "text-[13px] font-semibold text-[#b9d8c9]/70 underline-offset-4 transition hover:text-white hover:underline";
export const loginButton =
  "mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8cc556] to-aqua py-3.5 text-[16px] font-extrabold text-[#0e2a23] shadow-lg shadow-[#8cc556]/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50";
