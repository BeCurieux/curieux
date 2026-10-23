# Income Fit Test v1.4: corrections checklist

**Scope:** the Income Fit Test kit (US$19), the first paid offer, plus the free 5-Question Fit Check that leads to it. Source of every item: `content/CORRECTIONS.md` (founder decisions, 22 Oct 2026) and the audit records in `content/audit/`.

**Why corrected files can't be produced here (FACT):**

- The kit's source files (`01_income-fit-test/`: PDFs, HTML report, Python generators) **aren't in the repository**. `content/source/` holds only a README, by design.
- Only the **report patches** are ready to apply: `content/corrections/report.patch` and `report_src.patch`, tested against the supplied v1.4 files.
- Every other item below is an edit for the founder, or for her build scripts, to make.

**Live customer downloads are not to be overwritten without approval.** See §4 for the safe replacement procedure.

## 1. Verify the live listing first (founder)

- [ ] Open `https://herlittleempireco.gumroad.com/l/income-fit-test`. Confirm the price is **US$19** and the product is published.
- [ ] Note which files the listing delivers, with names and versions.
- [ ] Confirm the listing's description says **20 questions** and **v1.4**, or note what it says.
- [ ] Confirm the refund line on the listing is exactly "Full refund within 14 days of purchase, no questions asked."
- [ ] Copy the product's **Gumroad product id** for [GUMROAD_CONNECTION_CHECKLIST.md](GUMROAD_CONNECTION_CHECKLIST.md).
- [ ] Do the same for the free Fit Check (`/l/fit-check`).

## 2. Line-by-line corrections, by file

Tick each one when the file is edited. "Now" is what the audit found in the v1.4 files supplied on 22 Oct 2026.

### The Income Fit Report (`kit/00_Your_Income_Fit_Report.html` and `source/report_src.html`)

- [ ] **Apply `report.patch`** from `01_income-fit-test/`: `patch -p1 < report.patch`.
- [ ] **Apply `report_src.patch`** the same way. Also make the `top3` change in the engine source (first two hunks of `report.patch`).
- [ ] Result: **Day 14** gains "Not enough evidence yet" as its own verdict, checked first.
- [ ] Result: **Go** gains the slow-buying-market line.
- [ ] Result: the **calculator** gains "Unpaid hours a week" (default 2).
- [ ] Result: **ties** go to the product/service and recurring/one-off preferences.
- [ ] Result: "How we scored this" mentions the preference tie-breaker.
- [ ] Open the patched report in a browser; check there are no script errors and a quiz completes.
- [ ] The version line stays **v1.4**.

### Start Here

- [ ] "17 Fit Finder questions, plus where you live and the least you'd accept for an hour" → **"20 questions"**.
- [ ] Refund: "Full refund within 14 days of purchase, no questions asked, on top of your consumer rights." → **"Full refund within 14 days of purchase, no questions asked. This is on top of your rights under consumer law."**
- [ ] Under "start here.": "Find the income idea that fits your life. Test it in 14 days." → the promise **"Make your own money. Know what you're getting into."** then the supporting line **"Find the side income that fits your real week, see what it really costs and takes, check the rules where you live, then test it for 14 days before you spend big."**
- [ ] "uses the same scoring and gives the same top three" is only true once the workbook matches (below).

### Workbook

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Fit Finder sheet: "17 questions … (two more are optional)" plus location → **20 questions in the report's order, adding the minimum hourly rate input**.
- [ ] Calculators 2A/2B/2C (20/50/80% of paid hours; per hour over hours worked; break-even on fixed costs; product sheet unpaid default 2.5; "Base" scenario) → **the report's model:**
  - 25/50/100% of paid hours;
  - per hour over all hours;
  - break-even on start-up;
  - unpaid default 2 on every sheet;
  - one scenario name.
- [ ] Label: "Options K 'Min start-up (AU$, researched)'" → label EST, consistent with the cards' ranges.
- [ ] Label: 2A F10 "Card payments are usually 2–3%; tutoring and freelance platforms often take 15–33%" → label and date.
- [ ] Label: 2A F12 "Two hours is a realistic minimum" and F13 "many new businesses sell only a few hours in the first months" → label EST.
- [ ] Scorecard sheet: replace "total 24 or more" with **"the calculator shows your minimum hourly rate or more at 50% busy"**; ADJUST: **"change one thing and repeat Days 9–12"**.

### Opportunity Cards

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Cards 2, 10, 11: add labels to the repeated figures in "Who pays", "How you reach them" and "Why this might be a poor fit":
  - Card 2: Preply 33%/18%/100%, italki about 21%;
  - Card 10: Depop 0% in Australia;
  - Card 11: eBay A$25,000.
- [ ] Card 8: label the package example "five hems and two zips for A$120".
- [ ] Card 20: label the "92,100 sales and 8,600 reviews" statistic.
- [ ] Card 21: label the Spam Act / ACL / TGA statements.
- [ ] Card 22: label "ProZ about US$150/year".
- [ ] Card 23: label the pricing heuristic as an HLE method.
- [ ] Index excluded list: label and date the Redbubble, Airbnb (180-day cap), Uber Carshare and BAS lines.

### AI Shortcut System

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Workflow 1: skill areas "questions 13 and 14" → **"questions 15 and 16"**.
- [ ] Workflow 10: example "fewer than ten conversations" → **five**.
- [ ] Workflow 11: "GO / ADJUST / STOP band" → **the four outcomes** (not enough evidence, go, adjust, stop).
- [ ] Label and date: "Claude is at claude.ai; ChatGPT is at chatgpt.com. Both have a free version…"; Workflow 7 spam-law line; "The AI service may store what you paste".
- [ ] Label the example responses' figures as illustrative (EST / example).

### 14-Day Test Plan

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Days 1 and 2: "questions 1–12" and "questions 13–15" → **cover questions 1–20 between them**.
- [ ] Day 14: → **the four outcomes** above.
- [ ] Day 9: label and date the spam-law sentence (Spam Act, CASL, PECR, CAN-SPAM).
- [ ] Label day timings (20–60 min) as EST; label or remove "replies are likelier" in the morning.

### Go / No-Go Scorecard (PDF)

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Keep the gates. Replace "total 24 or more" with **"the calculator shows your minimum hourly rate or more at 50% busy"**.
- [ ] Both ADJUST texts → **"change one thing and repeat Days 9–12"**.

### Rules Guides

- [ ] "Version 1.3" → **"Version 1.4"**.
- [ ] Add explicit **FACT** labels (EST and UNKNOWN are already marked).

### `source/common.py`

- [ ] `VERSION = "Version 1.3"` → **`"Version 1.4"`** (every generator that imports it picks this up).

### Old generators (don't use)

- [ ] Don't regenerate with `cards.py` (builds 25 cards, not 23) or `quickstart.py` (outdated Australia-only guide, old ASIC fees, a Centrelink line that contradicts the Rules Guide). The current generators weren't in the supplied folder.

### Free 5-Question Fit Check (lead magnet)

- [ ] "Next step" callout: "17 questions (plus 2 optional)" → **"20 questions"**.
- [ ] "Next step" callout: "14-day refund" → **"Full refund within 14 days of purchase, no questions asked."**
- [ ] Price mention US$19 matches the listing (check after §1).

### 14-Day Tracker (in the Empire Bundle; optional for this launch)

- [ ] Money log: "most countries expect you to keep them for five to seven years" → the country-by-country sentence in `content/CORRECTIONS.md` §8 (FACT, checked 17–19 Oct 2026).

## 3. Already consistent (no change)

- The report's cover already uses the promise.
- The PDFs' imprint refund wording matches exactly.
- Empire Studio's FIT Finder already follows every rule above. It's tested against the patched report: identical top threes on 5,000 answer sets and identical calculator numbers on 2,000.

## 4. Replacing live files safely (needs founder approval)

1. **Keep the old files.** Download the current v1.4 files from Gumroad and store them, dated, before changing anything.
2. Make every edit in §2 on copies. Re-export the PDFs with the same file names, or names that clearly say v1.4.
3. Have someone (not the person who made the edits) spot-check the 20-question count, the refund sentence and Day 14 in each file.
4. On Gumroad, replace the files on the Income Fit Test product. **How Gumroad handles existing buyers' libraries when files change is UNVERIFIED:** check Gumroad's help or test on a cheap product first. If unsure, add the corrected files beside the old ones, labelled "corrected", rather than deleting the old ones.
5. Do the same for the Fit Check, and update both listings' descriptions if they mention 17 or 19 questions.
6. Then add the Studio line to the listing and receipt (LAUNCH_COPY.md §4).
