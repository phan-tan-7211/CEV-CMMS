# Equipment feature boundary

All Equipment route screens should consume this feature through `src/features/equipment/index.ts`.

Private implementation lives under:

- `api/` — Supabase-backed equipment, photo, status and registration data operations.
- `model/` — Equipment-specific normalization and suggestion logic.
- `ui/` — Equipment-specific presentation primitives such as `EquipmentPhoto` and `SuggestField`.

The compatibility files under `src/services`, `src/components/EquipmentPhoto.tsx`, `src/equipmentSuggestions.ts`, and `src/SuggestField.tsx` exist only to keep older code stable while the root registration screen is migrated. New route screens must not import them.

Equipment images must preserve the repository image contract: fixed frame, centered, full bitmap visible, aspect ratio preserved, `contain` behavior only.
