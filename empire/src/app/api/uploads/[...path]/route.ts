import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { readUpload } from "@/lib/uploads/store";

// Serves her own uploads only. The path must sit in her folder; anything
// else is a 404, whether or not the file exists.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { path } = await params;
  const file = await readUpload(user.id, path.join("/"));
  if (!file) return new NextResponse(null, { status: 404 });
  if ("redirect" in file) return NextResponse.redirect(file.redirect);
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.type,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
