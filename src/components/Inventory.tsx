"use client";

import { useEffect, useMemo, useState } from "react";
import { collectionColor, derive, sortCollections, type Component, type Derived, type Item } from "@/lib/types";
import ItemSheet from "./ItemSheet";
import AddPiece from "./AddPiece";

type Own = "all" | "have" | "need";
type Prefs = { own: Own; collections: string[]; type: string };

const PREFS_KEY = "spode-tree:filters";

function loadPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : null;
  } catch {
    return null;
  }
}

export default function Inventory({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const derived = useMemo(() => derive(items), [items]);
  const [own, setOwn] = useState<Own>("all");
  const [collections, setCollections] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  // Filters are a per-device convenience; ownership itself lives on the server.
  useEffect(() => {
    const p = loadPrefs();
    if (!p) return;
    setOwn(p.own ?? "all");
    setCollections(p.collections ?? []);
    setType(p.type ?? "");
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ own, collections, type }));
    } catch {}
  }, [own, collections, type]);

  const allCollections = useMemo(() => sortCollections([...new Set(items.map((i) => i.collection))]), [items]);
  const allTypes = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);

  // Each filter's counts respect the *other* filters, so the numbers on a chip
  // always match what tapping it would show.
  const matchQ = (i: Derived) => {
    const s = q.trim().toLowerCase();
    return !s || `${i.name} ${i.collection} ${i.type} ${i.sku ?? ""} ${i.note}`.toLowerCase().includes(s);
  };
  const matchOwn = (i: Derived) => own === "all" || (own === "have" ? i.have : !i.have);
  const matchCol = (i: Derived) => collections.length === 0 || collections.includes(i.collection);
  const matchType = (i: Derived) => !type || i.type === type;

  const colRank = new Map(allCollections.map((c, n) => [c, n]));
  const visible = derived
    .filter((i) => matchQ(i) && matchOwn(i) && matchCol(i) && matchType(i))
    .sort(
      (a, b) =>
        colRank.get(a.collection)! - colRank.get(b.collection)! ||
        a.type.localeCompare(b.type) ||
        a.name.localeCompare(b.name),
    );
  const scope = derived.filter((i) => matchCol(i) && matchType(i));
  // Progress counts single pieces; a set counts through the pieces it contains.
  const pieces = derived.filter((i) => !i.isSet);
  const haveCount = pieces.filter((i) => i.have).length;
  const sets = derived.filter((i) => i.isSet);
  const pct = pieces.length ? Math.round((haveCount / pieces.length) * 100) : 0;

  async function patch(id: string, change: Partial<Pick<Item, "owned" | "qty" | "note">>) {
    const before = items;
    setItems((cur) =>
      cur.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, ...change };
        if (change.owned === true && !i.owned) next.qty = Math.max(1, change.qty ?? 1);
        if (change.owned === false) next.qty = 0;
        if (change.qty !== undefined && change.owned === undefined) next.owned = change.qty > 0;
        return next;
      }),
    );
    setError("");
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const { item } = (await res.json()) as { item: Item };
      setItems((cur) => cur.map((i) => (i.id === id ? item : i)));
    } catch (e) {
      setItems(before);
      setError(`Couldn't save — ${(e as Error).message}`);
    }
  }

  async function saveComponents(id: string, components: Component[]) {
    setError("");
    const res = await fetch(`/api/items/${encodeURIComponent(id)}/components`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components }),
    });
    if (!res.ok) {
      setError("Couldn't save the set's pieces");
      return;
    }
    const { item } = (await res.json()) as { item: Item };
    setItems((cur) => cur.map((i) => (i.id === id ? item : i)));
  }

  async function remove(id: string) {
    const res = await fetch(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete that piece");
      return;
    }
    setItems((cur) => cur.filter((i) => i.id !== id));
    setOpenId(null);
  }

  const toggleCollection = (c: string) =>
    setCollections((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const filtered = own !== "all" || collections.length > 0 || type !== "" || q.trim() !== "";
  const open = derived.find((i) => i.id === openId) ?? null;

  return (
    <>
      <header className="bg-[var(--brand)] text-[var(--brand-ink)]">
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Spode · since 1938</p>
              <h1 className="serif text-[26px] font-semibold leading-tight">Christmas Tree Collection</h1>
            </div>
            <button className="btn btn-primary ml-auto mt-1" onClick={() => setAdding(true)}>
              + Add piece
            </button>
          </div>
          <div className="mt-4 flex items-baseline gap-2 text-sm">
            <span className="serif text-2xl font-semibold">{haveCount}</span>
            <span className="opacity-80">
              of {pieces.length} pieces in the cabinet
              {sets.length > 0 && ` · ${sets.filter((s) => s.owned).length} of ${sets.length} sets`}
            </span>
            <span className="ml-auto font-semibold">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="bar-fill h-full rounded-full bg-[#e3b341]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl space-y-2.5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Ownership">
              {(
                [
                  ["all", `All ${scope.length}`],
                  ["have", `Have ${scope.filter((i) => i.have).length}`],
                  ["need", `Need ${scope.filter((i) => !i.have).length}`],
                ] as [Own, string][]
              ).map(([k, label]) => (
                <button key={k} className={own === k ? "on" : ""} onClick={() => setOwn(k)} aria-pressed={own === k}>
                  {label}
                </button>
              ))}
            </div>
            <select
              className="field !w-auto min-w-0 flex-1 !py-[7px] sm:flex-none"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Item type"
            >
              <option value="">All item types</option>
              {allTypes.map((t) => {
                const n = derived.filter((i) => i.type === t && matchCol(i) && matchOwn(i)).length;
                return (
                  <option key={t} value={t}>
                    {t} ({n})
                  </option>
                );
              })}
            </select>
            <input
              className="field !py-[7px] sm:ml-auto sm:max-w-[240px]"
              type="search"
              placeholder="Search pieces…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {allCollections.map((c) => {
              const on = collections.includes(c);
              const inC = derived.filter((i) => i.collection === c && matchType(i));
              return (
                <button
                  key={c}
                  className={`chip ${on ? "on" : ""}`}
                  style={on ? { background: collectionColor(c) } : undefined}
                  onClick={() => toggleCollection(c)}
                  aria-pressed={on}
                >
                  {!on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: collectionColor(c) }} />}
                  {c}
                  <span className="count">
                    {inC.filter((i) => i.have).length}/{inC.length}
                  </span>
                </button>
              );
            })}
            {filtered && (
              <button
                className="chip !border-transparent !bg-transparent text-[var(--muted)]"
                onClick={() => {
                  setOwn("all");
                  setCollections([]);
                  setType("");
                  setQ("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4">
        {error && (
          <p className="mb-3 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        {visible.length === 0 ? (
          <p className="py-16 text-center text-[var(--muted)]">
            {items.length === 0 ? "The catalog is empty." : "No pieces match these filters."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((i) => (
              <Piece key={i.id} item={i} onToggle={() => patch(i.id, { owned: !i.owned })} onOpen={() => setOpenId(i.id)} />
            ))}
          </div>
        )}
      </main>

      {open && (
        <ItemSheet
          key={open.id}
          item={open}
          all={derived}
          onOpen={setOpenId}
          onSaveComponents={(c) => saveComponents(open.id, c)}
          onClose={() => setOpenId(null)}
          onPatch={(c) => patch(open.id, c)}
          onDelete={open.custom ? () => remove(open.id) : undefined}
        />
      )}
      {adding && (
        <AddPiece
          collections={allCollections}
          types={allTypes}
          onClose={() => setAdding(false)}
          onAdded={(item) => {
            setItems((cur) => [...cur, item]);
            setAdding(false);
            if (item.isSet) setOpenId(item.id);
          }}
        />
      )}
    </>
  );
}

function Piece({ item, onToggle, onOpen }: { item: Derived; onToggle: () => void; onOpen: () => void }) {
  const viaOnly = !item.owned && item.viaQty > 0;
  return (
    <div className={`piece ${item.have ? "have" : ""}`}>
      <div className="photo">
        <button className="absolute inset-0 h-full w-full border-none bg-transparent p-0" onClick={onOpen} aria-label={`Details for ${item.name}`}>
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" loading="lazy" />
          ) : (
            <span className="placeholder" aria-hidden>🎄</span>
          )}
        </button>
        {item.isSet && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--brand-ink)]">
            Set{item.components.length > 0 && ` · ${item.components.reduce((n, c) => n + c.qty, 0)}`}
          </span>
        )}
        <button
          className={`check ${item.owned ? "on" : viaOnly ? "via" : ""}`}
          onClick={onToggle}
          role="checkbox"
          aria-checked={item.owned ? true : viaOnly ? "mixed" : false}
          title={viaOnly ? "You have this through a set — tap to also mark a loose one" : undefined}
          aria-label={`${item.owned ? "Remove" : "Add"} ${item.name} ${item.owned ? "from" : "to"} my collection`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
        {(item.total > 1 || viaOnly) && (
          <span className="absolute bottom-2 right-2 rounded-full bg-[var(--good)] px-2 py-0.5 text-xs font-bold text-white">
            {viaOnly ? `in set${item.total > 1 ? ` ×${item.total}` : ""}` : `×${item.total}`}
          </span>
        )}
      </div>
      <button className="flex flex-1 flex-col gap-1 border-none bg-transparent p-2.5 text-left" onClick={onOpen}>
        <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{item.name}</span>
        <span className="mt-auto flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: collectionColor(item.collection) }} />
          <span className="truncate">
            {item.collection} · {item.type}
          </span>
        </span>
      </button>
    </div>
  );
}
