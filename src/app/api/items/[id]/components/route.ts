import { NextRequest } from "next/server";
import { listItems, setComponents } from "@/lib/db";
import { bad, body, json, notFound, type Ctx } from "@/lib/http";
import type { Component } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// { components: [{ id, qty }] } — replaces what the set contains.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const set = listItems().find((i) => i.id === id);
  if (!set) return notFound();
  if (!set.isSet) return bad("only sets have contents");
  const b = await body(req);
  const list = b?.components;
  if (!Array.isArray(list)) return bad("components must be a list");
  const comps: Component[] = [];
  for (const c of list) {
    if (!c || typeof c.id !== "string" || typeof c.qty !== "number" || !Number.isFinite(c.qty)) return bad("each component needs an id and a qty");
    comps.push({ id: c.id, qty: c.qty });
  }
  setComponents(id, comps);
  return json({ item: listItems().find((i) => i.id === id) });
}
