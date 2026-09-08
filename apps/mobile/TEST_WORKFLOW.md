# Mobile test workflow

This file defines the operator-facing test command order after each Mobile code change.

## Goal

Keep the feedback loop fast while preserving a real Android native verification path.

- Web browser is the fastest visual loop for small UI/layout/text changes.
- S22 Ultra Development Build is the source of truth for native behavior: camera, QR scan, image picker, date picker, keyboard, autocomplete, gestures, permissions and real device performance.
- A preview/release-like APK is used separately for final performance checks without Metro overhead.

## Mandatory command order after each Mobile code change

After a Mobile batch is merged and the Mobile lane is fast-forwarded, always give the operator both command blocks below.

### 1. FAST LOOP FIRST — Web on PC

Use this first for screenshots and quick visual review.

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\MOBILE\IATF-16949-Equipment-Management

git branch --show-current
git status
git pull --ff-only origin feat/cmms-workflow-next-mobile
git log -1 --oneline

cd apps\mobile
npm install
npm run web -- --port 8082
```

Open:

```text
http://localhost:8082
```

Use Web for quick checks such as:
- spacing
- typography
- colors
- card density
- navigation structure
- labels/text
- general responsive layout
- screenshots for discussion

Do not use Web as proof for native-only behavior.

### 2. NATIVE LOOP — S22 Ultra Development Build

Use this after the Web check, or immediately when the change affects native behavior.

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\MOBILE\IATF-16949-Equipment-Management

git branch --show-current
git status
git pull --ff-only origin feat/cmms-workflow-next-mobile
git log -1 --oneline

cd apps\mobile
npm install
npm run doctor
npm run start -- --lan --clear
```

Then open the installed **CEV CMMS Development Build** on the S22 Ultra and connect to the Metro QR/LAN URL.

Use the S22 Ultra as the source of truth for:
- keyboard behavior
- autocomplete behavior
- camera
- QR scan
- gallery/image picker
- date picker
- touch and gestures
- permissions
- Android back behavior
- native module compatibility
- real-device responsiveness

## When a new Development Build APK is required

Do **not** rebuild the native APK after every TypeScript/JavaScript/UI change.

Build a new Development Build when a native dependency, Expo config plugin, Android native configuration or native module set changes.

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\MOBILE\IATF-16949-Equipment-Management\apps\mobile
npm install
npm run doctor
npm run build:android:dev
```

After EAS completes, install the resulting APK on the S22 Ultra. If prompted:

```text
Install and run the Android build on an emulator? (Y/n)
```

Choose `n` when the target is the physical S22 Ultra.

## Parallel daily setup

The operator may keep both loops running at the same time:

Terminal A — S22 Ultra Development Build:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\MOBILE\IATF-16949-Equipment-Management\apps\mobile
npm run start -- --lan --clear
```

Terminal B — Web screenshot loop:

```powershell
cd C:\Users\T\Documents\Inventor\zinitek\MOBILE\IATF-16949-Equipment-Management\apps\mobile
npm run web -- --port 8082
```

Expected usage:

```text
Web / localhost:8082
→ fastest UI review + screenshots

S22 Ultra / Development Build
→ native verification
```

## Reporting rule for assistants

After every Mobile code batch:

1. Report `ĐÃ LÀM` and `CHƯA XÁC NHẬN` separately.
2. Wait for the exact Quality Gate HEAD to pass before calling the batch complete.
3. Give the **Web command block first** because it is the fastest feedback loop for small UI changes.
4. Give the **S22 Ultra Development Build command block second** for native verification.
5. If the batch changes native dependencies/configuration, explicitly say that a new Development Build APK is required and include `npm run build:android:dev`.
6. If the batch is JS/TS/UI-only, explicitly say that no APK rebuild is required.
7. Never treat Web verification as equivalent to physical-device native verification.
8. Do not recommend `npm audit fix --force` as part of the normal Mobile test flow.
