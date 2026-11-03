# Spode Christmas Tree — collection inventory

A checklist of every piece in Spode's **Christmas Tree** line (Harold Holdway's 1938
pattern and its sub-lines), with a photo of each, so you can tick off what's in the
cabinet and see what's still to find.

- **Checkbox on every photo** → in my collection. Tap the photo for details: quantity
  (×8 dinner plates), your own notes (condition, price to watch for), SKU, discontinued flag.
- **Filters**: All / Have / Need · sub-line chips (Classic, Gold, Tartan, Peppermint…,
  multi-select, each showing have/total) · item type · free-text search. Filters are
  remembered per device; ownership is stored on the server so phone and laptop agree.
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

The catalog was compiled from spode.com / Portmeirion and Replacements, Ltd. listings.
To refresh or extend it, edit/produce a raw JSON array
(`[{ name, collection, type, sku?, image_url?, source_url?, status?, notes? }]`) and run:

```bash
npm run catalog -- path/to/raw.json   # writes src/data/catalog.json + downloads new photos (macOS sips)
```

Renaming a piece changes its id, which drops its checkmark — prefer adding over renaming.

## Develop

```bash
npm install
npm run dev        # http://localhost:4870
```

Deploying: see [deploy/README.md](deploy/README.md).
