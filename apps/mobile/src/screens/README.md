# Native Mobile screen boundaries

CEV Mobile follows a screen-oriented React Native structure inspired by mature CMMS apps while keeping CEV business logic and code independent.

Current boundaries:

- `HomeScreen.tsx` — compact dashboard and global entry points
- `LoginScreen.tsx` — authentication UI
- `EquipmentRegistrationScreen.tsx` — registration route boundary
- `EquipmentListScreen.tsx` — equipment module boundary
- `ScanAssetScreen.tsx` — QR/camera module boundary
- `WorkOrdersScreen.tsx` — work-order module boundary
- `NotificationsScreen.tsx` — notifications module boundary
- `MoreScreen.tsx` — secondary modules/settings boundary

`navigation/MobileShell.tsx` owns session readiness and top-level native routes. Data access remains in services/repositories such as `supabase.ts`; presentation screens should not duplicate business rules.
