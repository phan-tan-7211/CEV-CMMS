# Status FAB architecture

`EquipmentStatusSettingsScreen` opts out of the scaffold ScrollView (`scroll={false}`).

The screen then owns:
- one internal ScrollView for status content
- one absolute-positioned FAB as a sibling of that ScrollView

This prevents the FAB from inheriting scroll movement from `SettingsScaffold` while preserving bottom list padding for action visibility.
