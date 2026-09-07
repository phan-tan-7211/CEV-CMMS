# Web render requirement

Expo Web renders the native mobile shell in the browser for fast UI review and screenshots.

`react-native-safe-area-context` must be provided at the app root with `SafeAreaProvider`. Mobile screens use `SafeAreaView`; without the provider, browser rendering may fail before the screen becomes visible.

The app entrypoint owns this provider so all current and future screens inherit the same safe-area context on Android, iOS, and Web.
