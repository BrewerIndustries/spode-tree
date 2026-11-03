import { NextRequest } from "next/server";
import { addCustom, listItems } from "@/lib/db";
import { storeFromFile, storeFromUrl } from "@/lib/images";
import { bad, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ items: listItems() });
}

// Add a piece the catalog is missing. multipart/form-data so a photo can ride along;
// imageUrl is downloaded and stored locally instead.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("expected form data");
  }
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const name = str("name").slice(0, 200);
  const collection = str("collection").slice(0, 60);
  const type = str("type").slice(0, 60);
  if (!name || !collection || !type) return bad("name, collection and type are required");

  let image: string | null = null;
  try {
    const file = form.get("image");
    if (file instanceof File && file.size > 0) image = await storeFromFile(file);
    else if (str("imageUrl")) image = await storeFromUrl(str("imageUrl"));
  } catch (e) {
    return bad((e as Error).message);
  }
  const id = addCustom({ name, collection, type, notes: str("notes").slice(0, 500), image });
  return json({ item: listItems().find((i) => i.id === id) }, 201);
}
