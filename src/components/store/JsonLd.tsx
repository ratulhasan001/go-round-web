/**
 * Structured data for search engines (schema.org JSON-LD): what a page is about - the shop, a product with its price,
 * stock and ratings - so Google can show it in results. A data block, not a script the browser runs, so the
 * Content-Security-Policy doesn't apply to it. "<" is escaped so text in it can never close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
