import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui";
import AppShell from "@/components/AppShell";
import { areaOf } from "@/lib/site";
import { requestHost } from "@/lib/server/links";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const area = areaOf(await requestHost());
  // the public addresses are the shop, not the admin app (store pages set their own titles)
  if (area === "store" || area === "verify") return { title: "Go Round", applicationName: "Go Round", appleWebApp: { capable: true, title: "Go Round", statusBarStyle: "default" } };
  return {
    title: "Go Round · Admin Panel",
    description: "Go Round admin panel: website orders, receipts, products, customers and staff.",
    applicationName: "Go Round Admin",
    appleWebApp: { capable: true, title: "GR Admin", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#f3efe6", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // on goroundbd.com / verify.goroundbd.com every page is a public one: no admin shell, no shop data
  const area = areaOf(await requestHost());
  return (
    // suppressHydrationWarning: the inline script below adds the "js" class before React starts
    <html lang="en" className={`${bricolage.variable} ${manrope.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* marks that JavaScript runs, so scroll-reveal effects may hide content until it scrolls into view */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <StoreProvider area={area}>
          <ToastProvider>
            <AppShell area={area}>{children}</AppShell>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
