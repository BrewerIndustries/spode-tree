import { readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { IMAGE_DIR } from "@/lib/db";
import { MIME } from "@/lib/images";
import { notFound } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const file = basename((await params).file);
  const mime = MIME[extname(file).slice(1)];
  if (!mime) return notFound();
  try {
    const bytes = await readFile(join(IMAGE_DIR, file));
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return notFound();
  }
}
