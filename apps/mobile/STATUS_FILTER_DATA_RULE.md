# Equipment status filter data rule

Equipment List status filters must be derived from the status values that actually exist in the loaded `equipment_master` dataset.

Rules:
- Never invent synthetic status options to imitate a reference screenshot.
- The menu always includes `Tất cả (mặc định)` plus the distinct non-empty status values currently present in data.
- If a new status value is added to `equipment_master`, it appears automatically in the menu after the list reloads/refreshes.
- Selecting a status filters by that exact status value (case-insensitive normalization only).
- Reference screenshots are for interaction/layout behavior, not for hard-coded business data.
