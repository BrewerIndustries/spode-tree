#!/usr/bin/env node
// Build src/data/catalog.json + public/items/*.jpg from a raw research file.
//
//   node scripts/build-catalog.mjs <raw.json>
//
// raw.json: [{ name, collection, type, sku?, image_url?, source_url?, status?, notes? }]
// Ids are stable slugs of collection + name, so re-running keeps the owner's
// checkmarks attached. Images are downloaded once (skipped if the file exists),
// shrunk to 640px JPEG with macOS `sips`, and committed with the app — the app
// never hotlinks a retailer.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT_DIR = "public/items";
mkdirSync(OUT_DIR, { recursive: true });

const slug = (s) =>
  s.toLowerCase().replace(/["”″]/g, "in").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seen = new Set();
const out = [];
for (const r of raw) {
  let id = slug(`${r.collection} ${r.name}`).slice(0, 90);
  for (let n = 2; seen.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
  seen.add(id);
  out.push({
    id,
    name: r.name.trim(),
    collection: r.collection.trim(),
    type: r.type.trim(),
    sku: r.sku || null,
    image: null,
    image_url: r.image_url || null,
    source_url: r.source_url || null,
    status: ["current", "discontinued"].includes(r.status) ? r.status : "unknown",
    notes: r.notes || null,
  });
}

let ok = 0, failed = 0;
const queue = [...out];
async function worker() {
  for (let e; (e = queue.shift()); ) {
    const file = join(OUT_DIR, `${e.id}.jpg`);
    if (!existsSync(file) && e.image_url) {
      try {
        const res = await fetch(e.image_url, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tmp = `${file}.download`;
        writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
        execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "640", tmp, "--out", file], { stdio: "ignore" });
        unlinkSync(tmp);
      } catch (err) {
        failed++;
        console.warn(`✗ ${e.id}: ${err.message}`);
      }
    }
    if (existsSync(file)) {
      e.image = `/items/${e.id}.jpg`;
      ok++;
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const catalog = out.map(({ image_url, ...rest }) => rest); // eslint-disable-line no-unused-vars
writeFileSync("src/data/catalog.json", JSON.stringify(catalog, null, 1) + "\n");
console.log(`catalog: ${catalog.length} items · ${ok} with images · ${failed} downloads failed`);
