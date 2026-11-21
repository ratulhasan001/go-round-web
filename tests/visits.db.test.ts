// The visitor counter against a real Postgres: totals per day, and the 30 days the admin panel shows. Runs only with
// TEST_DATABASE_URL pointing at a throwaway local database (GitHub's CI starts one), because it empties gr_visits.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const g = globalThis as unknown as { __grSql?: unknown; __grSchema?: unknown };

describe.skipIf(!url)("visitor counter in the database", () => {
  let m: {
    db: typeof import("@/lib/server/db");
    visits: typeof import("@/lib/server/visits");
  };

  beforeAll(async () => {
    if (!local) throw new Error("TEST_DATABASE_URL must be a local throwaway database - these tests empty it");
    process.env.DATABASE_URL = url;
    g.__grSql = g.__grSchema = undefined; // a fresh connection, whatever ran before
    m = { db: await import("@/lib/server/db"), visits: await import("@/lib/server/visits") };
    await m.db.ensureSchema();
    await m.db.db()`delete from gr_visits`;
  });

  afterAll(async () => {
    if (m) await m.db.db().end();
    g.__grSql = g.__grSchema = undefined; // the next test file starts its own
  });

  it("adds visits to the day's totals, and a visitor only for a browser's first visit that day", async () => {
    await Promise.all([m.visits.countVisit(true, "2026-11-21"), m.visits.countVisit(true, "2026-11-21"), m.visits.countVisit(false, "2026-11-21")]);
    await m.visits.countVisit(true, "2026-11-20");
    const [today] = await m.db.db()<{ visitors: number; visits: number }[]>`select visitors, visits from gr_visits where day = '2026-11-21'`;
    expect(today).toEqual({ visitors: 2, visits: 3 });
  });

  it("gives the last 30 days, oldest first, with zeros for quiet days and nothing older", async () => {
    await m.visits.countVisit(true, "2026-10-01"); // long before the 30 days
    const days = await m.visits.visitHistory(30, "2026-11-21");
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ day: "2026-10-23", visitors: 0, visits: 0 });
    expect(days.at(-2)).toEqual({ day: "2026-11-20", visitors: 1, visits: 1 });
    expect(days.at(-1)).toEqual({ day: "2026-11-21", visitors: 2, visits: 3 });
    expect(days.reduce((s, d) => s + d.visits, 0)).toBe(4);
  });
});
