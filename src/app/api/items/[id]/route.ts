import { NextRequest } from "next/server";
import { deleteCustom, itemExists, listItems, setNote, setOwned } from "@/lib/db";
import { removeStored } from "@/lib/images";
import { bad, body, json, notFound, type Ctx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// { owned?: boolean, qty?: number, note?: string }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!itemExists(id)) return notFound();
  const b = await body(req);
  if (!b) return bad("expected a JSON object");
  if (b.qty !== undefined && (typeof b.qty !== "number" || !Number.isFinite(b.qty))) return bad("qty must be a number");
  if (b.owned !== undefined) {
    if (typeof b.owned !== "boolean") return bad("owned must be true or false");
    setOwned(id, b.owned, b.qty as number | undefined);
  } else if (b.qty !== undefined) {
    setOwned(id, (b.qty as number) > 0, b.qty as number);
  }
  if (b.note !== undefined) {
    if (typeof b.note !== "string") return bad("note must be text");
    setNote(id, b.note);
  }
  return json({ item: listItems().find((i) => i.id === id) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const image = deleteCustom(id);
  if (image === null) return notFound(); // catalog pieces can't be deleted
  if (image) await removeStored(image);
  return json({ ok: true });
}
