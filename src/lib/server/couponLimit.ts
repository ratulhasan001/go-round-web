import { clientIp } from "./auth";
import { allow } from "./rateLimit";

/**
 * Coupon codes tried from one internet address - checking one at checkout or placing an order with one. Enough for
 * real customers (20 in 10 minutes), far too few to guess codes.
 */
export const couponAttempt = (req: Request) => allow(`coupon:${clientIp(req)}`, 20, 10);
