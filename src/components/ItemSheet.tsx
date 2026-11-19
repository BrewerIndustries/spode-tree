"use client";

import { useEffect, useMemo, useState } from "react";
import { collectionColor, type Component, type Derived, type Item } from "@/lib/types";

type Props = {
  item: Derived;
  all: Derived[];
  onOpen: (id: string) => void;
  onClose: () => void;
  onPatch: (change: Partial<Pick<Item, "owned" | "qty" | "note">>) => void;
  onSaveComponents: (components: Component[]) => Promise<void>;
  onDelete?: () => void;
};

export default function ItemSheet({ item, all, onOpen, onClose, onPatch, onSaveComponents, onDelete }: Props) {
  const [note, setNote] = useState(item.note);
  const [editing, setEditing] = useState(item.isSet && item.components.length === 0);
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveNote = () => note !== item.note && onPatch({ note });
  const sets = item.inSets.map((id) => byId.get(id)).filter((s): s is Derived => !!s);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="panel overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.name}>
        <div className="photo !aspect-[4/3]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt={item.name} />
          ) : (
            <span className="placeholder" aria-hidden>🎄</span>
          )}
          <button className="btn btn-sm absolute left-3 top-3" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="serif text-xl font-semibold leading-snug">{item.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: collectionColor(item.collection) }} />
                {item.collection}
              </span>
              <span>· {item.type}</span>
              {item.sku && <span>· SKU {item.sku}</span>}
              {item.status === "discontinued" && <span>· Discontinued</span>}
              {item.custom && <span>· Added by you</span>}
            </p>
            {item.notes && <p className="mt-2 text-sm">{item.notes}</p>}
          </div>

          <div className="rounded-xl bg-[var(--sunk)] p-3">
            <div className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2.5 font-semibold">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--good)]"
                  checked={item.owned}
                  onChange={(e) => onPatch({ owned: e.target.checked })}
                />
                {item.viaQty > 0 ? "Also have loose ones" : "In my collection"}
              </label>
              {item.owned && (
                <div className="flex items-center gap-1.5" aria-label="Quantity">
                  <button className="btn btn-sm !px-2.5" onClick={() => onPatch({ qty: item.qty - 1 })} aria-label="One fewer">
                    −
                  </button>
                  <span className="w-8 text-center font-semibold tabular-nums">{item.qty}</span>
                  <button className="btn btn-sm !px-2.5" onClick={() => onPatch({ qty: item.qty + 1 })} aria-label="One more">
                    +
                  </button>
                </div>
              )}
            </div>
            {item.viaQty > 0 && (
              <p className="mt-2 text-sm text-[var(--good)]">
                ✓ {item.viaQty} through sets you own{item.owned && ` · ${item.total} in all`}
              </p>
            )}
          </div>

          {item.isSet &&
            (editing ? (
              <SetEditor
                set={item}
                all={all}
                onCancel={item.components.length ? () => setEditing(false) : undefined}
                onSave={async (c) => {
                  await onSaveComponents(c);
                  setEditing(false);
                }}
              />
            ) : (
              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="font-semibold">In this set</h3>
                  <button className="btn btn-sm ml-auto" onClick={() => setEditing(true)}>
                    Edit pieces
                  </button>
                </div>
                {item.components.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No pieces listed yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {item.components.map((c) => {
                      const p = byId.get(c.id);
                      return p ? <PieceRow key={c.id} piece={p} qty={c.qty} onClick={() => onOpen(p.id)} /> : null;
                    })}
                  </ul>
                )}
              </div>
            ))}

          {sets.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Part of</h3>
              <ul className="space-y-1.5">
                {sets.map((s) => (
                  <PieceRow key={s.id} piece={s} onClick={() => onOpen(s.id)} />
                ))}
              </ul>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-semibold">My notes</span>
            <textarea
              className="field min-h-[72px]"
              placeholder="Condition, where it came from, a price to watch for…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
            />
          </label>

          {onDelete && (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => confirm(`Delete “${item.name}”? This removes the piece you added.`) && onDelete()}
            >
              Delete this {item.isSet ? "set" : "piece"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumb({ piece }: { piece: Derived }) {
  return (
    <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-[var(--photo)]">
      {piece.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={piece.image} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />
      ) : (
        <span aria-hidden>🎄</span>
      )}
    </span>
  );
}

function PieceRow({ piece, qty, onClick }: { piece: Derived; qty?: number; onClick: () => void }) {
  return (
    <li>
      <button
        className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent p-1 text-left hover:bg-[var(--sunk)]"
        onClick={onClick}
      >
        <Thumb piece={piece} />
        <span className="min-w-0 flex-1 text-sm">
          {qty !== undefined && <span className="font-bold">{qty} × </span>}
          {piece.name}
        </span>
        {piece.have && <span className="text-sm font-bold text-[var(--good)]">✓</span>}
      </button>
    </li>
  );
}

function SetEditor({
  set,
  all,
  onSave,
  onCancel,
}: {
  set: Derived;
  all: Derived[];
  onSave: (c: Component[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const [comps, setComps] = useState<Component[]>(set.components);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);

  // Pieces only (no sets inside sets); same sub-line first since sets rarely mix.
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const taken = new Set(comps.map((c) => c.id));
    return all
      .filter((i) => !i.isSet && !taken.has(i.id))
      .filter((i) => words.every((w) => `${i.name} ${i.collection} ${i.type}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.collection === set.collection) - Number(a.collection === set.collection))
      .slice(0, 8);
  }, [q, all, comps, set.collection]);

  const bump = (id: string, d: number) =>
    setComps((cur) => cur.flatMap((c) => (c.id !== id ? [c] : c.qty + d < 1 ? [] : [{ ...c, qty: c.qty + d }])));

  return (
    <div className="rounded-xl border border-[var(--line)] p-3">
      <h3 className="mb-2 font-semibold">Pieces in this set</h3>
      {comps.length === 0 && <p className="mb-2 text-sm text-[var(--muted)]">Search below to add the pieces this set contains.</p>}
      <ul className="mb-3 space-y-1.5">
        {comps.map((c) => {
          const p = byId.get(c.id);
          if (!p) return null;
          return (
            <li key={c.id} className="flex items-center gap-2">
              <Thumb piece={p} />
              <span className="min-w-0 flex-1 text-sm leading-snug">{p.name}</span>
              <button className="btn btn-sm !px-2" onClick={() => bump(c.id, -1)} aria-label="One fewer">
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{c.qty}</span>
              <button className="btn btn-sm !px-2" onClick={() => bump(c.id, 1)} aria-label="One more">
                +
              </button>
            </li>
          );
        })}
      </ul>
      <input
        className="field !py-[7px]"
        type="search"
        placeholder="Find a piece to add, e.g. gold dinner plate"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {matches.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent p-1 text-left hover:bg-[var(--sunk)]"
                onClick={() => {
                  setComps((cur) => [...cur, { id: m.id, qty: 1 }]);
                  setQ("");
                }}
              >
                <Thumb piece={m} />
                <span className="min-w-0 flex-1 text-sm">
                  {m.name}
                  <span className="block text-xs text-[var(--muted)]">
                    {m.collection} · {m.type}
                  </span>
                </span>
                <span className="text-sm font-bold text-[var(--good)]">+ Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button className="btn btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(comps);
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Save pieces"}
        </button>
      </div>
    </div>
  );
}
