import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { fitReceipt, receiptArt, registerFonts } from "@/lib/pdf";
import type { Invoice, Shop } from "@/lib/types";
import { PUBLIC_DIR, printableLogo, serverGfx } from "./gfx";

/**
 * A receipt as the same A4 PDF the admin panel makes, built on the server. Customers download this one: building it
 * in their own browser failed on many phones (Opera, Opera Mini, in-app browsers).
 */
export async function receiptPdf(inv: Invoice, shop: Shop): Promise<Buffer> {
  registerFonts(join(PUBLIC_DIR, "fonts"));
  const gfx = serverGfx();
  const [art, logoSrc] = await Promise.all([receiptArt(inv, shop, gfx), printableLogo(shop.logo)]);
  return fitReceipt(inv, shop, { ...art, logoSrc }, (doc) => renderToBuffer(doc));
}
