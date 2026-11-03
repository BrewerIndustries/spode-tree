// One row in the inventory: a catalog piece (shipped in src/data/catalog.json)
// or a piece the owner added by hand, merged with whether they own it.
export type Item = {
  id: string;
  name: string;
  collection: string;
  type: string;
  sku: string | null;
  image: string | null; // site-relative URL (/items/… for catalog, /api/images/… for custom)
  status: "current" | "discontinued" | "unknown";
  notes: string;
  custom: boolean;
  isSet: boolean;
  components: Component[]; // what a set contains (empty for single pieces)
  owned: boolean;
  qty: number;
  note: string; // the owner's own note (condition, where bought…)
};

export type Component = { id: string; qty: number };

// Item plus what ownership of *sets* implies for it: owning a 4-piece place
// setting means owning its dinner plate, without ticking the plate itself.
export type Derived = Item & {
  viaQty: number;     // pieces held through owned sets
  inSets: string[];   // ids of sets that contain this piece
  have: boolean;      // owned directly or through a set
  total: number;      // qty + viaQty
};

export function derive(items: Item[]): Derived[] {
  const via = new Map<string, number>();
  const inSets = new Map<string, string[]>();
  for (const s of items) {
    for (const c of s.components) {
      inSets.set(c.id, [...(inSets.get(c.id) ?? []), s.id]);
      if (s.owned) via.set(c.id, (via.get(c.id) ?? 0) + s.qty * c.qty);
    }
  }
  return items.map((i) => {
    const viaQty = via.get(i.id) ?? 0;
    return { ...i, viaQty, inSets: inSets.get(i.id) ?? [], have: i.owned || viaQty > 0, total: i.qty + viaQty };
  });
}

export const SET_TYPES = ["Place Setting", "Dinnerware Set", "Set"];

export type CatalogEntry = {
  id: string;
  name: string;
  collection: string;
  type: string;
  sku: string | null;
  image: string | null;
  source_url: string | null;
  status: Item["status"];
  notes: string | null;
  is_set?: boolean;
  components?: Component[];
};

// Display order for the sub-line chips; anything unlisted sorts after, A→Z.
export const COLLECTION_ORDER = [
  "Classic", "Gold", "Tartan", "Peppermint", "Red Trim", "Holly", "Polka Dot", "Black & White", "Wreath",
  "Yuletide", "Village", "Sculpted/Figural", "Melamine", "250th Anniversary", "Annual", "Ornaments",
];

const PALETTE: Record<string, string> = {
  Classic: "#2f7d4a",
  Gold: "#b8892a",
  Tartan: "#a8312f",
  Peppermint: "#d1477a",
  "Red Trim": "#9e2a2b",
  Holly: "#3d7a2a",
  "Polka Dot": "#c0392b",
  "Black & White": "#3a3a3a",
  Wreath: "#4f8a3c",
  Yuletide: "#8a3f6b",
  Village: "#3b6fb6",
  Annual: "#a0522d",
  Ornaments: "#b8892a",
};
const FALLBACK = ["#3b6fb6", "#7a52b3", "#2a8c8c", "#a0522d", "#5c6b2f", "#8a3f6b"];

export function collectionColor(name: string): string {
  if (PALETTE[name]) return PALETTE[name];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

export function sortCollections(names: string[]): string[] {
  const rank = (n: string) => {
    const i = COLLECTION_ORDER.indexOf(n);
    return i === -1 ? COLLECTION_ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
