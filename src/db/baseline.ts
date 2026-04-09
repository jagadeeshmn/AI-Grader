/**
 * Run this once to mark already-applied migrations (applied via drizzle-kit push)
 * as done in the __drizzle_migrations tracking table.
 * After running this, `npm run db:migrate` will only apply new migrations.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import "dotenv/config";

// hash = SHA-256 of migration file content
// created_at = "when" from drizzle/meta/_journal.json
const applied = [
  {
    hash: "4c0fc81ad551f024e815031729483296067a7782d8e7bec7471a95d362bc411a",
    createdAt: 1775078280682,
    name: "0000_flowery_wendigo",
  },
  {
    hash: "a1ede87eb77a04538fb0bdf3c9920a4ba26eaabffc875ef9760ed29dfc759ed7",
    createdAt: 1775088622384,
    name: "0001_cloudy_cerise",
  },
];

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  // Drizzle's migrator stores tracking data in the "drizzle" schema
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  for (const m of applied) {
    const existing = await db.execute(
      sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${m.hash}`
    );
    if (existing.rows.length === 0) {
      await db.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${m.hash}, ${m.createdAt})`
      );
      console.log(`Baselined: ${m.name}`);
    } else {
      console.log(`Already recorded: ${m.name}`);
    }
  }

  console.log("Baseline complete. Run `npm run db:migrate` now.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
