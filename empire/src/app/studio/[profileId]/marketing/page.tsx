import { HubPage } from "@/components/studio/hub";

export default async function MarketingStudio({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return (
    <HubPage
      profileId={profileId}
      eyebrow="Marketing Studio"
      title="Tell people. Nicely, clearly, more than once."
      intro="A coordinated launch: emails and social content that say the same true things in your voice."
      modules={["email_sequence", "social_content"]}
      safety={[
        "No fake countdowns, invented scarcity or earnings claims. If it's not true, it's not in here.",
        "Testimonials only once real customers give them to you.",
        "Nothing is posted for you — copy, schedule and publish in your own tools.",
      ]}
    />
  );
}
