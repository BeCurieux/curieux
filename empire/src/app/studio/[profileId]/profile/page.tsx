import { LogoUpload, ProfileEditForm } from "@/components/studio/profile-edit-form";
import { Card, PageHeader } from "@/components/ui/card";
import { profileFactsOf } from "@/lib/domain/profile";
import { loadProfile } from "@/lib/studio/context";

export default async function ProfileDetails({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { profile } = await loadProfile(profileId);
  return (
    <div>
      <PageHeader eyebrow="Business details" title="The facts we build from.">
        Saving creates a new profile version. Existing assets stay exactly as they are until you choose to regenerate them.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card><ProfileEditForm profileId={profile.id} defaults={profileFactsOf(profile)} /></Card>
        <Card className="self-start">
          {profile.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/uploads/${profile.logoPath}`} alt={`${profile.brandName} logo`} className="mb-4 max-h-24 rounded-xl bg-ivory object-contain p-2" />
          ) : null}
          <LogoUpload profileId={profile.id} />
        </Card>
      </div>
    </div>
  );
}
