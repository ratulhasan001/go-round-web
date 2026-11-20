import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { GlobalFonts, createCanvas, loadImage } from "@napi-rs/canvas";
import type { Gfx } from "@/lib/gfx";

/** The site's public folder: the fonts, sign.png and logo.png a receipt is drawn with (next.config.ts ships them). */
export const PUBLIC_DIR = join(process.cwd(), "public");

// the faces the seal and signature block are lettered in - the same files the website and the PDF use
const CANVAS_FONTS: [file: string, family: string][] = [
  ...[500, 700, 800].map((w): [string, string] => [`Bricolage-${w}.ttf`, "Bricolage Grotesque"]),
  ...[400, 500, 600, 700, 800].map((w): [string, string] => [`Manrope-${w}.ttf`, "Manrope"]),
];
let fontsReady = false;

/**
 * The bytes of a picture given as a data URL, a path in the public folder (/sign.png) or a web address; null when it
 * can't be read. Paths never reach outside the public folder.
 */
export async function pictureBytes(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",");
      if (comma < 0) return null;
      const data = src.slice(comma + 1);
      return src.slice(0, comma).endsWith(";base64") ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data));
    }
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    const file = normalize(join(PUBLIC_DIR, src.split(/[?#]/)[0]!));
    if (!file.startsWith(PUBLIC_DIR + sep)) return null;
    return await readFile(file);
  } catch {
    return null;
  }
}

/** The same drawing tools as the browser's (see src/lib/gfx.ts), made with @napi-rs/canvas. */
export function serverGfx(): Gfx {
  if (!fontsReady) {
    for (const [file, family] of CANVAS_FONTS) GlobalFonts.registerFromPath(join(PUBLIC_DIR, "fonts", file), family);
    fontsReady = true;
  }
  return {
    // the canvas library's canvas and images work like the browser's ones the art is written for
    canvas: (width, height) => createCanvas(width, height) as unknown as HTMLCanvasElement,
    image: async (src) => {
      const bytes = await pictureBytes(src);
      if (!bytes) return null;
      try {
        return (await loadImage(bytes)) as unknown as HTMLImageElement;
      } catch {
        return null;
      }
    },
    fonts: async () => {}, // registered above, ready straight away
    display: "'Bricolage Grotesque', sans-serif",
    body: "'Manrope', sans-serif",
  };
}

const isPng = (b: Buffer) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * The shop logo as a data URL react-pdf can print. It reads only PNG and JPEG, so any other kind of picture (WebP, GIF,
 * SVG) is redrawn as a PNG first. "" when there is no logo or it can't be read - the receipt then shows the initials.
 */
export async function printableLogo(logo: string): Promise<string> {
  if (!logo) return "";
  const bytes = await pictureBytes(logo);
  if (!bytes) return "";
  if (isPng(bytes)) return `data:image/png;base64,${bytes.toString("base64")}`;
  if (isJpeg(bytes)) return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  try {
    const img = await loadImage(bytes);
    const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = createCanvas(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } catch {
    return "";
  }
}
