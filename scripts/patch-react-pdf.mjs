// Fixes a bug in @react-pdf/render that misplaces shifted glyphs (runs after every `npm install`, also on Vercel).
//
// react-pdf hands glyph offsets to its text drawing already in points, then multiplies them by fontSize / 1000 a
// second time, so a mark that should move ~7 pt moves a fraction of a point. Latin text rarely uses offsets, but
// Bangla does: the ra-phala of "প্র" and the reph of "র্ক" ended up beside the wrong letter in letter and receipt PDFs.
// The fix converts offsets to the same text-space units as the advances (x 1000 / fontSize), as pdfkit expects.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "node_modules", "@react-pdf", "render", "lib");
if (!existsSync(dir)) process.exit(0);

const BUG = `        xOffset: pos.xOffset,
        yOffset: pos.yOffset,`;
const FIX = `        xOffset: pos.xOffset * scale, // patched by scripts/patch-react-pdf.mjs
        yOffset: pos.yOffset * scale,`;

let patched = 0;
for (const f of readdirSync(dir).filter((f) => /\.(c?js|mjs)$/.test(f))) {
  const p = join(dir, f);
  const src = readFileSync(p, "utf8");
  if (src.includes("patched by scripts/patch-react-pdf.mjs")) continue;
  if (!src.includes(BUG)) continue;
  writeFileSync(p, src.replace(BUG, FIX));
  patched++;
}
console.log(patched ? `react-pdf: glyph offset fix applied to ${patched} file(s)` : "react-pdf: glyph offset fix already applied or not needed");
