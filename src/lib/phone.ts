// Shared by the browser (customer import) and the server (public customer form).

/** Collapses runs of whitespace and trims. */
export const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Bengali digits (০-৯) as 0-9. */
const asciiDigits = (s: string) => s.replace(/[\u09E6-\u09EF]/g, (c) => String(c.charCodeAt(0) - 0x09e6));

/** One number's digits as 01XXXXXXXXX, or "" when it isn't a Bangladeshi mobile number. */
function bdMobile(raw: string) {
  let d = asciiDigits(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 00880… (international prefix)
  if (d.startsWith("880")) d = d.slice(3); // +880 17…, and +880 017… typed with the 0 as well
  else if (d.startsWith("88") && d.length === 13) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return /^01\d{9}$/.test(d) ? d : "";
}

/**
 * Bangladeshi numbers in any common shape (+880 17…, 88017…, 1743…, 017-43…, Bengali digits) become 01XXXXXXXXX.
 * A cell holding two numbers ("01743…, 01812…") gives the first. Anything else is kept as typed.
 */
export function normPhone(raw: string) {
  const s = clean(raw);
  const one = bdMobile(s);
  if (one) return one;
  for (const part of s.split(/[,;/|]|\s{2,}|\bor\b/i)) {
    const d = bdMobile(part);
    if (d) return d;
  }
  return s;
}

/** Digits only - two numbers with the same key are the same customer. */
export const phoneKey = (p: string) => normPhone(p).replace(/\D/g, "");
