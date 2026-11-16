"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, IdCard, QrCode } from "lucide-react";
import { useStore } from "@/lib/store";
import { absolute, prettyPhone, publicLinks } from "@/lib/site";
import { supportEmail } from "@/lib/letter";
import { initials, logoUrl } from "@/lib/theme";
import type { Employee } from "@/lib/types";
import { saveBlob } from "@/lib/download";
import { Modal } from "./Modal";
import { Button, useToast } from "./ui";

const INK = "#113A2D";
const TEAL = "#1F7FA8";
const CREAM = "#F3EFE6";

export const verifyUrl = (e: Employee) => absolute(publicLinks(window.location.host).staff(e.code), window.location.origin);
const fileName = (e: Employee, what: string) => `${(e.name.trim() || "staff").replace(/[^\w-]+/g, "_")}-${what}.png`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Draws `text` centred at y, shrinking the font until it fits `max` px wide. */
function fitText(g: CanvasRenderingContext2D, text: string, y: number, font: (px: number) => string, size: number, max: number, min = 18) {
  g.font = font(size);
  while (g.measureText(text).width > max && size > min) g.font = font((size -= 2));
  g.fillText(text, W / 2, y);
}

// portrait CR80 (54 x 85.6 mm) at about 300 dpi
const W = 638;
const H = 1012;

/** A printable vertical staff ID card with the verification QR; team heads get their photo on it. */
async function renderCard(e: Employee, shop: { name: string; logo: string; email: string; phone: string }) {
  await Promise.all([document.fonts?.load('600 40px "Fraunces"'), document.fonts?.load('italic 400 30px "Fraunces"')]).catch(() => null);
  const sans = getComputedStyle(document.body).fontFamily; // Manrope, under the name next/font gave it
  const serif = (w: string) => (px: number) => `${w} ${px}px "Fraunces", Georgia, serif`;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = CREAM;
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";

  // grass strip along the bottom, as on the visiting card
  const greens = ["#1E5A45", "#2F6B3A", "#4C8C3A", "#6FAE45", "#8CBF5A"];
  for (let x = 0; x < W; x += 8) {
    g.strokeStyle = greens[(x * 7) % greens.length]!;
    g.globalAlpha = 0.55;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + ((x * 13) % 20) - 10, H - 26, x + ((x * 17) % 24) - 12, H - 34 - ((x * 31) % 42));
    g.stroke();
  }
  g.globalAlpha = 1;

  // logo + shop name
  const logo = await loadImage(logoUrl(shop.logo));
  if (logo) g.drawImage(logo, W / 2 - 42, 38, 84, 84);
  g.fillStyle = INK;
  fitText(g, shop.name, logo ? 166 : 110, serif("600"), 40, W - 96);
  g.font = `800 15px ${sans}`;
  g.fillStyle = "rgba(17,58,45,0.6)";
  g.fillText("S T A F F   I D", W / 2, 200);
  g.fillStyle = "#5E9E39";
  g.fillRect(W / 2 - 24, 214, 48, 4);

  // photo (team heads) or initials
  const cy = 318;
  const r = 88;
  const photo = e.head && e.photo ? await loadImage(e.photo) : null;
  g.save();
  g.beginPath();
  g.arc(W / 2, cy, r, 0, Math.PI * 2);
  g.closePath();
  if (photo) {
    g.clip();
    const k = Math.max((2 * r) / photo.width, (2 * r) / photo.height); // cover
    g.drawImage(photo, W / 2 - (photo.width * k) / 2, cy - (photo.height * k) / 2, photo.width * k, photo.height * k);
  } else {
    g.fillStyle = "#E3ECDD";
    g.fill();
    g.fillStyle = INK;
    g.font = serif("600")(70);
    g.textBaseline = "middle";
    g.fillText(initials(e.name.trim() || "?"), W / 2, cy + 4);
    g.textBaseline = "alphabetic";
  }
  g.restore();
  g.strokeStyle = "#5E9E39";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(W / 2, cy, r + 3, 0, Math.PI * 2);
  g.stroke();

  // name and role
  g.fillStyle = INK;
  fitText(g, e.name.trim() || "Staff member", 464, serif("400"), 46, W - 80, 26);
  if (e.role.trim()) {
    g.fillStyle = TEAL;
    fitText(g, e.role.trim(), 504, serif("italic 400"), 30, W - 80);
  }

  // QR
  const qr = await QRCode.toDataURL(verifyUrl(e), { errorCorrectionLevel: "M", margin: 1, width: 224, color: { dark: INK, light: "#FFFFFF" } });
  const img = await loadImage(qr);
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  g.roundRect(W / 2 - 122, 530, 244, 244, 24);
  g.fill();
  if (img) g.drawImage(img, W / 2 - 112, 540, 224, 224);
  g.font = `800 15px ${sans}`;
  g.fillStyle = TEAL;
  g.fillText("SCAN TO VERIFY", W / 2, 804);

  // support contact
  g.fillStyle = INK;
  g.font = `700 18px ${sans}`;
  g.fillText(`Support: ${supportEmail(shop)}`, W / 2, 846);
  if (shop.phone.trim()) {
    g.font = `600 17px ${sans}`;
    g.fillStyle = "rgba(17,58,45,0.75)";
    g.fillText(prettyPhone(shop.phone), W / 2, 874);
  }
  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

/** The staff member's verification QR code: preview, download (QR alone or a printable ID card) and the link it opens. */
export function StaffQrDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { shop, mode } = useStore();
  const toast = useToast();
  const [svg, setSvg] = useState("");
  const url = employee ? verifyUrl(employee) : "";

  useEffect(() => {
    if (!url) return;
    let alive = true;
    void QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: INK, light: "#FFFFFF" } }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!employee) return null;
  const e = employee;
  return (
    <Modal
      open
      onClose={onClose}
      icon={<QrCode className="size-5" />}
      title={e.name.trim() || "New staff member"}
      subtitle="Verification QR code - anyone who scans it sees whether this person works for you"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            onClick={async () => {
              saveBlob(await (await fetch(await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: INK, light: "#FFFFFF" } }))).blob(), fileName(e, "QR"));
              toast("QR code downloaded");
            }}
          >
            <Download className="size-4" /> QR code
          </Button>
          <Button
            variant="dark"
            className="flex-1"
            onClick={async () => {
              saveBlob(await renderCard(e, shop), fileName(e, "ID-card"));
              toast("ID card downloaded - print it at card size (54 × 85.6 mm, portrait)");
            }}
          >
            <IdCard className="size-4" /> ID card
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 p-5">
        {/* the QR is an SVG made by the qrcode library from this page's own link, never from user input */}
        <div className="size-60 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-center text-[13px] text-muted">
          {e.role.trim() ? `${e.role.trim()} · ` : ""}
          {e.active === false ? <b className="text-red-600">Marked as former - the page says they no longer work here</b> : "Active - the page shows them as verified staff"}
        </p>
        <div className="flex w-full items-center gap-2 rounded-xl bg-canvas p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-body">{url}</span>
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => toast("Link copied"));
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
          <a href={url} target="_blank" rel="noopener" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white hover:text-ink" aria-label="Open verification page">
            <ExternalLink className="size-4" />
          </a>
        </div>
        {mode !== "cloud" && <p className="text-center text-[12px] text-amber-700">The verification page needs the database, so it only works on the live site.</p>}
        <p className="text-center text-[12px] text-faint">The QR opens the verify page on your website, so it keeps working however you open this panel.</p>
      </div>
    </Modal>
  );
}
