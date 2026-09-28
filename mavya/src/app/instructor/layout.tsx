import { AppShell } from "@/components/shell/app-shell";
import { requireShell } from "@/lib/auth/viewer";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireShell("instructor");
  return (
    <AppShell shell="instructor" shells={viewer.shells}>
      {children}
    </AppShell>
  );
}
