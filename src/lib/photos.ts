// Photo uploads from the admin panel: scaled in the browser, then saved to the database (or kept as a data URL).

/** Draws the image at most `max` px on its longest side. */
async function drawScaled(file: File, max: number) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; // transparent PNGs get a white background in JPEG
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, q));

/** WebP where the browser can make it (older Safari can't), JPEG otherwise. */
async function encode(c: HTMLCanvasElement) {
  const webp = await toBlob(c, "image/webp", 0.85);
  if (webp?.type === "image/webp") return webp;
  const jpg = await toBlob(c, "image/jpeg", 0.85);
  if (!jpg) throw new Error("encode failed");
  return jpg;
}

/** Saves one photo: to the database in cloud mode, or as a small data URL on this device. */
export async function storePhoto(file: File, cloud: boolean): Promise<string> {
  if (!cloud) return (await drawScaled(file, 800)).toDataURL("image/jpeg", 0.8);
  const [full, small] = await Promise.all([drawScaled(file, 1400).then(encode), drawScaled(file, 480).then(encode)]);
  const form = new FormData();
  form.set("full", full, "full");
  form.set("thumb", small, "thumb");
  const res = await fetch("/api/images", { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) throw new Error(body?.error ?? "Upload failed");
  return body.url;
}

export const forget = (url: string) => {
  if (url.startsWith("/api/img/")) void fetch(`/api/images?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => null);
};
