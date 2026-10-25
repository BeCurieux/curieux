import { redirect } from "next/navigation";
import { studio } from "@/lib/studio/context";

export default async function StudioHome() {
  const { repo } = await studio();
  const profiles = await repo.listProfiles();
  if (profiles.length === 0) redirect("/studio/new");
  redirect(`/studio/${profiles[0]!.id}`);
}
