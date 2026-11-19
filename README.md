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
- `public/items/<id>.jpg` — catalog photos, ≤640px JPEGs (committed, ~115 MB). The builder
  deletes photos of entries no longer in the catalog.
- `data/spode.db` — what you own (`owned`), your notes (`item_notes`), hand-added pieces
  (`custom_items`). `data/images/` — photos of hand-added pieces. Both server-only, gitignored.

## Updating the catalog

2,048 entries (1,946 pieces + 102 sets). Raw sources, merged in order:

- `catalog/raw.json` — round 1: spode.com + spode.co.uk.
- `catalog/round2.json` — round 2: sets with contents (Spode listings, Walmart) and vintage
  pieces from Poshmark/Chairish (original listing title kept in `notes`).
- `catalog/replacements.json` — Replacements, Ltd., ten patterns (main, Green Trim, Red Trim,
  Thick Red Wine Trim, Magenta Band, Gold Collection, Garland, Grove, Disney, Brown Gadroon),
  made by `scripts/import-replacements.py` from an in-browser scrape. It drops pieces already in
  the other two files, "- Set of N" multipacks, Replacements' "HC" handcrafted items, paper
  goods and loose spare parts. Replacements sets come without contents (add them in the app).

### Re-importing from Replacements

Replacements answers scripts (curl, Node fetch) with a Cloudflare 403, for both pages and
`images.replacements.com`, but loads normally in a real browser. The 2026-11-03 import ran
in the Claude desktop app's browser pane:

1. On a `www.replacements.com` page, `fetch()` each pattern's `/c/<id>?page=N` (100 listings
   a page, cards are `.product-photo[data-webid]`), group by piece name, and save the rows as
   JSON (`{pattern, name, sizes, img, webid, listings}`) via a blob download.
2. Navigate to a direct image URL (`https://images.replacements.com/<path>`, **not** the
   `/cdn-cgi/image/` one, whose CSP blocks loading anything else), `fetch()` each image path
   same-origin, shrink to 480px on a canvas, and download base64 bundles. Chrome blocks
   repeated scripted downloads, so each bundle is saved by clicking a button.
3. Unpack the bundles to one JPEG per path (non-alphanumerics → `_`), then:

```bash
python3 scripts/import-replacements.py rows.json catalog/raw.json catalog/round2.json > catalog/replacements.json
LOCAL_IMAGES=path/to/unpacked npm run catalog -- catalog/raw.json catalog/round2.json catalog/replacements.json
```

Raw files are arrays of `{ name, collection, type, sku?, image_url?, source_url?, status?,
notes?, is_set?, components?: [{ name, qty }] }`; build with:

```bash
npm run catalog -- catalog/raw.json catalog/round2.json catalog/replacements.json   # writes src/data/catalog.json + downloads new photos (macOS sips)
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
