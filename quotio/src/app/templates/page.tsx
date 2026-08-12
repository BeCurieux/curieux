import type { Metadata } from "next";
import { Gallery, type GalleryCard } from "@/components/templates/Gallery";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { miniFromDocument } from "@/components/widget/MiniWidget";
import { TEMPLATES } from "@/lib/templates/catalogue";

export const metadata: Metadata = {
  title: "Templates",
  description: "Working calculators you can make your own in a click.",
};

export default async function TemplatesPage() {
  const user = await currentUser();

  const cards: GalleryCard[] = TEMPLATES.map((template) => {
    return {
      slug: template.slug,
      name: template.name,
      type: template.type,
      tagline: template.tagline,
      audience: template.audience,
      illustration: template.illustration,
      questionCount: template.document.steps.length,
      brandColour: template.document.theme.brandColour,
      preview: miniFromDocument(template.document),
    };
  });

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      {/* On a gallery the templates are the content, so the masthead stays out
          of their way — text-title, not text-display. */}
      <main className="mx-auto max-w-6xl px-5 pb-14 pt-10">
        <div className="max-w-xl">
          <p className="eyebrow">Templates</p>
          <h1 className="mt-2 text-title">Start from something that already works.</h1>
          <p className="mt-3 leading-relaxed text-slate">
            Every one of these works. Try it, then make it yours. Nothing here is a screenshot.
          </p>
        </div>

        <Gallery cards={cards} />
      </main>

      <SiteFooter />
    </>
  );
}
