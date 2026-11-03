"use client";

import { useEffect, useState } from "react";
import { collectionColor, type Item } from "@/lib/types";

type Props = {
  item: Item;
  onClose: () => void;
  onPatch: (change: Partial<Pick<Item, "owned" | "qty" | "note">>) => void;
  onDelete?: () => void;
};

export default function ItemSheet({ item, onClose, onPatch, onDelete }: Props) {
  const [note, setNote] = useState(item.note);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveNote = () => note !== item.note && onPatch({ note });

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

          <div className="flex items-center gap-3 rounded-xl bg-[var(--sunk)] p-3">
            <label className="flex flex-1 items-center gap-2.5 font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--good)]"
                checked={item.owned}
                onChange={(e) => onPatch({ owned: e.target.checked })}
              />
              In my collection
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
              Delete this piece
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
