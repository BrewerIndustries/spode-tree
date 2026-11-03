# Spode Christmas Tree — collection inventory

A checklist of every piece in Spode's **Christmas Tree** line (Harold Holdway's 1938
pattern and its sub-lines), with a photo of each, so you can tick off what's in the
cabinet and see what's still to find.

- **Checkbox on every photo** → in my collection. Tap the photo for details: quantity
  (×8 dinner plates), your own notes (condition, price to watch for), SKU, discontinued flag.
- **Filters**: All / Have / Need · sub-line chips (Classic, Gold, Tartan, Peppermint…,
  multi-select, each showing have/total) · item type · free-text search. Filters are
  remembered per device; ownership is stored on the server so phone and laptop agree.
- **Sets** (place settings, dinner sets, bundles) list the pieces they contain. Owning a set
  counts its pieces as owned — they show an "in set" badge, count toward Have and progress —
  and each piece lists the sets it's part of. Edit a set's pieces from its detail sheet; a
  hand-added piece can be marked as a set.
- **+ Add piece** for anything the catalog is missing (photo upload or image URL — the
  image is downloaded and stored on the server, never hotlinked).
- Tailnet-only, no login (same model as Trip Packing).

| Env  | URL                              | Port | Branch |
| ---- | -------------------------------- | ---- | ------ |
| PROD | https://spode.dabrewer.dev       | 4860 | `main` |
| DEV  | https://spode.dev.dabrewer.dev   | 4870 | `dev`  |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · SQLite via better-sqlite3.

- `src/data/catalog.json` — the shipped catalog (committed). Ids are stable slugs of
  collection + name, so rebuilding the catalog keeps checkmarks attached.
- `public/items/<id>.jpg` — catalog photos, 640px JPEGs (committed).
- `data/spode.db` — what you own (`owned`), your notes (`item_notes`), hand-added pieces
  (`custom_items`). `data/images/` — photos of hand-added pieces. Both server-only, gitignored.

## Updating the catalog

676 entries (628 pieces + 48 sets), compiled from spode.com, spode.co.uk, Walmart, Poshmark
and Chairish listings: `catalog/raw.json` (round 1) and `catalog/round2.json` (sets + vintage).
Resale-sourced entries keep the original listing title in `notes`.

Replacements, Ltd. (the definitive list, ~2,450 distinct Christmas Tree pieces across ten
patterns: main, Green Trim, Red Trim, Thick Red Wine Trim, Magenta Band, Gold Collection,
Garland, Grove, Disney, Brown Gadroon) blocks scripted downloads (Cloudflare 403 for pages
and images). It does load in a real browser, so an import has to run there.

Raw files are arrays of `{ name, collection, type, sku?, image_url?, source_url?, status?,
notes?, is_set?, components?: [{ name, qty }] }`; build with:

```bash
npm run catalog -- catalog/raw.json catalog/round2.json   # writes src/data/catalog.json + downloads new photos (macOS sips)
```

Set contents are copied into the DB once per set (`seeded_sets`); after that the owner's
edits in the app win, so changing a set's components in the catalog won't override them.

Renaming a piece changes its id, which drops its checkmark — prefer adding over renaming.

## Develop

```bash
npm install
npm run dev        # http://localhost:4870
```

Deploying: see [deploy/README.md](deploy/README.md).
