import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/business/owner";
import { DomainError } from "@/lib/domain/db";
import { exportFamily } from "@/lib/domain/privacy";

// Downloads everything Ovyko holds about a family, as one JSON file. POST
// only: each export is audited, so a link or prefetch mustn't make one.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const { db } = await requireOwner();
  try {
    const data = await exportFamily(db, id);
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ovyko-family-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(error.message, { status: 403 });
    throw error;
  }
}
