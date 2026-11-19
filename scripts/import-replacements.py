#!/usr/bin/env python3
"""Turn a Replacements, Ltd. scrape into a raw catalog file.

    python3 scripts/import-replacements.py rows.json catalog/raw.json catalog/round2.json > catalog/replacements.json

rows.json comes from the in-browser scrape (see README): one row per distinct
piece name per Replacements pattern, {pattern, name, sizes, img, webid, listings}.
Pieces already in the other raw files (same sub-line, same name once sizes, "Christmas
Tree" and era words like "New" are stripped) are dropped, as are "- Set of N"
multipacks of a single piece, Replacements' own "HC" handcrafted items (tidbits,
candles made from plates), paper goods / storage bags, and loose spare parts (a lid, a top tier). Images come from a separate bundle (img path →
local file), so image_url here is the Replacements image path, not a URL.
"""
import json, re, sys

PATTERN_COLLECTION = {
    "Green Trim": "Green Trim", "Red Trim": "Red Trim", "Red Wine Trim": "Red Wine Trim",
    "Magenta Band": "Magenta Band", "Brown Gadroon": "Brown", "Garland": "Garland",
    "Grove": "Grove", "Gold Collection": "Gold", "Disney": "Disney",
}
# Main-pattern pieces are sorted into the app's sub-lines by keyword, first hit wins.
KEYWORD_COLLECTION = [
    (r"tartan|plaid", "Tartan"), (r"peppermint|candy cane", "Peppermint"), (r"\bgold\b", "Gold"),
    (r"polka", "Polka Dot"), (r"black (&|and) white", "Black & White"), (r"wreath", "Wreath"),
    (r"yuletide", "Yuletide"), (r"village", "Village"), (r"holly", "Holly"), (r"melamine", "Melamine"),
    (r"250th", "250th Anniversary"), (r"ornament|tree topper", "Ornaments"),
    (r"annual|\b(19|20)\d\d\b", "Annual"), (r"figur|sculpt", "Sculpted/Figural"),
]
TYPES = [
    (r"place setting|\d+ ?(piece|pc)\b.*set|boxed set|dinnerware set", "Set"),
    (r"ornament|tree topper", "Ornament"), (r"figurine|statue|music box|snow ?globe", "Figurine"),
    (r"charger|service plate", "Charger"), (r"dinner plate", "Dinner Plate"),
    (r"salad plate|luncheon|dessert plate|bread (&|and) butter|b ?& ?b", "Salad/Dessert Plate"),
    (r"accent|canape|tidbit|plate", "Accent Plate"), (r"mug|stein|tankard", "Mug"),
    (r"cup|saucer", "Cup & Saucer"), (r"teapot|tea pot", "Teapot"), (r"coffee ?pot", "Coffee Pot"),
    (r"creamer|sugar", "Creamer & Sugar"), (r"platter|tray", "Platter"),
    (r"soup|pasta|cereal|rice|fruit|dessert bowl|bowl", "Bowl"), (r"cake stand|cake plate|pedestal", "Cake Stand"),
    (r"cookie jar|biscuit", "Cookie Jar"), (r"canister", "Canister"), (r"pitcher|jug", "Pitcher"),
    (r"casserole|baker|ramekin|pan\b|pie|gratin|souffle|quiche", "Bakeware"),
    (r"glass|goblet|tumbler|flute|wine|crystal", "Drinkware/Glassware"),
    (r"napkin|towel|runner|placemat|cloth|apron|mitt", "Linens"),
    (r"fork|knife|spoon|ladle|server|flatware|spreader", "Flatware"),
    (r"candle|vase|votive|lamp|clock|bell", "Candle/Decor"),
    (r"dish|server|tureen|vegetable|gravy|sauce|butter|relish|candy|jar|box|salt|pepper|trivet|cheese|chip|dip|spoon rest|"
     r"napkin ring|sandwich|basket|bonbon|condiment|oil|cruet|egg|toast|serv", "Serveware"),
]
SKIP = r"-\s*set of \d+|\bHC\b|^(lid|bottom|top|base|insert|liner|tray|stand|handle|stopper|cover)s? (only|for)\b|\bno lid\b|\blid only\b|plastic lid|does not have|replacement|paper|napkin set|storage (bag|case|box|chest)|wrapping|gift wrap|gift bag|playing cards|tissue"
NOISE = r"christmas tree|spode|\bnew\b|\bnewer\b|\bolder\b|\bthe\b|\bwith\b|\bw/|\band\b|&|\bin(ch)?\b|\d+(\.\d+)?( \d/\d)?|\d/\d|[^a-z ]"

def norm(name, collection):
    s = name.lower()
    for word in collection.lower().split("/"):
        s = s.replace(word, " ")
    s = re.sub(NOISE, " ", s)
    return " ".join(sorted(w.rstrip("s") for w in s.split() if len(w) > 1))

def pick(table, name, default):
    return next((v for pat, v in table if re.search(pat, name, re.I)), default)

def main():
    rows = json.load(open(sys.argv[1]))
    existing = [e for f in sys.argv[2:] for e in json.load(open(f))]
    have = {(c["collection"], norm(c["name"], c["collection"])) for c in existing}
    out, seen = [], set()
    for r in rows:
        name = re.sub(r"\s+", " ", r["name"]).strip()
        if re.search(SKIP, name, re.I):
            continue
        coll = PATTERN_COLLECTION.get(r["pattern"]) or pick(KEYWORD_COLLECTION, name, "Classic")
        key = (coll, norm(name, coll))
        if key in have or key in seen:
            continue
        seen.add(key)
        prefix = "Christmas Tree" if r["pattern"] in ("Christmas Tree", "Gold Collection") else f"Christmas Tree {r['pattern']}"
        if r["pattern"] == "Disney":
            prefix = "Disney Christmas Tree Celebration"
        full = name if name.lower().startswith("christmas tree") else f"{prefix} {name}"
        typ = pick(TYPES, name, "Other")
        sizes = ", ".join(r["sizes"])
        notes = "; ".join(x for x in [sizes, f"Replacements, Ltd. item {r['webid']}"] if x)
        entry = {
            "name": full, "collection": coll, "type": typ, "sku": None,
            "image_url": None if r["img"].startswith("http") else r["img"],
            "source_url": f"https://www.replacements.com/p/{r['webid']}",
            "status": "discontinued" if r["pattern"] != "Christmas Tree" else "unknown",
            "notes": notes,
        }
        if typ == "Set":
            entry.update(type="Dinnerware Set" if re.search(r"\d+ ?piece", name, re.I) else "Set", is_set=True, components=[])
        out.append(entry)
    json.dump(out, sys.stdout, indent=1)
    print(f"{len(rows)} rows → {len(out)} new entries", file=sys.stderr)

main()
