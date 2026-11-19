"use client";

import { useState } from "react";
import type { Item } from "@/lib/types";

type Props = {
  collections: string[];
  types: string[];
  onClose: () => void;
  onAdded: (item: Item) => void;
};

// For pieces the shipped catalog is missing (store exclusives, old one-offs…).
export default function AddPiece({ collections, types, onClose, onAdded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/items", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onAdded(data.item as Item);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <form className="panel space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="serif text-xl font-semibold">Add a piece</h2>
        <p className="text-sm text-[var(--muted)]">For anything the catalog is missing.</p>
        <input className="field" name="name" placeholder="Name, e.g. Christmas Tree Gravy Boat" required autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" name="collection" list="add-collections" placeholder="Collection" required />
          <input className="field" name="type" list="add-types" placeholder="Item type" required />
        </div>
        <datalist id="add-collections">
          {collections.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="add-types">
          {types.map((t) => <option key={t} value={t} />)}
        </datalist>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Photo</span>
          <input className="field" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" />
        </label>
        <input className="field" name="imageUrl" type="url" placeholder="…or paste an image URL" />
        <input className="field" name="notes" placeholder="Notes (optional)" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isSet" className="h-4 w-4 accent-[var(--good)]" />
          This is a set (place setting, boxed set…) — pick its pieces after adding
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Adding…" : "Add piece"}
          </button>
        </div>
      </form>
    </div>
  );
}
