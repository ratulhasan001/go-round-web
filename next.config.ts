import type { NextConfig } from "next";

/** Sent with every page and file: the browser mustn't guess file types, or share full page addresses with other sites. */
const SAFETY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // nothing here uses the camera, microphone or location; turning them off means injected code couldn't either
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/**
 * No other site may show these pages inside a frame (a "clickjacking" trick: a hidden admin page under a fake
 * button). The home page preview is the one exception: the admin panel frames it, and src/proxy.ts sets who may.
 */
const NO_FRAMING = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // customers' receipt PDFs are drawn on the server (src/lib/server/receiptPdf.ts). The canvas library loads a native
  // add-on, so it is required as it is instead of bundled
  serverExternalPackages: ["@napi-rs/canvas"],
  // public/ isn't part of server functions on Vercel, so ship the fonts and pictures the receipt is drawn with
  outputFileTracingIncludes: {
    "/api/site/receipt/*": ["./public/fonts/*.ttf", "./public/fonts/*.woff", "./public/sign.png", "./public/logo.png"],
  },
  // the customer page "Track your order" became "Order status"; old links still work
  async redirects() {
    return [{ source: "/store/track", destination: "/store/order-status", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SAFETY_HEADERS },
      // the preview is /preview on the store's address, and /store/preview where everything shares one address
      { source: "/:path((?!preview$|preview/|store/preview$|store/preview/).*)", headers: NO_FRAMING },
      // the admin panel and the verify address never appear in search results (their robots.txt also closes them)
      ...["admin.goroundbd.com", "verify.goroundbd.com"].map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
