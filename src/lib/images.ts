import { writeFile, unlink } from "fs/promises";
import { basename, join } from "path";
import { randomUUID } from "crypto";
import { IMAGE_DIR } from "./db";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
export const MIME: Record<string, string> = Object.fromEntries(
  Object.entries(EXT).map(([m, e]) => [e, m]),
);
const MAX_BYTES = 8 * 1024 * 1024;

// Images live on the app's own disk, never hotlinked: retailer URLs rot.
async function store(bytes: Buffer, mime: string): Promise<string> {
  const ext = EXT[mime];
  if (!ext) throw new Error("unsupported image type");
  if (bytes.length > MAX_BYTES) throw new Error("image too large (8 MB max)");
  const file = `${randomUUID()}.${ext}`;
  await writeFile(join(IMAGE_DIR, file), bytes);
  return `/api/images/${file}`;
}

export async function storeFromUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error("image URL must start with http(s)://");
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (spode-tree)" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`image download failed (${res.status})`);
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  return store(Buffer.from(await res.arrayBuffer()), mime);
}

export async function storeFromFile(file: File): Promise<string> {
  return store(Buffer.from(await file.arrayBuffer()), file.type);
}

export async function removeStored(url: string) {
  if (!url.startsWith("/api/images/")) return;
  await unlink(join(IMAGE_DIR, basename(url))).catch(() => {});
}
