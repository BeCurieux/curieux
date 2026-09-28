import { redirect } from "next/navigation";
import { homePath } from "@/lib/auth/roles";
import { requireViewer } from "@/lib/auth/viewer";

// Sends each person to the shell their role gives them.
export default async function Home() {
  const viewer = await requireViewer();
  redirect(homePath(viewer.shells));
}
