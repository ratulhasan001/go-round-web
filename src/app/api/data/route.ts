import type postgres from "postgres";
import { NextResponse } from "next/server";
import { authEnabled, adminAuthed } from "@/lib/server/auth";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * A short fingerprint of every saved record. It changes whenever any record is added, changed or deleted - by the
 * admin panel, a website order, a review, anything - because a row's `xmin` changes with every write to it (so it
 * doesn't depend on each write remembering to touch `updated_at`).
 */
const fingerprint = async (sql: postgres.Sql | postgres.TransactionSql) => {
  const [{ v }] = await sql<{ v: string }[]>`
    select md5(coalesce(string_agg(kind || '/' || id || '/' || xmin::text, ',' order by kind, id), '')) as v from gr_docs`;
  return v;
};

/**
 * All shop data in one go: settings, products, customers, coupons, receipts, letters and website orders.
 * The admin panel asks again every minute with ?v=<the version it has>: when nothing changed it gets back only
 * { unchanged: true } instead of the whole database.
 */
export async function GET(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ db: false, auth: authEnabled() });
  try {
    await ensureSchema();
    const known = new URL(req.url).searchParams.get("v");
    if (known && known === (await fingerprint(db()))) return NextResponse.json({ db: true, auth: authEnabled(), unchanged: true });
    // the version and the records come from one snapshot, so the version describes exactly the records sent with it
    const { version, rows } = await db().begin("isolation level repeatable read read only", async (tx) => ({
      version: await fingerprint(tx),
      rows: await tx<{ kind: string; data: unknown }[]>`select kind, data from gr_docs order by updated_at`,
    }));
    const pick = (k: string) => rows.filter((r) => r.kind === k).map((r) => r.data);
    return NextResponse.json({
      db: true,
      auth: authEnabled(),
      version,
      shop: pick("shop")[0] ?? null,
      products: pick("product"),
      customers: pick("customer"),
      coupons: pick("coupon"),
      invoices: pick("invoice"),
      letters: pick("letter"),
      orders: pick("order"),
      employees: pick("employee"),
      reviews: pick("review"),
    });
  } catch (e) {
    console.error("GET /api/data failed", e);
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}
