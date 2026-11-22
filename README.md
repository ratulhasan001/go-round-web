# Go Round · Web

An online store and a receipt and customer-ledger app for **Go Round**, an aquarium supply shop in Bangladesh. Make a professional A4 payment receipt in under a minute, then download it as a **PDF** or **Excel** file, print it, or send it on WhatsApp. The app also tracks who still owes money, keeps your price list and customers, runs a coupon sheet, and lets customers type in their own details from a one-time link.

**Live:**

| Address | What it is |
|---|---|
| https://goroundbd.com | The customer store |
| https://admin.goroundbd.com | The admin panel (receipts, orders, products, staff…), behind the admin login |
| https://verify.goroundbd.com | Check a purchase or order status, download the receipt, or verify a staff member; staff QR codes open here |

All three are served by this one Next.js app: `src/proxy.ts` routes each address to its pages. Any other address (localhost, the `*.vercel.app` one) serves everything on one address: the admin panel at `/`, the store at `/store` and the verify page at `/store/verify`.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, `@react-pdf/renderer`, ExcelJS and Postgres (Neon), hosted on Vercel, with product photos on Cloudflare R2. The app is mobile-first and can be installed to the home screen.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deploying](#deploying)
- [Testing and monitoring](#testing-and-monitoring)
- [Using the app](#using-the-app)
- [Importing spreadsheets](#importing-spreadsheets)
- [How totals are calculated](#how-totals-are-calculated)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Security](#security)
- [Customising](#customising)
- [Troubleshooting](#troubleshooting)

---

## Features

### Customer website (goroundbd.com)
- A public online store in the style of the Go Round visiting card (Aquascape Editorial): Fraunces serif headings, swaying aquatic grass, line-drawn fish and gentle scroll motion. It is built for phones first.
- **Pages:** Home (hero photos, featured products, categories, brands, reviews), Shop (search, category chips, brand filter, sort, in-stock filter), product pages, Cart (a panel that slides in, and a cart page), Checkout, Order status, Reviews, Wholesale, About us, Contact us, FAQ, the policy pages and My account.
- **Ordering:** as a guest or with an account (an account can also be created at checkout). Returning customers get their saved details filled in from their mobile number. Payment is **bKash** or **bank transfer**, checked by hand: the customer pays the total shown and types the transaction ID at checkout. The ID is optional only for a bank transfer when no bank details are set, since the customer has to ask for them first. Prices, stock, delivery and coupons are always worked out on the server.
- **Variants:** a product sold in several sizes or amounts shows once in the shop ("From" its cheapest price). Its page lists the *Available variants* (e.g. 100 ml · 200 ml · 500 ml) and the customer picks one; the price, discount, stock and photo follow the pick, and the cart and the order name it ("APT Zero - 500 ml"). Kinds: kilogram (1-20 kg), millilitre (1-10,000 ml), gram (1-10,000 gm), litre (1-100 L), piece (1-10), pot (1-10), size (small / medium / large) and full bag; kg and litres also take fractions such as a 0.67 L bag.
- **Coupons at checkout:** a coupon given to a customer works only with their mobile number (or name). The order summary shows the discount, and the coupon is reserved when the order is placed.
- **Approval, then receipt:** the order waits as *Waiting for approval* until the shop approves the payment. The order page checks for the approval every 30 seconds. Once approved, the customer gets **Download receipt**, the same A4 PDF the shop prints, stamped PAID. If the shop marks the payment *not found*, the customer is asked to check the transaction ID and send it again.
- **Order status** (`/order-status`, no account needed): the customer types the **mobile number** they ordered with to see their orders' progress (placed → approved → shipped → delivered), payment status and courier info, and to download the receipt. Links in the shop's WhatsApp updates open one order directly. The old `/store/track` link redirects here.
- **Accounts:** log in with phone number and password. Customers see their orders and edit their details. A forgotten password is reset by the shop from Customers → Website accounts.
- **Reviews:** customers rate products and write reviews, optionally without showing their name. Reviews can be approved automatically or by the shop.
- A floating WhatsApp button, plus Facebook and WhatsApp links throughout. Products without a photo get a drawn aquascape placeholder.

### Admin panel (admin.goroundbd.com)
- Same look as the store: ink green, teal accents and Fraunces headings.
- **Orders:** to approve / to ship / shipped / delivered / cancelled tabs with a badge for unseen orders. Open an order and check the bKash TrxID. **Approve payment** marks it paid, moves the order to *Approved*, and makes the receipt the customer downloads from the website. **Payment not found** asks the customer to resend the ID, and **Undo** takes an approval back. From there: one button for each next step, courier info, a private note, and a ready-made WhatsApp update for the customer. New orders appear within a minute. Cancelling an order gives its stock and coupon back.
- **Website:** *Home page design* (hero photos, sections, text blocks, partners, live preview), *Store settings* (taking-orders switch, announcement bar, WhatsApp and Facebook links, bKash number and type, bank details, delivery services and fees, free-delivery threshold, About us text and FAQ) and *Visitors* (today's visitors and visits, the last 30 days as a chart and day by day; today's visitors also show on the home page's Website tile).
- **Products:** *Photos & details* on each product: photos (resized in the browser), description, specification, category, brand, prices (purchase, regular, selling), stock, weight, *Show on website* and *Feature on home page*.
- **Variants:** in the product form, *Add a variant* (kg, ml, gm, litre, piece, pot, size, full bag) gives the product the sizes it's sold in, each with its own regular and discounted price, purchase price, stock, weight, SKU, photo and in-stock switch; only the variants added show on the website. **Merge sizes** (on the Products page) combines products that were saved once per size into one product with variants: it suggests products whose names differ only by the size, lets you check what each one becomes, and keeps every size's own details. The product with the most written about it keeps its page; the same photo saved twice is kept once; different descriptions are each kept under their size. **Undo** splits a merge again while the dialog is open. Receipts and letters list each variant on its own line ("APT Zero - 500 ml"), at its own price.
- **Login & security** (Settings): password, two-step login, passkeys, logged-in devices, login history and alerts. See [Security](#security).
- **Visit store** button in the navbar and on the home page.

### Employees
- Staff records: name, phone, role, joining date, monthly salary, notes and an active / former switch, with the active headcount and monthly salary total at the top.
- Every new employee automatically gets a private random code and a **verification QR code**. Download the QR on its own, or a printable **ID card** (card size, front and back).
- Scanning the QR opens `verify.goroundbd.com/<code>`: **Verified staff** with their name, role and start month, **No longer with us** once they're marked as former, or **Not verified** for an unknown code. Phone, salary and notes are never shown.

### Receipts
- **Live A4 preview** that matches the downloaded PDF. On a phone, you switch between Edit and Preview.
- **PDF export**: A4 portrait with the fonts embedded (Bangla included), the shop logo, an optional faint logo watermark, and the signature. The layout tightens step by step until the receipt fits on one page, and only very long receipts run onto a second page.
- **Automatic PAID / DUE stamp**: a "PAID" stamp with the date of the last payment, or a "DUE" stamp with the balance still owed.
- **Excel export**: an A4 portrait workbook, fit to page width, with the logo and live formulas for amounts, totals, paid and balance due. It uses Arial so it prints the same on any computer.
- **Amount in words** using the Bangladeshi lakh / crore system ("Taka Five Thousand Seven Hundred Only").
- **Autofill**: a saved customer fills in their phone and address, and a saved product fills in its price. New customers and products are remembered when the receipt is saved.
- **Quick-add chips** for your best-selling products.
- **Discounts**: a percentage, a fixed BDT amount, or free delivery, with 5% / 10% / 15% shortcuts.
- **Coupons**: use a code from the coupon sheet on this receipt, or give one as a gift for the customer's next visit. A gift prints a "Special Reward for You!" note on the receipt.
- **Additional charges** (optional for each receipt): a payment-channel percentage (for example bKash 2%), a courier percentage (Pathao, Steadfast or a custom courier with a percentage plus a fixed fee), and any manual charges.
- **Payments**: Cash, bKash, Bank Transfer and Card, each with a date and a note. "Mark fully paid" fills in the rest. Payments can be flagged as **advance** (paid before delivery), so the courier percentage is charged only on what the courier still has to collect.
- **Status** (Paid / Partial / Unpaid) is worked out from the payments.
- **Auto-save** while editing an existing receipt. **Ctrl/⌘ + S** saves and **Ctrl/⌘ + P** prints. You are warned before leaving a new receipt you haven't saved.
- **Duplicate** any receipt as a starting point for a new one.
- **Letters** on the shop letterhead, downloaded as PDF or Word.

### Sharing
- **WhatsApp**: on a phone, share the PDF itself through the system share menu (WhatsApp, Messenger, Gmail and so on). On a computer, open WhatsApp with a ready-made receipt summary.
- **Payment reminders**: the "Who owes you" list (largest balance first) has a one-tap WhatsApp reminder for each customer.

### Lists
- **Receipts**: totals billed, collected and outstanding, a list you can search and filter, and a **ledger export** that puts every receipt in one Excel sheet with totals.
- **Products**: your price list, with an in-stock / out-of-stock switch and best-sellers.
- **Customers**: contacts with their number of receipts, total spent and amount still owed. You can copy a customer's details or import customers from Excel / CSV. The customer list and website accounts stay in step by phone number.
- **Coupons**: your coupon sheet, showing who has each code, its validity dates, and when and on which receipt or order it was used. You can import the sheet from Excel / CSV.
- Every list has search (press `/` to jump to it), filter tabs, sorting and inline editing that saves instantly.

### Customer form links
- Make a **one-time link** (valid for 30 minutes) and send it to a customer. They open it without logging in and type in their name, WhatsApp number and address, which go straight into your customer list.
- If the phone number is already saved, that customer is updated instead of being added twice. Bangladeshi numbers match in any format (`+880 17…`, `017-…`).
- A live countdown, a status for each link (active, used, expired or cancelled), and a cancel button.

### Home and app shell
- A dashboard with this month's billed and collected amounts, the total still due, and the receipt count, plus a calendar and flip clock.
- An interactive **aquarium** on the home page: a planted tank with neon tetras, rummy-nose tetras and harlequin rasboras to explore, feed, play with and keep clean. Receipts and customers add fish. Guests on the customer form see a version without any shop data.
- Number keys **1–6** jump straight to a section. Pages slide between sections with view transitions.
- Mobile layout: a bottom navigation bar, a thumb-friendly action bar, and "Add to Home Screen" support through the PWA manifest.
- **Backup / restore** to a JSON file, and a reset to sample data, in Settings.

---

## How it works

The app runs in one of two modes, depending on whether a database is configured:

| Mode | When | Where data lives |
|---|---|---|
| **Cloud** | `DATABASE_URL` is set | Postgres, shared across every device. The admin panel loads the shop data from the server; only changes that haven't reached the server yet wait in the browser (the outbox), so the panel keeps working through a dropped connection. No copy of the shop data is kept on the device. |
| **Local** | No `DATABASE_URL` | Only in this browser's `localStorage`. The sidebar shows "Saved on this device". Customer form links and the store's ordering are unavailable. |

- **PDFs and Excel files are never stored.** Receipts, letters and exports are generated in the browser when you ask for them; the receipt a customer downloads is drawn on the server.
- All shop data (settings, products, customers, coupons, receipts, letters, orders, staff, reviews) is stored as JSON documents in one table, `gr_docs(kind, id, data)`. Customer form links, website accounts and their logins, admin logins and security settings, and rate-limit counters have tables of their own, so password hashes and tokens never travel with the shop data.
- Tables are **created automatically**. A starting server checks one stored schema version (`SCHEMA_VERSION` in `src/lib/server/db.ts`) and runs the table steps only when it is behind; bump it when you add a table, column or index.
- Changes are sent in batches to `/api/sync`. Every minute (and when the app comes back into view) the panel asks whether anything changed since its last load, by a fingerprint of every record, and downloads the data only if something did - a website order, a review, or an edit on another device.
- **First login on a device that already has receipts in its browser** moves them into the database automatically. Log in first on the device that has your existing receipts.

---

## Architecture

```
 Customers / admin (phones in Bangladesh)
        │ HTTPS
        ▼
 Vercel edge: CDN + firewall ─────────── rate limit on public APIs, logins and form links
        │
        ▼
 Next.js on Vercel (functions in Singapore, sin1)
   ├─ store pages ───────► Next data cache (catalogue, reviews) ──► database only after a change
   ├─ checkout / logins ─► checks first ─► one database transaction
   └─ admin panel ───────► "anything changed?" ─► the records, only when they did
        │
        ▼
 Neon Postgres (Singapore, pooled connections, autoscaling, scales to zero when idle)

 Product photos: Cloudflare R2 ─► img.goroundbd.com (Cloudflare CDN, cached for a year)
```

- **Hosting.** Vercel runs the app; `vercel.json` places the server functions in Singapore (`sin1`), next to the database and close to customers in Bangladesh. **Keep the database in the same region as the functions**: every query crosses the distance between them. DNS is on Cloudflare.
- **Database.** Neon Postgres, connected through the Vercel integration with its pooled connection string (`prepare: false` in `src/lib/server/db.ts` for pgbouncer). Each server instance keeps a small connection pool. Neon keeps a restore history for undoing mistakes.
- **Caching.** The store's catalogue (shop settings + products) and reviews come from Next's data cache (`unstable_cache` with the tags `catalog` and `reviews`, plus a 10-minute backstop). Saving in the admin panel, placing an order or writing a review refreshes the tag, so changes show at once while ordinary browsing never reads the database. Store and admin pages are rendered per request because every page gets its own security nonce (see [Security](#security)), but they read the cache, not the database. New store pages and APIs should read the catalogue through `loadCatalog` / `cachedProducts` in `src/lib/server/catalog.ts`.
- **Product photos.** Uploads are resized in the browser (a full size and a thumbnail) and stored in Cloudflare R2 as `p/<id>` and `p/<id>-t`, served from `img.goroundbd.com` through Cloudflare's CDN. Photo addresses never change, so they are cached for a year. A Cloudflare cache rule makes these extensionless files cacheable, and a response-header rule adds `Access-Control-Allow-Origin: *` (the admin's ID-card builder reads team photos as bytes) and `X-Content-Type-Options: nosniff`. Older `/api/img/<id>` addresses keep working: they redirect to the same photo on R2. Without the R2 settings, photos are stored in the database (`gr_images`) instead.
- **Light store pages.** The home page and the shop send each product's card fields only - full descriptions and specifications stay on the product's own page (`cardProduct` / `listedProduct` in `src/lib/site.ts`). The shop builds 24 cards and adds 24 more as the customer scrolls; search, filters and sorting always cover every product. Coming back from a product shows the same cards at the same place. `?all=1` builds every card, for browsers without JavaScript (Opera Mini) and search engines.
- **Protection at the edge.** A Vercel Firewall rule rate-limits each internet address on the public APIs (`/api/site/…`), the admin login and the customer-form links before requests reach the server. The server keeps its own finer limits per phone number and per address (`src/lib/server/rateLimit.ts`).
- **Visitor counter.** A store page that starts a visit sends one small request (`navigator.sendBeacon`, after the page has shown) and the server adds it to that day's totals in `gr_visits` - one row per Bangladesh day, kept outside `gr_docs` so a visit never makes the admin panel reload. Later page views in the same visit send nothing. The browser only remembers the day and time of its last page view (no cookie, no id), and the server keeps no address or anything about the visitor. Bots and automated browsers, other sites, the verify address and the admin's home page preview aren't counted. The admin panel reads the totals only when the Visitors tab or home page is opened, never on a timer, so an open panel doesn't keep the database awake.
- **Variants.** A product sold in several sizes keeps them in its own record (`variants`, see `src/lib/variants.ts`), not as one product per size. Each variant has an id that never changes - cart lines and orders point at it, and the server prices and stocks an order from the variant. Merging products keeps each merged product's id as its variant's id, so an old product address redirects (308) to the merged product with that variant picked, and a cart saved before the merge still orders the right size. The product's own price and in-stock flag follow its cheapest variant in stock, so lists, sorting and older code keep working.
- **Search engines.** A sitemap, structured data (JSON-LD) on store pages, and IndexNow pings (sent after the response, with `after()`) when products change.

---

## Getting started

**Requirements:** Node.js 20.9 or newer, and npm.

```bash
npm install
npm run dev       # http://localhost:3000
```

Without a `.env` file the app runs in **local mode**: no login, sample data, everything saved in the browser. That is enough to try the receipt editor, PDF / Excel export and the lists.

To test cloud mode, the store's ordering and customer form links locally, create `.env.local`:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/goround   # any Postgres; SSL is turned off for localhost
APP_PASSWORD=choose-a-pin                                   # optional: switches on the admin login
```

**Tip:** local-mode data is tied to the address in the browser (`localStorage` is per origin). To try things out without touching your usual data, run on a spare port, for example `npx next dev -p 3123`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Runs the tests, then the production build (a failing test stops the build) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm test` | The tests (see [Testing and monitoring](#testing-and-monitoring)) |

---

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (or in `.env.local` for development). Mark everything secret as **Sensitive** in Vercel so it can't be read back from the dashboard or the CLI, and never commit values to the repository.

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled). Set automatically when a Neon database is connected in Vercel. Without it the app runs in local mode. |
| `APP_PASSWORD` | Turns the admin login on. It works once, as a starting PIN: the first login with it asks for a real password, and from then on only that password works. |
| `SESSION_SECRET` | A long random secret (32+ characters). Protects the two-step login secret and signs customers' receipt download links. **Don't change it**: two-step login would have to be set up again. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile ("Verify you are human") on the admin login and on customer login and sign-up. |
| `RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM` | Security alerts and email login codes, sent through Resend to the owner's address. `ALERT_FROM` is optional. |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Product photos on Cloudflare R2. Use an API token limited to the photo bucket (object read & write). Without all four, photos are stored in the database. |

Only for development: `DEV_PRINT_ALERTS=1` prints email codes in the server log instead of sending them, `TEST_DATABASE_URL` points the database tests at a throwaway local database, and `R2_ENDPOINT` points the photo storage at a stand-in server.

---

## Deploying

1. Push the repository to GitHub, and on vercel.com choose **Add New… → Project** and import it (Framework: Next.js). Every push to `main` deploys to production.
2. Under **Storage**, connect a Neon Postgres database **in the same region as the functions** (`vercel.json` sets Singapore; change both together). This sets `DATABASE_URL`.
3. Add the [environment variables](#environment-variables) you need, then redeploy (a push does it).
4. Optional, for photos on R2: in Cloudflare, create an R2 bucket, connect a custom domain to it, add a cache rule that makes that host eligible for caching and a response-header rule for `Access-Control-Allow-Origin` and `X-Content-Type-Options`, and create an API token limited to the bucket. Set `PHOTO_BASE` in `src/lib/site.ts` to the custom domain and add the four `R2_*` variables. Existing photos can then be moved from the database with `POST /api/images/move` (admin only), and their database copies cleared afterwards with `?clear=1`.
5. Optional: a Vercel Firewall rate-limit rule for `/api/site/`, `/api/login` and `/api/f/` (see [Architecture](#architecture)).

The app deploys and works without any environment variables, saving to each browser only. Add a database to share data across devices, take website orders and use customer form links.

---

## Testing and monitoring

**Tests** (`npm test`, Vitest, in `tests/`):
- `tests/money.test.ts` checks the money rules with numbers worked out by hand: receipt totals, discounts and coupons, payments, amount in words, website coupon rules and Bangladesh dates, delivery and per-kg charges, discounted prices, saving orders and stock from the admin panel, and that the website's product data never carries the purchase price.
- `tests/orders.db.test.ts` places website orders against a real Postgres: prices come from the database, delivery and the coupon are applied, stock and the coupon are taken; used coupons, sold-out items and short stock are refused; cancelling, restoring and deleting move stock and the coupon back; and an order waits while another one is buying the same last item. It runs only when `TEST_DATABASE_URL` points at a **local throwaway database**, because it wipes the `gr_*` tables first; otherwise it is skipped.
- `tests/variants.test.ts` checks the variant rules: names and ranges, reading sizes from product names, which products are suggested for merging (and which aren't: models, colours), merging (prices, stock, photos and descriptions kept) and what the website shows. `tests/orders.db.test.ts` also orders variants: priced and stocked per variant, sold-out and unknown variants refused, carts from before a merge, and the last one of a variant sold once.
- `tests/visits.test.ts` checks the visitor counter's rules (when a page view starts a visit or a new visitor, which browsers are bots, the 30 days), and `tests/visits.db.test.ts` the daily totals in Postgres (same local-database rule).
- `npm run build` runs the tests first, so a broken money rule stops the Vercel build and never goes live (the database tests skip there).

**GitHub Actions** (`.github/workflows/`):
- **Checks** (`checks.yml`), on every push to `main` and every pull request: generates Next.js's route types, type-checks, lints and runs all tests, the database tests against a throwaway Postgres started for the run.
- **Uptime** (`uptime.yml`): every 15 minutes it checks that the store, its product list, the admin login page and a product photo load; every hour it also asks `/api/site/health` whether the site can reach its database (only hourly, because each question wakes the database). Requests are retried so a network blip doesn't count.
- GitHub emails the repository owner when a workflow fails (GitHub → Settings → Notifications → Actions). GitHub pauses scheduled workflows in a repository with no commits for 60 days, and emails before it does.

---

## Using the app

1. **Settings first.** Enter the shop name, tagline, contact details and logo, the invoice prefix and next number, the default delivery charge, the thank-you and terms text, the watermark setting, and the additional-charge rates. Then set up **Login & security**.
2. **New receipt.** Pick or type a customer, add items (or tap a quick-add chip), and set delivery, discount, coupon and charges. Record payments, then **Save**, **PDF**, **Excel**, **Print** or **Share**.
3. **Receipts.** See who owes you, send reminders, edit, duplicate or delete receipts, and export the ledger.
4. **Customer form.** From Customers, create a one-time link and send it to the customer. They fill it in, and their details appear in your list (refreshed automatically).
5. **Coupons.** Import your coupon sheet or add codes by hand. When a receipt or website order uses a code, or a receipt gives it as a gift, the sheet is updated automatically, and released again if the receipt changes or the order is cancelled.

Receipt numbers run on from **Next number** in Settings (for example `GR-0001`). Deleting the newest receipt frees its number for the next one. If two devices save a receipt with the same number at the same moment, the second one gets the next free number.

---

## Importing spreadsheets

Customers and coupons can be imported from `.xlsx` or `.csv` files (comma, semicolon or tab separated). The import dialog shows a preview of what will be added, updated or skipped before anything changes, and offers a sample file to download.

**Customers.** Columns are found by their headings: a name column (required) plus phone / mobile / contact and address / location / area. A matching phone number, or a matching name when neither row has a phone, counts as the same customer. A match only fills in a missing phone or address.

**Coupons.** Columns: `Code`, `Name`, `Phone Number`, `Validity`, `Using Date`. The offer comes from the code's letter ending, read from the legend in the Code heading:

```
Code (a-1%)(b-2%)(c-3%)(d-4%)(e-5%)(fd-free delivery),Name,Phone Number,Validity,Using Date
GR00-00-00-01a,Rahim Uddin,01700000000,21-04-26 to 21-06-26,
GR00-00-00-02fd,,,,
```

Dates such as `21-04-26`, `21/04/2026` and `2026-04-21` are all understood. A code that is already saved only gets its missing details filled in.

A coupon can't be used if it was already used on another receipt or order, has expired, isn't valid yet, or was given to a different customer. A gift coupon with no end date in the sheet is valid for two months from the receipt date.

---

## How totals are calculated

All maths lives in `src/lib/calc.ts` (amounts are rounded to 2 decimals), and website coupons in `src/lib/couponRules.ts`, so the store, the server and the receipt always agree:

```
subtotal       = Σ price × qty
discount       = subtotal × discount% + fixed discount (+ delivery, if "free delivery")
coupon         = (subtotal − item discount) × coupon% + coupon amount (+ delivery, if free delivery and not already waived)
base           = subtotal + delivery − discount − coupon
charges        = payment-channel % of subtotal
               + courier % of (subtotal − advance payments) [+ fixed fee for "Other"]
               + manual charges
grand total    = base + charges
balance due    = grand total − Σ payments
```

Website delivery is the chosen service's fee plus its charge for every started kilogram over the first one (`deliveryFee` in `src/lib/site.ts`); services quoted after the order charge nothing up front, and orders over the free-delivery threshold deliver free.

A coupon given as a gift takes nothing off the current receipt. Charge rates are copied into the receipt when chosen, so changing a rate in Settings never changes old receipts.

---

## Project structure

```
src/
├── proxy.ts                    # Routes each address to its pages; admin login gate; per-page security policy (Next 16 "proxy", formerly middleware)
├── app/
│   ├── page.tsx                # Home dashboard + aquarium
│   ├── new/                    # Receipt editor (?id=… edits, ?copy=… duplicates)
│   ├── receipts/ products/ customers/ coupons/ orders/ employees/ letterhead/ website/
│   ├── settings/               # Shop settings; settings/security = Login & security
│   ├── login/                  # Admin login, two-step login, password reset
│   ├── f/[token]/              # Public one-time customer form
│   ├── store/                  # The customer website (home, shop, product, cart, checkout, order status, account, policies…)
│   ├── sitemap.ts, robots.ts, manifest.ts
│   └── api/                    # See the API reference
├── components/
│   ├── Editor.tsx              # Receipt form, live summary and actions
│   ├── ReceiptPreview.tsx      # On-screen A4 preview
│   ├── ListEditor.tsx          # Shared list UI for products, customers and coupons
│   ├── CustomerFormDialog.tsx  # Make and track customer form links
│   ├── CustomerFormView.tsx    # The page customers fill in
│   ├── ImportDialog.tsx        # Excel / CSV import with preview
│   ├── VariantsEditor.tsx      # The product form's variants section
│   ├── MergeProductsDialog.tsx # Merge sizes: products saved once per size become one with variants
│   ├── AppShell.tsx, nav.tsx   # Navigation, sync status
│   ├── orders/                 # The admin's order panel
│   ├── security/               # Login & security page parts
│   ├── store/                  # Customer website components (shop browser, product card, cart, checkout…)
│   ├── website/                # Home page design editor, visitor counter
│   └── aquarium/               # Interactive tank
└── lib/
    ├── types.ts                # Data model
    ├── store.tsx               # Admin client store: outbox, sync, change check, coupon linking
    ├── site.ts                 # Shared store logic: addresses, public product shapes, delivery fees, photo addresses
    ├── calc.ts                 # Totals, charges, formatting, amount in words
    ├── couponRules.ts          # Website coupon rules (shared by checkout, server and panel)
    ├── visits.ts               # Visitor counter rules (when a visit starts, bots, the 30 days)
    ├── variants.ts             # Product variants: kinds and labels, the lead price, reading sizes from names, merging
    ├── csp.ts                  # Content-Security-Policy for each page
    ├── pdf.tsx, excel.ts, ledger.ts, letterPdf.tsx, letterDocx.ts, idCard.tsx
    ├── coupons.ts, customerImport.ts, sheet.ts, phone.ts, photos.ts, seo.ts, seed.ts
    └── server/                 # Server-only: db (schema), catalog (cache), orders, auth, accounts, twoFactor,
                                #   passkeys, loginGuard, rateLimit, r2 (photos), customers, reviews, visits, adminEvents…
tests/                          # Vitest: money rules, variants, visitor counter, website orders and visits against Postgres
.github/workflows/              # checks.yml (types, lint, tests), uptime.yml (scheduled checks)
vercel.json                     # Function region
public/
├── fonts/                      # Fonts embedded in the PDF (Bangla included)
├── logo.png, sign.png          # Default logo and signature
└── id-card/                    # ID card design
```

---

## API reference

Every route needs the admin login, except where marked **public**. When `APP_PASSWORD` isn't set (local development), every request counts as logged in.

| Method & path | Purpose |
|---|---|
| `GET/POST /api/login` | **Public.** Login steps: password (+ human check), choosing the first real password, the two-step code. |
| `POST /api/login/passkey` | **Public.** Log in with a passkey. |
| `POST /api/login/forgot`, `POST /api/login/reset` | **Public.** Email a one-time reset link to the owner's alert address; use it (with the two-step code when that is on). |
| `POST /api/logout` | Logs this device out. |
| `/api/security/…` | Login & security: `status`, `password`, `2fa`, `passkeys`, `sessions` (devices), `history`, `alerts`. |
| `GET /api/data` | All shop data, or `{ db: false }` in local mode. `?v=<version>` answers `{ unchanged: true }` when nothing changed since that version. |
| `POST /api/sync` | `{ changes: [{ kind, id, data \| null }] }`. Up to 5000 upserts / deletes in one transaction; orders move stock and coupons; clashing receipt numbers are renumbered. |
| `POST/GET/DELETE /api/forms` | Create, check (`?token=`), list (`?list=1`) and cancel customer form links. |
| `POST /api/f/[token]` | **Public.** `{ name, phone, address }`. Claims the link and saves the customer in one transaction. `422` with field errors, `410` once used or expired. |
| `GET /api/shop-logo` | **Public.** The shop logo image (raster only), cached by version. |
| `POST/DELETE /api/images` | Upload (`full` + `thumb` form fields) or remove a photo. |
| `POST /api/images/move` | Moves photos from the database to R2, checked by size; `?clear=1` then deletes the database copies R2 has. |
| `GET /api/img/[id]` | **Public.** A photo stored in the database (`-t` = thumbnail); redirects to R2 once its database copy is cleared. |
| `GET/POST /api/accounts` | List website accounts; `{ id, action: "reset" \| "delete" }`. |
| `GET /api/visits` | The store's visitors and visits per day for the last 30 days, today last. |
| `POST /api/site/orders` | **Public.** Places a website order (`name, phone, address, ps, email?, note?, zone, method, trxId?, sender?, coupon?, password?, accept, items: [{id, variant?, qty}]`; `variant` is the picked variant of a product sold in variants). |
| `POST /api/site/track` | **Public.** `{ phone }` → that number's orders; `{ code, phone }` → one order (without the shop's private note). |
| `POST /api/site/pay` | **Public.** `{ code, phone, method, trxId, sender? }` adds payment details to an unpaid order. |
| `POST /api/site/coupon` | **Public.** `{ code, phone, name }` → the coupon's offer for the order summary (nothing is reserved). |
| `POST /api/site/customer` | **Public.** `{ phone }` → a returning guest's saved details (numbers with an account only get `{ account: true }`). |
| `GET/POST /api/site/account` | **Public.** The logged-in customer and their orders; `action`: `register`, `login`, `logout`, `update`, `password`. |
| `GET /api/site/products` | **Public.** Current prices and stock for the cart. |
| `GET/POST /api/site/reviews` | **Public.** Approved reviews; write a review. |
| `POST /api/site/receipt`, `GET /api/site/receipt/[file]` | **Public.** `{ code, phone }` → a signed, expiring link to the approved order's receipt PDF; the link itself. |
| `POST /api/site/visit` | **Public.** A store page starts a visit (`{ first: true }` on the browser's first visit today). Counted only from the store's own pages and not from bots; always answers `204`. |
| `GET /api/site/health` | **Public.** `{ ok: true }` when the site can reach its database (for the uptime check). |
| `POST /api/site/csp-report` | **Public.** Browsers report what the security policy blocked; logged as "CSP blocked". |

---

## Security

**Admin login**
- The first login uses `APP_PASSWORD` as a starting PIN and asks for a real password (12+ characters); after that the PIN no longer works.
- Every attempt passes Cloudflare Turnstile, and wrong passwords lead to growing lockouts, per address and overall. Passkeys still work during a lockout.
- **Two-step login** with an authenticator app and/or email codes, with recovery codes. The authenticator secret is stored encrypted with a key made from `SESSION_SECRET`.
- A login lasts 2 hours, and ends after 30 minutes without use. The session cookie (`__Host-` prefixed, `httpOnly`, `secure`) is bound to the browser and country it logged in from: used from somewhere else, the session ends and the owner gets an alert.
- Only a hash of each session token is stored. The owner can see and log out every device, see the login history, and gets email alerts for new-device logins, lockouts and security changes.
- A forgotten password is reset through a one-time link sent to the owner's alert address, never to an address typed on the page; with two-step login on, the reset also needs the code.

**Every page**
- A Content-Security-Policy with a fresh nonce per page view: only the page's own scripts run (`src/lib/csp.ts`, applied in `src/proxy.ts`). Violations are reported to `/api/site/csp-report`.
- `nosniff`, a strict referrer policy and a permissions policy on every response; no other site may frame the pages; the admin and verify addresses are kept out of search results.

**Customers and the store**
- Customer passwords are hashed with scrypt and live in `gr_accounts`, never in `gr_docs`, so they never reach the admin browser. Login tokens are stored hashed; the customer cookie is `__Host-` prefixed and lasts 30 days. Customer login and sign-up pass Turnstile and have their own lockouts.
- The public site only ever sees shop details, website settings and products marked *Show on website*, in a public shape that never includes purchase prices (checked by the tests). Prices, stock, delivery and coupons are worked out on the server.
- Public forms are rate-limited at the edge and per phone number / address on the server.
- Customer form links are random tokens stored only as a SHA-256 hash; they expire after 30 minutes (timed by the database clock) and work once.
- Receipt download links are signed and expire.
- The visitor counter keeps daily totals only: no cookie, no internet address, nothing that tells one visitor from another (the privacy policy says so).

**Data and keys**
- With a database, no copy of the shop data is kept in the browser - only changes that haven't reached the server yet (the outbox), until they do.
- Only PNG / JPEG / WebP / GIF logos are served from the app's own domain (an SVG could carry script); photo uploads accept JPEG, PNG and WebP only.
- Secrets live only in Vercel environment variables, marked Sensitive. The R2 key can read and write the photo bucket and nothing else.

---

## Customising

| What | Where |
|---|---|
| Shop name, tagline, contact details, logo, watermark, invoice prefix, next number, delivery charge, footer text, charge rates | **Settings** page |
| Store settings, delivery services, home page design | **Website** page |
| Receipt colours, default logo | `src/lib/theme.ts` |
| Website colours and fonts | `src/app/globals.css` |
| Receipt layout | `src/lib/pdf.tsx` (PDF), `src/components/ReceiptPreview.tsx` (preview), `src/lib/excel.ts` (Excel) |
| Signature image | `public/sign.png` |
| Payment methods and couriers | `src/lib/types.ts` (`PAYMENT_METHODS`, `COURIERS`) |
| Default settings and sample data | `src/lib/seed.ts` |
| Coupon code legend | `DEFAULT_LEGEND` in `src/lib/coupons.ts` |
| Customer form link lifetime | `FORM_TTL_MINUTES` in `src/lib/server/forms.ts` |
| Admin login length and idle limit | `SESSION_HOURS` in `src/lib/server/auth.ts`, `ADMIN_IDLE_MINUTES` in `src/lib/site.ts` |
| Photo address | `PHOTO_BASE` in `src/lib/site.ts` |
| Server region | `vercel.json` (keep the database in the same region) |

> **Note for contributors:** this project uses Next.js 16, which renames and changes several APIs (for example `middleware.ts` → `proxy.ts`, and typed `PageProps` / `RouteContext`, generated with `npx next typegen`). Check the guides in `node_modules/next/dist/docs/` before changing framework code. See `AGENTS.md`.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Sidebar says "Saved on this device" on the live site | `DATABASE_URL` is missing or the database can't be reached. Check the Vercel environment variables and redeploy. |
| "Offline · will sync when back online" | Changes are queued in the browser and are sent automatically when the connection returns. Don't clear the browser data until it shows "Synced". |
| Customer form button doesn't work | Customer form links need a database (cloud mode). |
| Customers can open the form link on Wi-Fi but not on mobile data | Some mobile carriers have trouble reaching `*.vercel.app` addresses. Open the app from the custom domain, because form links use the address the app is opened from. |
| Logged out of the admin panel | Logins last 2 hours and end after 30 minutes without use, or when the session is used from another browser or country (an alert email says so). Log in again. |
| Forgot the admin password | Use **Forgot password** on the login page: a reset link goes to the owner's alert address. |
| An email from GitHub says the Uptime workflow failed | Open the run on GitHub to see which check failed (store, product list, admin login, photos or database), then check the Vercel logs, Neon or Cloudflare for that part. |
| A Vercel build failed in "vitest run" | A test caught a change in the money rules. Run `npm test` locally to see which. |
| Old receipts missing after first login | Log in on the device that had them. They are moved into the database on that device's first login. |
