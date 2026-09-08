# Equipment Status FAB scroll boundary

The Equipment Status screen must not put the floating add button inside any scrolling ancestor.

Required behavior:
- header stays fixed by `SettingsScaffold`
- the status list owns its own `ScrollView`
- the add-status FAB is a sibling overlay of that list, positioned absolute bottom-right
- the list reserves bottom padding so its last status row can scroll fully above the FAB
- scrolling the list must never move the FAB
