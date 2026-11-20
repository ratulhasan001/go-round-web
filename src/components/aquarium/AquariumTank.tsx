"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Cookie, Droplet, Hand, Heart, Sparkles, SprayCan, Thermometer, Wand2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, money, todayISO } from "@/lib/calc";
import { cx } from "../ui";
import { type Engine, type FishInfo, type SchoolFish, type Tool, createEngine } from "./engine";
import { Algae, type AlgaeHandle } from "./Algae";
import { Cabinet, Light, PlantedScene } from "../PlantedTank";

const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const keep = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
};

const TOOL_HINT: Record<Tool, string> = {
  explore: "Tap a fish to meet it · tap the glass to startle them · swipe to stir up a current",
  feed: "Tap to drop food - the schools come up for it",
  play: "Move your finger or mouse - the fish chase the light",
  clean: "Scrub the glass to wipe off the algae",
};

/**
 * The aquarium: a planted tank (scenery from components/PlantedTank.tsx - plants, driftwood, stones, the leaf carpet,
 * the LED light, filter and CO2) with schools of neon tetras, rummy-nose tetras and harlequin rasboras, run by the
 * engine (engine.ts).
 *
 * In the shop (default) it is tied to the business: a neon tetra for every receipt and a harlequin for every customer,
 * and a celebration for new receipts and customers who have paid in full. With `guest` (the store and the customer
 * form) none of that is read or shown - only the fish - and it keeps its own records on the device.
 */
export function AquariumTank({
  className,
  guest = false,
  guestFish = null,
  dark = false,
}: {
  className?: string;
  guest?: boolean;
  /** Customer form: the name of the fish that joins after the form is sent. */
  guestFish?: string | null;
  /** Controls sit on a dark page. */
  dark?: boolean;
}) {
  const storeData = useStore();
  // a guest never gets the shop's data - not even the demo data a logged-out browser holds
  const invoices = useMemo(() => (guest ? [] : storeData.invoices), [guest, storeData.invoices]);
  const customers = useMemo(() => (guest ? [] : storeData.customers), [guest, storeData.customers]);
  const ready = guest || storeData.ready;
  const K = guest ? "gr-guest-tank-" : "gr-tank-";

  const root = useRef<HTMLDivElement>(null);
  const farLayer = useRef<HTMLDivElement>(null);
  const nearLayer = useRef<HTMLDivElement>(null);
  const fxLayer = useRef<HTMLDivElement>(null);
  const uiLayer = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const algae = useRef<AlgaeHandle>(null);
  const sceneId = "aq" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const [tool, setTool] = useState<Tool>("explore");
  const [hour, setHour] = useState(12);
  const [tick, setTick] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [card, setCard] = useState<FishInfo | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [dirt, setDirt] = useState(0);

  // ---------- shop numbers (never for guests) ----------
  const today = todayISO();
  const totals = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const inv of invoices)
      if (inv.date === today) {
        sum += computeTotals(inv).grandTotal;
        count++;
      }
    return { today: sum, count };
  }, [invoices, today]);
  const receiptFish = useMemo<SchoolFish[]>(
    () =>
      [...invoices]
        .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
        .slice(-30)
        .map((i) => ({ key: `receipt-${i.id}`, name: i.number, fact: `Joined the school when receipt ${i.number}${i.customer.name ? ` for ${i.customer.name}` : ""} was saved.` })),
    [invoices],
  );
  const customerFish = useMemo<SchoolFish[]>(
    () =>
      customers
        .filter((c) => c.name.trim())
        .slice(-20)
        .map((c) => ({ key: `customer-${c.id}`, name: c.name.trim(), fact: `Joined when ${c.name.trim()} became a customer.` })),
    [customers],
  );

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-1), { id, text }]);
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---------- engine ----------
  useEffect(() => {
    const e = createEngine(
      root.current!,
      { far: farLayer.current!, near: nearLayer.current!, fx: fxLayer.current!, ui: uiLayer.current! },
      { onSelect: setCard, onWipe: (x, y, start) => algae.current?.wipe(x, y, start) },
    );
    engine.current = e;
    return () => {
      e.destroy();
      engine.current = null;
    };
  }, []);

  // saved names and the clock (after mount, so the server render matches)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setNames(load(`${K}names`, {}));
      setHour(new Date().getHours());
    }, 0);
    const clock = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    const ticker = window.setInterval(() => setTick((n) => n + 1), 4000);
    return () => {
      clearTimeout(id);
      clearInterval(clock);
      clearInterval(ticker);
    };
  }, [K]);

  useEffect(() => engine.current?.setTool(tool), [tool]);
  useEffect(() => {
    const first = guestFish?.trim().split(/\s+/)[0];
    engine.current?.setNames(first ? { ...names, "guest-you": first } : names);
  }, [names, guestFish]);
  useEffect(() => {
    if (guestFish) engine.current?.addGuest(guestFish);
  }, [guestFish]);

  // the shop's schools; members added later swim in from the side
  const placed = useRef(false);
  useEffect(() => {
    if (guest || !ready || !engine.current) return;
    engine.current.setSchool("receipt", receiptFish, placed.current);
    engine.current.setSchool("customer", customerFish, placed.current);
    placed.current = true;
  }, [guest, ready, receiptFish, customerFish]);

  // celebrations: new receipts since the last visit, and customers whose dues are now fully paid
  const celebrated = useRef(false);
  useEffect(() => {
    if (guest || !ready || celebrated.current || !engine.current) return;
    celebrated.current = true;
    const e = engine.current;
    const dues: Record<string, number> = {};
    for (const inv of invoices) {
      const name = inv.customer.name.trim();
      if (name) dues[name] = (dues[name] ?? 0) + Math.max(0, computeTotals(inv).due);
    }
    const seen = load<{ invoices: number; dues: Record<string, number> } | null>(`${K}seen`, null);
    keep(`${K}seen`, { invoices: invoices.length, dues });
    if (!seen) return;
    const fresh = invoices.length - seen.invoices;
    const cleared = Object.entries(seen.dues)
      .filter(([name, was]) => was > 0.5 && name in dues && dues[name]! <= 0.5)
      .map(([name]) => name);
    window.setTimeout(() => {
      if (fresh > 0) {
        e.celebrate();
        toast(`🎉 ${fresh} new receipt${fresh === 1 ? "" : "s"} - ${fresh === 1 ? "a new neon tetra has" : `${fresh} new neon tetras have`} joined the school!`);
      }
      cleared.forEach((name, i) =>
        window.setTimeout(() => {
          e.celebrate();
          toast(`💰 ${name} has paid in full!`);
        }, (fresh > 0 ? 4500 : 0) + i * 5000),
      );
    }, 1200);
  }, [guest, ready, invoices, toast, K]);

  // ---------- controls ----------
  const adopt = (key: string, name: string | null) => {
    setNames((n) => {
      const next = { ...n };
      if (name) next[key] = name;
      else delete next[key];
      keep(`${K}names`, next);
      return next;
    });
    if (name) toast(`♥ You adopted ${name}!`);
  };
  const closeCard = useCallback(() => engine.current?.select(null), []);

  // care readings drift gently with the time of day; the heater kicks in below 25.8°
  const temp = 25.7 + Math.sin(((hour - 9) / 24) * Math.PI * 2) * 0.45 + Math.sin(tick * 0.9) * 0.05;
  const ph = 7.45 - dirt * 0.4 + Math.sin(tick * 0.7) * 0.02;
  const clean = Math.round((1 - dirt) * 100);

  return (
    <div className={cx("relative select-none", className)}>
      {/* the LED light on the rim */}
      <Light dark={dark} />

      {/* frame */}
      <div
        className={cx(
          "overflow-hidden rounded-[22px] border-[3px] border-t-[9px]",
          dark ? "border-[#cfe6e2]/70 border-t-[#0b261d] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]" : "border-[#d3e5e2] border-t-[#113A2D] shadow-[0_30px_60px_-34px_rgba(17,58,45,0.55)]",
        )}
      >
        <div ref={root} data-tool={tool} role="application" aria-label="Interactive aquarium" className="tank-root relative h-80 overflow-hidden bg-[#e1f3f0] sm:h-[28rem]">
          {/* the planted scene: water and light, plants, driftwood, stones, the leaf carpet, filter pipes and CO2 */}
          <PlantedScene id={sceneId} interactive />
          {/* far fish behind, near fish in front, then their bubbles and food */}
          <div ref={farLayer} className="pointer-events-none absolute inset-0" />
          <div ref={nearLayer} className="pointer-events-none absolute inset-0" />
          <div ref={fxLayer} className="pointer-events-none absolute inset-0" />

          <Equipment temp={temp} />

          {/* the glass: algae, reflections */}
          <Algae ref={algae} storage={K} onDirt={setDirt} onClean={() => toast("✨ Sparkling clean! The fish can see you again")} />
          <div className="pointer-events-none absolute -left-10 top-0 h-full w-40 -skew-x-12 bg-gradient-to-r from-white/0 via-white/15 to-white/0" />
          <div className="pointer-events-none absolute left-40 top-0 h-full w-8 -skew-x-12 bg-white/10" />
          <div className="pointer-events-none absolute inset-0 rounded-[1.3rem] shadow-[inset_0_0_40px_rgb(0_0_0/0.25),inset_0_0_0_1px_rgb(255_255_255/0.2)]" />

          {/* name tags and the play dot */}
          <div ref={uiLayer} className="pointer-events-none absolute inset-0" />

          {/* announcements on the glass */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-2 px-3">
            {toasts.map((t) => (
              <div key={t.id} className="tank-toast rounded-full bg-deep/80 px-3.5 py-1.5 text-center text-[12.5px] font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md sm:text-[13px]">
                {t.text}
              </div>
            ))}
          </div>
          {card && <FishCard key={card.key} info={card} engine={engine} root={root} adopted={names[card.key]} onAdopt={adopt} onClose={closeCard} />}
        </div>
      </div>
      {/* the cabinet, with the canister filter and CO2 cylinder inside */}
      <Cabinet dark={dark} />

      {/* controls */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex justify-center">
          <div role="radiogroup" aria-label="Aquarium tool" className={cx("relative grid grid-cols-4 rounded-2xl p-1 shadow-sm ring-1", dark ? "bg-white/10 ring-white/15" : "bg-white ring-line")}>
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-xl bg-deep shadow ring-1 ring-lime/30 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ transform: `translateX(${["explore", "feed", "play", "clean"].indexOf(tool) * 100}%)` }}
            />
            {(
              [
                ["explore", "Explore", <Hand key="h" className="size-4" />],
                ["feed", "Feed", <Cookie key="c" className="size-4" />],
                ["play", "Play", <Wand2 key="p" className="size-4" />],
                ["clean", "Clean", <SprayCan key="s" className="size-4" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                role="radio"
                aria-checked={tool === id}
                onClick={() => setTool(id)}
                className={cx(
                  "relative z-10 flex items-center justify-center gap-1.5 px-2.5 py-2 text-[13px] font-bold transition-colors sm:px-3.5",
                  tool === id ? "text-lime" : dark ? "text-mint/80 hover:text-white" : "text-muted hover:text-ink",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Meter dark={dark} icon={<Thermometer className="size-4" />} label="Temp" value={`${temp.toFixed(1)}°C`} frac={(temp - 24) / 4} tone={temp < 25.8 ? "bg-orange-400" : "bg-lime"} />
          <Meter dark={dark} icon={<Droplet className="size-4" />} label="pH" value={ph.toFixed(1)} frac={(ph - 6.6) / 1.2} tone={ph < 7.1 ? "bg-amber-400" : "bg-aqua"} />
          <Meter
            dark={dark}
            icon={<Sparkles className="size-4" />}
            label="Clean"
            value={`${clean}%`}
            frac={clean / 100}
            tone={clean < 35 ? "bg-red-400" : clean < 65 ? "bg-amber-400" : "bg-lime"}
            onClick={clean < 90 ? () => setTool("clean") : undefined}
          />
        </div>
      </div>
      <p key={tool} className={cx("animate-fade-up mt-3 text-center text-[12.5px]", dark ? "text-mint/75" : "text-muted")}>
        {TOOL_HINT[tool]}
      </p>
      {!guest && (
        <p className="mt-1 text-center text-[12px] text-faint">
          <span className="font-semibold text-sky-600">{receiptFish.length}</span> receipt fish (neon tetras) ·{" "}
          <span className="font-semibold text-orange-600">{customerFish.length}</span> customer fish (harlequins) ·{" "}
          <span className="font-semibold text-body">{totals.count ? `৳ ${money(totals.today)} sold today` : "no sales yet today"}</span>
        </p>
      )}
    </div>
  );
}

function Meter({ icon, label, value, frac, tone, onClick, dark }: { icon: React.ReactNode; label: string; value: string; frac: number; tone: string; onClick?: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        "flex h-11 items-center gap-2 rounded-2xl px-3 shadow-sm ring-1 transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default",
        dark ? "bg-white/10 ring-white/15" : "bg-white ring-line",
      )}
      title={onClick ? "The glass needs a clean - tap to pick up the sponge" : undefined}
    >
      <span className={dark ? "text-mint/70" : "text-muted"}>{icon}</span>
      <span className="text-left">
        <span className={cx("block text-[10px] font-bold uppercase leading-none tracking-wider", dark ? "text-mint/60" : "text-faint")}>{label}</span>
        <span className={cx("block text-[13px] font-extrabold tabular-nums leading-tight", dark ? "text-white" : "text-ink")}>{value}</span>
      </span>
      <span className={cx("h-1.5 w-12 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-line")}>
        <span className={cx("block h-full rounded-full transition-all duration-700", tone)} style={{ width: `${Math.max(4, Math.min(100, frac * 100))}%` }} />
      </span>
    </button>
  );
}

/** Card that floats above the tapped fish and follows it; adopt it with a name. */
function FishCard({
  info,
  engine,
  root,
  adopted,
  onAdopt,
  onClose,
}: {
  info: FishInfo;
  engine: React.RefObject<Engine | null>;
  root: React.RefObject<HTMLDivElement | null>;
  adopted?: string;
  onAdopt: (key: string, name: string | null) => void;
  onClose: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(adopted ?? info.name);

  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const p = engine.current?.where(info.key);
      const box = el.current;
      const w = root.current?.clientWidth ?? 0;
      if (!p) return onClose();
      if (box) {
        const cw = box.offsetWidth;
        const ch = box.offsetHeight;
        const x = Math.max(8, Math.min(w - cw - 8, p.x - cw / 2));
        const below = p.y - ch - 16 < 8; // no room above: show it underneath
        box.style.transform = `translate3d(${x}px, ${below ? p.y + 40 : p.y - ch - 14}px, 0)`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [info.key, engine, root, onClose]);

  const shown = adopted ?? info.name;
  return (
    <div ref={el} data-tank-ui className="absolute left-0 top-0 z-30 w-60" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tank-card rounded-2xl bg-white/95 p-3.5 text-ink shadow-2xl ring-1 ring-black/5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-aqua-deep">{info.species}</p>
            <p className="flex items-center gap-1.5 truncate text-[17px] font-extrabold">
              {adopted && <Heart className="size-4 shrink-0 fill-rose-500 text-rose-500" />}
              {shown}
            </p>
          </div>
          <button onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition hover:rotate-90 hover:bg-canvas" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {info.fact && <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{info.fact}</p>}
        {info.adoptable &&
          (naming ? (
            <form
              className="mt-3 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = draft.trim().slice(0, 20);
                if (n) onAdopt(info.key, n);
                setNaming(false);
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={20}
                placeholder="Give it a name"
                className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-2.5 text-[13px] font-semibold outline-none focus:border-lime focus:bg-white"
              />
              <button className="h-9 rounded-xl bg-deep px-3 text-[12.5px] font-bold text-lime active:scale-95">Save</button>
            </form>
          ) : (
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => setNaming(true)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-50 text-[12.5px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95"
              >
                <Heart className="size-3.5" /> {adopted ? "Rename" : "Adopt & name"}
              </button>
              {adopted && (
                <button onClick={() => onAdopt(info.key, null)} className="h-9 rounded-xl px-2.5 text-[12px] font-semibold text-muted transition hover:bg-canvas">
                  Release
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

/** The heater (on when the water is below 25.8°) and the thermometer on the left glass. */
function Equipment({ temp }: { temp: number }) {
  const heating = temp < 25.8;
  return (
    <>
      <div className="pointer-events-none absolute left-2 top-5 flex w-3.5 flex-col items-center sm:left-4 sm:w-4">
        <div className="relative h-3 w-full rounded-t bg-[#1f2725]">
          <span className={cx("absolute left-1/2 top-1 size-1 -translate-x-1/2 rounded-full", heating ? "tank-pilot bg-red-500" : "bg-red-900")} />
        </div>
        <div className="relative h-32 w-full rounded-b-full border border-white/40 bg-white/15 sm:h-44">
          <div className={cx("absolute inset-x-[3px] bottom-2 top-2 rounded-full bg-[repeating-linear-gradient(0deg,#f97316_0_1.5px,transparent_1.5px_4px)] transition-opacity duration-1000", heating ? "opacity-80" : "opacity-30")} />
          <div className={cx("absolute inset-x-0 bottom-0 h-1/3 rounded-b-full bg-gradient-to-t from-orange-400/40 to-transparent transition-opacity duration-1000", heating ? "opacity-100" : "opacity-0")} />
          <span className="absolute -right-1.5 top-6 size-2 rounded-full bg-white/40" />
          <span className="absolute -right-1.5 bottom-8 size-2 rounded-full bg-white/40" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-8 top-5 flex h-16 w-5 flex-col items-center justify-end overflow-hidden rounded-full bg-white/85 pb-1 shadow sm:left-12 sm:h-20 sm:w-6">
        <span className="absolute top-1 text-[6px] font-bold tabular-nums text-ink sm:text-[7px]">{temp.toFixed(1)}°</span>
        <span className="w-1 rounded-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-1000" style={{ height: `${30 + (temp - 24) * 12}%` }} />
        <span className="mt-0.5 size-2 rounded-full bg-red-500" />
      </div>
    </>
  );
}
