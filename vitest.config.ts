import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `npm test`: tests/*.test.ts. The database tests (tests/*.db.test.ts) run only when TEST_DATABASE_URL points at a
// throwaway Postgres (GitHub's CI starts one); without it they are skipped, e.g. in the Vercel build.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // the database tests share one database: one file at a time
    fileParallelism: false,
  },
});
