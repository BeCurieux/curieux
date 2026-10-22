# Existing customers: migration and communication plan

**Nothing is unpublished, renamed or repriced by this build.** Every
existing Gumroad product keeps working exactly as before.

## Principles

- Previously purchased downloads are **yours forever on Gumroad**, under the
  terms they were bought with.
- The **Launch Pack is new software**, sold separately. It doesn't replace
  past products, and past products don't include it.
- In the studio, earlier purchases appear in **"Your Her Little Empire
  library"** (account page) — clearly separate from the software.

## How existing buyers are recognised

Signing in with the email used on Gumroad finds past purchases (via the
Gumroad sales API, `GUMROAD_ACCESS_TOKEN`) once each product's Gumroad id is
added to `src/content/catalogue.ts`. Nothing is required of the customer.

## Before changing any live listing

1. Fill the catalogue ids and confirm library matching works with a test
   purchase of each product.
2. Decide per product (from the content audit): keep as is, keep as a
   downloadable companion to a studio feature, or retire **from sale only**.
3. For any product retired from sale: keep it in buyers' Gumroad libraries
   (never delete the product), and keep the PDF available from their studio
   library.
4. Send the announcement below before the listing changes.

## Communication

**Email to past buyers (draft):**

> Subject: Something new from Her Little Empire (your downloads aren't going anywhere)
>
> Hi [first name],
>
> Quick note first: everything you've bought from me stays in your Gumroad
> library, exactly as it is.
>
> I've built Empire Studio — a tool that turns your business details into a
> coordinated Shopify launch: brand blueprint, store setup prompts, product
> copy, photo briefs, launch emails and a checklist.
>
> It's separate from your downloads. You can try it free at
> studio.herlittleempire.com — sign in with this email address and your
> past purchases will show up in your library there too.
>
> [Your name]

**Line for existing listings:** "Want this done for your own store? Try
Empire Studio free — your purchase here stays yours."

**Support answers:** "Does my old purchase include the studio?" — No, it's
separate software; your download is still yours. "Will I lose my
download?" — Never. "Can I get a discount?" — Founder's decision; if offered,
implement as a Gumroad discount code, not a code change.
