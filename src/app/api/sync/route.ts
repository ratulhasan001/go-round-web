import type postgres from "postgres";
import { NextResponse, after } from "next/server";
import { adminAuthed } from "@/lib/server/auth";
import { KINDS, type Kind, db, dbEnabled, ensureSchema } from "@/lib/server/db";
import { couponForOrderChange, mergeOrder, mergeProduct, stockForOrderChange } from "@/lib/server/orders";
import { syncAccount } from "@/lib/server/customers";
import { submitToIndexNow } from "@/lib/server/indexNow";
import { productPath } from "@/lib/seo";
import { onSite } from "@/lib/site";
import type { Invoice, Order, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Change {
  kind: Kind;
  id: string;
  data: Record<string, unknown> | null; // null = delete
}

const valid = (c: unknown): c is Change => {
  const x = c as Change;
  return !!x && KINDS.includes(x.kind) && typeof x.id === "string" && x.id.length > 0 && x.id.length <= 100 && (x.data === null || typeof x.data === "object");
};

/** Saves a batch of changes (upserts and deletes) from the browser. */
export async function POST(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "no database" }, { status: 503 });

  let changes: unknown;
  try {
    changes = (await req.json())?.changes;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!Array.isArray(changes) || changes.length > 5000 || !changes.every(valid)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    await ensureSchema();
    const sql = db();
    const renumbered: { id: string; number: string }[] = [];
    await sql.begin(async (tx) => {
      // receipts are numbered one batch at a time, so two devices saving at once can't both take the same number
      if ((changes as Change[]).some((c) => c.kind === "invoice" && c.data)) await tx`select pg_advisory_xact_lock(7301)`;
      for (const c of changes as Change[]) {
        if (c.data === null) {
          if (c.kind === "order") {
            // a deleted order that never left the shop gives its stock back
            const [cur] = await tx<{ data: Order }[]>`select data from gr_docs where kind = 'order' and id = ${c.id} for update`;
            await stockForOrderChange(tx, cur?.data, null);
            await couponForOrderChange(tx, cur?.data, null);
          }
          await tx`delete from gr_docs where kind = ${c.kind} and id = ${c.id}`;
        } else if (c.kind === "order") {
          // customers can add payment details to an order while the admin panel holds an older copy of it
          const [cur] = await tx<{ data: Order }[]>`select data from gr_docs where kind = 'order' and id = ${c.id} for update`;
          const data = mergeOrder(cur?.data, c.data as unknown as Order);
          // cancelling puts the items back in stock; bringing the order back takes them again
          await stockForOrderChange(tx, cur?.data, data);
          // and so does a coupon used at checkout
          await couponForOrderChange(tx, cur?.data, data);
          await tx`
            insert into gr_docs (kind, id, data) values ('order', ${c.id}, ${tx.json(data as never)})
            on conflict (kind, id) do update set data = excluded.data, updated_at = now()`;
        } else if (c.kind === "invoice") {
          const inv = c.data as unknown as Invoice;
          const number = await uniqueNumber(tx, c.id, String(inv.number ?? ""));
          if (number !== inv.number) {
            renumbered.push({ id: c.id, number });
            // the website order and the coupon that point at this receipt follow it
            await tx`update gr_docs set data = jsonb_set(data, '{invoiceNumber}', to_jsonb(${number}::text)), updated_at = now() where kind = 'order' and data->>'invoiceId' = ${c.id}`;
            await tx`update gr_docs set data = jsonb_set(data, '{usedInvoice}', to_jsonb(${number}::text)), updated_at = now() where kind = 'coupon' and data->>'usedInvoiceId' = ${c.id}`;
          }
          const data = { ...inv, number };
          await tx`
            insert into gr_docs (kind, id, data) values ('invoice', ${c.id}, ${tx.json(data as never)})
            on conflict (kind, id) do update set data = excluded.data, updated_at = now()`;
        } else if (c.kind === "product") {
          // keep the server's stock count when it is newer than the panel's copy (a website order took stock since)
          const [cur] = await tx<{ data: Product }[]>`select data from gr_docs where kind = 'product' and id = ${c.id} for update`;
          const data = mergeProduct(cur?.data, c.data as unknown as Product);
          await tx`
            insert into gr_docs (kind, id, data) values ('product', ${c.id}, ${tx.json(data as never)})
            on conflict (kind, id) do update set data = excluded.data, updated_at = now()`;
        } else if (c.kind === "customer") {
          // an edited customer passes the new details on to their website account (same phone number), if any
          const [cur] = await tx<{ data: Record<string, unknown> }[]>`select data from gr_docs where kind = 'customer' and id = ${c.id}`;
          await tx`
            insert into gr_docs (kind, id, data) values ('customer', ${c.id}, ${tx.json(c.data as never)})
            on conflict (kind, id) do update set data = excluded.data, updated_at = now()`;
          const s = (v: unknown) => (typeof v === "string" ? v : "");
          const d = c.data;
          const changed = !cur || ["name", "phone", "address", "email"].some((k) => s(cur.data[k]) !== s(d[k]));
          if (changed) await syncAccount(tx, { name: s(d.name), phone: s(d.phone), address: s(d.address), email: s(d.email) });
        } else
          await tx`
            insert into gr_docs (kind, id, data) values (${c.kind}, ${c.id}, ${tx.json(c.data as never)})
            on conflict (kind, id) do update set data = excluded.data, updated_at = now()`;
      }
    });
    // products added or changed on the website: tell Bing & co. now rather than waiting for their crawlers
    const shown = (changes as Change[]).filter((c) => c.kind === "product" && c.data && onSite(c.data as unknown as Product)).map((c) => productPath(c.data as unknown as Product));
    if (shown.length) after(() => submitToIndexNow([...shown, "/products"]));
    return NextResponse.json({ ok: true, saved: (changes as Change[]).length, renumbered });
  } catch (e) {
    console.error("POST /api/sync failed", e);
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}

type Tx = postgres.TransactionSql;

/**
 * The number a receipt may keep. Another receipt already has it (two devices made one at the same moment): the one
 * saved first keeps it, and this one gets the next free number with the same prefix - unless it was given a number
 * earlier, which it then keeps (so saving it again doesn't move it on every time).
 */
async function uniqueNumber(tx: Tx, id: string, number: string): Promise<string> {
  const wanted = number.trim();
  if (!wanted) return number;
  const [taken] = await tx<{ id: string }[]>`select id from gr_docs where kind = 'invoice' and id <> ${id} and lower(trim(data->>'number')) = lower(${wanted}) limit 1`;
  if (!taken) return number;
  const [mine] = await tx<{ number: string }[]>`select data->>'number' as number from gr_docs where kind = 'invoice' and id = ${id}`;
  if (mine?.number && mine.number.trim().toLowerCase() !== wanted.toLowerCase()) {
    const [still] = await tx<{ id: string }[]>`select id from gr_docs where kind = 'invoice' and id <> ${id} and lower(trim(data->>'number')) = lower(${mine.number.trim()}) limit 1`;
    if (!still) return mine.number;
  }
  const m = /^(.*?)(\d+)$/.exec(wanted);
  const prefix = m ? m[1]! : `${wanted}-`;
  const width = m ? m[2]!.length : 4;
  const rows = await tx<{ number: string }[]>`select data->>'number' as number from gr_docs where kind = 'invoice' and lower(data->>'number') like ${prefix.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%"}`;
  const used = new Set(rows.map((r) => r.number.trim().toLowerCase()));
  let n = Math.max(0, ...rows.map((r) => Number(r.number.trim().slice(prefix.length))).filter(Number.isFinite)) + 1;
  let next = `${prefix}${String(n).padStart(width, "0")}`;
  while (used.has(next.toLowerCase())) next = `${prefix}${String(++n).padStart(width, "0")}`;
  return next;
}
