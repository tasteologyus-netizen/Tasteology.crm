// One-off helper to apply supabase/schema.sql to your database.
// Usage (PowerShell):
//   $env:DATABASE_URL="postgresql://...";  node scripts/apply-schema.mjs
// The connection string is read from the environment and never stored.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log("Schema applied. Public tables:");
  rows.forEach((r) => console.log(" -", r.table_name));
} catch (err) {
  console.error("Failed to apply schema:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
