# CEV CMMS Mobile architecture plan

This plan adapts the useful principles from `alan2207/bulletproof-react` to the existing Expo / React Native CMMS. It is not a source-code copy and it does not replace CEV business rules, Supabase/RLS contracts, the performance architecture, or the platform/UI rules already defined in the repository.

## Goals

- Keep route screens thin and focused on presentation/orchestration.
- Group business capability by feature, not by file type alone.
- Give each feature a small public API (`src/features/<feature>/index.ts`).
- Prevent screens/navigation from reaching directly into Supabase or feature implementation files.
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
screen/navigation -> Supabase directly
screen/navigation -> another feature's private file
shared component -> feature business service
feature A private implementation -> feature B private implementation
```

## Target mobile structure

```text
src/
  features/
    auth/
      api/
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
      api/
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

Status: complete for the current Equipment reference implementation.

Completed:

- `src/lib/cache/persistentSnapshot.ts` is the shared versioned AsyncStorage snapshot primitive.
- `src/lib/supabase/client.ts` now owns the real Supabase client initialization; `src/supabase.ts` is compatibility-only.
- Equipment has memory cache, persistent list/detail snapshots, request de-duplication, stale-while-revalidate and subscriptions.
- Equipment List renders memory/persistent data first and revalidates Supabase in the background.
- Equipment Detail reuses its previous snapshot on revisit and revalidates in the background.
- Status changes patch list/detail cache after the authorized RPC succeeds instead of forcing a full Equipment reload.
- Equipment registration performs targeted cache reconciliation for the newly created equipment.
- Equipment Status Master has snapshot-first cache and background revalidation.
- Equipment create/photo mutations live inside the Equipment feature rather than the legacy Supabase module.
- Equipment photo URL cache is invalidated immediately after a successful replacement/upload so a stale signed URL is not reused.

The repository/cache convention established here is mandatory for upcoming data-driven features.

### Phase 4 - feature-by-feature migration

Status: in progress.

Completed slices:

- Auth has `src/features/auth/index.ts`; navigation consumes auth only through the public API.
- Profile/Security account writes live behind `src/features/settings/index.ts` instead of route screens calling Supabase directly.
- Work Orders now has `src/features/work-orders/index.ts`, a Supabase service and a snapshot-first repository with memory cache, persistent list/detail snapshots, request de-duplication, stale-while-revalidate and subscriptions.
- Native Work Order List is connected to the real `maintenance_work_order` table, uses `FlatList`, search, status filters, pull-to-refresh and cached revisit behavior.
- Native Work Order Detail is a real hierarchical route (`Work Orders -> Detail -> Back`) and joins equipment identity from `equipment_master` without querying Supabase from the screen.
- Architecture guard blocks route/navigation imports from Work Order private implementation files.

Next slices:

- Home dashboard Work Order counters/filter routing
- Requests
- Notifications
- remaining Settings data/preferences

Each feature receives a public API and route screens may import only from that API or generic shared components.

### Phase 5 - stronger architecture checks

Status: in progress as migrations land.

- Active route/entry/navigation UI is already blocked from direct Supabase imports.
- Active Equipment/Auth/Settings/Work Order UI is blocked from feature-private implementation imports.
- Remove compatibility shims once no legacy callers remain.

## Rules for new code from now on

1. New business modules belong under `src/features/<feature>`.
2. Screens/navigation import a feature through `src/features/<feature>/index.ts` only.
3. Do not add new direct Supabase calls inside screens/components/navigation.
4. Do not put feature-specific components in `src/components`.
5. Keep business writes behind authorized RPC/RLS boundaries.
6. Preserve CEV performance rules, image `contain` contract, and native physical-device verification gates.
7. Prefer small migration batches that keep behavior unchanged and pass the exact GitHub Quality Gate before merge.
8. New data-driven features must define memory cache, persistent snapshot, staleness, background revalidation, mutation patch and invalidation behavior before being considered complete.

## Legacy compatibility still present

- `src/supabase.ts` is now only a compatibility re-export surface. New code must not import it.
- `src/services/authService.ts` is a compatibility shim. New code must import `features/auth`.
- Old Equipment service/component paths remain as migration shims for non-route legacy callers; active Equipment UI is guarded against using them.
