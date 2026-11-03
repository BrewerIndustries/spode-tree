import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import catalogJson from "@/data/catalog.json";
import type { CatalogEntry, Item } from "./types";

const DB_PATH = process.env.SPODE_DB_PATH ?? join(process.cwd(), "data", "spode.db");
export const IMAGE_DIR = join(dirname(DB_PATH), "images");

const catalog = catalogJson as CatalogEntry[];
const catalogIds = new Set(catalog.map((c) => c.id));

// Next.js reloads modules in dev; cache the handle so migrations run once.
const globalForDb = globalThis as unknown as { _spodeDb?: Database.Database };

function init(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  mkdirSync(IMAGE_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    -- What the owner has. Keyed by catalog id or custom_items.id; a row means owned.
    CREATE TABLE IF NOT EXISTS owned (
      item_id   TEXT PRIMARY KEY,
      qty       INTEGER NOT NULL DEFAULT 1,
      note      TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL
    );
    -- Pieces missing from the shipped catalog, added by hand.
    CREATE TABLE IF NOT EXISTS custom_items (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      collection TEXT NOT NULL,
      type       TEXT NOT NULL,
      image      TEXT,
      notes      TEXT NOT NULL DEFAULT '',
      createdAt  TEXT NOT NULL
    );
    -- Notes on pieces the owner doesn't own yet (wishlist hints) survive un-checking.
    CREATE TABLE IF NOT EXISTS item_notes (
      item_id TEXT PRIMARY KEY,
      note    TEXT NOT NULL
    );
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb._spodeDb) globalForDb._spodeDb = init();
  return globalForDb._spodeDb;
}

type OwnedRow = { item_id: string; qty: number };
type CustomRow = { id: string; name: string; collection: string; type: string; image: string | null; notes: string };

export function listItems(): Item[] {
  const db = getDb();
  const owned = new Map(
    (db.prepare("SELECT item_id, qty FROM owned").all() as OwnedRow[]).map((r) => [r.item_id, r.qty]),
  );
  const notes = new Map(
    (db.prepare("SELECT item_id, note FROM item_notes").all() as { item_id: string; note: string }[])
      .map((r) => [r.item_id, r.note]),
  );
  const custom = db.prepare("SELECT * FROM custom_items ORDER BY createdAt").all() as CustomRow[];
  const merge = (base: Omit<Item, "owned" | "qty" | "note">): Item => ({
    ...base,
    owned: owned.has(base.id),
    qty: owned.get(base.id) ?? 0,
    note: notes.get(base.id) ?? "",
  });
  return [
    ...catalog.map((c) =>
      merge({
        id: c.id, name: c.name, collection: c.collection, type: c.type, sku: c.sku,
        image: c.image, status: c.status, notes: c.notes ?? "", custom: false,
      }),
    ),
    ...custom.map((c) =>
      merge({
        id: c.id, name: c.name, collection: c.collection, type: c.type, sku: null,
        image: c.image, status: "unknown", notes: c.notes, custom: true,
      }),
    ),
  ];
}

export function itemExists(id: string): boolean {
  if (catalogIds.has(id)) return true;
  return !!getDb().prepare("SELECT 1 FROM custom_items WHERE id = ?").get(id);
}

export function setOwned(id: string, owned: boolean, qty?: number) {
  const db = getDb();
  if (!owned) {
    db.prepare("DELETE FROM owned WHERE item_id = ?").run(id);
    return;
  }
  const n = Math.max(1, Math.min(999, Math.floor(qty ?? 1)));
  db.prepare(
    `INSERT INTO owned (item_id, qty, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET qty = ${qty === undefined ? "qty" : "excluded.qty"}, updatedAt = excluded.updatedAt`,
  ).run(id, n, new Date().toISOString());
}

export function setNote(id: string, note: string) {
  const db = getDb();
  const text = note.trim().slice(0, 2000);
  if (!text) db.prepare("DELETE FROM item_notes WHERE item_id = ?").run(id);
  else db.prepare("INSERT INTO item_notes (item_id, note) VALUES (?, ?) ON CONFLICT(item_id) DO UPDATE SET note = excluded.note").run(id, text);
}

export function addCustom(input: { name: string; collection: string; type: string; notes: string; image: string | null }, id = randomUUID()) {
  getDb()
    .prepare("INSERT INTO custom_items (id, name, collection, type, image, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.name, input.collection, input.type, input.image, input.notes, new Date().toISOString());
  return id;
}

export function deleteCustom(id: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT image FROM custom_items WHERE id = ?").get(id) as { image: string | null } | undefined;
  if (!row) return null;
  db.transaction(() => {
    db.prepare("DELETE FROM custom_items WHERE id = ?").run(id);
    db.prepare("DELETE FROM owned WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_notes WHERE item_id = ?").run(id);
  })();
  return row.image ?? "";
}
