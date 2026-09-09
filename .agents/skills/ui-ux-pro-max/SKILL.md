---
name: ui-ux-pro-max
description: Project-local UI/UX review rules for CEV Equipment Management, adapted for an UpKeep-first CMMS with IATF 16949 extensions.
---

# UI/UX Pro Max — CEV Project Rules

Use this skill for every UI, responsive, mobile, navigation, drawer, form, card, profile, work-order, inspection, spare-part, QR, dashboard, CMMS workspace, settings or list/detail change.

Before implementation also read:

- `docs/UI_UX_REFERENCE.md`
- `docs/UPKEEP_VISUAL_REFERENCE.md`
- `.agents/skills/platform-ui-architecture/SKILL.md` when desktop/mobile renderer ownership or layout boundaries are involved

## Product authority order

For CMMS product UI, use this order:

1. **UpKeep reference capture/live authorized reference** — visual, interaction, hierarchy and workflow authority.
2. **CEV/IATF business requirements** — domain and compliance authority.
3. **CEV architecture/data contracts** — implementation/data authority.
4. **MaintainX/Limble/Atlas** — fallback only when the target pattern is not represented in UpKeep.
5. **shadcn/Tamagui/other UI libraries** — implementation primitives only; they must not redefine the product visual language.

Do not replace a usable UpKeep reference with a generic admin-dashboard, Atlas, shadcn, Cal.com, Dify or template-style composition.

## UpKeep-first implementation rule

When a usable UpKeep reference exists for the target screen:

- Match shell/navigation hierarchy.
- Match page composition and information hierarchy.
- Match density, spacing, table/list structure, filter/search placement, tabs, drawer/modal behavior, badges and action placement.
- Preserve CEV terminology, permissions, Supabase contracts and IATF-required fields.
- Add IATF fields/workflows inside the UpKeep pattern rather than creating a separate visual system.
- If an existing CEV screen differs materially from the capture, treat the capture as the visual benchmark and fix shared primitives/layout before adding more page-specific CSS.
- “UpKeep-style” in a prior PR or handoff is not proof of parity; verify against the best available capture.

Do not copy UpKeep proprietary source code, logos, trademarks, private assets or licensed artwork. Reimplement the observed UI independently in CEV.

## IATF 16949 extension rule

CEV is not a separate IATF application beside a CMMS. IATF functionality extends the UpKeep-like entity/workflow model.

Typical additions include:

- Equipment Master and canonical Equipment ID
- equipment profile/history
- criticality/risk
- maintenance plans and PM evidence
- inspection/calibration records where applicable
- spare-part relationships and stock traceability
- breakdown/downtime history
- attachments/photos/documents
- approval/verification/evidence metadata
- audit trail and retained records

Prefer adding these as fields, tabs, linked records or workflow states inside the UpKeep-like Asset, Work Order, PM, Parts, Files, Meters and Activity structures.

Do not invent a disconnected “IATF portal” unless the user explicitly asks for one.

## Priority order

1. UpKeep visual/interaction fidelity for referenced CMMS screens
2. Accessibility
3. Touch and interaction
4. Navigation continuity
5. Responsive layout
6. Forms and feedback
7. Visual consistency
8. Performance

The first item never overrides business correctness, permissions, accessibility or platform architecture; it controls the visual/product pattern when those constraints allow multiple implementations.

## Non-negotiable CEV rules

### 1. Navigation continuity

- Every drill-down action must have a predictable way back to the exact source context.
- If a user goes `Equipment Profile -> Maintenance / Inspection / Spare / QR`, the destination must expose `← Trở về <equipment_id>`.
- Bottom navigation is global navigation and must not replace contextual Back.
- Maximum 5 persistent bottom-nav items.
- Direct navigation from global nav clears stale contextual Back state.

### 2. Responsive behavior must preserve capability

- Breakpoints may rearrange layout, never remove required actions.
- Desktop, tablet and mobile must expose the same business actions unless permission rules differ.
- Required test widths: 375, 440, 768, 1024, 1440 px.
- No horizontal page scrolling.
- Text, chips, badges and buttons must reflow without clipping.
- Never solve overflow by hiding a required action.
- If desktop and mobile need materially different DOM/task flow, use separate platform renderers with shared business logic; do not keep adding CSS patches to one mixed renderer.

### 3. One scroll owner

- Modal/drawer/profile overlays must lock the background.
- Only the foreground content area scrolls.
- Header/footer actions remain reachable.
- Use `100dvh` and safe-area handling on mobile where appropriate.
- Avoid scroll chaining from drawer to page behind it.

### 4. No duplicate information on one screen

- Identity information belongs in the hero/header once.
- Do not repeat Equipment ID, Criticality, Status, or the same field again in Overview.
- Summary cards should add new information, not mirror hero data.

### 5. Touch targets

- Primary touch targets should be at least 44x44 px.
- Keep enough separation between destructive and primary actions.
- Do not rely on hover for discovery.
- Every icon-only control requires an accessible label.

### 6. Footer actions

- Destructive, cancel and save actions must remain visible/reachable at all supported widths.
- Responsive CSS may change wrapping or alignment but must not change action existence.
- Delete must never disappear because of viewport width.

### 7. Forms

- Registration and Edit for the same entity must share the same business field model.
- If a field can be created, it must be editable later unless it is explicitly system-managed.
- System-managed Equipment ID / QR / type-derived prefix remain read-only.
- Labels stay visible; placeholder is not a label.
- Validation appears near the affected action/field and must not wipe user input.

### 8. Status and badges

- Meaning must not rely on color alone.
- Always include text such as `RUNNING`, `Cấp A`, etc.
- Unknown/missing values should display an intentional state, not broken layout.
- For referenced screens, match UpKeep badge scale/density/placement while preserving accessible text meaning.

### 9. Mobile-first task flow

- UpKeep mobile is the first product reference when a usable mobile capture exists.
- One screen = one primary task.
- Prefer short cards, quick actions, full-screen drawers and bottom sheets where native behavior requires it.
- Avoid desktop tables on mobile when a card/list interaction is materially better; if the DOM differs, own it in the mobile renderer instead of overriding desktop markup.
- Sticky CTA is allowed when it does not cover content or bottom navigation.
- Do not shrink a desktop UpKeep layout into mobile; preserve the product concepts using native composition.

### 10. Equipment image contract — immutable

Applies to Equipment Profile, Equipment List thumbnails, Edit Equipment, Register Equipment, QR/profile previews and all future equipment-image UI.

- Always show the complete source bitmap.
- Never crop, clip, mask, zoom-crop or hide corners/edges.
- Small images must scale UP to use the available frame.
- Large images must scale DOWN to fit the frame.
- Preserve original aspect ratio at all times; never stretch or squash.
- Keep the image centered.
- Use `object-fit: contain` behavior, never `cover`, for equipment images.
- Preferred implementation: stable frame + image `width:100%; height:100%; object-fit:contain; object-position:center`.
- Breakpoints may resize/reflow the frame only; they must never change fit behavior.
- Equipment List thumbnails must share one fixed frame size so source dimensions never alter row/card layout.
- Do not replace this with natural-size-only rendering (`width:auto;height:auto`) because small source images must also upscale to the frame.
- Do not add CSS overrides that revert any equipment image to `cover`.
- Before delivery test five image shapes/sizes: small, large, portrait, landscape, square.

### 11. Architecture ownership

- Shared primitives own accessibility/interaction contracts, not page composition.
- UI primitives must not call Supabase directly.
- Equipment desktop code must not import mobile renderers; mobile code must not import desktop renderers.
- Shared Equipment controller/hooks must not import either platform renderer.
- `EquipmentWorkspace.tsx` is the single platform selector for Equipment.
- Current Equipment boundary: `<901px` mobile/tablet, `>=901px` desktop.
- Run `npm run test:architecture` after platform/refactor work.

### 12. Visual fidelity gate for UpKeep-referenced screens

Before claiming parity, compare the implementation to the best available UpKeep reference for:

- shell/sidebar proportions
- header height/hierarchy
- page padding
- typography scale/weight
- table/list density and row height
- filters/search position
- button hierarchy
- status/priority badges
- tabs and active state
- drawer/modal dimensions and scroll behavior
- cards/section borders/radius/shadows
- icon sizing/alignment
- empty/loading/error states
- responsive rearrangement

If the same mismatch appears on multiple screens, fix the shared component/token instead of patching each page.

### 13. Existing screen preservation and correction

The repository already contains many UpKeep-parity screens. Treat them as a baseline, not immutable truth.

- Do not rewrite a working module into a different visual system.
- Do not assume prior “UpKeep-style” naming means the screen matches the reference.
- Compare first, then correct deviations.
- Prefer shared-shell/shared-list/shared-detail fixes over one-off selectors.
- During an explicitly UI-first phase, UI fidelity can be completed before live-data wiring, but do not break existing data-backed flows to create a mock-only replacement.

### 14. Pre-delivery UI checklist

Before claiming a UI change is done, verify:

- [ ] best available UpKeep reference identified
- [ ] side-by-side comparison performed when screenshots exist
- [ ] no unrelated visual language blended into a referenced screen
- [ ] IATF additions extend the UpKeep pattern instead of creating a separate UI
- [ ] 375 px
- [ ] 440 px
- [ ] 768 px
- [ ] 1024 px
- [ ] 1440 px
- [ ] required actions never disappear
- [ ] contextual Back works
- [ ] no duplicate information on same screen
- [ ] no background scroll behind drawer/modal
- [ ] footer actions reachable
- [ ] no horizontal page scroll
- [ ] keyboard focus visible
- [ ] touch targets usable
- [ ] badge meaning not color-only
- [ ] safe-area does not hide CTA/nav
- [ ] equipment images show full bitmap, upscale/downscale, never crop or distort
- [ ] architecture guard passes when platform layout changed
- [ ] Chromium + Pixel/WebKit smoke gates remain green

## Project-specific mobile architecture

Primary bottom navigation:
- Home
- Work
- Scan
- Equipment
- More

Equipment Profile quick actions:
- Maintenance
- Inspection
- Spare
- QR

Each quick action must preserve `equipment_id` as navigation context so the user can return to the exact equipment profile.

## Source usage

- Use UpKeep captures/live authorized references as the first product UI source.
- Use `docs/UPKEEP_VISUAL_REFERENCE.md` for exact authority/fallback rules and capture locations.
- Use `docs/UI_UX_REFERENCE.md` for the project-level product matrix.
- Use `.agents/skills/platform-ui-architecture/SKILL.md` for desktop/mobile ownership and shared-layer boundaries.
- Use MaintainX/Limble/Atlas only for gaps not represented by UpKeep or for platform-specific fallback cases.
- Use shadcn/Tamagui as accessible implementation primitives, never as authority to restyle a captured UpKeep screen.
