// Photo uploads from the admin panel: scaled in the browser, then saved to the server (or kept as a data URL).

import { isUploadedPhoto } from "./site";

/**
 * Reads an image file of any size. createImageBitmap is fast but can't read SVG logos (or, in some browsers, very
 * large or unusual photos), so those are read through an <img> instead - which also opens iPhone HEIC photos in Safari.
 */
async function readImage(file: File): Promise<{ img: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { img: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(`Couldn't read ${file.name || "that image"} - save it as a JPG or PNG and try again.`);
    }
    // an SVG without its own size draws at 1000 px across
    const w = img.naturalWidth || 1000;
    const h = img.naturalHeight || Math.round((w * 3) / 4);
    return { img, width: w, height: h, done: () => URL.revokeObjectURL(url) };
  }
}

/** Draws the image at most `max` px on its longest side (any size of file: big ones are scaled down here). */
async function drawScaled(file: File, max: number) {
  const { img, width, height, done } = await readImage(file);
  const k = Math.min(1, max / Math.max(width, height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width * k));
  c.height = Math.max(1, Math.round(height * k));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; // transparent PNGs get a white background in JPEG
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  done();
  return c;
}

/** The image files among dropped or picked files (anything a browser calls an image, plus .heic/.svg by name). */
export const imageFiles = (files: Iterable<File>) => [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif|svg|avif|webp|png|jpe?g|gif|bmp)$/i.test(f.name));

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

/** Deletes an uploaded photo that is no longer used (both sizes, wherever it is kept). */
export const forget = (url: string) => {
  if (isUploadedPhoto(url)) void fetch(`/api/images?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => null);
};
