import { notFound } from "next/navigation";

/** Any address on the store that isn't a page gets the store's own "not found" page, with its header and footer. */
export default function UnknownStorePage() {
  notFound();
}
