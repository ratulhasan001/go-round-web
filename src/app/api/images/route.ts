import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuthed } from "@/lib/server/auth";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";
import { deletePhoto, putPhoto, r2Enabled } from "@/lib/server/r2";
import { PHOTO_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";

const TYPES = ["image/webp", "image/jpeg", "image/png"];
// the browser scales every photo down before upload (any original size is fine), so this only stops abuse
const MAX = 8 * 1024 * 1024;

/**
 * Admin: uploads one product photo in two sizes (the browser resizes it first), as form fields "full" and "thumb".
 * Returns { url } - the thumbnail is the same address with "-t" on the end. Photos go to Cloudflare R2 when it is set
 * up (see r2.ts), otherwise into the database.
 */
export async function POST(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "no database" }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const full = form?.get("full");
  const small = form?.get("thumb");
  if (!(full instanceof Blob) || !(small instanceof Blob)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (![full, small].every((b) => TYPES.includes(b.type) && b.size > 0 && b.size <= MAX)) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 415 });
  try {
    let id = randomBytes(12).toString("base64url");
    while (id.endsWith("-t")) id = randomBytes(12).toString("base64url"); // "-t" marks the small copy (thumb())
    const [a, b] = await Promise.all([full.arrayBuffer(), small.arrayBuffer()]);
    if (r2Enabled()) {
      await Promise.all([putPhoto(id, new Uint8Array(a), full.type), putPhoto(`${id}-t`, new Uint8Array(b), small.type)]);
      return NextResponse.json({ url: `${PHOTO_BASE}${id}` });
    }
    await ensureSchema();
    await db()`insert into gr_images (id, mime, bytes) values (${id}, ${full.type}, ${Buffer.from(a)}), (${id + "-t"}, ${small.type}, ${Buffer.from(b)})`;
    return NextResponse.json({ url: `/api/img/${id}` });
  } catch (e) {
    console.error("POST /api/images failed", e);
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}

/** Admin: removes a photo (both sizes), wherever it is kept. ?url=/api/img/<id> or ?url=<PHOTO_BASE><id> */
export async function DELETE(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "no database" }, { status: 503 });
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const id = (url.startsWith(PHOTO_BASE) ? url.slice(PHOTO_BASE.length) : url.match(/^\/api\/img\/(.*)$/)?.[1])?.match(/^[A-Za-z0-9_-]{8,78}$/)?.[0];
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    // a photo moved to R2 may still have its old copy in the database (until that is cleared), so both go
    if (r2Enabled()) await Promise.all([deletePhoto(id), deletePhoto(`${id}-t`)]);
    await ensureSchema();
    await db()`delete from gr_images where id = ${id} or id = ${id + "-t"}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/images failed", e);
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}
