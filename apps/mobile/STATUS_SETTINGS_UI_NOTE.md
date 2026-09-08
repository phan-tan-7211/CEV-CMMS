# Equipment Status Settings interaction rules

- `Thêm trạng thái mới` must live in normal document flow. Do not use a floating CTA that can cover row actions.
- Edit/Delete controls are explicit 44x44 touch targets.
- Delete confirmation must use an in-app modal so the flow works consistently on Expo Web and native builds; do not rely on `Alert.alert` for the destructive confirmation.
- Locked statuses remain read-only when `usageCount > 0`.
- Status rows are rendered as one bordered table/card with Status, Usage and Action columns so action ownership stays visually clear.
