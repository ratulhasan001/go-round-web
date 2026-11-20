import { NextResponse } from "next/server";
import { cachedProducts } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

/**
 * Public: current prices and stock, so the cart can catch up with changes made since items were added. From the cached
 * catalogue (refreshed whenever the admin saves a product); checkout checks prices and stock again on the server.
 */
export async function GET() {
  try {
    return NextResponse.json({ products: await cachedProducts() });
  } catch (e) {
    console.error("GET /api/site/products failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
