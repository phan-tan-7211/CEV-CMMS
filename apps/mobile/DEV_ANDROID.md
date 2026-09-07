# CEV CMMS — Android development build

This app uses Expo SDK 54 + React Native 0.81 + Hermes. The preferred development loop is a native development build (`expo-dev-client`) installed on a real Android device.

## Pull + test after every integrated Mobile batch

Use the following block from PowerShell. It is written so it works even when your current directory is somewhere else:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\WEB\IATF-16949-Equipment-Management

git switch feat/cmms-workflow-next
git status --short
git pull --ff-only origin feat/cmms-workflow-next

cd apps/mobile
npm install
npm run doctor
npm run start -- --clear
```

If Metro is already running, stop it by pressing **Ctrl+C** on the keyboard. Do not type the literal text `Ctrl+C` into PowerShell.

### If `git pull --ff-only` is blocked by local `apps/mobile/app.json`

EAS can modify/link `app.json` locally. Preserve that local change before pulling:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\WEB\IATF-16949-Equipment-Management

git switch feat/cmms-workflow-next
git status --short

git stash push -m "local-eas-app-json" -- apps/mobile/app.json
git pull --ff-only origin feat/cmms-workflow-next
git stash pop

cd apps/mobile
npm install
npm run doctor
```

If `git stash pop` reports a conflict, stop and inspect it. Do not blindly restore `app.json` because that may discard the local EAS project link/configuration.

### When a new native dependency/config/plugin was added

JavaScript Fast Refresh is not enough after native module/config changes. Build and install a fresh development APK:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\WEB\IATF-16949-Equipment-Management\apps\mobile
npm install
npm run doctor
npm run build:android:dev
```

Install the new APK returned by EAS on the physical Android device/emulator. Then run Metro:

```powershell
npm run start -- --clear
```

If the physical phone cannot reach the PC LAN address, use tunnel mode:

```powershell
npm run start:tunnel
```

The Metro QR code is only a **development-client connection QR**. It does not install the APK. Install the APK from the EAS build page first, then scan/connect to Metro.

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
- `expo-image-manipulator`
- `@react-native-community/datetimepicker`
- Hermes
- New Architecture enabled

Camera, gallery, image processing, QR scanning, and native date-picker behavior must still be verified on a physical Android device.
