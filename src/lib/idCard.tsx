"use client";

// Staff ID cards, made from the shop's own CR80 card design (public/id-card/front.svg and back.svg, the files from
// "Go Round ID Card (CR80)"). The person's details, photo and QR codes are filled into the design, each side is drawn
// at print resolution, and both sides go side by side on one PDF page at real card size (54 x 85.6 mm).
import QRCode from "qrcode";
import { LETTERHEAD_PHONE } from "./letter";
import { initials } from "./theme";
import { prettyPhone } from "./site";
import type { Employee } from "./types";

const INK = "#113A2D";
const TEAL = "#1F7FA8";
const WHITE = "#FFFFFF";
const CREAM = /#F3EFE6/gi; // the design's paper colour - the shop asked for white cards
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

// ---------- fonts: embedded in the SVG so the drawing uses Fraunces and Manrope, as in the design ----------
const FONTS = [
  { family: "Fraunces 144pt", weight: 600, style: "normal", file: "/fonts/Fraunces-600.woff2", type: "woff2" },
  { family: "Fraunces 144pt", weight: 400, style: "italic", file: "/fonts/Fraunces-Italic.woff2", type: "woff2" },
  { family: "Manrope", weight: 500, style: "normal", file: "/fonts/Manrope-500.ttf", type: "truetype" },
  { family: "Manrope", weight: 700, style: "normal", file: "/fonts/Manrope-700.ttf", type: "truetype" },
  { family: "Manrope", weight: 800, style: "normal", file: "/fonts/Manrope-800.ttf", type: "truetype" },
];

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

let assets: Promise<{ front: string; back: string; css: string }> | null = null;
/** The two templates and the font CSS, fetched once. */
function loadAssets() {
  assets ??= (async () => {
    const [front, back, ...fonts] = await Promise.all([
      fetch("/id-card/front.svg").then((r) => r.text()),
      fetch("/id-card/back.svg").then((r) => r.text()),
      ...FONTS.map(async (f) => {
        const blob = await (await fetch(f.file)).blob();
        const url = await toDataUrl(blob);
        // also give them to the page, so names can be measured in the right font
        try {
          const face = new FontFace(f.family, await blob.arrayBuffer(), { weight: String(f.weight), style: f.style });
          document.fonts.add(await face.load());
        } catch {
          /* measuring falls back to a close estimate */
        }
        return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style};src:url(${url}) format('${f.type}');}`;
      }),
    ]);
    return { front, back, css: fonts.join("") };
  })();
  assets.catch(() => (assets = null));
  return assets;
}

// ---------- filling in the design ----------
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");
const el = (doc: Document, tag: string, attrs: Record<string, string | number>) => {
  const n = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};
const textNode = (doc: Document, content: string) => [...doc.querySelectorAll("text")].find((t) => t.textContent?.trim() === content);

/** Sets a text line, shrinking its font until it fits `max` wide (card units: 540 across). */
function setText(t: Element | undefined, value: string, max = 470) {
  if (!t) return;
  t.textContent = value;
  const size = Number(t.getAttribute("font-size"));
  const g = document.createElement("canvas").getContext("2d")!;
  const family = /Fraunces/.test(t.getAttribute("font-family") ?? "") ? "'Fraunces 144pt', Georgia, serif" : "Manrope, sans-serif";
  g.font = `${t.getAttribute("font-style") ?? ""} ${t.getAttribute("font-weight") ?? 400} ${size}px ${family}`;
  const width = g.measureText(value).width + value.length * Number(t.getAttribute("letter-spacing") ?? 0);
  if (width > max) t.setAttribute("font-size", (size * (max / width)).toFixed(2));
}

/**
 * Draws a QR code the way the design does: round dots, and rounded finder squares with a teal centre.
 * (x, y, size) is the square the code fills.
 */
function drawQr(doc: Document, group: Element, text: string, x: number, y: number, size: number) {
  while (group.firstChild) group.removeChild(group.firstChild);
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const m = size / n;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const dots = el(doc, "g", { fill: INK });
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c) && !finder(r, c)) dots.appendChild(el(doc, "circle", { cx: (x + (c + 0.5) * m).toFixed(2), cy: (y + (r + 0.5) * m).toFixed(2), r: (m * 0.47).toFixed(2) }));
  group.appendChild(dots);
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
    const fx = x + (c + 0.5) * m;
    const fy = y + (r + 0.5) * m;
    group.appendChild(el(doc, "rect", { x: fx.toFixed(2), y: fy.toFixed(2), width: (6 * m).toFixed(2), height: (6 * m).toFixed(2), rx: (2.2 * m).toFixed(2), fill: "none", stroke: INK, "stroke-width": m.toFixed(2) }));
    group.appendChild(el(doc, "rect", { x: (fx + 1.5 * m).toFixed(2), y: (fy + 1.5 * m).toFixed(2), width: (3 * m).toFixed(2), height: (3 * m).toFixed(2), rx: (1.1 * m).toFixed(2), fill: TEAL }));
  }
}

export interface CardInput {
  employee: Employee;
  verifyUrl: string; // what the front QR opens
  facebook: string; // what the back QR opens ("" = keep the design's code)
  supportEmail: string; // printed on the back
}

async function frontSvg(template: string, css: string, { employee: e, verifyUrl }: CardInput) {
  const doc = parse(template.replace(CREAM, WHITE));
  const photoGroup = doc.getElementById("Photo")!;
  // the grey placeholder person and the word PHOTO make way for the photo, or the person's initials
  photoGroup.querySelector("g[clip-path]")?.remove();
  textNode(doc, "PHOTO")?.remove();
  const outline = photoGroup.lastElementChild;
  let photo = "";
  if (e.head && e.photo) photo = await fetch(e.photo).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? toDataUrl(b) : "")).catch(() => "");
  if (photo) {
    const img = el(doc, "image", { x: 158, y: 176, width: 224, height: 276, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#archclip)" });
    img.setAttributeNS(XLINK_NS, "xlink:href", photo);
    img.setAttribute("href", photo);
    photoGroup.insertBefore(img, outline);
  } else {
    const t = el(doc, "text", { x: 270, y: 352, "text-anchor": "middle", "font-family": "'Fraunces 144pt'", "font-weight": 600, "font-size": 96, fill: INK, opacity: 0.75, "letter-spacing": -2 });
    t.textContent = initials(e.name.trim() || "?");
    photoGroup.insertBefore(t, outline);
  }

  setText(textNode(doc, "MD Fahim Ahmed"), e.name.trim() || "Staff member");
  setText(textNode(doc, "Chief Executive Officer"), e.role.trim());
  // no ID number or phone on the front (shop's request) - the verify tile moves to the centre in their place
  for (const t of ["ID NO.", "GR-0001", "PHONE", "+880 1309-372143"]) textNode(doc, t)?.remove();
  const qrGroup = doc.getElementById("Verification_QR")!;
  drawQr(doc, qrGroup, verifyUrl, 354.25, 610.25, 143.5);
  // centred under the name, a little smaller and raised so it sits clear of the grass
  // (the tile's centre is 426, 698 in the design; it is 171 x 203)
  const k = 0.86;
  const top = 594;
  const centre = el(doc, "g", { transform: `translate(270,${top + (203 * k) / 2}) scale(${k}) translate(-426,-698)` });
  doc.querySelector('#Divider line[y1="584"]')?.setAttribute("y1", "580");
  doc.querySelector('#Divider line[y2="584"]')?.setAttribute("y2", "580");
  qrGroup.parentNode!.insertBefore(centre, qrGroup);
  for (const n of [doc.getElementById("Verify_Tile"), qrGroup, doc.getElementById("Verified_Badge"), textNode(doc, "SCAN TO VERIFY")]) if (n) centre.appendChild(n);
  return finish(doc, css);
}

function backSvg(template: string, css: string, { employee: e, facebook, supportEmail }: CardInput) {
  const doc = parse(template.replace(CREAM, WHITE));
  // under the name, the same line as the website: "Importer & supplier of aquarium plants & accessories"
  // on two lines, so it stays the design's size
  const sub = textNode(doc, "AQUARIUM PLANTS & ACCESSORIES");
  if (sub) {
    sub.setAttribute("y", "99");
    setText(sub, "IMPORTER & SUPPLIER OF", 376);
    const second = sub.cloneNode() as Element;
    second.setAttribute("y", "112");
    sub.parentNode!.insertBefore(second, sub.nextSibling);
    setText(second, "AQUARIUM PLANTS & ACCESSORIES", 376);
  }
  setText(textNode(doc, "+880 1309-372143"), prettyPhone(LETTERHEAD_PHONE), 400);
  if (facebook.trim()) drawQr(doc, doc.getElementById("QR_Code")!, facebook.trim(), 52, 500, 196);

  // no signature: its line and label go
  textNode(doc, "AUTHORISED SIGNATURE")?.remove();
  doc.querySelector('#Divider line[y1="734"]')?.remove();

  // issue date on attendants' cards only; the support email sits beside it (or in its place on a team head's card)
  const issuedLabel = textNode(doc, "ISSUED")!;
  const issued = textNode(doc, "NOV 2026")!;
  const attendant = !e.head;
  if (attendant) setText(issued, new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }).toUpperCase(), 200);
  else {
    issuedLabel.remove();
    issued.remove();
  }
  const x = attendant ? 496 : 44;
  const anchor = attendant ? "end" : "start";
  const label = issuedLabel.cloneNode() as Element;
  label.setAttribute("x", String(x));
  label.setAttribute("text-anchor", anchor);
  label.textContent = "SUPPORT";
  const mail = issued.cloneNode() as Element;
  mail.setAttribute("x", String(x));
  mail.setAttribute("text-anchor", anchor);
  mail.setAttribute("letter-spacing", "0.2");
  const text = doc.getElementById("Text")!;
  text.appendChild(label);
  text.appendChild(mail);
  setText(mail, supportEmail, attendant ? 260 : 452);
  return finish(doc, css);
}

function finish(doc: Document, css: string) {
  const style = el(doc, "style", {});
  style.textContent = css;
  doc.documentElement.insertBefore(style, doc.documentElement.firstChild);
  return new XMLSerializer().serializeToString(doc);
}

// ---------- drawing ----------
const SCALE = 3; // 1620 x 2568 px: about 760 dpi at card size
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("card image failed"));
    img.src = src;
  });

async function rasterise(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    await img.decode().catch(() => null);
    const c = document.createElement("canvas");
    c.width = 540 * SCALE;
    c.height = 856 * SCALE;
    const g = c.getContext("2d")!;
    g.fillStyle = WHITE;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Both sides of the card as PNG data URLs. */
export async function renderCardSides(input: CardInput) {
  const { front, back, css } = await loadAssets();
  const [f, b] = await Promise.all([frontSvg(front, css, input), backSvg(back, css, input)]);
  return { front: await rasterise(f), back: await rasterise(b) };
}

/**
 * One A4 page: front and back side by side at real size, joined along the fold line. Print at 100 % (actual size),
 * cut round the outside, fold down the middle so the back sits behind the front, and laminate.
 */
export async function renderCardPdf(input: CardInput) {
  const [{ pdf, Document, Page, Image, View, Text }, sides] = await Promise.all([import("@react-pdf/renderer"), renderCardSides(input)]);
  const mm = 72 / 25.4;
  const W = 54 * mm;
  const H = 85.6 * mm;
  const left = (210 * mm - 2 * W) / 2;
  const top = 30 * mm;
  const label = { fontSize: 7, color: "#6f7f76", letterSpacing: 1.6, fontFamily: "Helvetica-Bold" };
  const line = "#c9c2b2";
  return pdf(
    <Document title={`${input.employee.name.trim() || "Staff"} - ID card`} author="Go Round">
      <Page size="A4" style={{ backgroundColor: WHITE }}>
        <Text style={[label, { position: "absolute", top: top - 14, left, width: W, textAlign: "center" }]}>FRONT</Text>
        <Text style={[label, { position: "absolute", top: top - 14, left: left + W, width: W, textAlign: "center" }]}>BACK</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        <Image src={sides.front} style={{ position: "absolute", top, left, width: W, height: H }} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        <Image src={sides.back} style={{ position: "absolute", top, left: left + W, width: W, height: H }} />
        {/* cut line round both, fold line down the middle */}
        <View style={{ position: "absolute", top, left, width: 2 * W, height: H, borderWidth: 0.5, borderColor: line }} />
        <View style={{ position: "absolute", top: top - 6, left: left + W, height: H + 12, borderLeftWidth: 0.5, borderLeftColor: "#8a9a90", borderStyle: "dashed" }} />
        <Text style={{ position: "absolute", top: top + H + 12, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#6f7f76", lineHeight: 1.5 }}>
          Print at 100 % (actual size) · cut along the outer line · fold on the dashed line so the back sits behind the front · laminate.{"\n"}
          Card size 54 × 85.6 mm (CR80).
        </Text>
      </Page>
    </Document>,
  ).toBlob();
}
