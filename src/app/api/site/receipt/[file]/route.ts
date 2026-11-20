import { clientIp } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { dbEnabled, ensureSchema } from "@/lib/server/db";
import { findOrderByCode, orderReceipt } from "@/lib/server/orders";
import { receiptLinkValid } from "@/lib/server/receiptLink";
import { receiptPdf } from "@/lib/server/receiptPdf";
import { fileBase } from "@/lib/calc";
import { DEFAULT_SHOP } from "@/lib/seed";
import { linksFor } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A short page for a link that can't give the receipt: the browser shows it instead of saving a file. */
function notice(req: Request, status: number, text: string) {
  const back = escape(linksFor(req.headers.get("x-forwarded-host") ?? req.headers.get("host")).orderStatus());
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#113A2D;line-height:1.5"><p style="font-size:1.1rem">${escape(text)}</p><p><a href="${back}" style="color:#1F7FA8;font-weight:700">Go to Order status</a></p></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Public: an approved order's receipt as a PDF file, from a signed link the order page gets from POST /api/site/receipt
 * (?o=<order code>&e=<expiry>&t=<signature>, and &inline=1 to show it rather than save it). The file name in the address
 * is only for browsers that ignore the one sent with the file.
 */
export async function GET(req: Request) {
  if (!(await allow(`receipt:${clientIp(req)}`, 60, 10))) return notice(req, 429, "You've downloaded several receipts in a short time. Please wait a few minutes and try again.");
  if (!dbEnabled()) return notice(req, 503, "Receipts can't be downloaded right now. Please message us on WhatsApp.");
  const q = new URL(req.url).searchParams;
  const code = q.get("o") ?? "";
  if (!receiptLinkValid(code, q.get("e") ?? "", q.get("t") ?? ""))
    return notice(req, 410, "This download link has expired. Go back to your order page and tap Download receipt again.");
  try {
    await ensureSchema();
    const order = await findOrderByCode(code);
    const receipt = order && (await orderReceipt(order));
    if (!receipt) return notice(req, 404, "This receipt isn't available any more. Please message us on WhatsApp and we'll send it to you.");
    const pdf = await receiptPdf(receipt.invoice, { ...DEFAULT_SHOP, ...receipt.shop });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        // ?inline=1 shows it on screen instead (the iPhone browsers inside apps can show a PDF but not save one)
        "content-disposition": `${q.get("inline") === "1" ? "inline" : "attachment"}; filename="${fileBase(receipt.invoice)}.pdf"`,
        "content-length": String(pdf.length),
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/site/receipt/[file] failed", e);
    return notice(req, 503, "Something went wrong on our side. Please try again in a minute.");
  }
}
