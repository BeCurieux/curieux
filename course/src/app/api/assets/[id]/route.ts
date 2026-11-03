import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serviceClient, userClient } from "@/lib/supabase/server";

// A lesson download (SPEC.md → Data model: download URLs are served through
// a signed route that checks entitlement). Checks who she is and whether
// her entitlements open the asset's lesson, then redirects to a signed URL
// for the private lesson-assets bucket that expires in a minute.

const SIGNED_URL_SECONDS = 60;

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("Not found", { status: 404, headers: noStore });

  const {
    data: { user },
  } = await (await userClient()).auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/learn");
    return NextResponse.redirect(login, { headers: noStore });
  }

  const service = serviceClient();
  const { data: asset, error } = await service
    .from("lesson_assets")
    .select("storage_path, lesson_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("asset lookup", error.message);
    return new NextResponse("Something went wrong", { status: 500, headers: noStore });
  }
  if (!asset) return new NextResponse("Not found", { status: 404, headers: noStore });

  const { data: allowed, error: accessError } = await service.rpc("user_can_open_lesson", {
    p_user: user.id,
    p_lesson: asset.lesson_id,
  });
  if (accessError) {
    console.error("asset access", accessError.message);
    return new NextResponse("Something went wrong", { status: 500, headers: noStore });
  }
  if (allowed !== true)
    return new NextResponse("This download comes with a lesson you haven't unlocked yet.", {
      status: 403,
      headers: noStore,
    });

  const { data: signed, error: signError } = await service.storage
    .from("lesson-assets")
    .createSignedUrl(asset.storage_path, SIGNED_URL_SECONDS, { download: true });
  if (signError || !signed) {
    console.error("asset sign", asset.storage_path, signError?.message);
    return new NextResponse("That file isn't available right now.", {
      status: 404,
      headers: noStore,
    });
  }
  return NextResponse.redirect(signed.signedUrl, { headers: noStore });
}
