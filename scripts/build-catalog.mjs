#!/usr/bin/env node
// Build src/data/catalog.json + public/items/*.jpg from a raw research file.
//
//   node scripts/build-catalog.mjs <raw.json>
//
// raw.json: [{ name, collection, type, sku?, image_url?, source_url?, status?, notes?,
//             is_set?, components?: [{ name, qty }] }]   (several files are concatenated)
// A set's components name other entries; they are resolved to ids here.
// Ids are stable slugs of collection + name, so re-running keeps the owner's
// checkmarks attached. Images are downloaded once (skipped if the file exists),
// shrunk to 640px JPEG with macOS `sips`, and committed with the app — the app
// never hotlinks a retailer. An image_url that isn't http(s) is a Replacements image
// path, read from $LOCAL_IMAGES (the unpacked in-browser photo bundle, see README).
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const raw = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
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
    ...(r.is_set ? { is_set: true, components: r.components ?? [] } : {}),
  });
}

// Resolve component names → ids, preferring a piece in the set's own sub-line.
const unresolved = [];
for (const e of out) {
  if (!e.is_set) continue;
  e.components = e.components.flatMap((c) => {
    const hits = out.filter((o) => !o.is_set && o.name.toLowerCase() === String(c.name).trim().toLowerCase());
    const hit = hits.find((h) => h.collection === e.collection) ?? hits[0];
    if (!hit) {
      unresolved.push(`${e.name} → ${c.name}`);
      return [];
    }
    return [{ id: hit.id, qty: Math.max(1, Math.floor(c.qty || 1)) }];
  });
}
if (unresolved.length) console.warn(`unresolved components:\n  ${unresolved.join("\n  ")}`);

let ok = 0, failed = 0;
const queue = [...out];
async function worker() {
  for (let e; (e = queue.shift()); ) {
    const file = join(OUT_DIR, `${e.id}.jpg`);
    if (!existsSync(file) && e.image_url) {
      try {
        if (!/^https?:/.test(e.image_url)) {
          const src = join(process.env.LOCAL_IMAGES ?? "", e.image_url.replace(/[^A-Za-z0-9._-]/g, "_"));
          if (!process.env.LOCAL_IMAGES || !existsSync(src)) throw new Error("no local image (set LOCAL_IMAGES)");
          execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "640", src, "--out", file], { stdio: "ignore" });
        } else {
          const res = await fetch(e.image_url, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36" },
            signal: AbortSignal.timeout(20000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const tmp = `${file}.download`;
          writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
          execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "640", tmp, "--out", file], { stdio: "ignore" });
          unlinkSync(tmp);
        }
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

// Photos of entries that are no longer in the catalog.
const keep = new Set(out.map((e) => `${e.id}.jpg`));
for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".jpg") && !keep.has(f)) unlinkSync(join(OUT_DIR, f));

const catalog = out.map(({ image_url, ...rest }) => rest); // eslint-disable-line no-unused-vars
writeFileSync("src/data/catalog.json", JSON.stringify(catalog, null, 1) + "\n");
console.log(`catalog: ${catalog.length} items · ${ok} with images · ${failed} downloads failed`);
