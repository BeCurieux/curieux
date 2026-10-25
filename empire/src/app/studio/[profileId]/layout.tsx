import { StudioNav } from "@/components/shell/studio-nav";
import { loadProfile } from "@/lib/studio/context";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile } = await loadProfile(profileId);
  return (
    <>
      <StudioNav profileId={profile.id} brandName={profile.brandName} />
      <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
    </>
  );
}
