# Income Fit Test kit: methods for software conversion

Sources are relative to `hle/01_income-fit-test/`. "PDF" quotes come from `pdftotext -layout`. "WB" means `kit/01_Workbook.xlsx` (sheet!cell). Cached values are the ones stored in the xlsx with its pre-loaded inputs. A Python re-implementation of the Fit Finder (sim, not shipped) reproduced the cached top three exactly (34/33/32) and the 12 filtered options.

---

## a. Go / No-Go Scorecard: exact criteria, scales, gates, verdicts

Sources: `kit/05_Go_No_Go_Scorecard.pdf` pp.2-3 and WB `3 Scorecard`. The PDF and the WB agree on the logic. Wording differences are noted.

### Offer type (input)
PDF: "Tick the kind of offer you tested: □ Service □ Product □ Slow-buying market (B2B retainers, approvals, high-ticket packages)."
WB C5 list: `Service, Product, Slow-buying market`. WB D5: "Slow-buying: B2B retainers, anything with approvals, high-ticket packages — commitments take longer than 14 days."

### Twelve questions, each an integer 0-3 (PDF wording; WB cell in brackets)

| # | Area | Question (PDF) | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|
| 1 | Evidence of need [C7] | How many of your real conversations described the problem your offer solves, without you leading them? | none | a few | about half | most |
| 2 | Reach [C8] | How many real conversations did you have with people who fit your customer type? | under 3 | 3-4 | 5-9 | 10 or more |
| 3 | Quality of feedback [C9] | Did people give specific, usable reactions (what they'd change, when they'd need it, what they'd pay), or politeness? | politeness only | mostly vague | some specifics | specific and consistent |
| 4 | Purchase interest [C10] | How many asked about price, timing or how to book without being prompted? | none | one | two or three | four or more |
| 5 | Commitments [C11] | Bookings, orders, paid deposits or firm dated 'yes' from the Day 12 test. | none | one | two or three | four or more |
| 6 | Start-up cost [C12] | How does the start-up cost from your calculator compare with your budget? | over budget | all of it | about half | well under |
| 7 | Profitability on paper [C13] | At your hours, the moderate-scenario effective hourly return compared with what you would accept. (WB B13: "Base-scenario effective hourly return against what you would accept") | below half of it | below it | about it | above it |
| 8 | Time reality [C14] | Hours actually spent over 14 days compared with the hours you said you had. | far more | somewhat more | about right | less |
| 9 | Operational complexity [C15] | Approvals, checks, inventory, tools or platforms still standing between you and delivering. | several, slow (WB: "several") | one significant | minor | none |
| 10 | Personal suitability [C16] | How did the work itself feel over the 14 days? | dreaded it | tolerated it | fine | looked forward to it |
| 11 | Ability to find customers [C17] | Could you reach the right people yourself, through channels you can repeat? | only via friends | with difficulty | yes, slowly | yes, repeatably |
| 12 | Willingness to continue [C18] | Knowing what you know now, do you want to do another 14 days of this? | no | reluctantly | yes | definitely |

Total: "Total (of 36) — context only, not the verdict" (PDF). WB C20 `=SUM(C7:C18)`.

### The gates, in order (PDF p.3, verbatim)
> The verdict is not the total. Enjoying the work and being able to afford it never produce a positive verdict on their own; only evidence that people want to buy does.
> 1. Gate 1 — enough evidence? Reach scored 0 or 1 (fewer than five real conversations) → INSUFFICIENT EVIDENCE. Stop here. A small or badly targeted sample cannot prove an idea will never work; it can only tell you that you have not found out yet.
> 2. Gate 2 — do you want to continue? Willingness scored 0 → STOP, whatever the numbers. That is allowed.
> 3. Gate 3 — demand gate. Service: Purchase interest 2+ and Commitments 1+. Product: Commitments 1+ (an order or pre-order) and Purchase interest 1+. Slow-buying market: Purchase interest 2+ and Quality of feedback 2+; commitments may come after 14 days.
> 4. If the demand gate passes: total 24 or more → NEXT TEST; under 24 → ADJUST (demand is there; something practical is weak).
> 5. If the demand gate fails: Purchase interest 1+, or Evidence of need 2+ together with Quality of feedback 2+ → ADJUST. Otherwise → STOP.

### WB formulas (the deterministic implementation)
```
C21 (demand gate) =IF($C$5="Service",AND($C$10>=2,$C$11>=1),
                    IF($C$5="Product",AND($C$10>=1,$C$11>=1),
                       AND($C$10>=2,$C$9>=2)))          // any other value = slow-buying
C23 (verdict)     =IF($C$8<2,"INSUFFICIENT EVIDENCE",
                    IF($C$18=0,"STOP",
                     IF(C21, IF($C$20>=24,"NEXT TEST","ADJUST"),
                      IF(OR($C$10>=1,AND($C$7>=2,$C$9>=2)),"ADJUST","STOP"))))
```
Pseudocode:
```
def verdict(kind, need, reach, quality, interest, commit, startup, profit, time, complexity, suit, find, willing):
    total = sum(all 12)
    if reach < 2: return "INSUFFICIENT EVIDENCE"
    if willing == 0: return "STOP"
    if kind == "Service": gate = interest >= 2 and commit >= 1
    elif kind == "Product": gate = interest >= 1 and commit >= 1
    else: gate = interest >= 2 and quality >= 2       # Slow-buying market
    if gate: return "NEXT TEST" if total >= 24 else "ADJUST"   # ADJUST variant A
    return "ADJUST" if (interest >= 1 or (need >= 2 and quality >= 2)) else "STOP"  # ADJUST variant B
```
The two ADJUST variants have different next-step text (WB B26 uses `IF(C21, ...)`).

### Next-step text per verdict
WB B26, verbatim. The PDF boxes are near-identical; the PDF wording is in brackets where it differs.
- INSUFFICIENT EVIDENCE: "You spoke to fewer than five people who fit. That is not a no; it is not enough information. Next 14 days: Days 9-12 again with a different channel or a sharper customer type, aiming for five to ten real conversations. Do not spend money on the idea yet." (PDF adds: "If a second round still cannot reach five people, the problem is reach, and that is itself an answer about this option for you.")
- NEXT TEST: "Real people showed buying interest and at least one committed. Next 14 days: reach new people through a channel you can repeat (not friends), keep the same offer unless Day 11 gave you a clear change, and make the first small paid upgrade only if it unlocks delivery (insurance, a listing, a tool). Measure the same five numbers again before adding hours." (The PDF omits "(insurance, a listing, a tool)".)
- ADJUST, gate passed: "Demand is there but something practical is weak. Find the lowest score among start-up cost, profitability, time reality, complexity and finding customers, change that one thing, and run a second 14 days."
- ADJUST, gate failed: "Interest or feedback exists but nobody committed. Change the single most likely cause — price, the offer, the customer type or the channel — and run Days 7-12 again. Two ADJUST rounds without a commitment is a STOP."
- STOP: "With five or more real conversations and no buying interest, this approach does not justify more time or money. That is a result, not a failure: you found out for the price of this kit and 14 days. Go back to the Fit Finder, update any answers the 14 days changed (contact comfort, hours, what you enjoyed), and choose from your other two options." (The PDF omits the parenthesis.)

Not implementable from the inputs: "Two ADJUST rounds without a commitment is a STOP" needs a round counter. Neither source stores history.

### Worked example (verbatim inputs: WB `3 Scorecard` defaults; check in WB `Audit` row 25)
Kind = Service; need 2, reach 2, quality 2, interest 1, commitments 0, start-up 2, profitability 2, time 2, complexity 2, suitability 2, find 2, willingness 2.
Cached: C20 total = **21**; C21 = **FALSE**; C23 = **"ADJUST"**; B26 = gate-failed ADJUST text.
Audit B25: "Scorecard: sample (reach 2, interest 1, commitments 0, service) returns ADJUST, not NEXT TEST" → Expected "ADJUST", PASS.

Suggested unit tests (derived from the rules above):
- reach=1, everything else 3 → INSUFFICIENT EVIDENCE (Gate 1 runs before everything).
- reach=2, willing=0, interest=3, commit=3 → STOP.
- Service, interest=2, commit=1, total=24 → NEXT TEST; the same with total=23 → ADJUST (gate passed).
- Product, interest=1, commit=1 → gate passes; Product, interest=0, commit=1 → gate fails → STOP unless need≥2 and quality≥2.
- Slow-buying, interest=2, quality=2, commit=0 → gate passes.
- Gate failed, interest=0, need=2, quality=2 → ADJUST; interest=0, need=1, quality=3 → STOP.

### Workflow 11 example (ai-shortcut-system, verbatim)
"Evidence supports ADJUST, agreeing with the scorecard. One commitment, two interested, trust objection twice: keep the offer, add the trial-with-exit, and run Days 9-12 again with ten new people from the clinic group. You may be over-weighting the one enthusiastic friend."
Note: for a Service with interest=2 (two interested) and commit=1, the demand gate passes, so the verdict is ADJUST only if the total is <24. The example re-runs Days 9-12, while the scorecard's gate-passed ADJUST says "run a second 14 days".

---

## b. 14-Day Test Plan, day by day

Source: `kit/04_14_Day_Test_Plan.pdf`, one page per day. "Output" is the "EXPECTED OUTPUT — SAVE THIS" box, verbatim; time comes from the page header.

| Day | Title (time) | Objective | Core task (3 steps) | Output | Open today |
|---|---|---|---|---|---|
| 1 | Map your hours and constraints (30 min) | Know exactly what time, money and conditions you are working with, so every later choice fits them. | 1. Write down the hours you can give this each week and which days and times they fall in. Be honest about pick-up, after-school activities and the days that always go wrong. 2. List your hard limits: no evenings, no phone calls, no stock in the house, nothing that needs a car, a ceiling on what you can spend to start. 3. Run Workflow 1 to turn your background into skill areas, then answer Fit Finder questions 1-12. | Your hours, limits and budget written at the top of this page, and Fit Finder questions 1-12 answered. | Workflow 1 · Fit Finder questions 1-12 |
| 2 | Run the Fit Finder (40 min) | See your three best-fit options and understand why they scored the way they did. | 1. Answer questions 13-15 and read your three results. Read the 'why it scores well' and 'what to check' lines for each. 2. Change one answer you were unsure about and see what moves. Put it back. 3. Read the one-page card for each of the three. Note the start-up cost, the rules and the first action. | Three options, each with one line on why it fits and one line on its biggest catch. | Fit Finder · Opportunity Cards |
| 3 | Choose one, Milestone (20 min) | Commit to one option for the rest of the 14 days. Not forever; for 11 more days. | 1. For each of the three, answer: Could I do the first practical action this week? Would I be glad to still be doing this in six months? Can it be tested in 14 days, or does it need an approval, a check or inventory first? 2. Pick the one with the most honest yeses. If two tie, pick the faster first dollar. 3. Write the option and the reason here. Write the other two below it; you may come back. | One chosen option, one sentence of reasoning, and the two you set aside. | Opportunity Cards · this page |
| 4 | Research the customer (45 min) | Describe the specific person or business who would pay, what triggers them, and what they do instead today. | 1. Run Workflow 2 with your option and your area. 2. Check anything it states as a fact about your area: find the group, the directory, the provider. Strike what you cannot find. 3. Write your main customer type and their trigger in one sentence. | One customer type, its trigger, where they already look, and five questions to ask on Day 10. | Workflow 2 |
| 5 | Look at competitors and substitutes (45 min) | Know what already exists, what it charges, and where there is room. | 1. Spend 20 minutes searching the way your customer would: the marketplace, the local group, a search engine. Note 3-6 providers, their prices and what they emphasise. 2. Run Workflow 3 with your notes. Let it organise, not invent. 3. Write the free alternative, the gap you found, and a price range to test. | A short competitor table, the free alternative, one gap, and a price range. | Workflow 3 |
| 6 | Run the Reality Calculator (45 min) | See profit before tax and your real hourly return at your hours, before you spend anything. | 1. Run Workflow 4 to itemise start-up and monthly costs from your card. Check every '(check)' item. 2. Open the Reality Calculator. Enter your price, the three cost totals and your hours. Read the moderate scenario and the 5/10/15 table. 3. If the effective hourly return at your hours is below what you would accept, change the price or the hours and look again. If it still does not work, note that now; it is a Day 14 signal. | Moderate-scenario profit per month, effective hourly return, and breakeven, written here. | Workflow 4 · Reality Calculator |
| 7 | Define your minimum offer (30 min) | One sentence that says who it is for, what they get, and the price. | 1. Run Workflow 5 with your customer, your gap and your price. 2. Read the sentence aloud. If you would not say it to a neighbour, simplify it. 3. Write the included / not-included list and the one question you will ask before quoting. | Your one-sentence offer, the included / not-included list, and three honest objection answers. | Workflow 5 |
| 8 | Make the simplest honest sample (60 min) | Have one thing to show that proves you can do the work. | 1. Run Workflow 6. Pick the sample you can make in under three hours. 2. If your option cannot be delivered in 14 days (approval, screening, inventory, licence), take the demand-test version instead and note that your Day 12 will measure interest, not sales. 3. Make it. Photograph or save it. | One sample or demonstration, plus an honest one-paragraph description that says you are new. | Workflow 6 |
| 9 | Plan who you will talk to (45 min) | A list of 10-20 real people or businesses and a first message that asks for a conversation, not a sale. | 1. Run Workflow 7. Group your contacts: people you know, one step away, strangers in the right places. 2. Read the rules of any community group before you post anything. If member offers are not allowed, do not post one. Message people one at a time: in Australia and Canada even one unsolicited commercial email can need consent (Spam Act, CASL), the UK has PECR, and in the US CAN-SPAM requires an opt-out. Never use bought or scraped lists. 3. Send the first messages to the people you know today. | Your contact list with daily targets, three message drafts, and the first messages sent. | Workflow 7 |
| 10 | Talk to real prospects, Milestone (60 min) | Five or more real conversations with people who fit your customer type. | 1. Work through your list. Ask the five questions from Day 4. Listen more than you talk; do not sell yet. 2. After each conversation, write three lines: who they were, what they said, whether they asked about price or booking. 3. In the evening, run Workflow 8 with your notes. | Notes from every conversation and a first count: how many showed real interest. | Workflow 8 (evening) |
| 11 | Collect feedback and objections (45 min) | Hear the objections in the customers' own words and decide whether to adjust the offer before the test. | 1. Continue conversations and follow-ups until you have at least five real ones (ten is better). 2. Run Workflow 8 again with all your notes. Read the objections list twice. 3. Make one small change to the offer or price if the notes justify it. Record it. | Counts: reached, conversations, interested, no. The top three objections, verbatim. Any change to your offer. | Workflow 8 |
| 12 | Run a small sales or preorder test (45 min) | Find out whether anyone will pay, or (for options that cannot be delivered yet) whether anyone will commit. | 1. Run Workflow 9 to write the listing, post or message. Include the price, that you are new, and how to book or pay. 2. Put it in front of the people who showed interest and, where rules allow, the place from Day 4. Use a real payment or booking link if you can deliver; otherwise ask for a firm 'yes, book me when you're ready' with a date. 3. Record every view, reply, booking and payment here as they happen. | The test is live. Replies, bookings and payments recorded with times. | Workflow 9 |
| 13 | Count interest, costs and hours (45 min) | Turn 13 days of notes into numbers. | 1. Add up: reached, conversations, interested, committed, paid, money in, money out, hours spent. 2. Run Workflow 10 with the lot. Read the sample-size paragraph before anything else. 3. Compare money in and hours spent with the calculator's moderate scenario. Note the gap. | A results table with conversion rates, the test's effective hourly result, and a one-paragraph summary. | Workflow 10 · Reality Calculator |
| 14 | Go, adjust or stop, Milestone (45 min) | Decide with evidence, and know the next experiment whichever way it falls. | 1. Fill in the Scorecard with your Day 13 numbers and your own honest answers. Read the sample-size rule first. 2. Open the workbook's '3 Scorecard' sheet (or this PDF's gates), then run Workflow 11 with the verdict and your results. Let it argue with you. 3. Write the decision and the next experiment here. If STOP, go back to the Fit Finder with what you learned about yourself and pick from the two you set aside. | NEXT TEST, ADJUST, STOP or INSUFFICIENT EVIDENCE, in writing, with the next 14-day experiment named. | Go / No-Go Scorecard · Workflow 11 |

Optional stretches (verbatim):
- D1: write down what you'd need to earn a month for this to be worth it — as context, not a target.
- D2: read the Options sheet to see why two options you expected were filtered out.
- D3: tell one person which option you chose; saying it aloud is a commitment device.
- D4: find one online place where your customers already talk (a group, a forum) and read for 15 minutes without posting.
- D5: note the single thing every competitor says about themselves; you will not say it.
- D6: change the price in the calculator until the base-scenario hourly return is one you would accept; write that price down.
- D7: ask one person who fits your customer to read the sentence and say what they think it means.
- D8: photograph the sample properly in daylight; it becomes your Day 12 image.
- D9: schedule the next three days' messages so they go out in the morning, when replies are likelier.
- D10: send a two-line thank-you to everyone you spoke to; it keeps the door open for Day 12.
- D11: write the objection you heard most as a sentence you can say back with its honest answer.
- D12: ask one interested person what would have made them say yes today.
- D13: compare your hours log against your Day 1 estimate; the gap is a Scorecard answer.
- D14: write the first line of the next experiment's Day 1 page while it is fresh.

"Waiting is part of it" callouts appear on D10 ("Send on Day 10; expect most answers by Day 12 and some after Day 14. Count conversations, not sends."), D11 ("If you have fewer than five conversations yet, keep sending; do not fill the gap with friends who are not customers.") and D12 ("A firm, dated yes counts as a commitment; so does a deposit.").

Phases: Days 1-3 map, run the Fit Finder, choose; Days 4-9 research, calculate, define, prepare; Days 10-12 talk to real prospects and run a small test; Days 13-14 count, then decide. Milestones: Days 3, 10 and 14. Progress text format: "Progress: N of 14". Rule: "If you miss a day, do not double up; just continue."

---

## c. Workbook formulas and calculators

WB has 9 sheets and 795 formulas. Constants: weeks per month = 52/12 = 4.333… (2A C16, 2B C19; "Fixed: 52 ÷ 12"). Every calculator output is wrapped `IF(NOT(<all-filled flag>),"enter a value", …)`.

### c1. Country and currency (Options BB2:BD7, BF2, BG2)
| Country (Fit Finder C4) | Symbol | Rate per AU$1 |
|---|---|---|
| United States | US$ | 0.6928 |
| United Kingdom | £ | 0.5243 |
| Canada | C$ | 0.9891 |
| Australia | A$ | 1 |
| New Zealand | NZ$ | 1.2362 |
| Somewhere else (use US$) | US$ | 0.6928 |

`BF2 = IFERROR(INDEX(BC, MATCH(country, BB, 0)), "US$")`, `BG2 = IFERROR(INDEX(BD, MATCH(...)), 0.6928)`. The rate is applied to Options K (AU$ start-up) for budget comparisons. The displayed start-up is `ROUND(K * BG2, -1)` (nearest 10). The currency symbol is concatenated into labels.

### c2. Fit Finder inputs ('1 Fit Finder' C4-C24) with defaults and allowed values
| Cell | Question | Default | Allowed values |
|---|---|---|---|
| C4 | Where you live (sets your currency) | Australia | list above |
| C6 | Hours you can give this each week (number) | 10 | decimal ≥0 |
| C7 | Your typical work block in hours (1, 2, 3 or 4) | 2 | 1, 2, 3, 4 |
| C8 | Could you work some evenings or weekends? | No | Yes / No |
| C9 | What matters most right now? | Flexibility | Money soon / Flexibility / Building something over time |
| C10 | Do you need first income within 8 weeks? | Yes | Yes / No |
| C11 | Start-up money you could spend (A$; 0 is fine) | 150 | decimal ≥0 |
| C12 | Do you have a car you can use? | Yes | Yes / No |
| C13 | Do you have spare space (garage, shed, room)? | No | Yes / No |
| C14 | Willing to get checks or registrations if an option needs them? | Yes | Yes / No |
| C15 | How much customer contact suits you? | Phone or video calls | None / Messaging only / Phone or video calls / In person (→ 0, 1, 2, 3) |
| C16 | Prefer selling products or services? | Services | Products / Services / Either (**not used in scoring**) |
| C17 | Prefer recurring clients or one-off projects? | Recurring | Recurring / Project / Either (**not used in scoring**) |
| C18 | Comfort with technology | Medium | Low / Medium / High (→ 1, 2, 3) |
| C19 | Your main skill area | Professional | Professional, Admin, Creative, Teaching, Practical, Writing |
| C20 | A second skill area (optional) | Writing | same list + blank |
| C21 | Remote work only? | Yes | Yes / No |
| C22 | Happy to appear on camera (video lessons or filmed content)? | Yes | Yes / No |
| C23 | Optional: monthly income goal (display only) | 500 | decimal ≥0 |
| C24 | Optional: anything else about your week (free text, unused) | "Pick-up 2:45 every day; Wednesdays are out." | text |

Per-option data (Options A-X, BH) is identical to `opportunities.json` (`id, name, group, min_hours=D, block_hrs=E, evenings=F, remote=G, car=H, space=I, checks=J, mincap=K, contact=L, psa=M, rp=N, weeks=O, evidence=P, tech=Q, skill=R, tag1=S, tag2=T, demand=U, leverage=V, competition=W, pitching=X`; camera BH = id ∈ {1, 2, 13}).

### c3. Per-option scoring (Options row r; uniform across rows 2-24; "u." means a user answer)
Let `CN = index(u.contact)` in [None=0, Messaging only=1, Phone or video calls=2, In person=3], `TN = index(u.tech)` in [Low=1, Medium=2, High=3], and `fx = BG2`.

**Filters, AF** (TRIM of the concatenated reasons; non-empty means filtered out):
- `D > u.hours + 2` → "needs about {D} hours a week and you have {u.hours}; "
- `F = "Partly" AND u.evenings = "No"` → "relies on evenings or weekends; "
- `K*fx > u.budget` → "start-up above your budget; "
- `H = "Yes" AND u.car = "No"` → "needs a car; "
- `I = "Yes" AND u.space = "No"` → "needs space you don't have; "
- `J = "Yes" AND u.checks = "No"` → "needs checks or registration; "
- `L > CN + 1` → "needs more customer contact than you want; "
- `u.soon = "Yes" AND O > 8` → "first income likely beyond 8 weeks; "
- `u.remote = "Yes" AND G = "No"` → "needs in-person work; "
- `u.camera = "No" AND BH = "Yes"` → "needs you on camera; "

**Lifestyle fit, AK = AG + AH + AI + AJ (max 12)**
- AG hours: `D <= u.hours → 3; D <= u.hours+2 → 1; else 0`
- AH block: `E <= u.block → 3; E <= u.block+1 → 1; else 0`
- AI evenings: `F = "No" → 3; u.evenings = "Yes" → 2; else 0`
- AJ contact: `L <= CN → 3; L = CN+1 → 1; else 0`

**Practical readiness, AP = 2*AL + AM + AN (max 12)**
- AL skills: `u.sk1 ∈ {S,T} → 3; (u.sk2 ≠ "" and u.sk2 ∈ {S,T}) → 2; R = 1 → 2; else 0`
- AM capital: `if u.budget = 0: (K = 0 → 3 else 0); else K*fx <= u.budget/2 → 3; K*fx <= u.budget → 2; else 0`
- AN tech: `Q <= TN → 3; Q = TN+1 → 1; else 0`
- AO (info only, unused): `3 − (J="Yes") − (H="Yes" OR I="Yes")`

**Commercial feasibility, AU = AQ + AR + AS + AT (max 12)**
- AQ = U (demand), AR = V (leverage), AS = W (competition)
- AT speed: if `u.soon = "Yes"`: `O<=2→3; O<=4→2; O<=8→1; else 0`; else `O<=4→3; O<=8→2; O<=16→1; else 0`
- X (pitching) and P (rate evidence) are **not used**.

**Totals and ranking**
- AV total = AK + AP + AU (of 36)
- AW priority bonus = `Money soon → AT; Flexibility → AH; Building something over time → AR; else 0`
- AX rank key = `AF ≠ "" → −1; else AV + AW + AU/100 + (99 − A)/100000` (ties go to higher commercial, then lower option #)
- AY band = `AF ≠ "" → "Filtered out"; AV>=27 → "Strong fit"; AV>=21 → "Good fit"; AV>=15 → "Possible with changes"; else "Weak fit"`
- AZ weak points = TRIM of `"{label}; "` for each criterion ≤1: AG "your weekly hours", AH "your block length", AI "evenings needed", AJ "customer contact style", AL "skills match", AM "budget stretch", AN "tech load", AQ "weak demand evidence", AR "income capped by the hour", AS "crowded market", AT "slow to first income"

**Top three ('1 Fit Finder' E-G 7-18)**, for n = 1..3: `row = MATCH(LARGE(AX, n), AX, 0)`.
- If `AX[row] < 0 OR AV[row] < 15`: E7 shows "No confident fit here — loosen a constraint or research further" and the other cells are blank.
- Otherwise: name (B), AK, AP, AU, `"{AV} — {AY}"` + `" · matches what matters most to you"` if AW ≥ 2; "Scores 3 of 3 on: …" for each of AG, AH, AI, AJ, AL, AM, AN, AQ, AR, AS, AT = 3 (labels: fits your weekly hours; fits your work blocks; no evenings needed; matches your contact style; uses your skills; well inside your budget; comfortable tech load; strong demand evidence; income not capped by the hour; room in the market; quick to first income for your need); AC (main reason it may fail); AZ or "None of the twelve criteria scored low."; AB (first test); ROUND(K*fx, −1); O; AD.
- E23:E45: `"{B} — {AF}"` for each filtered option.
- 'Income Pathway' mirrors these, adds Y (what you would do), Z (who pays) and AA (reach), and builds the situation summary strings in B6-B8.

**Worked example (default inputs; cached, reproduced independently)**
| Rank | Option | AK/AP/AU → AV | Band |
|---|---|---|---|
| #1 | 21 Email flows and copy for small e-commerce brands | 12 / 12 / 10 → 34 | Strong fit · matches what matters most to you |
| #2 | 4 Resume, LinkedIn and selection-criteria writing | 12 / 12 / 9 → 33 | Strong fit · matches… |
| #3 | 9 Virtual assistant to online business manager | 12 / 11 / 9 → 32 | Strong fit · matches… |

Start-up shown: 50 / 80 / 100. Weeks: 4 / 3 / 4. Filtered (12): 1 (evenings), 3 (budget), 7 (budget, space), 8 (space, in-person), 11 (space, in-person), 12 (weeks), 14 (weeks), 15 (budget, space, in-person), 16 (budget), 17 (budget), 19 (budget), 23 (budget). Cached rank keys (AX) for the 11 unfiltered options, by option #: 21 → 37.10078; 4 → 36.09095; 9 → 35.0909; 22 → 33.07077; 2 → 32.08097; 10 → 32.07089; 20 → 32.06079; 5 → 30.08094; 18 → 28.08081; 13 → 25.07086; 6 → 24.06093. Cached AV totals: 21 → 34, 4 → 33, 9 → 32, 22 → 30, 2 → 29, 10 → 29, 20 → 29, 5 → 27, 18 → 25, 13 → 22, 6 → 21.
Variant test (Start Here claim "five hours in one-hour blocks … the third option changes"): with C6=5 and C7=1, the top three become #21 (10/12/10 → 32), #4 (10/12/9 → 31) and #2 Language conversation lessons (12/9/8 → 29).
Audit B24: "default profile's #1 total equals the Options sheet value for that row" → 34 = 34 PASS.

### c4. 2A Service (Reality Calculator — Services)
Inputs (default): C7 price per billable hour **45**; C8 start-up total **180**; C9 fixed monthly **60**; C10 variable share **0.018**; C11 hours available/week **10**; C12 unpaid hours/week **2**; C13 share sold pessimistic **0.2**; C14 base **0.5**; C15 optimistic **0.8**; C16 weeks/month 52/12. Ready flag `C17 = COUNT(C7:C15)=9`.
For each scenario s ∈ {C13, C14, C15} (columns C/D/E):
- billable hours sold/month `B = MAX(0, hours − unpaid) * s * W`
- gross `G = B * price`; fixed `= C9`; variable `V = G * C10`
- profit before tax `P = G − C9 − V`
- all hours `A = (MAX(0, hours − unpaid) * s + unpaid) * W`
- effective hourly `= IF(A>0, P/A, 0)`; share of headline `= IF(price>0, eff/price, 0)`
- months to recover start-up `= IF(P>0, C8/P, "not reached")`; unrecovered after month 1 `= MAX(0, C8 − P)`
- Breakeven (C31): `IF(price*(1−C10)>0, C9/(price*(1−C10)), "n/a")` billable hours/month
- 5/10/15-hour table (C35:E35 = 5, 10, 15, base share C14): billable `MAX(0,h−unpaid)*C14*W`; gross ×price; costs `C9 + gross*C10`; profit; all hours `(MAX(0,h−unpaid)*C14 + unpaid)*W`; effective hourly; share of rate.

Cached results:
| | Pess | Base | Opt |
|---|---|---|---|
| Billable hours | 6.9333 | 17.3333 | 27.7333 |
| Gross | 312 | 780 | 1248 |
| Variable | 5.616 | 14.04 | 22.464 |
| Profit | 246.384 | 705.96 | 1165.536 |
| All hours | 15.6 | 26 | 36.4 |
| Effective hourly | 15.7938 | 27.1523 | 32.0202 |
| Share of rate | 0.35097 | 0.60338 | 0.71156 |
| Months to recover | 0.73057 | 0.25497 | 0.15444 |
| Unrecovered after m1 | 0 | 0 | 0 |

Breakeven 1.357773. 5/10/15 table: billable 6.5 / 17.3333 / 28.1667; gross 292.5 / 780 / 1267.5; costs 65.265 / 74.04 / 82.815; profit 227.235 / 705.96 / 1184.685; all hours 15.1667 / 26 / 36.8333; effective 14.9825 / 27.1523 / 32.1634; share 0.33295 / 0.60338 / 0.71474.

### c5. 2B Product (Reality Calculator — Products)
Inputs: C7 price/unit **45**; C8 materials/unit **9**; C9 shipping you pay/unit **0**; C10 fees share **0.095**; C11 start-up **450**; C12 fixed monthly **40**; C13 hours/week **10**; C14 unpaid hours/week **2.5**; C15 production hours/unit **1.5**; C16/C17/C18 units demanded/week **2 / 5 / 8**; C19 = 52/12. Ready flag `C20 = AND(COUNT(C7:C18)=12, C15>0)`.
- capacity/week `C21 = MAX(0, C13 − C14) / C15` (→ "enter a value" if C15 ≤ 0)
- contribution/unit `C22 = C7*(1−C10) − C8 − C9`; D22 warns "Negative margin: every sale loses money. Raise the price or cut unit costs before anything else." if ≤0
- per scenario d: units sold/week `u = MIN(d, capacity)` (0 if capacity is not a number); capacity note "Demand exceeds what you can make - capped" if d > capacity; units/month `m = u*W`; gross `= m*price`; materials+shipping+fees `= m*(C8+C9) + gross*C10`; fixed C12; profit `= gross − that − C12`; all hours `(u*C15 + C14)*W`; effective `IF(hours>0, P/hours, 0)`; months to recover `IF(P>0, C11/P, "not reached")`; unrecovered `MAX(0, C11 − P)`
- Breakeven C39: `IF(C22>0, C12/C22, "not reachable at this margin")` units/month
- 5/10/15 table (base demand C17): capacity `IF(C15>0, MAX(0,h−C14)/C15, 0)`; units `MIN(C17, cap)`; gross `units*W*price`; costs `C12 + units*W*(C8+C9) + gross*C10`; profit; hours `(units*C15 + C14)*W`; effective.

Cached: capacity 5; contribution 31.725; units sold/week 2 / 5 / 5 (optimistic capped); units/month 8.6667 / 21.6667 / 21.6667; gross 390 / 975 / 975; variable 115.05 / 287.625 / 287.625; profit 234.95 / 647.375 / 647.375; hours 23.8333 / 43.3333 / 43.3333; effective 9.8580 / 14.9394 / 14.9394; months to recover 1.9153 / 0.69511 / 0.69511; unrecovered 215.05 / 0 / 0; breakeven 1.260835. 5/10/15: capacity 1.6667 / 5 / 8.3333; units 1.6667 / 5 / 5; gross 325 / 975 / 975; costs 135.875 / 327.625 / 327.625; profit 189.125 / 647.375 / 647.375; hours 21.6667 / 43.3333 / 43.3333; effective 8.7288 / 14.9394 / 14.9394.

### c6. 2C Asset (Reality Calculator — Assets)
Inputs: C7 price/night **95**; C8 nights available/month **18**; C9/C10/C11 occupancy **0.3 / 0.5 / 0.7**; C12 platform fee **0.155**; C13 avg nights/booking **2**; C14 cost/booking **25**; C15 your hours/booking **1.5**; C16 start-up **400**; C17 fixed monthly **30**. Ready flag `C18 = AND(COUNT(C7:C17)=11, C13>0, C8>0)`.
- nights sold `n = C8*occ`; bookings `b = IF(C13>0, n/C13, 0)`; gross `= n*C7`; platform + per-booking `= gross*C12 + b*C14`; fixed C17; profit `= gross − that − C17`; hours `= b*C15`; effective `IF(hours>0, P/hours, "no hours")`; months to recover `IF(P>0, C16/P, "not reached")`; unrecovered `MAX(0, C16 − P)`
- Breakeven C32 (nights/month): `k = C7*(1−C12) − IF(C13>0, C14/C13, 0)`; `IF(k>0, C17/k, "not reachable")`

Cached: nights 5.4 / 9 / 12.6; bookings 2.7 / 4.5 / 6.3; gross 513 / 855 / 1197; fee+booking costs 147.015 / 245.025 / 343.035; profit 335.985 / 579.975 / 823.965; hours 4.05 / 6.75 / 9.45; effective 82.959 / 85.922 / 87.192; months to recover 1.19053 / 0.68968 / 0.48546; unrecovered 64.015 / 0 / 0; breakeven 0.442641.
Manual method text (B34): "monthly income = price per use × uses a month. Subtract the platform's share, any per-use cost (cleaning, fuel, wear), and fixed costs (insurance, registration). Divide what is left by the hours you spend on handovers and messages."

### c7. Audit sheet (ready-made unit tests; tolerance |exp − actual| < 0.01; text compares by equality)
| Row | Formula in words | Expected | Cell |
|---|---|---|---|
| 6 | Service: billable hours = (10 − 2) × 50% × 4.333 | 17.3333333 | 2A D20 |
| 7 | Service: gross sales = billable hours × A$45 | 780 | 2A D21 |
| 8 | Service: profit = sales − A$60 − 1.8% of sales | 705.96 | 2A D24 |
| 9 | Service: all hours = (8 × 50% + 2) × 4.333 | 26 | 2A D25 |
| 10 | Service: effective hourly = profit ÷ all hours | 27.1523077 | 2A D26 |
| 11 | Service at 5 hrs: profit | 227.235 | 2A C39 |
| 12 | Service at 5 hrs: effective hourly = profit ÷ ((3 × 50% + 2) × 4.333) | 14.9825275 | 2A C41 |
| 13 | Service: breakeven hours = 60 ÷ (45 × 0.982) | 1.35777325 | 2A C31 |
| 14 | Product: capacity = (10 − 2.5) ÷ 1.5 units a week | 5 | 2B C21 |
| 15 | Product: contribution per unit = 45 × 0.905 − 9 − 0 | 31.725 | 2B C22 |
| 16 | Product base: units sold a week = MIN(5, capacity) | 5 | 2B D27 |
| 17 | Product optimistic: units a week = MIN(8, capacity) — capped | 5 | 2B E27 |
| 18 | Product base: profit = sales − materials − fees − A$40 | 647.375 | 2B D33 |
| 19 | Product base: effective hourly = profit ÷ ((units × 1.5 + 2.5) × 4.333) | 14.9394231 | 2B D35 |
| 20 | Product: breakeven units a month = 40 ÷ contribution | 1.26083530 | 2B C39 |
| 21 | Asset base: nights = 18 × 50% | 9 | 2C D21 |
| 22 | Asset base: profit = sales − 15.5% − bookings × A$25 − A$30 | 579.975 | 2C D26 |
| 23 | Asset base: effective hourly = profit ÷ (bookings × 1.5) | 85.9222222 | 2C D28 |
| 24 | Fit Finder: default profile's #1 total equals Options value | 34 (formula) | FF E8+E9+E10 |
| 25 | Scorecard sample returns ADJUST | "ADJUST" | 3 Scorecard C23 |

Audit B27 lists edge cases "tested before release (see the QA report)": zero sales, zero capacity, negative margin, demand above capacity, very low hours, no-match Fit Finder profiles and blank inputs. That QA report is not in the kit; write tests for these cases.

---

## d. AI Shortcut System: prompts and structure

Source: `kit/03_AI_Shortcut_System.pdf` (text identical to `source/workflows.py`). Every workflow page has: number and day pill; title; What it does; When to use it; What you need to have ready; "Copy and paste this into Claude or ChatGPT" prompt with `[SQUARE BRACKET]` placeholders; Example of a useful response; Doing it without AI; A good answer looks like; Before you trust it; Then; privacy line ("Privacy: use types of people, never names or contact details; leave out children's details, your household finances and anything a customer told you in confidence. The AI service may store what you paste."). Each prompt follows the pattern: context lines with placeholders → "Please:" numbered deliverables → a closing prohibition (no invented statistics, competitors, earnings, testimonials or urgency).

| # | Day | Title |
|---|---|---|
| 1 | Day 1 | Turn what you already know into things people pay for |
| 2 | Day 4 | Research the people who would buy |
| 3 | Day 5 | Map the competitors and the substitutes |
| 4 | Day 6 | Itemise your costs for the calculator |
| 5 | Day 7 | Write your minimum offer in one sentence |
| 6 | Day 8 | Make the simplest honest sample |
| 7 | Day 9 | Plan who you will talk to, and write the first message |
| 8 | Day 10-11 | Turn conversations into notes you can use |
| 9 | Day 12 | Write the listing, page or post for a small sales test |
| 10 | Day 13 | Count what happened and what it cost you |
| 11 | Day 14 | Make the call: go, adjust or stop |
| 12 | Any day | Check whether the AI just made something up |

Placeholders used: [HOURS], [WHEN], [YOUR OPTION], [YOUR SUBURB / REGION], [YOUR AREA], [YOUR CURRENCY], [MINUTES], [US / UK / Australian], [YOUR OFFER], [X], [n], [amount], [PASTE THE CLAIM WORD FOR WORD], plus free-text brackets such as [from Day 4] and [Day 7 list].

Representative prompt 1, Workflow 02 (verbatim):
```
I'm testing whether I can earn extra income by offering [YOUR OPTION, e.g. daytime home organising sessions] to people in
[YOUR SUBURB / REGION, e.g. the Central Coast of NSW].

Help me understand the likely customer. Please answer these in order, in plain language:
1. Describe 2-3 specific types of person or small business most likely to pay for this. For each: their situation, what triggers
them to look for help, and what they currently do instead (including doing nothing).
2. Where would each type already be looking or asking? Name the kinds of places (local Facebook groups, marketplaces,
directories, referrals from which other businesses) rather than specific URLs you are not sure exist.
3. What are the five most common complaints people have about existing providers of this, based on the kinds of things said
in reviews and forums?
4. What would make someone choose a newcomer over an established provider?
5. List five questions I should ask real people on Day 10 to test whether this is true for them.

Important: where you are not sure something is true for my area, say "I'm not certain, check this" rather than guessing. Do not
invent statistics, market sizes or demand figures.
```

Representative prompt 2, Workflow 12 (verbatim):
```
You made this claim in an earlier answer, and I need to check it before I rely on it:

"[PASTE THE CLAIM WORD FOR WORD]"

Please:
1. Say whether this came from information I gave you, from general knowledge, or from a guess. Be specific.
2. If it is a fact about the real world (a rule, a fee, a price, a statistic, a company or product), tell me exactly what kind of
source would confirm it (for example: my tax office's page on X; the platform's own fees page; my local council or city
website) and what search terms I should use.
3. Give me your confidence as low, medium or high, and the single most likely way the claim could be wrong.
4. Rewrite the claim in the most cautious form that is still useful, with 'check' marked where I need to verify.

Do not look for new evidence to defend the claim. Just tell me how to check it.
```

Front matter rule (verbatim): "Four things the prompts forbid, and you should too. Invented demand or market size. Competitor revenue or 'typical earnings'. Statements about your legal or tax obligations (use your country's Rules Guide and the official page). Earnings projections of any kind. If an answer contains one, use Workflow 12."

---

## e. Duplication and disagreements across the PDFs, workbook and report

### Material repeated in more than one place
- Option database: the Options sheet A-AD equals `opportunities.json`, field for field (23/23 rows; only blank-tag encoding differs). The Opportunity Cards repeat the same text fields and dot ratings, and the Fit Finder and Income Pathway quote AB, AC and AD.
- Scorecard: the PDF (pp.2-3) and WB '3 Scorecard' share the same 12 questions, scales and gates. Plan Day 14 and Workflow 11 restate the decision.
- Day-to-tool map: Start Here "Which tool, which day", the Plan's "Open today" boxes and the AI Shortcut index table.
- Spam-law line: Plan Day 9 and Workflow 7 "Before you trust it".
- Commitment definition ("a firm, dated yes or a deposit counts as a commitment") and the 5-conversation rule: Plan p.2, Plan Day 12, Scorecard Gate 1, WB B26, Workflows 10 and 11.
- Sample Fit Finder result: Start Here p.2 equals the WB defaults and cached outputs.
- Country rules: the Rules Guides and the Cards' By-country pages overlap (for example the UK platform-reporting exclusion, US 1099-K, FTC disclosure, Canada vulnerable-sector checks, NZ criminal record check, NZ 8.5% credit, UK rent-a-room).
- Expert360 rate sentence: identical on cards 16 and 23.

### Disagreements (two versions differ)
1. **Version**: Start Here says 1.4; Workbook, Cards, AI Shortcut, Plan, Scorecard and Rules Guides say 1.3 (all dated 21 October 2026); `source/common.py` VERSION = "Version 1.3"; the `opportunities.json` _note says "database v1.1". The report contains both "1.3" and "1.4" strings (out of scope; not inspected further).
2. **Question count and numbering**: Start Here "17 Fit Finder questions, plus where you live and the least you'd accept for an hour" (19); WB "17 questions … (two more are optional)" + location; report "1 OF 20" (location, the 17 Fit Finder questions, minimum hourly, name); Plan Day 1 "questions 1-12" and Day 2 "questions 13-15" (15 total); Workflow 1 says skill areas are "questions 13 and 14", but in WB order they are the 14th and 15th (C19, C20).
3. **Scenario name**: Plan Day 6 and 13, Scorecard PDF Q7 and Workflows 10 and 11 say "moderate scenario"; WB calculators and WB Scorecard B13 say "Base". Plan Day 6 Stretch also says "base-scenario".
4. **Verdict vocabulary**: Scorecard, WB and Plan use NEXT TEST / ADJUST / STOP / INSUFFICIENT EVIDENCE. Workflow 11 prompt uses "[GO / ADJUST / STOP band]" and asks whether the evidence "agrees with the scorecard band", but the scorecard has no bands and says the total is "context only". The report uses "Go: next test / Adjust / Stop" with no separate INSUFFICIENT EVIDENCE verdict (the "fewer than 5" text sits inside the Stop block). The stale `quickstart.py` Start Here uses "GO, ADJUST or STOP".
5. **Re-run range after ADJUST**: Scorecard (PDF and WB), demand-gate-failed ADJUST → "run Days 7-12 again"; report Adjust → "repeat Days 9-12"; Workflow 11 example → "run Days 9-12 again"; INSUFFICIENT EVIDENCE → Days 9-12 (consistent).
6. **Report "Go" line versus Scorecard**: the report's Go requires "5+ real conversations", the Service/Product demand thresholds, and "Your calculator, with real numbers, shows {minrate}/hr or more at 50% busy". The Scorecard instead requires the total ≥24 and has no hard hourly-rate condition (profitability is one of 12 items). The report has no Slow-buying path.
7. **Calculator models**: WB 2A uses 20% / 50% / 80% of (hours − 2 unpaid) billable hours, unpaid hours counted, and breakeven on fixed costs. The report's JS (light glance, out of scope) uses `[0.25, 0.5, 1]` × capacity with `Math.floor`, capacity = monthly hours ÷ hours per unit, no unpaid-hours term, and break-even = `ceil(start / margin)` (start-up recovery in units). Results will differ for the same inputs, despite Start Here's claim that the workbook "uses the same scoring and gives the same top three" (that claim covers Fit Finder scoring only; whether the report's scoring uses C16/C17-equivalent answers was not verified).
8. **Small-sample threshold**: Workflow 10 example says "Fewer than ten conversations: directional only"; the prompt, Scorecard and Plan use five.
9. **Cards, index chip versus body start-up**: card 1 "under A$150" vs "A$0-300"; card 4 "under A$75" vs "A$0-150"; card 5 "under A$150" vs "A$0-300"; card 8 "under A$100" vs "A$0-800"; card 15 "A$400+" vs "A$265-1,500"; card 20 "under A$100" vs "A$50-200"; card 21 "under A$50" vs "A$0-100". The WB uses the chip value (K).
10. **Canva Pro price**: about A$20/month (cards 5, 12) vs about A$18/month (cards 18, 20).
11. **Four dots versus scoring**: Cards "How to read a card" says the four dots "feed the Fit Finder's commercial score". The WB commercial score uses demand, leverage and competition plus speed; "sells without pitching" (X) is unused.
12. **Product/service and recurring/project preferences**: collected in the WB (C16, C17) and in the report questions, and described in the Start Here sample profile ("prefers services and recurring clients"), but unused in WB scoring. The sample's #1 and #2 are Project-type.
13. **Start Here path**: step 5 says "Your report has done Days 1 to 3", while "Which tool, which day" and Plan Days 1-3 send the user to the Workbook Fit Finder and Workflow 1.
14. **Stale sources versus shipped PDFs**: `source/cards.py` builds 25 cards (old set) and `source/quickstart.py` builds an old 6-part Start Here (25 options, Australian Quick Start, Google Sheets import instructions that contradict "Google Sheets aren't tested yet", "Made by a mum who builds financial software") plus an Australia-only Quick Start (ASIC "about A$44-45 / A$102-104" vs the Rules Guide's A$47 / A$108; Centrelink "Report your income in the pay period you earn it" vs the Rules Guide AU item 10 "you do not report business takings in your fortnightly employment-income reporting"). Both write to `/home/claude/kit/`; the current generators write to `/home/claude/kit12/`. Treat cards.py and quickstart.py as superseded.
15. **Scorecard text**: WB adds "(insurance, a listing, a tool)" to NEXT TEST and "(contact comfort, hours, what you enjoyed)" to STOP. The PDF INSUFFICIENT EVIDENCE adds the second-round reach sentence. No logic differences.

---

## f. Contradictions with the 20-question quiz or the 23-opportunity count

- **20 questions**: the shipped report shows "1 OF 20" (Where do you live; 17 Fit Finder questions; "What's the least you'd accept for an hour of your time?"; "What should we call you on your report?"). Contradicting or inconsistent statements:
  - Start Here PDF step 2: "17 Fit Finder questions, plus where you live and the least you'd accept for an hour" (19; omits the name question).
  - WB Start Here B6 and Fit Finder B3: "the 17 questions in the blue cells … two more are optional" (the optional pair is the income goal and the free-text week question, not the report's minimum-hourly and name). The WB has no minimum-hourly input.
  - Plan Day 1 "questions 1-12" plus Day 2 "questions 13-15" = 15.
  - Workflow 1: skill areas are "questions 13 and 14" (WB: 14th and 15th; report: 15th and 16th).
- **23 opportunities**: all shipped kit documents agree on 23 (Start Here "you never need to read all 23", "Twelve of the 23"; Cards "23 realistic ways", "CARD nn OF 23", "23 options met the quality bar; the count was not padded back to 25"; WB Options rows 2-24; `opportunities.json` 23 options). Contradictions exist only in stale source: `source/cards.py` ("Opportunity card {n} of 25", "The 25 options at a glance", "Twenty-five realistic ways", "The fastest first dollar of the 25", "The slowest first dollar of the 25") and `source/quickstart.py` ("The Opportunity Cards (PDF): 25 researched options").
