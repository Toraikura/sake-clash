# SAKE CLASH development agreements

- This repository contains only SAKE CLASH. Preserve the existing playable behavior before redesigning. Never modify other games or sites.
- Primary target: iPhone portrait, touch and thumb interaction. Keyboard support is secondary. Do not rely on hover. Account for safe areas, dynamic Safari viewport, touch occlusion, accidental scrolling and app-switch pause/resume.
- Read README.md and docs/NEXT_STEPS.md first. Future ideas are proposals, not already implemented features or approval to implement everything.
- Keep scientific facts, educational simplifications and fictional game coefficients separate. Verify new biological/chemical claims against primary sources. Do not equate game outcomes with actual brewing safety or chemical production.
- No ads, payments, accounts, telemetry or external databases without a new explicit request. The current opponent is CPU; do not present it as human multiplayer.
- npm ci; npm run lint; npm run typecheck; npm test; npm run build. For browser tests: npx playwright install --with-deps chromium; npm run test:e2e -- --workers=3.
- Chrome viewport emulation is not iPhone Safari testing. Report real-device checks separately.
- src/model.ts: mechanics; src/render.ts: Canvas; src/main.tsx: UI and input; src/style.css: layout; src/storage.ts: local records.
- main pushes automatically publish to this game's GitHub Pages after CI. Use a branch/PR for reviewable changes unless asked to publish directly. Baseline release is v1.0.0.
