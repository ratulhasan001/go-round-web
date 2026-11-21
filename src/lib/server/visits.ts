import { bdToday } from "@/lib/couponRules";
import { lastDays, type VisitDay } from "@/lib/visits";
import { db, ensureSchema } from "./db";

/** Adds one visit to today's totals (Bangladesh date) - and one visitor when it is the browser's first visit today. */
export async function countVisit(first: boolean, today = bdToday()) {
  await ensureSchema();
  await db()`
    insert into gr_visits (day, visitors, visits) values (${today}::date, ${first ? 1 : 0}, 1)
    on conflict (day) do update set visitors = gr_visits.visitors + excluded.visitors, visits = gr_visits.visits + 1`;
}

/** The last `days` days' totals, oldest first, today last; a day nobody visited is there with zeros. */
export async function visitHistory(days = 30, today = bdToday()): Promise<VisitDay[]> {
  await ensureSchema();
  const dates = lastDays(today, days);
  const rows = await db()<VisitDay[]>`
    select day::text as day, visitors, visits from gr_visits where day between ${dates[0]!}::date and ${today}::date`;
  const by = new Map(rows.map((r) => [r.day, r]));
  return dates.map((day) => ({ day, visitors: by.get(day)?.visitors ?? 0, visits: by.get(day)?.visits ?? 0 }));
}
