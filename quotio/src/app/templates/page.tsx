import type { Metadata } from "next";
import { Gallery, type GalleryCard } from "@/components/templates/Gallery";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { TEMPLATES } from "@/lib/templates/catalogue";

export const metadata: Metadata = {
  title: "Templates",
  description: "Working calculators, estimators and quizzes you can make your own in a click.",
};

export default async function TemplatesPage() {
  const user = await currentUser();

  const cards: GalleryCard[] = TEMPLATES.map((template) => ({
    slug: template.slug,
    name: template.name,
    type: template.type,
    tagline: template.tagline,
    audience: template.audience,
    illustration: template.illustration,
    questionCount: template.document.steps.length,
    brandColour: template.document.theme.brandColour,
  }));

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-6xl px-5 py-14">
        <div className="max-w-xl">
          <p className="eyebrow">Templates</p>
          <h1 className="mt-3 text-display">Start from something that already works.</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            Every one of these is a real, working widget — try it, then make it yours. Nothing here
            is a screenshot.
          </p>
        </div>

        <Gallery cards={cards} />
      </main>

      <SiteFooter />
    </>
  );
}
