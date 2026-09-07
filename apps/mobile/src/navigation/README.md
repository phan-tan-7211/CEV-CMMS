# Mobile navigation ownership

`MobileShell.tsx` is the top-level native navigation/session boundary for the current Expo app. It decides which screen is visible and keeps Android hardware Back behavior predictable.

The shell should stay lightweight: session readiness, route selection and screen transitions only. Business data loading belongs in feature services/hooks, not in the navigation shell.
