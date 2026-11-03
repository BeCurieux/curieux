# Writing and publishing lessons

The course lives in this repository as markdown, one file per lesson
(SPEC.md → Content loading). You edit the text here, then run one command to
load it into the database. The site never reads these files directly.

```
content/modules/
  module-0/
    _module.md          the module's number, title and summary
    lesson-0-1.md       one lesson: frontmatter, then the script
    lesson-0-2.md
  module-1/
    _module.md
    …
  library/
    _module.md          hidden: true — the benchmark sheets and templates
    benchmarks.md
```

The folder name is the module's address (`/learn/module-0/…`) and the file
name is the lesson's (`…/lesson-0-1`). Lowercase letters, numbers and
hyphens only. Renaming a file changes its address, so its progress starts
over; change the `title` instead if you only want a new name.

## A module: `_module.md`

```yaml
---
number: 0
title: Module 0
summary: One or two sentences shown on the course page.
---
```

`hidden: true` keeps a module out of the module list. The Library module
uses it: its lessons appear in their own "Library" section instead.

## A lesson

```markdown
---
number: "0.3"
title: The landed-cost mistake
summary: Shown on the locked page and in lists.
min_tier: module0
video_provider: bunny
video_id: 6a1b2c3d-…
duration: "8:30"
example: false
assets:
  - label: Landed cost sheet
    path: module-0/landed-cost.xlsx
    kind: sheet
---

The script goes here, in plain markdown: headings, lists, bold, tables.
```

| Field                       | Required | What it does                                                                                                                                |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`                    | yes      | In quotes: `"0.3"`. The first part must match the module's number. Lessons are ordered by the second part, so `"0.10"` comes after `"0.9"`. |
| `title`                     | yes      |                                                                                                                                             |
| `summary`                   |          | One line.                                                                                                                                   |
| `min_tier`                  | yes      | `free`, `module0` or `course`. Who can open it. The founding cohort opens everything the course does.                                       |
| `video_provider`            |          | `bunny` or `youtube`. Set it together with `video_id`, or leave both out.                                                                   |
| `video_id`                  |          | Bunny: the video's ID from Stream. YouTube: the part after `v=` in the link (use an unlisted video).                                        |
| `duration`                  |          | `"8:30"`, `"1:02:03"` or seconds. Shown as "9 min".                                                                                         |
| `example`                   |          | `true` labels it "Worked example" (examples A, B and C).                                                                                    |
| `opens_with_benchmark_pack` |          | `true` on Library lessons with the benchmark sheets: buyers of the A$29 pack alone can open them too.                                       |
| `assets`                    |          | Downloads: `label`, `path` in the lesson-assets bucket, and `kind` (`sheet`, `pdf` or `template`).                                          |

Everything under the frontmatter is the script. With a video, the lesson
page shows it under "Read instead"; without one, it shows on its own. It's
also the course's text version, for accessibility and for people who'd
rather read.

## Videos

- **Bunny Stream:** upload to your Stream library and paste the video's ID
  into `video_id`. Set `BUNNY_STREAM_LIBRARY_ID` in Vercel once. For private
  embeds, turn on **Embed view token authentication** in the library's
  Security settings and set `BUNNY_STREAM_TOKEN_KEY`: every video link is
  then signed and stops working after six hours.
- **YouTube:** upload as **Unlisted** and paste the ID. Anyone given the
  link can watch an unlisted video, so the site only puts the ID on the page
  for people who can open the lesson.

## Downloads

1. Supabase dashboard → Storage → `lesson-assets` (private) → upload the
   file, e.g. into a `module-0` folder.
2. Add it to the lesson's `assets` with the same path, e.g.
   `module-0/landed-cost.xlsx`.

Customers never get the file's real address. The download link checks that
they can open the lesson, then hands out a link that expires in a minute.

## Publishing

```sh
npm run content:seed
```

It checks every file first and lists every problem at once (a missing
title, a lesson number in the wrong module, a typo in `min_tier`), and
changes nothing until they're all fixed. Then it creates or updates the
modules, lessons and downloads. Run it as often as you like.

It also tells you:

- which downloads are listed in a lesson but aren't in the bucket yet, and
- which lessons are in the database but no longer in `content/`. Those are
  **not** deleted, because deleting a lesson deletes everyone's progress on
  it. `npm run content:seed -- --prune` deletes them.

Against production: run it with production's `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SECRET_KEY` in the environment instead of the local ones.
