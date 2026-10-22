import { HubPage } from "@/components/studio/hub";

export default async function ThemeStudio({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  return (
    <HubPage
      profileId={profileId}
      eyebrow="Shopify Theme Studio"
      title="Design your store, one safe step at a time."
      intro="Start with the design brief, then use the Sidekick prompts and your homepage copy inside Shopify."
      modules={["theme_brief", "theme_prompts", "homepage_copy"]}
      safety={[
        "Duplicate your live theme before any big change, and work on the copy.",
        "What Shopify Sidekick can do depends on your theme and plan. It won't build a whole premium theme from one prompt — and nobody honest will tell you it does.",
        "Review every change on a phone and a laptop. Empire Studio never publishes anything for you.",
      ]}
    />
  );
}
