import { AwsClient } from "aws4fetch";

/**
 * Product and team photos in Cloudflare R2 (S3-compatible storage, free up to 10 GB, no charge for downloads). The
 * bucket is public only through its custom domain img.goroundbd.com (PHOTO_BASE in site.ts), where Cloudflare's CDN
 * caches every photo for a year; writing needs the R2 API token in these Vercel variables. Without them, photos stay
 * in the database as before (and in local mode they are data URLs).
 */
export const r2Enabled = () =>
  !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

const g = globalThis as unknown as { __grR2?: AwsClient };
const client = () =>
  (g.__grR2 ??= new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  }));

/** Photo ids are random base64url (see /api/images), plus "-t" for the small copy: nothing else is ever a key. */
const KEY = /^[A-Za-z0-9_-]{8,80}$/;
const objectUrl = (id: string) => {
  if (!KEY.test(id)) throw new Error("bad photo id");
  // R2_ENDPOINT only for tests against a stand-in server
  const endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return `${endpoint}/${process.env.R2_BUCKET}/p/${id}`;
};

/** Stores one photo (a new id every upload, so it can be cached for good). */
export async function putPhoto(id: string, bytes: Uint8Array<ArrayBuffer>, type: string) {
  const init = { method: "PUT", body: bytes, headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } };
  // signed by aws4fetch, but sent with the bytes themselves: its own fetch passes the body on as a stream, without the
  // Content-Length that R2 requires (it answers 411)
  const signed = await client().sign(objectUrl(id), init);
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: bytes });
  if (!res.ok) throw new Error(`R2 upload of ${id} failed: ${res.status}`);
}

/** The stored photo's size, or null when there is none. */
export async function photoSize(id: string): Promise<number | null> {
  const res = await client().fetch(objectUrl(id), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 check of ${id} failed: ${res.status}`);
  return Number(res.headers.get("content-length") ?? -1);
}

/** Removes one photo (nothing happens when it isn't there). */
export async function deletePhoto(id: string) {
  const res = await client().fetch(objectUrl(id), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete of ${id} failed: ${res.status}`);
}
