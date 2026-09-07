# Mandatory architecture and release gates

React + Vite + TypeScript frontend with Supabase PostgreSQL, Auth/RLS, Storage and RPC.
Current development and verification workflow is LOCAL. Deployment visibility is not a substitute for local build/test/UI verification.
Apps Script, Google Sheets and Google Drive are not runtime dependencies.

One equipment → one canonical equipment_id → one equipment_master root record.
Production IDs: CEV-PR-NNN. Measurement IDs: CEV-ME-NNN.
Every workflow references the same ID. Never create parallel equipment identities.

Business writes use authorized RPC/RLS boundaries. Never expose service-role credentials in frontend code.
A4/PDF renders existing Supabase records; do not introduce separate form data storage.
Audit ZIP export requires ADMIN. Record export limitations and checksum verification instructions.

## Mandatory performance architecture

Performance behavior is a permanent project rule, not a one-off optimization. Every new or modified data-driven module must follow `docs/PERFORMANCE_ARCHITECTURE.md` unless there is a documented technical reason not to.

Required rules:

1. Prefer instant navigation from existing client state. Do not remount the whole workspace when switching views, refreshing auth tokens, refocusing the browser, or revisiting a module.
2. Use layered client data: memory cache first, persistent local snapshot second, Supabase as source of truth.
3. Use stale-while-revalidate: render valid cached data immediately, then refresh stale data in the background.
4. Never refetch an entire module after a normal create/update/delete if the mutation result can patch the affected record(s) locally.
5. Normal mutations must be optimistic where safe: update UI/cache immediately, confirm with server, and rollback only the affected record on failure.
6. Cache entries must be versioned, timestamped, bounded, and explicitly invalidated when required. Never add unbounded caches.
7. Reuse valid signed image URLs and lazy-load images near visibility. Do not request signed URLs for every image on every module visit.
8. Browser focus/visibility changes must not cause app remount or login/loading flashes. Revalidate only data that is stale, with deduplication/throttling.
9. Supabase auth token refresh must be decoupled from UI readiness. `TOKEN_REFRESHED` is not a reason to unmount the application.
10. Prefetch code/data only when there is a useful user-intent signal such as hover, focus, or likely next navigation; avoid blind bulk prefetching.
11. Large histories, audit logs, work orders, and tables must use pagination/windowing/virtualization when row volume makes full rendering wasteful.
12. Before adding a new fetch path, check whether an existing shared repository/cache can serve it. Do not let each screen invent a separate fetching strategy for the same entity.
13. Manual refresh may force a server read; background warmup must be throttled and deduplicated.
14. Performance regressions count as release regressions. A feature is not complete if it reintroduces whole-module reloads, duplicate network requests, auth remounts, or avoidable spinners on revisits.

Target client flow:

`Supabase → data repository → memory cache → persistent snapshot → React UI`

Opening a module:

`RAM cache → show immediately` → else `local snapshot → show immediately` → background Supabase revalidate → patch only differences.

Mutation:

`user action → optimistic UI/cache patch → Supabase RPC/write → confirm` or `rollback affected record + show error`.

## Mandatory platform UI architecture

For Equipment and any future feature where desktop/mobile task flow differs materially:

1. Read `.agents/skills/platform-ui-architecture/SKILL.md` before implementation.
2. Follow `docs/FRONTEND_PLATFORM_ARCHITECTURE.md`.
3. Share domain/data/services/controllers; do not duplicate business rules by platform.
4. Desktop presentation must not import mobile presentation. Mobile presentation must not import desktop presentation.
5. Shared feature/controller code must not import either platform renderer.
6. Shared UI primitives may be reused, but they must not own platform page composition or call Supabase directly.
7. If one DOM requires repeated breakpoint overrides or `!important` chains to behave as two different products, split the renderer instead of adding more patches.
8. Current Equipment platform boundary is explicit: mobile/tablet `< 901px`; desktop `>= 901px`.
9. `src/equipment/EquipmentWorkspace.tsx` is the platform selector. Platform selection must not be scattered through feature components.
10. `src/LiveEquipmentPanel.tsx` is a retired mixed-renderer pattern and must not return.
11. Architecture guard tests are mandatory: run `npm run test:architecture` after Equipment architecture/layout refactors.

Reference principles are adapted for CEV from Cal.com, create-t3-turbo, Dify, shadcn/ui, Solito and Tamagui. CEV project rules and business requirements take precedence over external examples.

## Mandatory UI/UX gate

For every UI, responsive, mobile, navigation, form, drawer, modal, profile, work-order, inspection, spare, QR, or dashboard change:

1. Read `.agents/skills/ui-ux-pro-max/SKILL.md` before implementation.
2. For platform-specific layout changes also read `.agents/skills/platform-ui-architecture/SKILL.md`.
3. Follow `docs/UI_UX_REFERENCE.md`.
4. Preserve the same required business actions across desktop/tablet/mobile; breakpoints may rearrange, never hide required capabilities.
5. Preserve contextual navigation. A drill-down from Equipment Profile to Maintenance / Inspection / Spare / QR must provide `← Trở về <equipment_id>` to the exact source profile.
6. Do not duplicate the same Equipment ID, Status, Criticality, or equivalent field twice on one screen.
7. Overlays use one scroll owner: background locked, foreground content scrolls, header/footer actions stay reachable.
8. Registration and Edit for the same entity must use the same business field model unless a field is explicitly system-managed/read-only.
9. Verify at 375, 440, 768, 1024 and 1440 px before declaring UI work complete.
10. Never fix responsive overflow by hiding Delete/Save/Cancel or another required action.
11. Global bottom navigation does not replace contextual Back navigation.
12. Equipment images follow the immutable Equipment Image Contract below. Do not change image fit/crop behavior without an explicit product decision and corresponding update to all three UI/UX rule files.

## Immutable Equipment Image Contract

This rule applies to every equipment image surface: Equipment Profile, Equipment List thumbnails, Edit Equipment, Register Equipment, preview, QR result and any future equipment-image component.

- The complete source image must always remain visible. Never crop, mask, zoom-crop, clip away corners or hide any part of the bitmap.
- Images must automatically scale UP when smaller than the available frame and scale DOWN when larger than the frame.
- Scaling must preserve the original aspect ratio. Never stretch or distort width/height independently.
- Use a fixed/predictable frame for each surface. Breakpoints may resize the frame, but must not change the image-fit behavior.
- The image stays centered in the frame.
- The implementation contract is a frame that constrains size plus an image rendered as `width:100%; height:100%; object-fit:contain; object-position:center` (or an equivalent implementation with identical visual behavior).
- `object-fit: cover`, background-image cover behavior, manual crop transforms, negative offsets, and aspect-ratio distortion are forbidden for equipment images.
- Equipment List thumbnails must use one consistent frame size within the list so source-image dimensions cannot change row height or break layout.
- A UI change involving equipment images is not complete until tested with: small source image, very large source image, portrait image, landscape image, and square image.

## Mandatory parallel Web / Mobile coordination

This repository may be edited directly through GitHub by separate ChatGPT sessions. Before any edit, read `docs/PARALLEL_DEVELOPMENT_WORKFLOW.md` and follow its branch ownership rules.

Required lane model:

- `main` = production/release only.
- `feat/cmms-workflow-next` = combined integration branch for operator local testing.
- `feat/cmms-workflow-next-web` = Web development lane.
- `feat/cmms-workflow-next-mobile` = Expo/React Native development lane.

Every development session must identify whether it is **Web** or **Mobile** before editing. If the user did not make that clear, ask `Web hay Mobile?` before writing files.

Web normally writes Web files and must not modify `apps/mobile/**`. Mobile normally writes `apps/mobile/**` and must not modify Web presentation files. Shared files such as `AGENTS.md`, `.github/workflows/**`, root package/lockfiles, `supabase/**`, shared contracts, generated types and cross-platform business rules require explicit single-lane ownership for that batch.

Before the first write of a batch, fetch the latest integration HEAD and the current remote version of every file to be changed. Do not overwrite unexpected remote movement. Do not force-push to resolve coordination problems.

Each lane batch must reach a safe checkpoint, push all changes to its own lane branch, and wait for the GitHub `Quality Gate` to finish successfully before merging that batch into `feat/cmms-workflow-next`. The operator normally pulls only the integration branch to test combined behavior.

Work on feature branches / pull requests, not directly on main.
Before merge: local tests, architecture tests when applicable, build, lint, Chromium/Pixel 7/WebKit automated smoke,
Supabase diagnostics when database behavior changed, and final DB/Storage reconciliation where relevant must pass.
Android and iPhone camera scans are separate physical-device gates. Browser emulation
cannot satisfy them. Do not merge while any required gate is failing or unverified.
