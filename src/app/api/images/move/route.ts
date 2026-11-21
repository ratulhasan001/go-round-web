import { NextResponse } from "next/server";
import { adminAuthed } from "@/lib/server/auth";
import { refreshCatalog } from "@/lib/server/catalog";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";
import { photoSize, putPhoto, r2Enabled } from "@/lib/server/r2";
import { PHOTO_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs `fn` over `items`, a few at a time. */
async function inTurn<T>(items: T[], fn: (x: T) => Promise<void>, at = 8) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(at, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  }));
}

/**
 * Admin, once: moves the photos kept in the database to Cloudflare R2.
 * - POST: copies a batch (call again while `remaining` > 0); every copy is checked by its size on R2. When all of them
 *   are there, the saved records (products, team, orders, home page…) are switched to the R2 addresses.
 * - POST ?clear=1 (after checking the site): deletes the database copies of the photos R2 has, same size only.
 * Old /api/img/<id> addresses keep working either way (see /api/img/[id]).
 */
export async function POST(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled() || !r2Enabled()) return NextResponse.json({ error: "R2 or the database isn't set up" }, { status: 503 });
  const clear = new URL(req.url).searchParams.get("clear") === "1";
  try {
    await ensureSchema();
    const sql = db();
    const rows = await sql<{ id: string; mime: string; size: number }[]>`select id, mime, length(bytes)::int as size from gr_images order by id`;

    if (clear) {
      let cleared = 0;
      await inTurn(rows, async (r) => {
        if ((await photoSize(r.id)) !== r.size) return;
        await sql`delete from gr_images where id = ${r.id}`;
        cleared++;
      });
      return NextResponse.json({ cleared, kept: rows.length - cleared });
    }

    const started = Date.now();
    let moved = 0, already = 0, remaining = 0;
    await inTurn(rows, async (r) => {
      if (Date.now() - started > 40_000) return void remaining++; // the rest on the next call
      if ((await photoSize(r.id)) === r.size) return void already++;
      const [img] = await sql<{ bytes: Buffer }[]>`select bytes from gr_images where id = ${r.id}`;
      if (!img) return; // deleted meanwhile
      await putPhoto(r.id, new Uint8Array(img.bytes), r.mime);
      if ((await photoSize(r.id)) !== r.size) throw new Error(`R2 has a different size for ${r.id}`);
      moved++;
    });
    if (remaining) return NextResponse.json({ moved, already, remaining });

    // every photo is on R2: point the saved records at it. Only whole addresses change (they start right after a
    // quote, also inside descriptions' HTML), and updated_at stays as it is - the store lists products by it
    const updated = await sql`
      update gr_docs set data = replace(data::text, '"/api/img/', ${`"${PHOTO_BASE}`})::jsonb
      where data::text like '%"/api/img/%' returning kind`;
    refreshCatalog();
    return NextResponse.json({ moved, already, remaining: 0, recordsUpdated: updated.length });
  } catch (e) {
    console.error("POST /api/images/move failed", e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 503 });
  }
}
