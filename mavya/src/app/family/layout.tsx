import { AppShell } from "@/components/shell/app-shell";
import { requireShell } from "@/lib/auth/viewer";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireShell("family");
  return (
    <AppShell shell="family" shells={viewer.shells}>
      {children}
    </AppShell>
  );
}
