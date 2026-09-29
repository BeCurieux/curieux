import { AppShell } from "@/components/shell/app-shell";
import { requireShell } from "@/lib/auth/viewer";
import { unreadCount } from "@/lib/domain/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireShell("family");
  const unread = await unreadCount(await createClient());
  return (
    <AppShell shell="family" shells={viewer.shells} unread={unread}>
      {children}
    </AppShell>
  );
}
