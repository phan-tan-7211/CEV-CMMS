# CEV CMMS Mobile architecture plan

This plan adapts the useful principles from `alan2207/bulletproof-react` to the existing Expo / React Native CMMS. It is not a source-code copy and it does not replace CEV business rules, Supabase/RLS contracts, the performance architecture, or the platform/UI rules already defined in the repository.

## Goals

- Keep route screens thin and focused on presentation/orchestration.
- Group business capability by feature, not by file type alone.
- Give each feature a small public API (`src/features/<feature>/index.ts`).
- Prevent screens from reaching directly into Supabase or feature implementation files.
- Keep shared UI generic and feature UI inside its feature boundary.
- Make architecture violations fail early in the mobile quality gate.
- Migrate incrementally so current Equipment, QR, Work Order and Settings flows keep working during refactors.

## Target dependency direction

```text
index.tsx
  -> navigation / route screens
      -> features/<feature> public API
          -> feature services / repositories / hooks / components
              -> shared infra (Supabase client, storage, cache)
```

Forbidden direction:

```text
screen -> Supabase directly
screen -> another feature's private file
shared component -> feature business service
feature A private implementation -> feature B private implementation
```

## Target mobile structure

```text
src/
  features/
    auth/
      api/
      model/
      ui/
      index.ts
    equipment/
      api/
      model/
      ui/
      index.ts
    work-orders/
      api/
      model/
      ui/
      index.ts
    requests/
      api/
      model/
      ui/
      index.ts
    notifications/
      api/
      model/
      ui/
      index.ts
    settings/
      ui/
      index.ts
  navigation/
  screens/
  components/        # only generic/shared primitives
  lib/               # Supabase client, storage/cache helpers
```

## Migration phases

### Phase 1 - architecture guard + Equipment public boundary

Status: complete.

- `src/features/equipment/index.ts` is the Equipment public API.
- Equipment Status picker and Equipment Status Settings consume the public API.
- `npm run check:architecture` runs before TypeScript typecheck.

### Phase 2 - finish Equipment feature migration

Status: complete.

- Equipment List and Equipment Detail consume the Equipment public API.
- Equipment-specific UI (`EquipmentPhoto`, `SuggestField`) lives under `features/equipment/ui`.
- Equipment list/detail/status/photo repositories live under `features/equipment/api`.
- Equipment suggestion canonicalization lives under `features/equipment/model`.
- Root registration no longer imports Supabase, Equipment services, Equipment suggestions or Equipment-specific UI directly; creation + optional photo upload is orchestrated by the Equipment feature API.
- Compatibility re-export files remain temporarily to avoid breaking older imports outside active route/entry UI, but architecture checks reject new route/entry usage of those paths.

### Phase 3 - shared infrastructure

Status: next.

- Move the Supabase client and storage/cache primitives under `src/lib`.
- Keep all data-driven features on the required flow: memory cache -> persistent snapshot -> Supabase revalidate.
- Add bounded repository/cache ownership per entity.

### Phase 4 - feature-by-feature migration

- Auth
- Work Orders
- Requests
- Notifications
- Settings

Each feature receives a public API and route screens may import only from that API or generic shared components.

### Phase 5 - stronger architecture checks

After legacy imports are migrated, remove remaining non-Equipment allowlists from the architecture checker and fail CI on any direct data-client import from route/entry UI.

## Rules for new code from now on

1. New business modules belong under `src/features/<feature>`.
2. Screens import a feature through `src/features/<feature>/index.ts` only.
3. Do not add new direct Supabase calls inside screens/components.
4. Do not put feature-specific components in `src/components`.
5. Keep business writes behind authorized RPC/RLS boundaries.
6. Preserve CEV performance rules, image `contain` contract, and native physical-device verification gates.
7. Prefer small migration batches that keep behavior unchanged and pass the exact GitHub Quality Gate before merge.

## Legacy exceptions still to remove

- `ProfileSettingsScreen.tsx` and `SecuritySettingsScreen.tsx` still contain direct Supabase imports and are explicitly baselined until the Settings/Auth feature migration.
- Compatibility re-exports remain at the old Equipment service/component paths only as migration shims; active Equipment route/entry UI is guarded against using them.
