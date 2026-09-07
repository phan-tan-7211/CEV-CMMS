# CEV CMMS — Android development build

This app uses Expo SDK 54 + React Native 0.81 + Hermes. The preferred development loop is a native development build (`expo-dev-client`) installed on a real Android device.

## Standard command after every integrated Mobile pull

When a new Mobile batch has been merged into `feat/cmms-workflow-next`, use this exact PowerShell block from any current folder:

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

Then, while Metro is running:

- press `a` to open the Android emulator/device, or
- open the already-installed **CEV CMMS** development build on the Android device.

Do **not** type the text `Ctrl+C` into PowerShell. To stop Metro, physically press the **Ctrl** key and the **C** key together.

### If `git pull` is blocked by a local `apps/mobile/app.json` change

EAS setup/build can leave a local `apps/mobile/app.json` modification. Do not blindly discard it because it may contain the local EAS project link.

Use:

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
npm run start -- --clear
```

If `git stash pop` reports a conflict in `apps/mobile/app.json`, stop there and resolve the EAS-local fields together with the newest repository `app.json` before running Metro or rebuilding Android. Do not force-reset the file.

## When a new native dependency/config plugin was added

JavaScript/TypeScript/UI-only changes do not require a new APK. Native-module/config changes do.

After pulling a batch that changes native dependencies, Expo plugins, Android permissions, `app.json`, or native build settings, run:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\WEB\IATF-16949-Equipment-Management\apps\mobile
npm install
npm run doctor
npm run build:android:dev
```

Install the newly returned development APK once. After that, normal testing returns to:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\WEB\IATF-16949-Equipment-Management\apps\mobile
npm run start -- --clear
```

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
- `@react-native-community/datetimepicker`
- Hermes
- New Architecture enabled

Camera, gallery and date-picker native behavior must still be verified on a real Android device.
