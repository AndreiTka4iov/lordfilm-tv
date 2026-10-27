# Release preparation

The package and Android app currently use version `0.3.0` (`versionCode = 3`). The published README download still points to Preview 1; update the link only after a new release exists.

## Validate locally

```sh
npm ci
npm run check
npm run test:e2e
npm run build
npm run build:export
npm run test:android:web
cd android
./gradlew checkKotlinFormat testDebugUnitTest lintDebug verifyDebugWebAssets verifyReleaseWebAssets
```

Run these commands sequentially: web builds share generated types, and the browser and Android web suites share their output directory. Android preparation must run after ordinary static export so the APK receives the native TV viewport and in-process transport.

Both APK checks inspect packaged web assets, including `_next`, instead of checking compilation alone. CI retains debug and unsigned release artifacts separately.

## Package and publish

1. Choose the release version and increment `android/app/build.gradle.kts` versionCode for an update. Keep versionName and package.json/package-lock.json versions aligned.
2. Build the release candidate with the checks above. The release APK is `android/app/build/outputs/apk/release/app-release-unsigned.apk`.
3. Sign with the permanent release key using Android SDK `apksigner`, verify the signature, and record the signed APK SHA-256. Keep keystores and credentials outside Git. The debug package (`tv.lordfilm.app.debug`) and release package (`tv.lordfilm.app`) are separate apps.
4. Smoke-test the signed APK on a supported TV device: launch, arrows/OK/Back, sidebar return, current-year new releases, search, series selection, resume, and cold restart.
5. Publish the signed APK with release notes and checksum; update the README download link and version text to that exact release.

Builds and CI checks do not publish a release or install an APK on a device. The current preview download and chosen README screenshot should remain available until they are deliberately replaced.
