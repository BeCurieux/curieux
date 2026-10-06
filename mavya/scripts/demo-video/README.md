# The website's demo video

`public/ovyko-demo.mp4` (and its poster) is recorded from the real app on
the seeded demo school, so it can be redone whenever the app changes.

1. Start the local stack and reset it (`npm run db:reset`), then build the
   app (`npm run build`).
2. Capture the screens (signs in as the demo parent, owner and instructor,
   adds a believable month of example activity, and removes it again):

   ```
   set -a; . ./.env.local; set +a
   npx playwright test -c scripts/demo-video/playwright.config.ts
   ```

3. Compose and encode (needs `ffmpeg`):

   ```
   npx tsx scripts/demo-video/compose.ts
   ```

The story, captions and timings are the `SCENES` list in `compose.ts`; the
screens are taken in `capture.spec.ts`. Working files go to `out/` (not
committed). Captions never claim more than the app does; the end card says
the data is an example.
