# Warm Letter · Initial UI migration

Current gate: **HUMAN PRODUCTION UI REVIEW REQUIRED**. Local only; no deployment.

Branch: `feat/warm-letter-initial-ui`. Recovery branch: `recovery/warm-letter-before-initial-ui-20261004` at `e1580304b8fdaa93d919028d021ec84af5f1491a`. The pre-existing root untracked `.env` was left untouched.

The user approved Round 04's visual structure for initial migration. Round 02's 305-item matrix remains the functional baseline. Lab entrypoint: `D:/Users/JCLXJ/Documents/AI Project/Creative Web Lab/projects/cloud-mail-ui/docs/initial-production-migration/README.md`.

## Scope and preserved behavior

Migrated App Shell, three themes, Mail/Admin navigation, ordinary virtual mail list, Reader, Compose, Account Switch, shared dialogs/dropdowns and motion. Administration remains accessible through original permission routes; its internal pages are not redesigned in this checkpoint.

Request clients, axios, business stores, permissions, database, ShadowHtml and Admin page sources are unchanged. Reader business script is unchanged. Composer and account handlers remain original except UI lifecycle/closing guards. Sending, drafts, recipients, rich text, attachments and account operations use original dependencies.

## Theme system

`src/theme/themes.js` defines Clay Letter (default), Sage Garden and Cocoa Night. Palette values map to shared `--letter-*` semantic roles. `src/theme/letter.css` adapts components and existing CSS variables. Components do not select styles by theme name. `.dark` remains an existing-editor/chart compatibility signal.

Preference key: `cloud-mail-appearance-v1`. Missing/unknown values default to Clay. The user chooses a persistent theme via preview swatches in the header, Compose or Personal Settings. System dark does not override a choice. TinyMCE changes default surface/ink in its existing iframe, preserving content and editing instance. Sender HTML is left in ShadowHtml's own rendering context.

## List geometry and motion

Ordinary mail rows: 88px desktop / 144px below 760px, including skeletons and UseVirtualList itemHeight. All Mail retains 65px / 132px at its original 1367px breakpoint. KeepAlive/onActivated still restore list scroll.

Motion is lifecycle-bound in `src/theme/motion.js` and shared CSS: sidebar feedback 160ms, workspace/Reader 280ms, Inbox return 240ms, dialogs 220/180ms, Compose 240/180ms, Settings edit 200/180ms. Leaving routes is immediate; WAAPI cancellation settles Vue, and reduced-motion cancels spatial animations. Focus uses native controls/visible outlines; EP checkbox inner bounds receive a visible focus ring. Compose/sidebar use inert boundaries; original EP dialogs retain their focus traps. The production adaptation uses stable sidebar/account anchors without cloning sender DOM across routes.

## Local review and validation

From the Lab project, run `pwsh -NoProfile -File tools/run-production-review.ps1` for `http://127.0.0.1:3001/` connected to the existing API. The user signs in at this local origin. For isolated testing run `node tools/production-review-api.mjs`, then the launcher with `-Fixtures` for port 3002. Review caches are separate via VITE_REVIEW_CACHE; no env file was changed.

From mail-vue: `pnpm exec vite build --mode release --outDir dist-warm-letter`. Output and local log are ignored; the production static target is untouched. Build passed, including original size/environment/dependency-age warnings. Source AST/hash and 27 semantic contrast checks passed; browser regression exercised isolated mail/compose/account/permission flows. Evidence and actual screenshots are in the Lab `reviews/initial-production-migration/`.

These checks do not certify all 305 backend behaviors, real delivery, live Turnstile or complete Admin visuals. Await user production UI review before further migration or deployment.
