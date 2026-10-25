# Her Little Empire: content-to-software method extraction (faceless content, starter kits and brand)

Audit date: 22 Oct 2026. Sources: `hle/02_products/content/*.json` (primary), compared with `hle/02_products/pdf/*.pdf`, plus `hle/03_brand/visual-identity.html` and `hle/03_brand/PRINT_STYLE.md`. Citations use the form *file › section label: heading › block title*.

**How the PDFs compare.** For all nine in-scope products, every text line of the JSON appears in the matching PDF (checked by script on `pdftotext -raw` output). The PDFs add only:
- a running head
- a table of contents
- page footers ("Big plans. Real life.")
- the imprint: "General educational information, not financial, legal or tax advice. No income guarantees. Examples are illustrative. Version 1.1 · October 2026." and "Her Little Empire · ABN 38 813 430 864 · Australia · hello@herlittleempire.com · Full refund within 14 days of purchase, no questions asked."

The JSON is therefore a reliable source. The version (1.1) appears only in the PDFs.

---

## a. The Faceless Content System method

> **Source note.** No document defines content *pillars*. The closest structure is the 30-Day plan's four post types: "Teach / Trust / Show / Sell" (*30-day-faceless-content-plan › Start here: How this plan works › The weekly rhythm*). The workbook for the "Faceless Content System course" (*faceless-content-system-workbook*) is not in `catalog.py`, so its price and sale status are unknown.

### a1. Pillars (post types): the weekly rhythm
From *30-day › Start here › The weekly rhythm*:

| Type | What it does (verbatim) | Example (verbatim) |
|---|---|---|
| Teach | "Gives a useful tip, steps or a checklist. People save and share these." | "How to [small outcome] in 5 steps" |
| Trust | "Shows who you are and how you work, without your face." | "Why I started [business name]" |
| Show | "Lets people see your process, workspace or product." | "Watch a [deliverable] come together" |
| Sell | "Tells people clearly what you offer, the price and where to find it." | "Here's what I actually do for [audience]" |

Month arc (*› The month at a glance*):
- Week 1 "Say hello, teach the basics, ask what your audience needs. One soft sell."
- Week 2 "Build trust: your story, your values, your most-asked questions."
- Week 3 "Show your process and check interest in your offer."
- Week 4 "A gentle launch: your offer, what's inside, who it's for, honest Q&A."

### a2. Formats
Two format lists exist. The FCS list is the superset.

**FCS: "Six faceless formats"** (*faceless-content-system-workbook › Module 1: Formats without your face*):

| Format | Often good for | Effort |
|---|---|---|
| Text-on-screen reel | Reaching new people | Low |
| Hands and b-roll | Feeling real and personal | Low |
| Screen recording | Showing your product | Low to medium |
| Voice-over | Warmth, explaining | Medium |
| Carousel | Saves and teaching | Medium |
| Quote | Sends and shares | Low |

Instruction: "Pick the three formats you will use most."

**30-Day: four formats, with how-to** (*30-day › Formats: Faceless content types, explained*):
- **Text reel**: "A short video with bold text on screen, over a simple background or b-roll." How-to: "Film 5-10 seconds of b-roll. Add 1-3 lines of text that change every few seconds. Add audio at low volume."
- **B-roll reel**: "Clips of your hands, desk, screen or workspace, with text or a voiceover." How-to: "Film 3-6 short clips. Trim to 1-3 seconds each. Add text or record a voiceover on your phone."
- **Carousel**: "Up to 20 swipeable slides in one post (check the app, limits change)." How-to: "Strong first slide, one idea per slide, a clear last slide with a CTA."
- **Stories**: "Short posts that disappear after 24 hours, with stickers." How-to: "3-5 frames a day. Use one interactive sticker. Save the best to a Highlight."

**Brand series templates** (*visual-identity.html › 03 · Templates*): The Receipts, The Line, A note from Vee, The Series, Nonsense Watch, Inside the kit. "Built at 4:5 for Instagram; every one survives the 3:4 grid crop." These are HLE's own series. For Empire Studio users they are a visual pattern ("Each content series has its own colour and layout"), not content to copy.

### a3. Rules for faceless content (generator constraints)
1. **Trust basis.** "Trust comes from showing real work, a clear method and honest limits." (*FCS › Module 1 intro*). "You don't need to be on camera to be trusted. You need to be clear, useful and consistent." (*30-day › Formats intro*)
2. **AI presenter rule.** "if a person in your content is AI-generated, label it clearly every time (Instagram's AI label and a line in your caption). Never present an AI person as yourself, your founder or a real customer." (*FCS › Module 1 callout*)
3. **Privacy in footage.**
   - "check nothing private is visible: names, addresses, children's faces, school logos or screens with other people's details." (*FCS › Module 1: 25 things to film › callout*)
   - "Check every frame for private details: names, emails, addresses, client work, your children's faces or school logos." (*30-day › Film it › Filming tips*)
4. **What makes a good faceless post** (*30-day › Formats › list*):
   - "A hook in the first line or first second that names your audience or their problem."
   - "One clear idea. If you have three ideas, that's three posts."
   - "Your real voice. Write the way you'd text a friend."
   - "Something to do next: save, comment, tap the link, reply to a story."
   - "Voiceovers are optional. Text on screen works well, and many people watch with the sound off anyway."
5. **Honest caption check** (*FCS › Module 2: Hooks and captions*):
   - "No income claims, including examples that sound like promises"
   - "Estimates are labelled as estimates"
   - "No fake urgency or countdowns"
   - "No invented comments, results or testimonials"
   - "One clear next step only"
6. **Hook honesty.** "only use a hook if the post delivers exactly what it says." (*100-faceless-hooks › Start here callout*)
7. **What not to do** (*100-faceless-hooks › Worksheet: Make it yours › What not to do*):
   - engagement bait
   - misleading hooks
   - money promises
   - fake stats ("If you can't link to it, leave it out.")
   - fake urgency
   - copying others word for word
   - "Hook and run"
   - "Using a story that isn't yours, or isn't true, as if it happened to you."
8. **Platform rules** (*30-day › Get found › Platform rules to keep in mind*):
   - avoid engagement bait
   - disclose affiliate or paid content and "use the paid partnership label where it applies"
   - "Only send DMs to people who've contacted you or asked for something"
   - use only licensed images, music and fonts
9. **Accessibility** (*30-day › Accessibility › Every post*):
   - auto-captions checked
   - custom alt text
   - big, high-contrast text
   - keep text clear of the edges
   - "Use emojis lightly"
   - "Capital Case" hashtags ("#SmallBusinessTips")
   - don't rely on colour alone
   - "Avoid fast flashing effects"

   Alt-text formula: "[Type of image] showing [what's in it]. Text reads: \"[the main words on the slide]\"."
10. **Keywords and hashtags** (*30-day › Get found*):
    - Keywords: "Put your main [niche keyword] in your profile name field and bio"; "Say the keyword in the first line of your caption where it reads naturally"; "Put it in your on-screen text and your carousel's first slide too."
    - Hashtags: "Use 3-5 hashtags that describe the post, not 30"; "Mix one broad tag ([#topic]) with a few specific ones".
    - Posting times: "there's no magic time... After two weeks, check Insights".

### a4. How a post or Reel is structured
**From hook to post in 7 steps** (*100-faceless-hooks › Method: How to use a hook*):
1. "Choose the goal of this post: stop the scroll, save, comment, share, trust, sell or story."
2. "Go to that section and pick one hook that matches what you want to say."
3. "Fill every blank with something specific. \"5 Canva tips\" beats \"some tips\"."
4. "Check the post delivers the hook. If the hook says 5 steps, show 5 steps."
5. "Put the hook on slide 1 or the first frame, in large text with plenty of space around it."
6. "Add one call to action at the end (see the CTA section). Just one."
7. "Read it once more against the what-not-to-do list before you post."

**Caption template** (*FCS › Module 2: Hooks and captions*), verbatim:
```
[Hook, repeated or extended from the video]

[One or two sentences of real, specific detail]

[The lesson, in one line]

[One next step: save this / send it to a friend / comment KEYWORD for the free [thing]]
```

**Hook kinds and formulas** (*FCS › Module 2*):
- **Kinds:** Stop ("Make her pause"), Save ("Promise something useful"), Share ("Something to send a friend"), Conversation ("Invite a reply").
- **Formulas:** "Name her moment: \"It's 9:15pm and...\""; "Name the mistake: \"Before you buy the domain...\""; "Give a number: \"3 signs an idea is not for now\""; "Flip a belief: \"You don't need more time.\""

**Reel beats.** No document gives a beat sheet. The available specifics are:
- text reel: "1-3 lines of text that change every few seconds" (*30-day › Formats*)
- Day 12: "Text reel, one point per beat" (*30-day › The plan*)
- motion: "Words rise in line by line, 0.3–0.5 s each. Headline on screen for at least 1.5 s." / "Simple cuts or a page-turn. No spins, zooms or glitch effects." / End card "Ivory card, the line or the keyword (FIT), the running head. 2–3 s." (*visual-identity.html › 06 · Motion*)
- covers: "keep important text in the middle, away from the top and bottom edges" (*FCS › Module 3 callout*) and "title inside the middle 1080 × 1440 so it survives the grid crop" (*visual-identity.html › 07*)

Reel length is **unknown**: no document states it.

**Carousel structure.** "Strong first slide, one idea per slide, a clear last slide with a CTA." (*30-day › Formats*). "Keep slide text short: one idea per slide, large enough to read on a phone." (*30-day › Set up › Using the templates in Canva*). The T01-T10 structures are named in *30-day › Set up › Your carousel templates*:
- T01 Myth vs truth
- T02 Steps
- T03 Mistakes to avoid
- T04 Before / after "(of your process, no fake results)"
- T05 Checklist
- T06 This or that
- T07 Behind the scenes (faceless)
- T08 FAQ
- T09 Mini case study "(your own real work only)"
- T10 Offer / what's inside

The template files themselves ("Carousel-Templates.zip", per `catalog.py`) are **not in the source folder**.

**Weekly output and batching** (*FCS › Module 5: Your two-hour week*): "3 reels, 1 carousel, 1 quote, made and scheduled"; "Stories on 3 or more days, each with a sticker". If busy: "Post less, not never: one reel a week still counts".

### a5. "Faceless, not anonymous" principles (*faceless-not-anonymous-workbook*)
- **Definition:** "Faceless means you choose not to show your face. Anonymous means nobody can tell who is responsible. Be the first, never the second." (*Module 1 intro*)
- **Core idea:** "people trust what they can check. A face is only one thing they can check, and not the most important one." (*Start here callout*)
- **Swap the face** for something checkable: Recognition, Warmth, Accountability (*Module 1 table*).
- **When faceless is harder:** "one-to-one services sold on personality, coaching, in-home local services and regulated work... you'll usually need your name." (*Module 1 callout*)
- **Trust stack** (score 0 = missing, 1 = there but messy, 2 = solid; "Fix the lowest one this week"), from *Module 2*:
  1. Name: "Registered business or trading name, business number where it applies, same name everywhere"
  2. Contact: "Email on your own domain, a reply time you keep, a real first name"
  3. Policies: "Clear refund policy you honour, privacy policy that matches reality, short terms"
  4. Pages: "Real page previews, honest what's-inside list, who it is and isn't for"
  5. Replies: "You reply yourself where you can, automations say so, complaints answered kindly"
- **Recognition:** "Recognition comes from a look, a voice and a signature that repeat." (*Module 3*)
- **Proof without hype:** "show the work, show the method, show the limits. And remove anything you can't back up." (*Module 4*). Number labels:
  - FACT: "You checked it at the source"
  - EST: "It's a reasoned estimate"
  - UNKNOWN: "You couldn't find a reliable source"
- **Reviews:** "Ask once... Never offer anything in exchange for a positive review, and never reword a review to sound better." (*Module 4 callout*)
- **Boundaries vs legal duties:** "The business details the law asks you to show are separate from your boundaries. Show those." (*Module 5 callout*)
- **Disclosure checklist** (*Module 5 · extra*): automated replies say so; AI people labelled with "the platform's AI label and the caption"; "AI voices are labelled"; "No invented team members or customers".
- **Trust audit:** 14 items across Checkable / Recognisable / Honest proof / Calm answers, scored out of 28 (*Module 6*), repeated every three months (*Keep going*).

**For the social_content generator**, encode a3 (rules 1-10), the a4 7-step method and caption template, and the FNA disclosure checklist as system-level constraints. Use a1 as the post-type mix and a2 as the allowed format set.

---

## b. 100 Faceless Hooks: structure and library design

**JSON structure** (*100-faceless-hooks.json*). The top level has `slug`, `title`, `cover_title`, `tagline`, `cover_items` and `sections[]`. Each section has `label`, `heading`, `intro` and `blocks[]`, and each block has a `type` (list / steps / table / callout / checklist / worksheet / template), an optional `title` and `items` / `rows` / `text` / `fields`. The hooks are plain strings in `list` blocks, prefixed with their number (e.g. "1. Nobody tells you this about [topic]..."). **There are no per-hook fields, tags or format metadata.** Category comes only from the section.

| Section label | Block title (category) | Numbers | Count | Section intro (usage guidance) |
|---|---|---|---|---|
| Hooks 1-20 | Stop the scroll | 1-20 | 20 | "Use these on slide 1 of a carousel or the first two seconds of a text-on-screen reel." |
| Hooks 21-35 | Make them save | 21-35 | 15 | "Pair these with genuinely useful content: lists, templates, checklists and steps." |
| Hooks 36-50 | Make them comment | 36-50 | 15 | "Ask things you actually want to know, then reply to every comment you get." |
| Hooks 51-60 | Make them share | 51-60 | 10 | "Keep these warm and specific." |
| Hooks 61-70 | Build trust while faceless | 61-70 | 10 | "Use these only when the post shows exactly what the hook says." |
| Hooks 71-85 | Soft sell / lead to the offer | 71-85 | 15 | "explain who your offer helps and what is inside, without pressure." |
| Hooks 86-100 | Story slides | 86-100 | 15 | "Most of these work with a poll, quiz, slider or question sticker." |

**Count confirmed: exactly 100 hooks, numbered 1-100 with no gaps or duplicates** (checked by script). The file also contains:
- **20 CTAs** (*Calls to action › 20 comment KEYWORD calls to action*, "CTA 1." to "CTA 20."). These are not hooks and are excluded from `hooks.json`. Store them as a separate CTA library. CTA 2 and CTA 13 are HLE-specific (keyword FIT, the Fit Check).
- **5 worked examples** for hooks 7, 14, 22, 39 and 65. These are recorded in each hook's `notes` in `hooks.json`. The #22 example quotes the hook as "[Number] [templates] for [task]...", while hook 22 itself reads "[templates / scripts / prompts]".

**`hooks.json`** (100 objects): `id` = "hook-NNN" (the source number), `text` = verbatim with only the leading "N. " index removed, `category` = the block title, `tags` = [] (none in the source), `notes` = the worked example where one exists, otherwise "".

**Proposed searchable library** (a proposal, not in the source):
- Store `number`, `text`, `goal` (category) and `section_intro`.
- Store `placeholders[]`: parse the literal `[...]` tokens from the text, e.g. [topic], [side income idea], [product], [KEYWORD]. These are derivable without inventing anything.
- Include the full-text search index on `text`.
- Treat `audience_specific` as an owner-review field. Several hooks assume HLE's audience: "[side income idea]" appears widely; hook 12 "nap time", 33 "school pick-up", 53 "every mum", 60 "To the woman...".
- Add per-user "tried / result" fields to match the source's own tracking advice ("Hooks 1 to 100 are numbered so you can track which ones you've tried and how they went", *Start here*).
- Filter by goal, matching method step 1: "Choose the goal of this post".
- Recommended format per goal can be carried from the section intros above (e.g. Story slides → sticker).

---

## c. 30-Day Faceless Content Plan: structure and a 7-day launch slice

**Day fields.** *The plan: Your 30 days › Days 1-30* is a table with columns `Day | Format | Idea | Hook | Template / notes`. Format is a compound "Format · Type", e.g. "Reel (text) · Trust", "Carousel · Teach", "Stories · Show". Each day also has:
- **a caption template** in *Captions · Days 1-10 / 11-20 / 21-30*, titled "Day N · Format · Idea". Story days hold a "Story script (N frames)" plus an optional feed caption.
- **a story prompt** in *Stories: 30 daily story prompts*, a list of strings ("Day N: ..."). It runs "alongside your feed posts, including on reel and carousel days".
- **a tracker row** in *Track › Daily tracker*, with columns `Day | Format | Posted ✓ | Saves | Shares | Comments / DMs | What I noticed`.
- **a template code** (T01-T10) on carousel days (*Set up › Your carousel templates*).

Shared placeholders are defined once in *Set up: Fill your brackets once*: [audience], [outcome], [pain point], [topic], [niche keyword], [offer name], [price], [business name], @[handle], [KEYWORD], [free resource]. Day 15 also uses [deliverable], defined in *Making the plan fit your niche*.

Format counts (verified): 12 reels (days 1, 4, 7, 9, 12, 15, 18, 20, 23, 26, 28, 30), 10 carousels (2, 5, 8, 11, 14, 16, 19, 22, 24, 27) and 8 story days (3, 6, 10, 13, 17, 21, 25, 29). This matches the cover.

**Launch-specific days:**

| Day | Format · type | Role in the launch |
|---|---|---|
| 7 | Reel (text) · Sell | Early soft sell: "Soft sell... CTA: link in bio." |
| 21 | Stories · Sell | Interest check: "Would something like [offer idea] help you?" / "Tell them the offer details are coming next week." |
| 22 | Carousel · Teach | Bridge, T06: "Last slide: 'if you want [B], see my offer'" |
| **23** | Reel (text) · Sell | **"Launch day."** "Say what it is, who it's for, price, link in bio. Only mention a close date if it's real." |
| 24 | Carousel · Sell | T10 Offer / what's inside: "Price and link on the last slide." |
| 25 | Stories · Sell | Offer Q&A (caption lists "What's your refund policy? (Answer with your real policy.)") |
| 26 | Reel (b-roll) · Show | A peek inside the offer, by screen recording |
| 27 | Carousel · Trust | T09 Mini case study: "Your own real work only, with written permission. No made-up numbers." |
| 28 | Reel (text) · Sell | For / not for |
| 29 | Stories · Sell | Gentle recap: "Countdown sticker only for a real deadline." Story prompt: "One reminder only." |
| 30 | Reel (b-roll) · Trust | Reflection, then the day-30 review |

Week-4 callout: "Only mention a deadline, a limited number of spots or a launch price if it's real. No pressure, no fake countdowns." (*The plan*)

**Deriving a 7-day launch calendar.** Days 23-29 are exactly seven consecutive days and run from launch day to the recap. The mix is 3 reels, 2 carousels and 2 story days. Story prompts for those days come from *Stories* (Day 23 "Launch day. Three frames: what it is, who it's for, link sticker. Price included."). Points to adapt for a new Shopify store:
- **Day 27** needs real client work with written permission, which a brand-new store may not have. The plan's own guidance for a missing piece: "No offer ready yet? Use week 4 to share a free resource instead" (*Making the plan fit your niche*). A substitute is an owner decision.
- **Day 21** is pre-launch, so a pre-launch variant would be days 21-27.
- The plan assumes "a service or digital product" (tagline). The [deliverable] guidance covers services and digital products only, with no physical-product guidance. Day b-roll ideas "Packing or wrapping an order (if you send anything physical)" (*Film it*) is the only physical-goods reference.
- **Inconsistency to fix:** Day 13 plan row "Share the results the next day" vs Day 13 caption "On day 16, share the results" and story prompt Day 16 "Share the results from day 13's polls".

---

## d. Comment-to-DM Kit: method, templates, launch relevance and risks

**Method** (*comment-to-dm-kit › Start here › The whole thing in five moves*):
1. "You post a Reel or post that says: comment [KEYWORD] and we'll DM you [the thing]."
2. "Someone comments your keyword."
3. "Your tool (we use ManyChat in this kit) replies to the comment publicly..."
4. "It also sends one private DM to that person, with a button."
5. "They tap the button, and now the conversation is open..."

The design rule that follows from this: "every flow in this kit starts with a \"Send it to me\" style button. The tap opens the window, then the link arrives."

**Keyword rules** (*Step 1 › Keyword rules*): "One word. Short."; "Spell-proof"; "Distinctive. Common words like YES, INFO or LINK fire on comments that weren't meant for you"; "Linked to the thing"; add variations; use the exclude list; capitals in the caption; "One keyword per offer". The file also has 30 keyword ideas across 7 niches: VA, Etsy/printables, tutoring, bookkeeping, baking, Pinterest and digital products.

**Templates:**
- **Public replies** (*Step 2*): 5 rotating variations, e.g. "Sent! Check your DMs, [Name] 💌".
- **Flow 1, freebie** (*Flow 1*):
  - Message 1: "Hi [Name]! You asked for the [freebie name] 🙌 / Tap below and I'll send it straight over. / BUTTON: Send it to me"
  - Message 2: the link, a tip and a "Yes please / I'm good, thanks" choice
  - 3a: a soft paid mention ("No pressure at all, the freebie is yours either way.")
  - 3b: polite exit
  - optional follow-up "only within 24 hours"
  - optional email-consent ask
- **Flow 2, product link with a qualifying question** (*Flow 2*): quick replies "Just starting / Already doing [thing] / Just browsing". Message 2a gives "What's inside" and "Price" before the button. 2b honestly redirects ("might be a bit basic for you"). 2c offers a freebie. Then one follow-up and a polite exit. The callout: "tell people what's inside and the price before they click".
- **Flow 3, service enquiry to booking** (*Flow 3*): options, one qualifying question, a booking button, a pricing-only branch, one follow-up, an exit and a manual "Human handover".
- **Captions and stories**: 10 caption templates and 5 story-reply prompts (*Templates*). Story template 3 is "Countdown to launch (real date only)".
- **Tracker**: weekly columns Comments, DMs sent, Button taps, Link clicks, Sales or bookings, with "no target numbers here on purpose" (*Tracker*).

**Launch relevance.** High for the social side of a Shopify launch:
- Flow 2 maps directly onto "comment [KEYWORD] for the link" to a product page.
- Caption template 7 "The new product" ("It's here! The [product name] is ready ✨ / What's inside / Price / Comment [KEYWORD] for the link") fits launch day.
- Story template 3 fits a pre-launch countdown, for a real date only.

It is **not an email sequence**. Email appears only as an optional consent ask in Flow 1 ("only add people who said yes... consent and an unsubscribe link"). The app's launch email copy cannot be sourced from this kit.

**Compliance risks to flag:**
1. **Platform automation rules are third-party and dated "checked Oct 2026"** (Meta developer docs, ManyChat Help Centre). They cover:
   - one private reply within 7 days
   - a one-block first DM
   - the 24-hour window and the 7-day manual window
   - the 1,000-byte cap
   - Live comments

   The app must store these with source and check date and re-verify them. Some sources are weak: "Commonly advised by ManyChat community moderators"; a community moderator in July 2026; an "Inro guide".
2. **ManyChat pricing** (Essential US$14, Pro US$29, Free 25 contacts and 4 automations) is labelled EST and dated, but it is commercial data that changes ("plans changed in March 2026").
3. **Many items are explicitly UNKNOWN:**
   - active-contact counting
   - Free-plan delays and keyword caps
   - the ads trigger
   - native Instagram automation
   - sticker-tap triggers
   - whether "comment KEYWORD" posts are shown to fewer people
4. **Consent and spam:** "Don't message people who didn't ask"; "If someone asks you to stop, stop"; regulator pointers (ACMA, ICO, FTC, CRTC, DIA; "Canada's CASL is often mentioned"). Whether a DM counts as a commercial electronic message is left to the user. The app should not present this as legal advice.
5. **Engagement-rule risk:** "Don't paste the same public reply on every comment. ManyChat says Meta's systems watch for too many automated messages too quickly".
6. **Marketplace rule:** "Don't use DMs to move marketplace buyers to buy from you directly" (*Step 1 callout*). This is relevant to the future Etsy module.

---

## e. Starter kits as launch pathways

The four kits share one skeleton: Start here → choose niche/offer → templates and scripts → set-up checklists → a 30-day plan. **Only the Etsy kit is about selling products from a shop.** The other three are service businesses. Shopify is mentioned only as a client type:
- Pinterest: "Etsy and Shopify sellers" (*Start here › Who usually pays*)
- VA: "Order and supplier admin... Shopify and Etsy sellers" (*Step 1 › Starter service ideas*)
- Pinterest also mentions "their Shopify reports" (*Monthly client report callout*)

### Etsy Digital Downloads Starter Kit. Shopify relevance: indirect (Etsy is a future module)
Pathway (*Plan: Your 30-day plan › Week by week*, verbatim):
- **Week 1, "Choose a niche":** "List groups you know; write 5 niche ideas; run the search bar and page-one checks; fill in the scoring worksheet; pick one niche; check trademarks and licences."
- **Week 2, "Plan and design":** "Fill in the first-10-products plan; design the hero product; print-test it; ask 2-3 people in the niche for quick feedback; make the 'Start here' page."
- **Week 3, "Set up and list":** "Set up the shop and policies; check Etsy's fee page and fill in pricing worksheets; make mock-ups; list the hero and 2-4 more products; make pins for each."
- **Week 4, "Launch and learn":** "Send feedback messages; check listings after 3-4 days... list 2-3 more products; keep pinning; write down what you learned."

Launch checklist (*Checklist: Launch checklist*):
- **Shop set-up:** 7 items, including "Read Etsy's seller policy, prohibited items policy and intellectual property policy" and "Shop policies filled in, including how digital downloads and refunds work".
- **Each listing:** 8 items.
- **Launch week:** "First 3-5 listings live"; "Pins made for each listing"; "Feedback asked from 5-10 people in my niche"; "A note in my diary to review listings after 3-4 days".

Steps that could be adapted for Shopify (platform-neutral in wording; adapting them is a proposal):
- Step 1 niche scoring (8 criteria, "Total (out of 40)")
- Step 3 "What to avoid" (trademarks, copying, licences)
- Step 4 first-10 product family ("One hero product... Three to four close variations... Two to three companion products... One small bundle")
- the description structure ("WHAT YOU GET / HOW IT HELPS / HOW IT WORKS / PLEASE NOTE")
- the photo and mock-up checklist, which can feed image_briefs: "First image shows the product in use, not just a flat page"; "Product name or a 3-5 word benefit is readable at thumbnail size"; "No brand logos visible on devices, cups or props"
- file delivery and the "Start here" page

The Etsy-only steps (search bar, tags, Etsy messages, Etsy reviews) belong in the Etsy module.

### Pinterest Manager Starter Kit. Shopify relevance: service pathway; pin workflows reusable for store marketing
Pathway (*Plan: Your first 30 days*, Days / Focus / Done when):
- 1-3: set up your own account ("Profile, boards and 10 pins live")
- 4-6: niche and 10 brands
- 7-9: keyword workflow ("Keyword sheet with 30+ keywords")
- 10-12: 10 practice pins
- 13-14: 3 packages and founding prices
- 15-16: registration and tax
- 17-19: public-profile audit of 5 brands
- 20-21: send five openers
- 22-25: free audit through "warm routes only"
- 26-28: agreement checked; make the ask
- 29-30: onboard and "save their analytics baseline"

For a Shopify store's own marketing, two parts are reusable: the keyword research workflow (10 steps, *Workflow*) and the pin design checklist ("Vertical format: a 2:3 ratio, such as 1000 x 1500 pixels (FACT, checked Oct 2026...)", *Checklist*).

### Tutor & Lesson Starter Kit. Shopify relevance: none stated
Pathway (*Plan: Your 30-day plan*):
- **Week 1 "Decide and check":** "Choose subject and student type; decide platform, direct or both; read platform terms; check working-with-children or background check rules if teaching under-18s; research rates."
- **Week 2 "Set up":** "Write lesson plan and first-lesson structure; set up video, booking and payment for direct students; adapt the cancellation policy; create a platform profile..."
- **Week 3 "Trial lessons":** "Send trial invitations... run trials with the script; make the ask the same day; send welcome messages."
- **Week 4 "First regular students":** "Teach first paid lessons; keep notes; adjust your plan from feedback; send follow-ups; ask for referrals; review pricing and time per lesson."

The pathway also includes the "Direct students: set-up checklist" (9 items, *Set-up*) and safeguarding steps (*Safeguarding*), which must come before any work with under-18s.

### VA & OBM Starter Kit. Shopify relevance: service pathway; some SOPs useful to store owners
Pathway (*Plan: Your first 30 days*):
- 1-3: 2-3 services and a one-sentence offer
- 4-6: floor rate and founding rate
- 7-8: one-page services menu
- 9-10: registration and tax
- 11-12: email, password manager, task and time tools
- 13-14: list of five people
- 15-16: send five openers
- 17-20: discovery calls; follow up once
- 21-23: agreement template checked
- 24-26: "Start a paid two-week pilot"
- 27-30: SOPs and first weekly report

SOPs a Shopify owner could reuse for their own admin (a proposal): "SOP: Supplier and order follow-up (weekly)", "SOP: Review requests (weekly)" ("Never write or post reviews on the client's behalf"), "SOP: Email newsletter preparation" ("only to people who have opted in") and "SOP: Social media scheduling".

---

## f. Brand system (for app adoption)

**Version note.** `PRINT_STYLE.md` is "v2, Oct 2026"; `visual-identity.html` is "Brand book · visual identity · v1 · October 2026". Where they disagree, v2 is presumably newer. That's an inference, so confirm with the owner.

### Colour tokens
| Token (README) | PRINT_STYLE.md name and role (verbatim) | visual-identity.html | Hex |
|---|---|---|---|
| aubergine | "aubergine #43252C (headlines, cover background, buttons)" | `--aubergine`, "Headlines, dark posts, buttons" | #43252C |
| ivory | "ivory #F7F2E9 (page/cover alt background)" | `--ivory`, "Page and post background" | #F7F2E9 |
| paper | "paper #FFFCF7 (cards)" | `--paper` (cards and templates) | #FFFCF7 |
| blush | "blush #EACACB (soft panels, callouts)" | `--blush`, "Soft panels, series covers" | #EACACB |
| rose | "rose #DA5265 (one accent word/stroke, large text only)" | `--rose`, "One word, one line, one tag" | #DA5265 |
| ink | "rose-ink #B8384C (accent text at small sizes)" | no token; hard-coded `#B8384C` (Caveat text) | #B8384C |
| char | "charcoal #242122 (body text)" | `--charcoal`, "Body text, Nonsense Watch posts" | #242122 |
| line | "line #E3D8CF" | `--line` | #E3D8CF |
| mute | "mute #564B4E" | **`--mute:#6E6264`** (conflict) | README/PRINT_STYLE #564B4E |

Rules:
- "No black (#121012) backgrounds and no hot pink (#D0245C / #E0316B / #FF4D85) anywhere any more." (PRINT_STYLE)
- "Rose is a highlight, never a background for body text." / "Rose on ivory reads at large sizes only (headlines and tags), so body text is always charcoal or aubergine." (HTML › 01)
- Proportions across nine posts: "ivory 55%, aubergine 25%, blush 12%, charcoal 5%, rose 3%" (HTML › 01)

Token-name mismatches: README `char` vs PRINT_STYLE/HTML "charcoal", and README `ink` vs PRINT_STYLE "rose-ink". Pick one naming set for the app.

### Font roles
| Role | PRINT_STYLE.md (v2) | visual-identity.html (v1) |
|---|---|---|
| Display | "Bodoni Moda variable... use weight 800, and set font-optical-sizing:none; font-variation-settings:\"opsz\" 18 so hairlines aren't too thin. Italic 700 for the one emphasised word." | "Bodoni Moda, Bold... headlines, covers" (CSS weight 700); "Bodoni Moda, Italic... one word per headline" (500). "Canva free: Playfair Display" |
| Body | "Lora... at weight 500 for reading text in PDFs; or Inter... weight 500 for UI-like text, tables, labels." | "Lora, Regular... captions on posts, emails, long copy" |
| Labels | "Inter 700, uppercase, letter-spacing .2em, small." | "Inter, Semibold, tracked... running heads, buttons, data" (600, .24em); Canva "letter spacing 200" |
| Handwriting | "Caveat 600... sign-offs only, max six words... colour rose-ink" | "Caveat, Semibold... Vee's hand · sign-offs and one-line notes only, never more than six words" |
| Numbers | "ALL numbers (prices, page numbers, counters, tables): Lora or Inter, never Bodoni (its numerals look odd). Use font-variant-numeric: lining-nums." | not stated |

Conflicts: Bodoni weight 800 (v2) vs 700 (v1); Lora 500 vs Regular; label weight and tracking (700/.2em vs 600/.24em).

PRINT_STYLE font paths point to `file:///home/claude/brandbox/node_modules/...` and are not portable. `03_brand/fonts/` holds:
- bodoni-moda opsz normal and italic
- caveat 600
- inter 500, 600 and 700
- lora 500 normal and italic, and lora 700

Lora 400/600 and Inter 400, named in PRINT_STYLE, are not in the folder.

**Post scale** (HTML › 02): "Scale for posts (1080 × 1350): headline 96–140 px, sub-headline 54 px, body 34 px, labels 22 px with wide tracking. Never more than two sizes of Bodoni on one slide."

### Devices (recognition)
- **PRINT_STYLE:** "running head \"HER LITTLE EMPIRE\" (Inter label) top-left with product/series name top-right; a thin rule above a short italic Lora footnote; one rose word or stroke per page at most."
- **HTML › 04:** "The running head", "The numbering" ("Every series is numbered: No. 03, 04 of 23, 01 / 08"), "The footnote" ("the source, the caveat or a dry joke. It's the brand's signature."), "One rose word" ("never more").
- **Components (PRINT_STYLE):**
  - Callouts: "blush background, charcoal text, label \"Good to know\" in rose-ink"
  - Templates: "paper background, 1px line border, label \"Copy and adapt\" in rose-ink"
  - Tables: "no fills; header row Inter 700 uppercase small with 1.5px charcoal bottom border"
  - Cover: "aubergine background, ivory Bodoni title..., blush italic emphasis word..."

### Voice and tone
- **PRINT_STYLE:** "Tone: modern women's publication meets intelligent business brand. Calm, editorial, generous margins. No AI people, no stock photos."
- **HTML cover:** "A modern women's publication that happens to be a business brand. Aspirational enough to want to belong to, rigorous enough to trust, witty enough to share."
- **Taglines:** "Big plans. Real life." / "Ideas. Income. On your terms." / "Same woman. Bigger options." / "Ambitious. Unavailable for nonsense." Note: these are HLE's own lines, not for user stores.
- **Motion (HTML › 06):** "Reels move at reading pace. The brand never shouts, flashes or uses countdown energy." Audio: "Vee's voice where possible; otherwise calm music from the business-safe library."
- **Nonsense Watch:** "we never name individuals. We do name tactics."

### Do and don't (HTML › 05 · Imagery)
**Shoot and use:**
- "Your hands writing, typing, holding a printed page"
- "Real products: printed kits, screen recordings of the Fit Finder"
- "Natural light, cafe tables, a kitchen bench at 9am, books and notebooks"
- "Travel and everyday details: a train window, a beach path, a library"
- "Warm, slightly muted grade; grain is fine"
- "Stock photos only with a model release, and never presented as Vee"

**Never use:**
- "AI-generated women or AI \"lifestyle\" photos"
- "Laptop-on-the-beach, champagne, cash, cars or luxury props"
- "Overly glossy stock with forced smiles"
- "Anyone presented as the founder who isn't"
- "Children's faces or anything that locates your home"
- "More than one photo-led post in a row on the grid"

**"The two-second check" (HTML › 08):**
- Recognisable: "Running head, series colour and footnote are in place"
- One accent: "Rose used once, or not at all"
- Honest: "Every number labelled fact, estimate or unknown; nothing promised"
- Real: "No AI people; any person shown is real and isn't presented as Vee"
- Readable: "Body text charcoal or aubergine on ivory or blush; nothing small on rose"
- Grid: "Next to a different colour than the post before it"

### Brand-file flags
1. **Compliance:** the HTML footer reads "Her Little Empire is a trading name of [the former trading entity] · ABN 38 813 430 864 · Australia · [the former contact address]". This breaks "Do not mention [the former trading entity] anywhere", and the email differs from hello@herlittleempire.com. Do not ship this footer.
2. **Stock photos:** HTML allows "Stock photos only with a model release" but PRINT_STYLE v2 says "no stock photos".
3. **Fit Test question count:** the HTML sample says "17 questions · 23 researched ideas" while the README says a "20-question quiz". The figures conflict.
4. **Trademark:** HTML uses "Her Little Empire™". Trademark status is unknown.
5. **Sample figures:** "About 3 hrs a week · about US$70 to start (est.)" (The Series sample) is labelled est. but undated. The Receipts sample footnote says "illustrative layout".

**Adoption proposal for Empire Studio.** Use the README hex values and PRINT_STYLE v2 roles for the app's own chrome. User-store brand kits should be separate: the FCS "My grid style" worksheet and the FNA "My look" worksheet are the user-facing equivalents.

---

## g. Duplication and the proposed authoritative versions

| Shared method | Where it appears | Proposed authoritative source | Distinctive material to keep from the others |
|---|---|---|---|
| Format taxonomy | FCS M1 (6 formats); 30-Day Formats (4); Hooks Start here (reels, carousel covers, story slides); brand 6 series | **FCS "Six faceless formats"** as the canonical set, plus **Stories** from 30-Day as a placement | 30-Day's per-format "Quick how-to" (clip lengths, text lines, 3-5 frames); FCS "Effort" column; brand series as optional visual layouts |
| Hook taxonomy and library | FCS M2 (4 kinds, 4 formulas, hook bank); 100 Hooks (7 goals, 100 hooks); 30-Day (30 day-hooks) | **100 Faceless Hooks** (7 goals, numbered) | FCS's 4 reusable formulas ("Name her moment..."); FCS "write ten, keep three" exercise; 30-Day's day-hooks as launch/calendar-specific hooks tied to day rows |
| Post / caption structure | Hooks "From hook to post in 7 steps"; FCS caption template; 30-Day "What makes a good faceless post" and 30 caption templates | **Hooks 7-step method + FCS caption template** as the generator recipe | 30-Day's 30 day-specific caption templates (as examples); FCS "Honest caption check" |
| Honesty / anti-hype rules | FCS Honest caption check; Hooks What not to do and CTA rules; 30-Day platform rules; FNA Remove the hype, labelling table, disclosure checklist | **FNA Module 4 and Module 5 · extra** (the most complete; matches README rules) | Hooks' "Hook and run" and "story that isn't yours"; 30-Day accessibility checklist (unique) |
| B-roll / "25 things to film" | FCS M1 (25 items); 30-Day Film it (25 items, different); brand shot list ("10 hands-writing shots, 5 desk flat-lays...") | **Merge the FCS and 30-Day lists**, de-duplicated (overlaps include laptop typing, to-do list, ticking a checklist, sticky notes, printing a page, timer, closing laptop, rain on window, slow pan) | 30-Day filming tips (window light, 5-10 s holds, 9:16, privacy check); brand "Never use" list as negative constraints for image_briefs |
| Comment-to-DM | C2DM Kit (full); FCS M4 (condensed); Hooks CTAs and rules; 30-Day Set up callout | **Comment-to-DM Kit** (dated, sourced) | FCS follow-gate note ("off by default... compare a week with it and a week without"); Hooks' 20 CTAs as the CTA library |
| Metrics and review | FCS M6 (5 numbers: Reach, Sends, Saves, Follows, Link clicks/keyword comments; "about seven days"; Keep/Tweak/Drop "after 3 tries"); 30-Day Track (Saves, Shares, Comments/DMs; "a day or two after"; Keep/Change/Drop); C2DM tracker (comments → sales) | **Owner decision needed.** The timings conflict (7 days vs 1-2 days). FCS's five-number set is the more complete feed-post metric set; C2DM's funnel columns are unique | 30-Day day-30 review questions; FNA quarterly re-audit for trust |
| Time model / cadence | FCS "two-hour week" (3 reels, 1 carousel, 1 quote weekly + stories 3+ days); 30-Day "30-45 minutes a day" or "3-4 hours a week" batch; Hooks practice "20-30 min a day (EST)" | **30-Day for launch calendars** (daily cadence); **FCS for ongoing weekly cadence** | All effort figures need EST labels (only the Hooks plan has them) |
| Grid and recognition | FCS M3 grid planner ("No two neighbours the same colour"); FNA M3 look/voice/signature; brand two-second check ("Next to a different colour than the post before it") | **FNA Module 3** for the user's own brand recognition; **FCS 9-post grid planner** as the interactive tool | Brand rules govern HLE's own content only |

**Faceless Not Anonymous** is mostly distinct from the content-production files: the trust stack, trust audit, founder note, boundaries replies, refund/contact templates and ask-a-friend script are unique. It should be the authoritative trust and guardrail layer, but needs owner review of its family-detail examples ("mum of one on the coast of NSW", "for my family's sake").

**Pricing and cataloguing.** FCS and FNA are absent from `catalog.py`, so their price, bundle and sale status are unknown. The Faceless Content Bundle (US$29) contains 100 Faceless Hooks, the 30-Day plan, the Comment-to-DM Kit and Get Found (out of scope). Its worth is 9 + 17 + 12 + 7 = US$45, as computed from the PRICE values in `catalog.py`.
