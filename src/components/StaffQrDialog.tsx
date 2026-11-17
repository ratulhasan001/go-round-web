"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, IdCard, Loader2, QrCode } from "lucide-react";
import { useStore } from "@/lib/store";
import { absolute, publicLinks, siteSettings } from "@/lib/site";
import { nextIdNo, renderCardPdf, renderCardSides, type CardInput } from "@/lib/idCard";
import type { Employee } from "@/lib/types";
import { saveBlob } from "@/lib/download";
import { Modal } from "./Modal";
import { Button, useToast } from "./ui";

const INK = "#113A2D";

export const verifyUrl = (e: Employee) => absolute(publicLinks(window.location.host).staff(e.code), window.location.origin);
const fileName = (e: Employee, what: string, ext = "png") => `${(e.name.trim() || "staff").replace(/[^\w-]+/g, "_")}-${what}.${ext}`;

/** The staff member's ID card (front and back, from the shop's card design) and verification QR: preview and downloads. */
export function StaffQrDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { shop, mode, employees } = useStore();
  const toast = useToast();
  const [sides, setSides] = useState<{ key: string; front: string; back: string } | null>(null);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState(false);
  const url = employee ? verifyUrl(employee) : "";

  const input: CardInput | null = employee
    ? {
        employee,
        idNo: employee.idNo?.trim() || nextIdNo(employees),
        verifyUrl: url,
        facebook: siteSettings(shop).facebook,
        shopPhone: shop.phone,
      }
    : null;
  // redraw the preview whenever something printed on the card changes
  const key = input ? JSON.stringify([input.employee.name, input.employee.role, input.employee.phone, input.employee.head, input.employee.photo, input.idNo, url, input.facebook]) : "";

  useEffect(() => {
    if (!input || sides?.key === key) return;
    let alive = true;
    renderCardSides(input)
      .then((s) => alive && setSides({ key, ...s }))
      .catch(() => alive && setFailed(key));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` covers everything the card shows

  if (!employee || !input) return null;
  const e = employee;
  const ready = sides?.key === key;
  return (
    <Modal
      open
      onClose={onClose}
      icon={<IdCard className="size-5" />}
      title={e.name.trim() || "New staff member"}
      subtitle="ID card (front and back) and the verification QR - anyone who scans it sees whether this person works for you"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            onClick={async () => {
              saveBlob(await (await fetch(await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: INK, light: "#FFFFFF" } }))).blob(), fileName(e, "QR"));
              toast("QR code downloaded");
            }}
          >
            <QrCode className="size-4" /> QR code only
          </Button>
          <Button
            variant="dark"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                saveBlob(await renderCardPdf(input), fileName(e, "ID-card", "pdf"));
                toast("ID card PDF downloaded - print at actual size (100 %)");
              } catch {
                toast("Couldn't make the ID card PDF - please try again", "err");
              }
              setBusy(false);
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} ID card PDF
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 p-5">
        {/* front and back, side by side, as they print */}
        <div className="grid w-full grid-cols-2 gap-3">
          {(["front", "back"] as const).map((side) => (
            <figure key={side} className="min-w-0">
              <div className="relative aspect-[54/85.6] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
                {ready ? (
                  // eslint-disable-next-line @next/next/no-img-element -- generated card preview
                  <img src={sides[side]} alt={`ID card ${side}`} className="size-full object-contain" />
                ) : failed === key ? (
                  <p className="grid size-full place-items-center p-3 text-center text-[12px] text-red-600">Preview failed</p>
                ) : (
                  <span className="grid size-full place-items-center text-muted">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                )}
              </div>
              <figcaption className="mt-1.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{side}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-center text-[13px] text-muted">
          {input.idNo} · {e.role.trim() ? `${e.role.trim()} · ` : ""}
          {e.active === false ? <b className="text-red-600">Marked as former - the page says they no longer work here</b> : "Active - scanning shows them as verified"}
          {!e.head && <span className="block text-[12px]">Attendant cards show initials; switch on Team head and add a photo to put a photo in the arch.</span>}
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
      </div>
    </Modal>
  );
}
