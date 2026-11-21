import postgres from "postgres";

/**
 * Everything (shop settings, products, customers, coupons, receipts, letters, website orders, reviews) is stored as JSON
 * documents in one table: gr_docs(kind, id, data). PDFs / Excel files are never
 * stored - they are generated in the browser on demand. Product photos live in gr_images, and the customer
 * website's accounts in gr_accounts / gr_sessions (kept out of gr_docs so password hashes never reach a browser). The
 * store's daily visitor totals are in gr_visits, also outside gr_docs: a visit mustn't make the admin panel reload.
 */
export const KINDS = ["shop", "product", "customer", "invoice", "coupon", "letter", "order", "employee", "review"] as const;
export type Kind = (typeof KINDS)[number];

export const dbEnabled = () => !!process.env.DATABASE_URL;

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __grSql?: Sql; __grSchema?: Promise<unknown> };

export function db(): Sql {
  if (!g.__grSql) {
    const url = process.env.DATABASE_URL!;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__grSql = postgres(url, {
      ssl: local ? false : "require",
      max: 3,
      prepare: false, // required for Neon's pooled (pgbouncer) connection string
      idle_timeout: 20,
    });
  }
  return g.__grSql;
}

/**
 * The version of the tables below. **Bump it whenever you add or change a table, column or index in migrate()**:
 * the next server to start then runs every step again (each one is safe to repeat) and stores the new number.
 * Until then a starting server only reads the stored number - one quick query instead of the whole list, which
 * also took table locks (ALTER TABLE locks its table even when the column is already there).
 */
const SCHEMA_VERSION = 2;

/** Whether the database already has this version of the tables (or a newer one, from a newer deployment). */
async function schemaUpToDate(): Promise<boolean> {
  try {
    const [row] = await db()<{ v: number }[]>`select v from gr_schema`;
    return (row?.v ?? 0) >= SCHEMA_VERSION;
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return false; // no gr_schema table yet: a new or older database
    throw e;
  }
}

/** Creates or updates every table, in one transaction; two servers starting at once take turns. */
const migrate = () =>
  db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(7302)`;
    await sql`
      create table if not exists gr_docs (
        kind text not null,
        id text not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (kind, id)
      )`;
    // one row per customer-form link; only a hash of the link's token is kept
    await sql`
      create table if not exists gr_forms (
        token_hash text primary key,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        used_at timestamptz,
        customer_name text
      )`;
    await sql`alter table gr_forms add column if not exists cancelled_at timestamptz`;
    // product photos, uploaded from the admin panel
    await sql`
      create table if not exists gr_images (
        id text primary key,
        mime text not null,
        bytes bytea not null,
        created_at timestamptz not null default now()
      )`;
    // customer accounts on the website; phone_key = digits of the normalised phone number
    await sql`
      create table if not exists gr_accounts (
        id text primary key,
        phone_key text not null unique,
        phone text not null,
        name text not null,
        email text not null default '',
        address text not null default '',
        pass_hash text not null,
        created_at timestamptz not null default now()
      )`;
    // only a hash of each login token is kept
    await sql`
      create table if not exists gr_sessions (
        token_hash text primary key,
        account_id text not null references gr_accounts(id) on delete cascade,
        expires_at timestamptz not null
      )`;
    // wrong admin PINs, so guessing can be stopped (see /api/login)
    await sql`
      create table if not exists gr_login_fails (
        ip text not null,
        at timestamptz not null default now()
      )`;
    await sql`alter table gr_login_fails add column if not exists id bigserial`;
    await sql`alter table gr_login_fails add column if not exists scope text not null default 'admin'`;
    // admin logins, one row per logged-in device; only a hash of each device's token is kept
    await sql`
      create table if not exists gr_admin_sessions (
        token_hash text primary key,
        id text not null unique,
        device text not null default '',
        ip text not null default '',
        ua text not null default '',
        how text not null default '',
        created_at timestamptz not null default now(),
        last_seen timestamptz not null default now(),
        expires_at timestamptz not null
      )`;
    // the country each admin login came from: a session used from another country is ended (see auth.ts)
    await sql`alter table gr_admin_sessions add column if not exists country text not null default ''`;
    // the admin's own login settings (password hash, two-step login…), never sent to a browser
    await sql`
      create table if not exists gr_admin_settings (
        k text primary key,
        v jsonb not null,
        updated_at timestamptz not null default now()
      )`;
    // the admin login history (see adminEvents.ts)
    await sql`
      create table if not exists gr_admin_events (
        id bigserial primary key,
        at timestamptz not null default now(),
        kind text not null,
        ip text not null default '',
        device text not null default '',
        device_id text not null default '',
        detail text not null default ''
      )`;
    // short-lived one-time admin tokens: two-step login tickets, reset links, passkey challenges (see adminTokens.ts)
    await sql`
      create table if not exists gr_admin_tokens (
        token_hash text primary key,
        kind text not null,
        data jsonb not null default '{}',
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
      )`;
    // the admin's passkeys: only public keys (see passkeys.ts)
    await sql`
      create table if not exists gr_admin_passkeys (
        id text primary key,
        public_key bytea not null,
        counter bigint not null default 0,
        transports jsonb,
        name text not null default 'Passkey',
        created_at timestamptz not null default now(),
        last_used timestamptz
      )`;
    // uses of the store's public forms, for their limits (see rateLimit.ts)
    await sql`
      create table if not exists gr_rate_hits (
        id bigserial primary key,
        key text not null,
        at timestamptz not null default now()
      )`;
    await sql`create index if not exists gr_rate_hits_key_at on gr_rate_hits (key, at)`;
    // the store's visitor counter: totals per Bangladesh day, nothing about any one visitor (see visits.ts)
    await sql`
      create table if not exists gr_visits (
        day date primary key,
        visitors int not null default 0,
        visits int not null default 0
      )`;
    // the version of all of the above (see SCHEMA_VERSION)
    await sql`create table if not exists gr_schema (v int not null)`;
    await sql`delete from gr_schema`;
    await sql`insert into gr_schema (v) values (${SCHEMA_VERSION})`;
  });

/** Makes sure the tables exist, once per server instance: usually a single quick check (see SCHEMA_VERSION). */
export function ensureSchema() {
  g.__grSchema ??= schemaUpToDate()
    .then((ok) => (ok ? undefined : migrate()))
    .catch((e) => {
      g.__grSchema = undefined; // retry on the next request
      throw e;
    });
  return g.__grSchema;
}
