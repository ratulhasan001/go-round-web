import { type Gfx, browserGfx } from "./gfx";

/** How strongly the watermark shows on the receipt (applied as opacity). */
export const WATERMARK_OPACITY = 0.07;

const cache = new Map<string, Promise<string | null>>();

/**
 * Turns the shop logo into a single-colour (brand green) watermark PNG.
 * Darker parts of the logo stay stronger, so the script lettering inside the
 * bowl is still readable instead of becoming one flat blob.
 */
export function makeWatermark(logo: string, tint = "#3E7A18", gfx: Gfx = browserGfx): Promise<string | null> {
  if (!logo) return Promise.resolve(null);
  const key = `${logo}|${tint}`;
  if (!cache.has(key)) {
    const made = (async () => {
      const img = await gfx.image(logo);
      if (!img) return null;
      const S = 900;
      const k = Math.min(S / img.width, S / img.height);
      const w = Math.round(img.width * k);
      const h = Math.round(img.height * k);
      const c = gfx.canvas(w, h);
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h);
      const px = data.data;
      const r = parseInt(tint.slice(1, 3), 16);
      const gr = parseInt(tint.slice(3, 5), 16);
      const b = parseInt(tint.slice(5, 7), 16);
      for (let i = 0; i < px.length; i += 4) {
        const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        px[i + 3] = Math.round(px[i + 3] * (0.35 + 0.65 * (1 - lum)));
        px[i] = r;
        px[i + 1] = gr;
        px[i + 2] = b;
      }
      g.putImageData(data, 0, 0);
      return c.toDataURL("image/png");
    })().catch(() => null); // e.g. a logo from another site that the canvas may not read: no watermark
    if (cache.size >= 8) cache.clear();
    cache.set(key, made);
  }
  return cache.get(key)!;
}
