# Existing customers: migration and communication plan

**Nothing on Gumroad is unpublished, renamed or repriced by this build, and nothing will be without Vee's approval.**

## What existing buyers get

- **Everything they bought stays theirs on Gumroad**, under the terms they bought it with.
- **Signing in to Empire Studio with the same email** finds their purchases (via the Gumroad API, `GUMROAD_ACCESS_TOKEN`) and lists them under "Your Her Little Empire library", separate from the Launch Pack software. Bundles count as owning everything inside them.
- **Income Fit Test owners** (directly or via The Empire Bundle or The Whole Empire) get the **interactive FIT Finder** in their account: the same quiz and scoring as their kit, with the report, calculator and 14-day plan saved to their account. This is an addition to what they bought, not a replacement; their offline report keeps working.
- The Launch Pack is **new software sold separately**. Past products don't include it; it doesn't replace them.

## Before changing any live listing

1. Fill the Gumroad product ids in `src/content/catalogue.ts` and test library matching with a real purchase of one product and one bundle.
2. Decide per product from `content/REGISTER.md`: keep as is; keep as a downloadable companion to a studio feature; or retire **from sale only**.
3. For anything retired from sale: never delete the Gumroad product (buyers keep access), and keep it in their studio library.
4. Fix the source inconsistencies first if the listing copy repeats them (quiz length 20, kit version, refund sentence on Start Here and Fit Check).
5. Send the announcement below before the listing changes.

## Communication

**Email to past buyers (draft for Vee):**

> Subject: Something new from Her Little Empire (your downloads aren't going anywhere)
>
> Hi [first name],
>
> Quick note first: everything you've bought from Her Little Empire stays in your Gumroad library, exactly as it is.
>
> I've built Empire Studio, a tool that turns your business details into a coordinated Shopify launch: brand blueprint, store set-up prompts, product copy, photo briefs, launch emails and a checklist.
>
> If you own the Income Fit Test, there's something extra: sign in at studio.herlittleempire.com with this email and you can take the Fit Finder there too, with your plan and numbers saved as you go.
>
> Empire Studio is separate from your downloads and free to try.
>
> [Sign-off]
>
> Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com

**Line for existing listings:** "Bought this? Sign in to Empire Studio with the same email and find it in your library."

**Support answers:** "Does my old purchase include the Launch Pack?" — No, it's separate software; your download is still yours. "Will I lose my download?" — Never. "Can I get a discount?" — Vee's decision; if offered, use a Gumroad discount code.
