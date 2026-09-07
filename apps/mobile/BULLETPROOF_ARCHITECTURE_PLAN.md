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

Status: in progress; Equipment is the reference implementation.

Completed in the first Phase 3 batch:

- Added `src/lib/cache/persistentSnapshot.ts` as the shared versioned AsyncStorage snapshot primitive.
- Added `src/lib/supabase/client.ts` as the shared client boundary while keeping legacy client initialization stable during migration.
- Added an Equipment repository with memory cache, persistent list/detail snapshots, request de-duplication, stale-while-revalidate and subscriptions.
- Equipment List now renders memory/persistent data first and revalidates Supabase in the background instead of blanking a known list with a spinner.
- Equipment Detail now reuses its previous snapshot on revisit and revalidates in the background.
- Status changes patch list/detail cache after the authorized RPC succeeds instead of forcing a full Equipment reload.
- Equipment registration performs targeted cache reconciliation for the newly created equipment.
- Equipment Status Master now has a bounded snapshot-first cache and background revalidation.

Remaining Phase 3 work:

- Finish moving legacy Supabase initialization/domain helpers apart so all raw client imports resolve from `src/lib/supabase` without compatibility indirection.
- Add the same repository/cache conventions to upcoming Work Orders, Requests and Notifications rather than creating screen-local fetch patterns.
- Add focused invalidation for equipment photo replacement/delete when those mutations are exposed from active UI.

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
8. New data-driven features must define memory cache, persistent snapshot, staleness, background revalidation, mutation patch and invalidation behavior before being considered complete.

## Legacy exceptions still to remove

- `ProfileSettingsScreen.tsx` and `SecuritySettingsScreen.tsx` still contain direct Supabase imports and are explicitly baselined until the Settings/Auth feature migration.
- Compatibility re-exports remain at the old Equipment service/component paths only as migration shims; active Equipment route/entry UI is guarded against using them.
- The legacy `src/supabase.ts` still owns client initialization plus older Equipment mutation/image helpers; Phase 3 will split those responsibilities without changing auth/session behavior.
