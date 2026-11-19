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
  // the customer page "Track your order" became "Order status"; old links still work
  async redirects() {
    return [{ source: "/store/track", destination: "/store/order-status", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SAFETY_HEADERS },
      // the preview is /preview on the store's address, and /store/preview where everything shares one address
      { source: "/:path((?!preview$|preview/|store/preview$|store/preview/).*)", headers: NO_FRAMING },
    ];
  },
};

export default nextConfig;
