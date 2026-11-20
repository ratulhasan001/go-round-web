import { NextResponse } from "next/server";
import { clientIp } from "@/lib/server/auth";
import { allow, tooMany } from "@/lib/server/rateLimit";
import { dbEnabled, ensureSchema } from "@/lib/server/db";
import { findOrder, orderReceipt } from "@/lib/server/orders";
import { receiptLink } from "@/lib/server/receiptLink";

export const dynamic = "force-dynamic";

/**
 * Public: the download link of an approved order's receipt ({ code, phone }). The link itself serves the PDF, built on
 * the server (./[file]/route.ts), so the customer's browser only has to save a file.
 */
export async function POST(req: Request) {
  if (!(await allow(`receipt:${clientIp(req)}`, 60, 10))) return tooMany();
  if (!dbEnabled()) return NextResponse.json({ error: "offline" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    await ensureSchema();
    const order = await findOrder(String(body?.code ?? ""), String(body?.phone ?? ""));
    if (!order) return NextResponse.json({ error: "missing" }, { status: 404 });
    const receipt = await orderReceipt(order);
    if (!receipt) return NextResponse.json({ error: "not ready" }, { status: 409 });
    return NextResponse.json({ url: receiptLink(order.code, receipt.invoice.number), number: receipt.invoice.number }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("POST /api/site/receipt failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
