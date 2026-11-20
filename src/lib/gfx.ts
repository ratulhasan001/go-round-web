/**
 * The drawing tools the receipt art (seal, signature block, logo watermark) needs. In the browser they are the page's
 * own canvas, images and web fonts; for customers' receipt downloads the server passes src/lib/server/gfx.ts, which
 * provides the same things with @napi-rs/canvas - so both draw the very same pictures.
 */
export interface Gfx {
  /** A blank canvas of this size. */
  canvas(width: number, height: number): HTMLCanvasElement;
  /** The picture at this address (a data URL, a path such as /sign.png, or a web address); null if it can't be loaded. */
  image(src: string): Promise<HTMLImageElement | null>;
  /** Waits until these canvas fonts (e.g. "700 30px 'Manrope'") are ready to draw with; never fails. */
  fonts(specs: string[]): Promise<void>;
  /** Font families for the art: the display face (Bricolage Grotesque) and the body face (Manrope). */
  readonly display: string;
  readonly body: string;
}

const cssFont = (v: string, fallback: string) =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || fallback;

/** The browser's own canvas, images and web fonts (the page's next/font families). */
export const browserGfx: Gfx = {
  canvas: (width, height) => Object.assign(document.createElement("canvas"), { width, height }),
  image: (src) =>
    new Promise((resolve) => {
      const img = new Image();
      // a logo from another site must allow it, or the canvas couldn't read its pixels back
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }),
  fonts: async (specs) => {
    try {
      await Promise.all(specs.map((s) => document.fonts.load(s)));
    } catch {
      /* fall back to whatever is available */
    }
  },
  get display() {
    return cssFont("--font-bricolage", "'Bricolage Grotesque', sans-serif");
  },
  get body() {
    return cssFont("--font-manrope", "'Manrope', sans-serif");
  },
};
