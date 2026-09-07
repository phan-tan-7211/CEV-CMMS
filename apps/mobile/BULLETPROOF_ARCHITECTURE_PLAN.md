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

Status: started in this batch.

- Add `src/features/equipment/index.ts` as the public feature API.
- Migrate Equipment Status picker and Equipment Status Settings to consume the public API.
- Add `npm run check:architecture` and run it before TypeScript typecheck.
- Keep existing service files in place temporarily behind the public API to reduce regression risk.

### Phase 2 - finish Equipment feature migration

- Migrate Equipment List and Equipment Detail imports to the Equipment public API.
- Move Equipment-specific UI (`EquipmentPhoto`) under `features/equipment/ui` while preserving the public export.
- Move equipment services under `features/equipment/api` without changing route-screen imports.
- Extract registration business/data logic from root `App.tsx` into the Equipment feature.

### Phase 3 - shared infrastructure

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

After legacy imports are migrated, remove temporary allowlists from the architecture checker and fail CI on any new direct feature-service import from screens.

## Rules for new code from now on

1. New business modules belong under `src/features/<feature>`.
2. Screens import a feature through `src/features/<feature>/index.ts` only.
3. Do not add new direct Supabase calls inside screens/components.
4. Do not put feature-specific components in `src/components`.
5. Keep business writes behind authorized RPC/RLS boundaries.
6. Preserve CEV performance rules, image `contain` contract, and native physical-device verification gates.
7. Prefer small migration batches that keep behavior unchanged and pass the exact GitHub Quality Gate before merge.

## Legacy exceptions still to remove

- `App.tsx` still owns a large part of Equipment Registration and is a planned Phase 2 extraction target.
- Equipment List / Detail still have legacy service imports until Phase 2.
- Existing service files remain in `src/services` temporarily; screens migrated to a feature API will not depend on those paths directly.
