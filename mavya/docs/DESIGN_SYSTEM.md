# MAVYA v0.1 — Design System

## Brand feeling

Mavya should feel:

- optimistic
- modern
- warm
- calm
- capable
- premium but not luxury
- playful without becoming childish

Reference feeling:

**Apple Wallet × Duolingo × Linear**

## Visual direction

### Parent product
- soft lilac / warm white base
- coral, cobalt, mint and butter accents
- rounded cards
- progress rings and bars
- warm expressive microcopy
- strong child/activity iconography
- large tap targets

### Business product
- more neutral
- less decorative
- clearer information density
- strong hierarchy
- action-first cards
- calm charts and metrics

## Suggested tokens

```css
:root {
  --bg: #F8F6FB;
  --surface: #FFFFFF;
  --surface-soft: #F1ECF8;
  --text: #1F2230;
  --text-muted: #6F7282;
  --border: #E7E2EC;

  --brand-lilac: #B8A7E8;
  --brand-cobalt: #4767D7;
  --brand-coral: #F38A78;
  --brand-mint: #A7D9C8;
  --brand-butter: #F3D98C;

  --success: #3C9C73;
  --warning: #C78A2C;
  --danger: #C85A5A;

  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 28px;
}
```

These are working tokens, not final brand colours.

## Typography

Use:
- expressive modern display face for marketing / select headings
- highly legible sans-serif for UI

Do not use novelty children's fonts.

## UX copy style

Prefer:
- "Can't make it?"
- "Find a make-up"
- "Ava moved up!"
- "We found 3 classes that fit"
- "4 spots can be filled"

Avoid:
- "manage attendance workflow"
- "optimise utilisation"
- "execute enrolment change"

## Navigation

### Parent
Bottom nav:
- Home
- Calendar
- Kids
- Messages
- Account

### Business
Desktop side/top navigation should stay minimal:
- Today
- Classes
- Families
- Progress
- Settings

Do not expose ten navigation items in v0.1.
