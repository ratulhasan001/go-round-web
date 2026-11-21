"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartColumn, Info, RefreshCw } from "lucide-react";
import type { VisitDay } from "@/lib/visits";
import { Button, Card, SectionTitle, cx } from "@/components/ui";

type Visits = { db: false } | { db: true; today: string; days: VisitDay[] };

const BAR = "#1f7fa8"; // aqua-deep: passes the chart colour checks on the card's paper (#fbf9f4)
const BAR_ACTIVE = "#3a9cc6"; // the same hue, a step lighter, for the bar under the pointer

const count = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string) => `${count(n)} ${one}${n === 1 ? "" : "s"}`;
/** "Sat 15 Nov" (the dates are Bangladesh dates already, so they are read as UTC) */
const dayName = (day: string, weekday = true) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: weekday ? "short" : undefined, day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The store's visitors and visits per day, last 30 days (see /api/visits). Loads when it is shown and again when the
 * admin comes back to the tab after a minute or more - it never checks on a timer, so an open admin panel doesn't keep
 * the database awake. `data` is null while loading and "error" when it couldn't load.
 */
export function useVisits(enabled = true) {
  const [data, setData] = useState<Visits | null | "error">(null);
  const loadedAt = useRef(0);
  const load = useCallback(() => {
    loadedAt.current = Date.now();
    return fetch("/api/visits", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Visits>;
      })
      .then(
        (v) => setData(v),
        () => setData((d) => (d && d !== "error" ? d : "error")), // keep what's on screen
      );
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void load();
    const onShow = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > 60_000) void load();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [enabled, load]);
  return { data, reload: load };
}

/** Website → Visitors: today's numbers, the last 30 days as a chart, and every day as a table. */
export function VisitorsPanel({ cloud }: { cloud: boolean }) {
  const { data, reload } = useVisits(cloud);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    await reload();
    setBusy(false);
  };

  if (!cloud || (data && data !== "error" && !data.db))
    return (
      <Card className="p-5 text-[14px] text-body sm:p-6">
        The visitor counter works with the cloud database: visits are counted on the server, so it shows here once the
        admin panel is connected to it.
      </Card>
    );
  if (!data) return <Card className="grid min-h-60 place-items-center p-6 text-[14px] text-muted">Loading visitors…</Card>;
  if (data === "error" || !data.db)
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5 text-[14px] text-body sm:p-6">
        Couldn&apos;t load the visitor counts.
        <Button size="sm" onClick={() => void refresh()} loading={busy}>
          Try again
        </Button>
      </Card>
    );

  const days = data.days;
  const today = days[days.length - 1]!;
  const yesterday = days[days.length - 2];
  const visits = days.reduce((s, d) => s + d.visits, 0);
  const visitors = days.reduce((s, d) => s + d.visitors, 0);
  const busiest = days.reduce((b, d) => (d.visits > b.visits ? d : b), days[0]!);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">
          Today is {dayName(data.today)} in Bangladesh. Numbers update as customers open the store.
        </p>
        <Button size="sm" onClick={() => void refresh()} loading={busy} aria-label="Refresh the visitor counts">
          {!busy && <RefreshCw className="size-3.5" />} Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label="Visitors today" value={count(today.visitors)} note={yesterday ? `Yesterday ${count(yesterday.visitors)}` : ""} />
        <Stat label="Visits today" value={count(today.visits)} note={yesterday ? `Yesterday ${count(yesterday.visits)}` : ""} />
        <Stat label="Visits in the last 30 days" value={count(visits)} note={`About ${count(Math.round(visitors / days.length))} visitors a day`} />
        <Stat label="Busiest day" value={busiest.visits ? count(busiest.visits) : "-"} note={busiest.visits ? `visits on ${dayName(busiest.day)}` : "No visits yet"} />
      </div>

      <DailyChart days={days} />

      <Card className="p-5 sm:p-6">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
            Day by day
            <span className="text-[13px] font-semibold text-aqua-deep group-open:hidden">Show all 30 days</span>
            <span className="hidden text-[13px] font-semibold text-aqua-deep group-open:inline">Hide</span>
          </summary>
          <table className="mt-4 w-full text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 font-semibold">Day</th>
                <th className="py-2 text-right font-semibold">Visitors</th>
                <th className="py-2 text-right font-semibold">Visits</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-b border-line/60 last:border-0">
                  <td className="py-2 text-body">{d.day === data.today ? `Today · ${dayName(d.day)}` : dayName(d.day)}</td>
                  <td className="py-2 text-right font-semibold text-ink">{count(d.visitors)}</td>
                  <td className="py-2 text-right text-body">{count(d.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      <p className="flex gap-2 text-[13px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          A <b className="font-semibold text-body">visitor</b> is one phone or computer that opened the store that day (Bangladesh time); each
          one is counted once a day. A <b className="font-semibold text-body">visit</b> starts when they open the store, and a new one after half
          an hour away. Search engines, link previews, the verify address and the home page preview here aren&apos;t counted. No cookies and
          nothing about who visited is kept - only these totals.
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, note, hero }: { label: string; value: string; note: string; hero?: boolean }) {
  return (
    <Card className={cx("flex flex-col p-4 sm:p-5", hero && "border-aqua-deep/30 bg-aqua-soft/60")}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className={cx("mt-1 font-sans font-extrabold leading-none text-ink", hero ? "text-5xl sm:text-[56px]" : "text-2xl sm:text-3xl")}>{value}</span>
      {note && <span className="mt-auto pt-2 text-[12.5px] text-muted">{note}</span>}
    </Card>
  );
}

/** Clean axis steps: 1, 2, 5, 10, 20, 50… so that at most 4 steps reach the busiest day. */
function axis(max: number) {
  let step = 1;
  for (let k = 1; max / step > 4; k++) step = [1, 2, 5][k % 3]! * 10 ** Math.floor(k / 3);
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

function DailyChart({ days }: { days: VisitDay[] }) {
  const [metric, setMetric] = useState<"visitors" | "visits">("visits");
  const [active, setActive] = useState<number | null>(null);
  const values = days.map((d) => d[metric]);
  const { top, ticks } = axis(Math.max(...values));
  const empty = values.every((v) => v === 0);
  const last = days.length - 1;
  const label = (d: VisitDay) => `${dayName(d.day)}: ${plural(d.visitors, "visitor")}, ${plural(d.visits, "visit")}`;
  const hovered = active === null ? null : days[active]!;

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={<ChartColumn className="size-4" />}
        title={metric === "visits" ? "Visits per day" : "Visitors per day"}
        hint="The last 30 days, today on the right"
        action={
          <div className="flex shrink-0 gap-1 rounded-xl border border-line bg-white p-1" role="radiogroup" aria-label="Show">
            {(["visits", "visitors"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => setMetric(m)}
                className={cx("h-8 rounded-lg px-3 text-[13px] font-bold capitalize transition", metric === m ? "bg-deep text-lime" : "text-muted hover:bg-canvas hover:text-ink")}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex gap-2">
        {/* y axis */}
        <div className="relative h-52 w-8 shrink-0 text-right text-[11px] tabular-nums text-muted sm:h-60">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {count(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* plot: one roving focus stop; arrow keys move along the days */}
          <div
            className="relative h-52 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-aqua-deep/40 focus-visible:ring-offset-4 sm:h-60"
            tabIndex={0}
            role="group"
            aria-label={`${metric === "visits" ? "Visits" : "Visitors"} per day for the last 30 days. Use the left and right arrow keys to read each day.`}
            onFocus={() => setActive((a) => a ?? last)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "Home" ? -last : e.key === "End" ? last : 0;
              if (!step) return;
              e.preventDefault();
              setActive((a) => Math.min(last, Math.max(0, (a ?? last) + step)));
            }}
          >
            {ticks.map((t) => (
              <div key={t} className={cx("pointer-events-none absolute inset-x-0 h-px", t === 0 ? "bg-faint/70" : "bg-line/70")} style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex">
              {days.map((d, i) => (
                <div key={d.day} className="flex h-full flex-1 items-end justify-center px-[1px]" onPointerEnter={() => setActive(i)} aria-hidden>
                  <div
                    className="w-full max-w-6 rounded-t-[4px] transition-[height,background-color] duration-300"
                    style={{ height: values[i] ? `max(2px, ${(values[i]! / top) * 100}%)` : 0, backgroundColor: active === i ? BAR_ACTIVE : BAR }}
                  />
                </div>
              ))}
            </div>
            {empty && (
              <p className="absolute inset-x-0 top-1/3 px-4 text-center text-[13.5px] text-muted">
                No visits counted yet. They show up here as customers open the store.
              </p>
            )}
            {hovered && (
              // beside the day, inside the chart: towards the middle, so it never covers the bar or leaves the card
              <div
                className="pointer-events-none absolute top-1 z-10 w-max rounded-xl border border-line bg-white px-3 py-2 shadow-lg shadow-deep/10"
                style={
                  active! >= days.length / 2
                    ? { right: `calc(${((days.length - active!) / days.length) * 100}% + 6px)` }
                    : { left: `calc(${((active! + 1) / days.length) * 100}% + 6px)` }
                }
              >
                <div className="text-[12px] text-muted">{active === last ? `Today · ${dayName(hovered.day)}` : dayName(hovered.day)}</div>
                <div className="mt-0.5 text-[13px] text-muted">
                  <b className="text-[15px] font-bold text-ink">{count(hovered.visitors)}</b> {hovered.visitors === 1 ? "visitor" : "visitors"}
                </div>
                <div className="text-[13px] text-muted">
                  <b className="text-[15px] font-bold text-ink">{count(hovered.visits)}</b> {hovered.visits === 1 ? "visit" : "visits"}
                </div>
              </div>
            )}
            <span className="sr-only" aria-live="polite">
              {hovered ? label(hovered) : ""}
            </span>
          </div>

          {/* x axis: every 7th day back from today */}
          <div className="relative mt-2 h-4 text-[11px] text-muted">
            {days.map((d, i) =>
              (last - i) % 7 === 0 ? (
                <span
                  key={d.day}
                  className={cx("absolute whitespace-nowrap", i === last ? "right-0" : "-translate-x-1/2")}
                  style={i === last ? undefined : { left: `${((i + 0.5) / days.length) * 100}%` }}
                >
                  {i === last ? "Today" : dayName(d.day, false)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
