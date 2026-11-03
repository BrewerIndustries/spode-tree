import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import catalogJson from "@/data/catalog.json";
import type { CatalogEntry, Component, Item } from "./types";

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
    -- What each set contains. Seeded once per set from the catalog, then the
    -- owner's edits win (seeded_sets remembers which sets were seeded).
    CREATE TABLE IF NOT EXISTS set_components (
      set_id  TEXT NOT NULL,
      item_id TEXT NOT NULL,
      qty     INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (set_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS seeded_sets (set_id TEXT PRIMARY KEY);
    -- Notes on pieces the owner doesn't own yet (wishlist hints) survive un-checking.
    CREATE TABLE IF NOT EXISTS item_notes (
      item_id TEXT PRIMARY KEY,
      note    TEXT NOT NULL
    );
  `);
  const cols = db.prepare("PRAGMA table_info(custom_items)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_set")) db.exec("ALTER TABLE custom_items ADD COLUMN is_set INTEGER NOT NULL DEFAULT 0");
  seedSets(db);
  return db;
}

// New catalog sets get their contents copied in; sets seeded before are left as edited.
function seedSets(db: Database.Database) {
  const seeded = db.prepare("SELECT 1 FROM seeded_sets WHERE set_id = ?");
  const mark = db.prepare("INSERT INTO seeded_sets (set_id) VALUES (?)");
  const add = db.prepare("INSERT OR IGNORE INTO set_components (set_id, item_id, qty) VALUES (?, ?, ?)");
  db.transaction(() => {
    for (const c of catalog) {
      if (!c.is_set || seeded.get(c.id)) continue;
      for (const comp of c.components ?? []) if (catalogIds.has(comp.id)) add.run(c.id, comp.id, comp.qty);
      mark.run(c.id);
    }
  })();
}

export function getDb(): Database.Database {
  if (!globalForDb._spodeDb) globalForDb._spodeDb = init();
  return globalForDb._spodeDb;
}

type OwnedRow = { item_id: string; qty: number };
type CustomRow = { id: string; name: string; collection: string; type: string; image: string | null; notes: string; is_set: number };

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
  const comps = new Map<string, Component[]>();
  for (const r of db.prepare("SELECT set_id, item_id, qty FROM set_components ORDER BY rowid").all() as { set_id: string; item_id: string; qty: number }[]) {
    comps.set(r.set_id, [...(comps.get(r.set_id) ?? []), { id: r.item_id, qty: r.qty }]);
  }
  const merge = (base: Omit<Item, "owned" | "qty" | "note" | "components">): Item => ({
    ...base,
    components: comps.get(base.id) ?? [],
    isSet: base.isSet || comps.has(base.id),
    owned: owned.has(base.id),
    qty: owned.get(base.id) ?? 0,
    note: notes.get(base.id) ?? "",
  });
  return [
    ...catalog.map((c) =>
      merge({
        id: c.id, name: c.name, collection: c.collection, type: c.type, sku: c.sku,
        image: c.image, status: c.status, notes: c.notes ?? "", custom: false, isSet: !!c.is_set,
      }),
    ),
    ...custom.map((c) =>
      merge({
        id: c.id, name: c.name, collection: c.collection, type: c.type, sku: null,
        image: c.image, status: "unknown", notes: c.notes, custom: true, isSet: !!c.is_set,
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

export function addCustom(input: { name: string; collection: string; type: string; notes: string; image: string | null; isSet: boolean }, id = randomUUID()) {
  getDb()
    .prepare("INSERT INTO custom_items (id, name, collection, type, image, notes, is_set, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.name, input.collection, input.type, input.image, input.notes, input.isSet ? 1 : 0, new Date().toISOString());
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
    db.prepare("DELETE FROM set_components WHERE set_id = ? OR item_id = ?").run(id, id);
  })();
  return row.image ?? "";
}

// Replace a set's contents. Unknown ids, the set itself and other sets are dropped.
export function setComponents(setId: string, components: Component[]) {
  const db = getDb();
  const items = new Map(listItems().map((i) => [i.id, i]));
  const add = db.prepare("INSERT INTO set_components (set_id, item_id, qty) VALUES (?, ?, ?)");
  db.transaction(() => {
    db.prepare("DELETE FROM set_components WHERE set_id = ?").run(setId);
    db.prepare("INSERT OR IGNORE INTO seeded_sets (set_id) VALUES (?)").run(setId);
    const seen = new Set<string>();
    for (const c of components) {
      const it = items.get(c.id);
      if (!it || c.id === setId || it.isSet || seen.has(c.id)) continue;
      seen.add(c.id);
      add.run(setId, c.id, Math.max(1, Math.min(99, Math.floor(c.qty))));
    }
  })();
}
