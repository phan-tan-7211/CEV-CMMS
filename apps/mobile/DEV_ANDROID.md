# CEV CMMS — Android development build

This app uses Expo SDK 54 + React Native 0.81 + Hermes. The preferred development loop is a native development build (`expo-dev-client`) installed on a real Android device.

## First-time setup on the PC

From the repository root:

```powershell
git pull origin feat/cmms-workflow-next
cd apps/mobile
npm install
npm run doctor
```

`npm run doctor` must pass before creating a native build.

## Option A — EAS cloud APK (recommended on Windows)

Login and link/create the Expo EAS project once:

```powershell
cd apps/mobile
npx eas-cli@latest login
npm run eas:init
```

Create the installable development APK:

```powershell
npm run build:android:dev
```

The `development` profile in `eas.json` sets `developmentClient: true`, internal distribution, and Android `apk` output. Install the returned APK on the Android phone.

After the APK is installed, normal day-to-day development only needs Metro:

```powershell
npm run start
```

Open **CEV CMMS** on the phone and connect it to the Metro server. JavaScript/TypeScript/UI changes use Fast Refresh and do not require rebuilding the APK.

If LAN discovery does not work:

```powershell
npm run start:tunnel
```

Rebuild the APK only after adding/changing native modules, config plugins, Android permissions, app config, or native build settings.

## Option B — USB + local Android build

Requires Android Studio / Android SDK and USB debugging enabled on the phone.

Verify the phone:

```powershell
adb devices
```

Then install directly:

```powershell
cd apps/mobile
npm run android:device
```

After the first native install, use `npm run start` for the normal Fast Refresh loop.

## Expo Go fallback

Expo Go is only for quick UI checks. It is not the release-quality test environment for CEV camera/QR/native behavior.

```powershell
npm run start:go
```

## Current native packages prepared

- `expo-dev-client`
- `expo-camera`
- `expo-image-picker`
- Hermes
- New Architecture enabled

Camera and gallery permissions are declared in `app.json`. Physical Android camera/QR behavior must still be verified on a real device.
